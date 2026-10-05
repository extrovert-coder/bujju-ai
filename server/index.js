import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import multer from 'multer'
import { PDFParse } from 'pdf-parse'

// Ensure .env is loaded from project root
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const PORT = process.env.PORT || 5000

// Security headers with Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

// CORS configuration supporting FRONTEND_URL in production, localhost in development
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true)
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true)
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error('Blocked by CORS policy'))
    },
    credentials: true,
  }),
)

// Request size limits (10 MB maximum request payload)
app.use(express.json({ limit: '10mb' }))

// Rate limiting: general limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again in a few minutes.',
  },
})

// Stricter limiter for AI generation / image analysis / upload endpoints
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 40, // limit each IP to 40 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI generation limit reached. Please wait a moment before sending another request.',
  },
})

app.use('/api/', apiLimiter)
app.use('/api/chat', aiLimiter)
app.use('/api/search', aiLimiter)
app.use('/api/images/analyze', aiLimiter)
app.use('/api/files/upload', aiLimiter)

// Multer memory storage with 10 MB maximum file size
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
})

// Active Gemini models list with ultra-fast models prioritized and instant failover
const GEMINI_CANDIDATE_MODELS = [
  (process.env.GEMINI_MODEL || 'gemini-3.6-flash').replace(/^models\//, ''),
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
].filter((m, i, arr) => m && arr.indexOf(m) === i)

let activeGeminiModel = GEMINI_CANDIDATE_MODELS[0]

// Gemini system instruction to produce the best, Google Gemini-caliber output
const GEMINI_SYSTEM_INSTRUCTION = `You are Bujju AI, a world-class AI assistant powered by Google Gemini technology.
Your mission is to provide the best output possible—insightful, clear, brilliantly reasoned, and beautifully formatted like Google Gemini.

Output Formatting & Quality Standards:
1. Formatting:
   - Use clean Markdown with headers (## and ###) for distinct sections.
   - Use bullet points, numbered lists, and bold text for key terms to make answers effortless to scan and read.
   - When writing code, ALWAYS use markdown code fences with the language identifier (e.g., \`\`\`javascript, \`\`\`python, \`\`\`html, \`\`\`sql). Ensure all code is clean, idiomatic, and production-ready.
   - Use blockquotes (>) for tips, cautions, or important highlights.
   - Use Markdown tables when comparing items or displaying structured data.
2. Tone & Quality:
   - Provide direct, high-value, and accurate answers.
   - Be helpful, conversational, insightful, and concise without unhelpful fluff or repetitive disclaimers.
   - Maintain multi-turn conversational context seamlessly.`

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseKey) &&
  supabaseUrl !== 'your_supabase_url' &&
  supabaseKey !== 'your_supabase_anon_key' &&
  supabaseUrl.startsWith('http')

// Function to get a Supabase client scoped with the user's JWT access token
// This guarantees that PostgREST executes queries with the authenticated role
// and auth.uid() matching the user's UUID, satisfying Row Level Security (RLS)
function getScopedSupabase(token) {
  if (!isSupabaseConfigured) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  })
}

// In-memory fallback store with user isolation for offline/mock development
const localStore = {
  conversations: [],
  messages: [],
  files: [],
}

// Helper: UUID format verification
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str.trim())
}

// Helper: Extract and verify authenticated user from request
async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization
  const headerUserId = req.headers['x-user-id']

  let token = null
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace(/^Bearer\s+/i, '').trim()
  }

  // 1. Verify token with Supabase Auth if Supabase is configured
  if (isSupabaseConfigured) {
    if (!token || token === 'undefined' || token === 'null') {
      // In production/supabase mode, require valid token
      if (headerUserId && process.env.NODE_ENV !== 'production') {
        const cleanId = headerUserId.trim()
        return { user: { id: cleanId, email: `${cleanId}@example.com` }, token: null, scopedClient: null }
      }
      return { user: null, token: null, scopedClient: null }
    }

    try {
      const scopedClient = getScopedSupabase(token)
      const {
        data: { user },
        error,
      } = await scopedClient.auth.getUser(token)

      if (user && !error) {
        return { user, token, scopedClient }
      }
      return { user: null, token: null, scopedClient: null }
    } catch (err) {
      console.warn('[Bujju AI Backend] Supabase token check notice:', err.message)
      return { user: null, token: null, scopedClient: null }
    }
  }

  // 2. Offline fallback ONLY when Supabase is completely NOT configured
  if (token && token.startsWith('user_')) {
    return { user: { id: token, email: `${token}@example.com` }, token, scopedClient: null }
  }

  if (headerUserId && typeof headerUserId === 'string' && headerUserId.trim()) {
    const cleanId = headerUserId.trim()
    return { user: { id: cleanId, email: `${cleanId}@example.com` }, token: null, scopedClient: null }
  }

  return { user: null, token: null, scopedClient: null }
}

// Helper: Generate clean, concise conversation title from first prompt
function generateTitle(text) {
  if (!text || typeof text !== 'string') return 'New Chat'
  let cleaned = text
    .replace(/^(can you|please|could you|explain|what is|how to|tell me about|help me with)\s+/i, '')
    .trim()
  if (!cleaned) cleaned = text.trim()
  const words = cleaned.split(/\s+/).slice(0, 5)
  let title = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  if (title.length > 28) {
    title = title.slice(0, 28).trim() + '...'
  }
  return title || 'New Chat'
}

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Bujju AI API is running',
  })
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
  })
})

// ----------------------------------------------------
// FILE UPLOAD & MANAGEMENT ENDPOINTS
// ----------------------------------------------------

// 1. POST /api/files/upload - Secure file upload (PDF and TXT up to 10 MB)
app.post('/api/files/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File is too large. Maximum size is 10 MB.',
        })
      }
      return res.status(400).json({
        error: err.message || 'File upload failed.',
      })
    }

    try {
      // 1. Check authentication
      const { user, scopedClient } = await getAuthenticatedUser(req)
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized. Please sign in to upload files.',
        })
      }

      // 2. Validate file existence
      if (!req.file) {
        return res.status(400).json({
          error: 'No PDF selected. Please choose a PDF file to upload.',
        })
      }

      const originalname = req.file.originalname || 'document.pdf'
      const ext = path.extname(originalname).toLowerCase()

      // 3. Validate file type (PDF only)
      if (ext !== '.pdf') {
        return res.status(400).json({
          error: 'Invalid file type. Only PDF files are supported.',
        })
      }

      // 4. Validate file size
      if (!req.file.size || req.file.size === 0) {
        return res.status(400).json({
          error: 'The uploaded file is empty.',
        })
      }

      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({
          error: 'File larger than 10 MB. Maximum size is 10 MB.',
        })
      }

      // 5. Process PDF file: PDF text extraction
      let extractedText = ''
      try {
        const parser = new PDFParse({ data: req.file.buffer })
        const result = await parser.getText()
        const rawText = result?.text || ''
        // Strip out page headers/footers like "-- 1 of 5 --" to check for actual textual content
        const cleanText = rawText.replace(/-- \d+ of \d+ --/g, '').trim()
        if (!cleanText) {
          return res.status(400).json({
            error: 'PDF extraction error: This PDF appears to be a scanned or image-only document without extractable text.',
          })
        }
        extractedText = rawText.trim()
      } catch (pdfErr) {
        console.error('[Bujju AI Backend] PDF parsing error:', pdfErr)
        return res.status(400).json({
          error: 'PDF extraction error: Failed to extract text from the PDF file. Please ensure the PDF is valid.',
        })
      }

      // 6. Store file record
      const fileId = randomUUID()
      const now = new Date().toISOString()
      const fileRecord = {
        id: fileId,
        user_id: user.id,
        filename: originalname,
        file_type: ext,
        file_size: req.file.size,
        extracted_text: extractedText,
        created_at: now,
      }

      if (scopedClient) {
        const { error: dbErr } = await scopedClient
          .from('files')
          .insert([fileRecord])

        if (dbErr) {
          console.warn('[Bujju AI Backend] Supabase files insert notice:', dbErr.message)
        }
      }

      localStore.files.unshift(fileRecord)

      return res.status(200).json({
        success: true,
        file_id: fileId,
        filename: originalname,
        file_size: req.file.size,
        file_type: ext,
        message: 'File uploaded and processed successfully.',
      })
    } catch (uploadErr) {
      console.error('[Bujju AI Backend] File upload handling error:', uploadErr)
      return res.status(500).json({
        error: uploadErr.message || 'An unexpected error occurred during file upload.',
      })
    }
  })
})

// 2. GET /api/files/:id - Get file metadata (scoped to user)
app.get('/api/files/:id', async (req, res) => {
  const { id } = req.params

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid file ID format.' })
  }

  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }

    if (scopedClient) {
      const { data, error } = await scopedClient
        .from('files')
        .select('id, filename, file_type, file_size, created_at')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (!error && data) {
        return res.status(200).json(data)
      }
    }

    const localFile = localStore.files.find((f) => f.id === id && f.user_id === user.id)
    if (!localFile) {
      return res.status(404).json({ error: 'File not found or access denied.' })
    }

    return res.status(200).json({
      id: localFile.id,
      filename: localFile.filename,
      file_type: localFile.file_type,
      file_size: localFile.file_size,
      created_at: localFile.created_at,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch file.' })
  }
})

// 3. DELETE /api/files/:id - Delete file (scoped to user)
app.delete('/api/files/:id', async (req, res) => {
  const { id } = req.params

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid file ID format.' })
  }

  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }

    if (scopedClient) {
      await scopedClient.from('files').delete().eq('id', id).eq('user_id', user.id)
    }

    localStore.files = localStore.files.filter((f) => !(f.id === id && f.user_id === user.id))
    return res.status(200).json({ success: true, message: 'File deleted.' })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to delete file.' })
  }
})

// ----------------------------------------------------
// DEDICATED WEB SEARCH ENDPOINT
// ----------------------------------------------------

// POST /api/search - Authenticated Web Search query endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { user } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in to use web search.' })
    }

    const rawQuery = (req.body?.query || req.body?.message || '').trim()
    if (!rawQuery) {
      return res.status(400).json({ error: 'Search query cannot be empty.' })
    }
    if (rawQuery.length > 500) {
      return res.status(400).json({ error: 'Search query exceeds maximum length of 500 characters.' })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'AI service is temporarily unavailable.' })
    }

    const ai = new GoogleGenAI({ apiKey })
    let replyText = ''
    let sources = []

    try {
      const response = await ai.models.generateContent({
        model: activeGeminiModel,
        contents: `You are Bujju AI with web search capabilities. Answer the following search query with clear, accurate, and up-to-date facts:\n\n${rawQuery}`,
        config: { tools: [{ googleSearch: {} }] },
      })
      replyText = response?.text || ''
      const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks
      if (Array.isArray(chunks)) {
        sources = chunks
          .map((c) => (c.web?.uri ? { title: c.web.title || c.web.uri, url: c.web.uri } : null))
          .filter(Boolean)
      }
    } catch {
      // Fallback without search tool if search tool limit reached
      const fallbackRes = await ai.models.generateContent({
        model: activeGeminiModel,
        contents: `You are Bujju AI. Answer the following search query clearly and factually:\n\n${rawQuery}`,
      })
      replyText = fallbackRes?.text || ''
    }

    return res.status(200).json({
      success: true,
      query: rawQuery,
      answer: replyText,
      sources,
    })
  } catch (err) {
    console.error('[Bujju AI Backend] Search endpoint error:', err.message)
    return res.status(500).json({ error: 'Web search is temporarily unavailable. Please try again.' })
  }
})

// ----------------------------------------------------
// IMAGE UNDERSTANDING ENDPOINTS (STEP 7)
// ----------------------------------------------------

// POST /api/images/analyze - Analyze uploaded image with Google Gemini Vision
app.post('/api/images/analyze', (req, res) => {
  upload.any()(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'Image is too large. Maximum size is 10 MB.',
        })
      }
      return res.status(400).json({
        error: err.message || 'Image upload failed.',
      })
    }

    try {
      // 1. Check authentication
      const { user, scopedClient } = await getAuthenticatedUser(req)
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized. Please sign in to analyze images.',
        })
      }

      // 2. Validate image file existence
      const uploadedFile =
        req.files?.find((f) => f.fieldname === 'image' || f.fieldname === 'file') ||
        req.files?.[0]

      if (!uploadedFile) {
        return res.status(400).json({
          error: 'No image selected. Please choose an image to upload.',
        })
      }

      // 3. Validate image size
      if (!uploadedFile.size || uploadedFile.size === 0) {
        return res.status(400).json({
          error: 'The uploaded image is empty.',
        })
      }

      if (uploadedFile.size > 10 * 1024 * 1024) {
        return res.status(400).json({
          error: 'Image is too large. Maximum size is 10 MB.',
        })
      }

      // 4. Validate image type (.jpg, .jpeg, .png, .webp)
      const originalname = uploadedFile.originalname || 'image.jpg'
      const ext = path.extname(originalname).toLowerCase()
      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp']
      if (!allowedExts.includes(ext)) {
        return res.status(400).json({
          error: 'Invalid file type. Only JPG, JPEG, PNG, and WEBP images are supported.',
        })
      }

      let mimeType = uploadedFile.mimetype
      if (!mimeType || mimeType === 'application/octet-stream') {
        if (ext === '.png') mimeType = 'image/png'
        else if (ext === '.webp') mimeType = 'image/webp'
        else mimeType = 'image/jpeg'
      }

      // 5. Extract and validate user question / prompt
      const rawMessage = (req.body?.message || '').trim()
      if (rawMessage.length > 20000) {
        return res.status(400).json({
          error: 'Question is too long. Maximum allowed length is 20,000 characters.',
        })
      }
      const message = rawMessage || 'What is in this image?'
      let conversationId = req.body?.conversation_id || req.body?.conversationId || null
      if (conversationId && !isValidUUID(conversationId)) {
        return res.status(400).json({
          error: 'Invalid conversation ID format.',
        })
      }

      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
        return res.status(500).json({
          error:
            process.env.NODE_ENV === 'production'
              ? 'AI service is temporarily unavailable.'
              : 'Gemini API key is missing or not configured. Please set your GEMINI_API_KEY in the .env file.',
        })
      }

      const now = new Date().toISOString()
      let currentTitle = 'Image Analysis'

      // 6. Manage conversation in Supabase or local store
      if (!conversationId) {
        conversationId = randomUUID()
        currentTitle = generateTitle(message) || 'Image Analysis'

        const newConv = {
          id: conversationId,
          user_id: user.id,
          title: currentTitle,
          created_at: now,
          updated_at: now,
        }

        if (scopedClient) {
          const { error: convErr } = await scopedClient.from('conversations').insert([newConv])
          if (convErr) {
            console.warn('[Bujju AI Backend] Supabase insert image conversation notice:', convErr.message)
          }
        }
        localStore.conversations.unshift(newConv)
      } else {
        // Fetch or verify existing title
        let foundTitle = null
        if (scopedClient) {
          const { data: conv } = await scopedClient
            .from('conversations')
            .select('title')
            .eq('id', conversationId)
            .eq('user_id', user.id)
            .single()
          if (conv) foundTitle = conv.title
        }
        if (!foundTitle) {
          const localConv = localStore.conversations.find(
            (c) => c.id === conversationId && c.user_id === user.id,
          )
          if (localConv) foundTitle = localConv.title
        }
        currentTitle = foundTitle || generateTitle(message)
      }

      // 7. Save user message to database / history (metadata attached, no base64 in DB)
      const userMsgId = randomUUID()
      const userMessageContent = `[Image attached: ${originalname}]\n${message}`

      if (scopedClient) {
        const { error: msgErr } = await scopedClient.from('messages').insert([
          {
            id: userMsgId,
            conversation_id: conversationId,
            role: 'user',
            content: userMessageContent,
            created_at: now,
          },
        ])
        if (msgErr) console.warn('[Bujju AI Backend] Supabase user image msg notice:', msgErr.message)
      }

      localStore.messages.push({
        id: userMsgId,
        conversation_id: conversationId,
        role: 'user',
        content: userMessageContent,
        created_at: now,
      })

      // 8. Call Gemini Vision API
      const ai = new GoogleGenAI({ apiKey })
      let currentModel = activeGeminiModel

      const systemInstruction = `You are Bujju AI, a helpful, intelligent AI assistant.
Analyze the user's uploaded image and answer their question accurately.
- If the user asks what is in the image or to explain/describe it, provide a clear, accurate, and structured explanation.
- If the user asks to read, transcribe, or extract text from the image, extract all visible text as accurately as possible.
- If the image is unclear, blurry, corrupt, or you cannot interpret what is in it, respond strictly with:
"I can't clearly understand the image. Please upload a clearer image."
- Do NOT invent, assume, or hallucinate details that are not visible in the image.`

      const base64Data = uploadedFile.buffer.toString('base64')
      const contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `${systemInstruction}\n\nUser Question: ${message}`,
            },
          ],
        },
      ]

      let response
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: currentModel,
            contents,
          })
          break
        } catch (err) {
          const isQuota =
            err.status === 429 ||
            err.message?.includes('RESOURCE_EXHAUSTED') ||
            err.message?.includes('Quota exceeded') ||
            err.message?.toLowerCase().includes('quota')

          const isHighDemand =
            err.status === 503 ||
            err.message?.includes('503') ||
            err.message?.includes('UNAVAILABLE') ||
            err.message?.toLowerCase().includes('high demand') ||
            err.message?.toLowerCase().includes('overloaded')

          const currentIdx = GEMINI_CANDIDATE_MODELS.indexOf(currentModel)
          const nextModel =
            currentIdx !== -1 && currentIdx < GEMINI_CANDIDATE_MODELS.length - 1
              ? GEMINI_CANDIDATE_MODELS[currentIdx + 1]
              : (currentIdx !== 0 ? GEMINI_CANDIDATE_MODELS[0] : null)

          if ((isQuota || isHighDemand) && nextModel && nextModel !== currentModel) {
            console.log(
              `[Bujju AI Backend] Vision model ${currentModel} busy/exhausted, immediately switching to ${nextModel}...`,
            )
            activeGeminiModel = nextModel
            currentModel = nextModel
            continue
          }

          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 300))
          } else {
            throw err
          }
        }
      }

      const replyText = response?.text
      if (!replyText) {
        return res.status(500).json({
          error: 'Received an empty response from Gemini model.',
        })
      }

      // 9. Save AI response to messages and update conversation
      const aiNow = new Date().toISOString()
      const aiMsgId = randomUUID()

      if (scopedClient) {
        const { error: aiMsgErr } = await scopedClient.from('messages').insert([
          {
            id: aiMsgId,
            conversation_id: conversationId,
            role: 'ai',
            content: replyText,
            created_at: aiNow,
          },
        ])
        if (aiMsgErr) {
          console.warn('[Bujju AI Backend] Supabase ai image msg notice:', aiMsgErr.message)
        }

        await scopedClient
          .from('conversations')
          .update({ title: currentTitle, updated_at: aiNow })
          .eq('id', conversationId)
          .eq('user_id', user.id)
      }

      localStore.messages.push({
        id: aiMsgId,
        conversation_id: conversationId,
        role: 'ai',
        content: replyText,
        created_at: aiNow,
      })

      const localConv = localStore.conversations.find(
        (c) => c.id === conversationId && c.user_id === user.id,
      )
      if (localConv) {
        localConv.title = currentTitle
        localConv.updated_at = aiNow
      }

      return res.status(200).json({
        success: true,
        reply: replyText,
        conversation_id: conversationId,
        title: currentTitle,
        image_name: originalname,
      })
    } catch (uploadErr) {
      console.error('[Bujju AI Backend] Image analysis error:', uploadErr)
      return res.status(500).json({
        error: uploadErr.message || 'An unexpected error occurred during image analysis.',
      })
    }
  })
})

// ----------------------------------------------------
// CONVERSATIONS & CHAT ENDPOINTS
// ----------------------------------------------------

// 4. GET /api/conversations - List conversations for the authenticated user only
app.get('/api/conversations', async (req, res) => {
  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }

    if (scopedClient) {
      const { data, error } = await scopedClient
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (!error && Array.isArray(data)) {
        return res.status(200).json(data)
      }
      if (error) {
        console.error('[Bujju AI Backend] Supabase conversations error:', error.message)
      }
    }

    // Local fallback store filtered by user_id
    const userConversations = localStore.conversations
      .filter((c) => c.user_id === user.id)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))

    return res.status(200).json(userConversations)
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch conversations.' })
  }
})

// 5. POST /api/conversations - Create a new conversation for the authenticated user
app.post('/api/conversations', async (req, res) => {
  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }

    const title = req.body?.title || 'New Chat'
    const fileId = req.body?.file_id || null
    const fileName = req.body?.file_name || null
    const now = new Date().toISOString()
    const newId = randomUUID()

    const convRecord = {
      id: newId,
      user_id: user.id,
      title,
      file_id: fileId,
      file_name: fileName,
      created_at: now,
      updated_at: now,
    }

    if (scopedClient) {
      const { data, error } = await scopedClient
        .from('conversations')
        .insert([convRecord])
        .select()
        .single()

      if (error && (error.message?.includes('schema cache') || error.message?.includes('file_id'))) {
        const { data: fallbackData } = await scopedClient
          .from('conversations')
          .insert([{ id: newId, user_id: user.id, title, created_at: now, updated_at: now }])
          .select()
          .single()
        if (fallbackData) return res.status(201).json(fallbackData)
      } else if (!error && data) {
        return res.status(201).json(data)
      } else if (error) {
        console.error('[Bujju AI Backend] Supabase create conversation error:', error.message)
      }
    }

    // Local fallback
    localStore.conversations.unshift(convRecord)
    return res.status(201).json(convRecord)
  } catch (error) {
    console.error('Error creating conversation:', error)
    return res.status(500).json({ error: error.message || 'Failed to create conversation.' })
  }
})

// 6. GET /api/conversations/:id - Get conversation messages and attached file reference
app.get('/api/conversations/:id', async (req, res) => {
  const { id } = req.params

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid conversation ID format.' })
  }

  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }

    if (scopedClient) {
      const { data: conversation, error: convError } = await scopedClient
        .from('conversations')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (!convError && conversation) {
        const { data: messages, error: msgError } = await scopedClient
          .from('messages')
          .select('*')
          .eq('conversation_id', id)
          .order('created_at', { ascending: true })

        if (!msgError) {
          return res.status(200).json({
            conversation,
            messages: messages || [],
          })
        }
      }
    }

    // Local fallback
    const conversation = localStore.conversations.find((c) => c.id === id && c.user_id === user.id)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found or access denied.' })
    }

    const messages = localStore.messages
      .filter((m) => m.conversation_id === id)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    return res.status(200).json({
      conversation,
      messages,
    })
  } catch (error) {
    console.error('Error fetching conversation messages:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch conversation.' })
  }
})

// 7. POST /api/conversations/:id/detach-file - Remove attached file reference from conversation
app.post('/api/conversations/:id/detach-file', async (req, res) => {
  const { id } = req.params

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid conversation ID format.' })
  }

  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }

    if (scopedClient) {
      await scopedClient
        .from('conversations')
        .update({ file_id: null, file_name: null })
        .eq('id', id)
        .eq('user_id', user.id)
    }

    const localConv = localStore.conversations.find((c) => c.id === id && c.user_id === user.id)
    if (localConv) {
      localConv.file_id = null
      localConv.file_name = null
    }

    return res.status(200).json({ success: true, message: 'File detached from conversation.' })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to detach file.' })
  }
})

// 8. DELETE /api/conversations/:id - Delete conversation (scoped to user)
app.delete('/api/conversations/:id', async (req, res) => {
  const { id } = req.params

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid conversation ID format.' })
  }

  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }

    if (scopedClient) {
      const { error } = await scopedClient
        .from('conversations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (!error) {
        return res.status(200).json({ success: true, message: 'Conversation deleted.' })
      }
    }

    // Local fallback
    localStore.conversations = localStore.conversations.filter(
      (c) => !(c.id === id && c.user_id === user.id),
    )
    localStore.messages = localStore.messages.filter((m) => m.conversation_id !== id)
    return res.status(200).json({ success: true, message: 'Conversation deleted.' })
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return res.status(500).json({ error: error.message || 'Failed to delete conversation.' })
  }
})

// 9. POST /api/chat - Main chat handler with user authentication, file context & Gemini
app.post('/api/chat', async (req, res) => {
  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }

    const rawMessage =
      req.body?.message ||
      (Array.isArray(req.body?.messages)
        ? req.body.messages[req.body.messages.length - 1]?.content
        : null)

    if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
      return res.status(400).json({
        error: 'A non-empty "message" string is required.',
      })
    }

    const message = rawMessage.trim()
    if (message.length > 20000) {
      return res.status(400).json({
        error: 'Message is too long. Maximum allowed length is 20,000 characters.',
      })
    }

    let conversationId = req.body?.conversation_id || req.body?.conversationId || null
    if (conversationId && !isValidUUID(conversationId)) {
      return res.status(400).json({
        error: 'Invalid conversation ID format.',
      })
    }

    let fileId = req.body?.file_id || req.body?.fileId || null
    if (fileId && !isValidUUID(fileId)) {
      return res.status(400).json({
        error: 'Invalid file ID format.',
      })
    }

    const isWebSearch = Boolean(req.body?.webSearch)
    let attachedFile = null

    // Check if user passed fileId or if existing conversation already has a file
    if (fileId) {
      if (scopedClient) {
        const { data: fData } = await scopedClient
          .from('files')
          .select('*')
          .eq('id', fileId)
          .eq('user_id', user.id)
          .single()
        if (fData) attachedFile = fData
      }
      if (!attachedFile) {
        attachedFile = localStore.files.find((f) => f.id === fileId && f.user_id === user.id) || null
      }
    } else if (conversationId) {
      let existingFileId = null
      if (scopedClient) {
        const { data: convData } = await scopedClient
          .from('conversations')
          .select('file_id')
          .eq('id', conversationId)
          .eq('user_id', user.id)
          .single()
        if (convData?.file_id) existingFileId = convData.file_id
      }
      if (!existingFileId) {
        const localConv = localStore.conversations.find((c) => c.id === conversationId && c.user_id === user.id)
        if (localConv?.file_id) existingFileId = localConv.file_id
      }

      if (existingFileId) {
        fileId = existingFileId
        if (scopedClient) {
          const { data: fData } = await scopedClient
            .from('files')
            .select('*')
            .eq('id', existingFileId)
            .eq('user_id', user.id)
            .single()
          if (fData) attachedFile = fData
        }
        if (!attachedFile) {
          attachedFile = localStore.files.find((f) => f.id === existingFileId && f.user_id === user.id) || null
        }
      }
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
      return res.status(500).json({
        error:
          process.env.NODE_ENV === 'production'
            ? 'AI service is temporarily unavailable.'
            : 'Gemini API key is missing or not configured. Please set your GEMINI_API_KEY in the .env file.',
      })
    }

    const now = new Date().toISOString()
    let currentTitle = 'New Chat'

    // Step 1: Ensure valid conversation exists for this user or create one
    if (!conversationId) {
      conversationId = randomUUID()
      currentTitle = generateTitle(message)

      const newConv = {
        id: conversationId,
        user_id: user.id,
        title: currentTitle,
        file_id: attachedFile?.id || null,
        file_name: attachedFile?.filename || null,
        created_at: now,
        updated_at: now,
      }

      if (scopedClient) {
        const { error } = await scopedClient.from('conversations').insert([newConv])
        if (error) {
          if (error.message?.includes('schema cache') || error.message?.includes('file_id')) {
            await scopedClient.from('conversations').insert([{
              id: conversationId,
              user_id: user.id,
              title: currentTitle,
              created_at: now,
              updated_at: now,
            }])
          } else {
            console.error('[Bujju AI Backend] Failed to insert conversation in Supabase:', error.message)
          }
        }
      }

      localStore.conversations.unshift(newConv)
    } else {
      // Check existing conversation title
      let foundTitle = null
      if (scopedClient) {
        const { data: conv } = await scopedClient
          .from('conversations')
          .select('title')
          .eq('id', conversationId)
          .eq('user_id', user.id)
          .single()
        if (conv) foundTitle = conv.title
      }

      if (!foundTitle) {
        const localConv = localStore.conversations.find(
          (c) => c.id === conversationId && c.user_id === user.id,
        )
        if (localConv) foundTitle = localConv.title
      }

      if (foundTitle) {
        currentTitle = foundTitle
        if (foundTitle === 'New Chat') {
          currentTitle = generateTitle(message)
        }
      } else {
        currentTitle = generateTitle(message)
      }
    }

    // Step 2: Save user message
    const userMsgId = randomUUID()
    if (scopedClient) {
      const { error: userMsgErr } = await scopedClient.from('messages').insert([
        {
          id: userMsgId,
          conversation_id: conversationId,
          role: 'user',
          content: message,
          created_at: now,
        },
      ])
      if (userMsgErr) {
        console.error('[Bujju AI Backend] Failed to save user message in Supabase:', userMsgErr.message)
      }
    }

    localStore.messages.push({
      id: userMsgId,
      conversation_id: conversationId,
      role: 'user',
      content: message,
      created_at: now,
    })

    // Step 3: Call Google Gemini API with streaming and fast failover
    const ai = new GoogleGenAI({ apiKey })
    const wantsStream = Boolean(req.body?.stream || req.headers.accept?.includes('text/event-stream'))

    // Fetch recent conversation history for multi-turn context
    let history = []
    if (scopedClient && conversationId) {
      try {
        const { data: pastMsgs } = await scopedClient
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(8)
        if (pastMsgs && pastMsgs.length > 0) {
          history = pastMsgs.reverse()
        }
      } catch (hErr) {
        console.warn('[Bujju AI Backend] Could not fetch past messages:', hErr.message)
      }
    } else if (conversationId) {
      const localPast = localStore.messages
        .filter((m) => m.conversation_id === conversationId && m.id !== userMsgId)
        .slice(-8)
      if (localPast.length > 0) {
        history = localPast.map((m) => ({ role: m.role, content: m.content }))
      }
    }

    let systemInstruction = GEMINI_SYSTEM_INSTRUCTION
    let promptContents = message

    if (attachedFile) {
      if (attachedFile.extracted_text && attachedFile.extracted_text.length > 50000) {
        const replyMsg = 'This PDF is too large to process in one request.'
        if (wantsStream) {
          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')
          res.write(`data: ${JSON.stringify({
            type: 'done',
            reply: replyMsg,
            conversation_id: conversationId,
            title: currentTitle,
            file_id: attachedFile.id,
            file_name: attachedFile.filename,
          })}\n\n`)
          return res.end()
        }
        return res.status(200).json({
          reply: replyMsg,
          conversation_id: conversationId,
          title: currentTitle,
          file_id: attachedFile.id,
          file_name: attachedFile.filename,
        })
      }

      systemInstruction = `You are Bujju AI, a helpful, intelligent AI assistant.
The user has uploaded a PDF document named "${attachedFile.filename}".

PDF DOCUMENT CONTENT:
"""
${attachedFile.extracted_text}
"""

INSTRUCTIONS:
1. Answer the user's question accurately using ONLY the information provided in the PDF document above.
2. If the user asks to summarize the PDF or what the document is about, provide a clear, helpful summary based on the PDF.
3. If the answer is not found in the PDF, respond strictly with:
"I couldn't find that information in the uploaded PDF."
4. Do NOT invent or assume information that is not in the PDF.`
      promptContents = `User question: ${message}`
    } else if (isWebSearch) {
      systemInstruction = `${GEMINI_SYSTEM_INSTRUCTION}
Web Search is active. Provide current, accurate, and comprehensive information. When presenting facts, cite sources or references clearly.`
      promptContents = `User question: ${message}`
    }

    // Prepare contents payload with multi-turn history when available
    let contentsPayload
    if (history.length > 1 && !attachedFile) {
      const turns = []
      for (const h of history) {
        if (h.content === message) continue
        turns.push({
          role: h.role === 'ai' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })
      }
      turns.push({
        role: 'user',
        parts: [{ text: promptContents }],
      })
      contentsPayload = turns
    } else {
      contentsPayload = promptContents
    }

    let currentModel = activeGeminiModel
    let streamResult = null
    let responseResult = null
    let useGoogleSearch = isWebSearch

    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const generateOptions = {
          model: currentModel,
          contents: contentsPayload,
          config: {
            systemInstruction,
          },
        }

        if (useGoogleSearch) {
          generateOptions.config.tools = [{ googleSearch: {} }]
        }

        if (wantsStream) {
          streamResult = await ai.models.generateContentStream(generateOptions)
        } else {
          responseResult = await ai.models.generateContent(generateOptions)
        }
        activeGeminiModel = currentModel
        break
      } catch (err) {
        let activeErr = err

        // If Google Search tool hit quota or error, immediately fall back without search tool
        if (useGoogleSearch) {
          console.warn('[Bujju AI Backend] Live search tool hit limit; generating web-informed answer...')
          useGoogleSearch = false
          try {
            const generateOptions = {
              model: currentModel,
              contents: contentsPayload,
              config: { systemInstruction },
            }
            if (wantsStream) {
              streamResult = await ai.models.generateContentStream(generateOptions)
            } else {
              responseResult = await ai.models.generateContent(generateOptions)
            }
            activeGeminiModel = currentModel
            break
          } catch (innerErr) {
            activeErr = innerErr
          }
        }

        const isQuota =
          activeErr.status === 429 ||
          activeErr.message?.includes('RESOURCE_EXHAUSTED') ||
          activeErr.message?.includes('Quota exceeded') ||
          activeErr.message?.toLowerCase().includes('quota')

        const isHighDemand =
          activeErr.status === 503 ||
          activeErr.message?.includes('503') ||
          activeErr.message?.includes('UNAVAILABLE') ||
          activeErr.message?.toLowerCase().includes('high demand') ||
          activeErr.message?.toLowerCase().includes('overloaded')

        const currentIdx = GEMINI_CANDIDATE_MODELS.indexOf(currentModel)
        const nextModel =
          currentIdx !== -1 && currentIdx < GEMINI_CANDIDATE_MODELS.length - 1
            ? GEMINI_CANDIDATE_MODELS[currentIdx + 1]
            : (currentIdx !== 0 ? GEMINI_CANDIDATE_MODELS[0] : null)

        if ((isQuota || isHighDemand) && nextModel && nextModel !== currentModel) {
          console.log(
            `[Bujju AI Backend] Model ${currentModel} busy or exhausted, immediately switching to ${nextModel}...`,
          )
          activeGeminiModel = nextModel
          currentModel = nextModel
          continue
        }

        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 300))
        } else {
          throw activeErr
        }
      }
    }

    // Helper to persist AI message to database and local store
    async function persistAiMessage(replyText, aiMsgId, aiNow) {
      if (scopedClient) {
        const { error: aiMsgErr } = await scopedClient.from('messages').insert([
          {
            id: aiMsgId,
            conversation_id: conversationId,
            role: 'ai',
            content: replyText,
            created_at: aiNow,
          },
        ])
        if (aiMsgErr) {
          console.error('[Bujju AI Backend] Failed to save AI message in Supabase:', aiMsgErr.message)
        }

        const updateData = {
          title: currentTitle,
          updated_at: aiNow,
        }
        if (attachedFile) {
          updateData.file_id = attachedFile.id
          updateData.file_name = attachedFile.filename
        }

        const { error: updateErr } = await scopedClient
          .from('conversations')
          .update(updateData)
          .eq('id', conversationId)
          .eq('user_id', user.id)

        if (updateErr && (updateErr.message?.includes('schema cache') || updateErr.message?.includes('file_id'))) {
          await scopedClient
            .from('conversations')
            .update({ title: currentTitle, updated_at: aiNow })
            .eq('id', conversationId)
            .eq('user_id', user.id)
        }
      }

      localStore.messages.push({
        id: aiMsgId,
        conversation_id: conversationId,
        role: 'ai',
        content: replyText,
        created_at: aiNow,
      })

      const localConv = localStore.conversations.find((c) => c.id === conversationId)
      if (localConv) {
        localConv.title = currentTitle
        localConv.updated_at = aiNow
        if (attachedFile) {
          localConv.file_id = attachedFile.id
          localConv.file_name = attachedFile.filename
        }
      }
    }

    // Handle Streaming Response (Server-Sent Events)
    if (wantsStream && streamResult) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()

      let replyText = ''
      let sources = []

      try {
        for await (const chunk of streamResult) {
          const chunkText = chunk.text
          if (chunkText) {
            replyText += chunkText
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`)
          }
          const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks
          if (Array.isArray(chunks)) {
            for (const c of chunks) {
              if (c.web?.uri && !sources.some((s) => s.url === c.web.uri)) {
                sources.push({ title: c.web.title || c.web.uri, url: c.web.uri })
              }
            }
          }
        }

        const aiNow = new Date().toISOString()
        const aiMsgId = randomUUID()
        await persistAiMessage(replyText, aiMsgId, aiNow)

        res.write(`data: ${JSON.stringify({
          type: 'done',
          reply: replyText,
          conversation_id: conversationId,
          title: currentTitle,
          file_id: attachedFile?.id || null,
          file_name: attachedFile?.filename || null,
          sources: sources.length > 0 ? sources : undefined,
        })}\n\n`)
        return res.end()
      } catch (streamErr) {
        console.error('[Bujju AI Backend] Streaming error:', streamErr)
        res.write(`data: ${JSON.stringify({ type: 'error', error: streamErr.message })}\n\n`)
        return res.end()
      }
    }

    // Handle Standard Non-Streaming Response
    const replyText = responseResult?.text
    if (!replyText) {
      return res.status(500).json({
        error: 'Received an empty response from Gemini model.',
      })
    }

    const aiNow = new Date().toISOString()
    const aiMsgId = randomUUID()
    await persistAiMessage(replyText, aiMsgId, aiNow)

    let sources = []
    const chunks = responseResult?.candidates?.[0]?.groundingMetadata?.groundingChunks
    if (Array.isArray(chunks)) {
      sources = chunks
        .map((c) => (c.web?.uri ? { title: c.web.title || c.web.uri, url: c.web.uri } : null))
        .filter(Boolean)
    }

    return res.status(200).json({
      reply: replyText,
      conversation_id: conversationId,
      title: currentTitle,
      file_id: attachedFile?.id || null,
      file_name: attachedFile?.filename || null,
      sources: sources.length > 0 ? sources : undefined,
    })
  } catch (error) {
    console.error('[Bujju AI Backend] /api/chat error:', error)

    let statusCode = error.status || 500
    let errorMessage = error.message || 'An error occurred while communicating with Gemini.'

    try {
      const parsed = JSON.parse(error.message)
      if (parsed?.error?.message) {
        errorMessage = parsed.error.message
      }
    } catch {
      // Keep original errorMessage
    }

    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key not valid')) {
      statusCode = 401
      errorMessage =
        process.env.NODE_ENV === 'production'
          ? 'AI service authentication failed.'
          : 'Invalid Gemini API key. Please check that GEMINI_API_KEY in your .env file is correct.'
    } else if (
      error.message?.includes('RESOURCE_EXHAUSTED') ||
      statusCode === 429 ||
      error.status === 429
    ) {
      statusCode = 429
      errorMessage = 'Gemini API rate limit or quota exceeded. Please wait a moment and try again.'
    }

    return res.status(statusCode).json({
      error: errorMessage,
    })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`[Bujju AI Backend] Server running on http://localhost:${PORT}`)
})
