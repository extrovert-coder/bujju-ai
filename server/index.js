import fs from 'fs'
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
import mammoth from 'mammoth'
import {
  getUserMemories,
  saveUserMemory,
  deleteUserMemory,
  clearUserMemories,
  buildMemoryPrompt,
  extractMemoriesFromConversation,
} from './memoryManager.js'

// Ensure .env is loaded from project root
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const PORT = process.env.PORT || 5000

// Trust first proxy (required for Render reverse proxy and express-rate-limit)
app.set('trust proxy', 1)

// Security headers with Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

// CORS configuration supporting FRONTEND_URL in production, localhost in development
const cleanFrontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '')

const allowedOrigins = [
  cleanFrontendUrl,
  'https://bujju-ai-tgcq.vercel.app',
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
      return callback(null, false)
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

// Confirmed active supported models in order of priority:
// Primary: gemini-3.8-flash (or process.env.GEMINI_MODEL if specified and supported)
// Reliable confirmed fallbacks: gemini-3.6-flash, gemini-3.5-flash-lite, gemini-flash-latest
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'

const DEPRECATED_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
])

// Model normalizer ensuring model string is clean, properly formatted,
// and automatically replaces deprecated models (such as gemini-2.5-flash) with DEFAULT_GEMINI_MODEL
function normalizeGeminiModel(modelName) {
  if (!modelName || typeof modelName !== 'string') return DEFAULT_GEMINI_MODEL
  const cleaned = modelName.trim().replace(/^(models\/)+/i, '')
  if (DEPRECATED_MODELS.has(cleaned)) {
    return DEFAULT_GEMINI_MODEL
  }
  return cleaned || DEFAULT_GEMINI_MODEL
}

// Helper to determine if an error should trigger switching to a fallback model
function shouldFailoverModel(err) {
  if (!err) return false
  const status = err.status || err.code || (err.error && err.error.code)
  const msg = (err.message || '').toLowerCase()
  const errorObjMsg = (err.error?.message || '').toLowerCase()

  const isQuota =
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota')

  const isUnavailable =
    status === 503 ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded')

  const isNotFound =
    status === 404 ||
    msg.includes('404') ||
    msg.includes('not_found') ||
    msg.includes('not found') ||
    msg.includes('no longer available') ||
    errorObjMsg.includes('not found') ||
    errorObjMsg.includes('no longer available')

  return isQuota || isUnavailable || isNotFound
}

const configuredModel = normalizeGeminiModel(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL)

const GEMINI_CANDIDATE_MODELS = [
  configuredModel,
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
].filter((m, i, arr) => m && arr.indexOf(m) === i)

let activeGeminiModel = GEMINI_CANDIDATE_MODELS[0]

function getNextCandidateModel(currentModel) {
  const normCurrent = normalizeGeminiModel(currentModel)
  const currentIdx = GEMINI_CANDIDATE_MODELS.indexOf(normCurrent)
  if (currentIdx !== -1 && currentIdx < GEMINI_CANDIDATE_MODELS.length - 1) {
    return GEMINI_CANDIDATE_MODELS[currentIdx + 1]
  }
  if (GEMINI_CANDIDATE_MODELS[0] !== normCurrent) {
    return GEMINI_CANDIDATE_MODELS[0]
  }
  return null
}

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

// Server-Authoritative Daily AI Message Limit (configurable via DAILY_MESSAGE_LIMIT env var)
const DAILY_MESSAGE_LIMIT = parseInt(process.env.DAILY_MESSAGE_LIMIT || '20', 10)

// In-memory fallback store with user isolation for offline/mock development
const localStore = {
  conversations: [],
  messages: [],
  files: [],
  reminders: [],
  usage: {}, // { [userId]: { date: 'YYYY-MM-DD', count: N } }
}

// Reset time calculation helper (midnight UTC)
function getUsageResetTime() {
  const reset = new Date()
  reset.setUTCHours(24, 0, 0, 0)
  return reset.toISOString()
}

// Today's date string helper in UTC ('YYYY-MM-DD')
function getTodayDateString() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Retrieve verified server-side daily usage quota for a user.
 * Tries Supabase user_usage table first, falling back to localStore if table is not migrated yet.
 */
async function getUserUsage(userId, scopedClient = null) {
  const today = getTodayDateString()
  const resetAt = getUsageResetTime()
  const limit = DAILY_MESSAGE_LIMIT

  let count = 0
  let fetchedFromDb = false

  if (scopedClient && isSupabaseConfigured) {
    try {
      const { data, error } = await scopedClient
        .from('user_usage')
        .select('message_count')
        .eq('user_id', userId)
        .eq('usage_date', today)
        .maybeSingle()

      if (!error && data) {
        count = Number(data.message_count) || 0
        fetchedFromDb = true
      } else if (!error && !data) {
        count = 0
        fetchedFromDb = true
      }
    } catch {
      // user_usage table not migrated yet; gracefully fall back to localStore
    }
  }

  if (!fetchedFromDb) {
    const userLocal = localStore.usage[userId]
    if (userLocal && userLocal.date === today) {
      count = Number(userLocal.count) || 0
    } else {
      count = 0
    }
  }

  const remaining = Math.max(0, limit - count)
  return {
    used: count,
    limit,
    remaining,
    resetAt,
  }
}

/**
 * Increment daily usage count for a user upon successful AI generation.
 * Updates localStore cache and upserts into Supabase user_usage table if available.
 */
async function incrementUserUsage(userId, scopedClient = null) {
  const today = getTodayDateString()
  const resetAt = getUsageResetTime()
  const limit = DAILY_MESSAGE_LIMIT

  let newCount = 1

  // 1. Update in-memory / localStore cache
  const userLocal = localStore.usage[userId]
  if (userLocal && userLocal.date === today) {
    userLocal.count = (Number(userLocal.count) || 0) + 1
    newCount = userLocal.count
  } else {
    localStore.usage[userId] = { date: today, count: 1 }
    newCount = 1
  }

  // 2. Upsert into Supabase user_usage table
  if (scopedClient && isSupabaseConfigured) {
    try {
      const { data: existing } = await scopedClient
        .from('user_usage')
        .select('message_count')
        .eq('user_id', userId)
        .eq('usage_date', today)
        .maybeSingle()

      if (existing) {
        const updatedCount = (Number(existing.message_count) || 0) + 1
        await scopedClient
          .from('user_usage')
          .update({ message_count: updatedCount, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('usage_date', today)
        newCount = updatedCount
      } else {
        await scopedClient
          .from('user_usage')
          .insert({
            user_id: userId,
            usage_date: today,
            message_count: 1,
            updated_at: new Date().toISOString(),
          })
        newCount = 1
      }
    } catch {
      // Gracefully fall back to localStore count
    }
  }

  const remaining = Math.max(0, limit - newCount)
  return {
    used: newCount,
    limit,
    remaining,
    resetAt,
  }
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

// GET /api/usage - Fetch verified server-side daily usage quota for authenticated user
app.get('/api/usage', async (req, res) => {
  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in to view usage.' })
    }

    const usage = await getUserUsage(user.id, scopedClient)
    return res.status(200).json(usage)
  } catch (err) {
    console.error('[Bujju AI Backend] Usage fetch error:', err.message)
    return res.status(500).json({ error: 'Failed to retrieve usage data.' })
  }
})

// ----------------------------------------------------
// FILE UPLOAD & MANAGEMENT ENDPOINTS
// ----------------------------------------------------

// 1. POST /api/files/upload - Secure file upload (PDF, DOCX, TXT, CSV, JSON up to 10 MB)
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
          error: 'No file selected. Please choose a file to upload.',
        })
      }

      const originalname = req.file.originalname || 'document'
      const ext = path.extname(originalname).toLowerCase()

      // 3. Validate supported file types (PDF, DOCX, TXT, CSV, JSON)
      const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.csv', '.json']
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return res.status(400).json({
          error: `Invalid file type "${ext || 'unknown'}". Supported formats are PDF, DOCX, TXT, CSV, and JSON.`,
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

      // 5. Safe file extraction per file type
      let extractedText = ''

      if (ext === '.pdf') {
        try {
          const parser = new PDFParse({ data: req.file.buffer })
          const result = await parser.getText()
          const rawText = result?.text || ''
          const cleanText = rawText.replace(/-- \d+ of \d+ --/g, '').trim()
          if (!cleanText) {
            return res.status(400).json({
              error: 'PDF extraction error: This PDF appears to be a scanned or image-only document without extractable text.',
            })
          }
          extractedText = rawText.trim()
        } catch (pdfErr) {
          console.error('[Bujju AI Backend] PDF parsing error:', pdfErr.message)
          return res.status(400).json({
            error: 'PDF extraction error: Failed to extract text from the PDF file. Please ensure the PDF is valid.',
          })
        }
      } else if (ext === '.docx') {
        try {
          const mammothResult = await mammoth.extractRawText({ buffer: req.file.buffer })
          const docText = (mammothResult?.value || '').trim()
          if (!docText) {
            return res.status(400).json({
              error: 'Word document error: The uploaded DOCX document contains no readable text.',
            })
          }
          extractedText = docText
        } catch (docxErr) {
          console.error('[Bujju AI Backend] DOCX parsing error:', docxErr.message)
          return res.status(400).json({
            error: 'Word document error: Failed to parse DOCX. The file may be corrupted, password-protected, or in an invalid format.',
          })
        }
      } else if (ext === '.txt') {
        const textContent = req.file.buffer.toString('utf-8')
        if (textContent.includes('\0')) {
          return res.status(400).json({
            error: 'Text file error: Binary content detected. Please ensure this is a valid UTF-8 plain text file.',
          })
        }
        if (!textContent.trim()) {
          return res.status(400).json({
            error: 'Text file error: The uploaded text file is empty.',
          })
        }
        extractedText = textContent.trim()
      } else if (ext === '.json') {
        const jsonContent = req.file.buffer.toString('utf-8')
        if (jsonContent.includes('\0')) {
          return res.status(400).json({
            error: 'JSON error: Binary content detected. Please ensure this is a valid UTF-8 JSON file.',
          })
        }
        if (!jsonContent.trim()) {
          return res.status(400).json({
            error: 'JSON error: The uploaded JSON file is empty.',
          })
        }
        try {
          const parsed = JSON.parse(jsonContent)
          extractedText = JSON.stringify(parsed, null, 2)
        } catch (jsonErr) {
          return res.status(400).json({
            error: `JSON parsing error: Malformed JSON syntax (${jsonErr.message}).`,
          })
        }
      } else if (ext === '.csv') {
        const csvContent = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '')
        if (csvContent.includes('\0')) {
          return res.status(400).json({
            error: 'CSV error: Binary content detected. Please ensure this is a valid UTF-8 CSV file.',
          })
        }
        if (!csvContent.trim()) {
          return res.status(400).json({
            error: 'CSV error: The uploaded CSV file is empty.',
          })
        }
        const lines = csvContent.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0)
        if (lines.length === 0) {
          return res.status(400).json({
            error: 'CSV error: The uploaded CSV file does not contain any valid rows.',
          })
        }
        extractedText = csvContent.trim()
      }

      // Safe length upper bound for real-time AI reasoning
      if (extractedText.length > 100000) {
        extractedText =
          extractedText.slice(0, 100000) +
          '\n\n[Note: Document content truncated to the first 100,000 characters for optimal AI reasoning.]'
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
          if (dbErr.message?.includes('file_type') || dbErr.message?.includes('column')) {
            const { file_type: _, ...compatRecord } = fileRecord
            await scopedClient.from('files').insert([compatRecord])
          } else {
            console.warn('[Bujju AI Backend] Supabase files insert notice:', dbErr.message)
          }
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
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in to use web search.' })
    }

    // Check server-authoritative daily message quota
    const currentUsage = await getUserUsage(user.id, scopedClient)
    if (currentUsage.remaining <= 0) {
      return res.status(429).json({
        error: 'Daily AI limit reached. Your limit resets at midnight UTC.',
        limitReached: true,
        usage: currentUsage,
      })
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

    let searchModel = normalizeGeminiModel(activeGeminiModel)
    try {
      const response = await ai.models.generateContent({
        model: searchModel,
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
      try {
        const fallbackRes = await ai.models.generateContent({
          model: searchModel,
          contents: `You are Bujju AI. Answer the following search query clearly and factually:\n\n${rawQuery}`,
        })
        replyText = fallbackRes?.text || ''
      } catch (fallbackErr) {
        const nextModel = getNextCandidateModel(searchModel)
        if (shouldFailoverModel(fallbackErr) && nextModel && nextModel !== searchModel) {
          console.warn(`[Bujju AI Backend] Search model ${searchModel} unavailable, switching to ${nextModel}...`)
          const secondRes = await ai.models.generateContent({
            model: nextModel,
            contents: `You are Bujju AI. Answer the following search query clearly and factually:\n\n${rawQuery}`,
          })
          replyText = secondRes?.text || ''
          activeGeminiModel = nextModel
        } else {
          throw fallbackErr
        }
      }
    }

    // Increment verified server-side daily message quota
    const updatedUsage = await incrementUserUsage(user.id, scopedClient)

    return res.status(200).json({
      success: true,
      query: rawQuery,
      answer: replyText,
      sources,
      usage: updatedUsage,
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

      // Check server-authoritative daily message quota
      const currentUsage = await getUserUsage(user.id, scopedClient)
      if (currentUsage.remaining <= 0) {
        return res.status(429).json({
          error: 'Daily AI limit reached. Your limit resets at midnight UTC.',
          limitReached: true,
          usage: currentUsage,
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
      let currentModel = normalizeGeminiModel(activeGeminiModel)

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
      for (let attempt = 1; attempt <= GEMINI_CANDIDATE_MODELS.length + 1; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: currentModel,
            contents,
          })
          activeGeminiModel = currentModel
          break
        } catch (err) {
          const nextModel = getNextCandidateModel(currentModel)
          if (shouldFailoverModel(err) && nextModel && nextModel !== currentModel) {
            console.warn(
              `[Bujju AI Backend] Vision model ${currentModel} error (status: ${err?.status || 'failover'}), safely switching to ${nextModel}...`,
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

      // Increment verified server-side daily message quota
      const updatedUsage = await incrementUserUsage(user.id, scopedClient)

      return res.status(200).json({
        success: true,
        reply: replyText,
        conversation_id: conversationId,
        title: currentTitle,
        image_name: originalname,
        usage: updatedUsage,
      })
    } catch (uploadErr) {
      console.error('[Bujju AI Backend] Image analysis error status:', uploadErr?.status || 500)
      const cleanMessage =
        uploadErr?.status === 404
          ? 'Selected AI vision model is currently unavailable. Please try again.'
          : uploadErr?.message || 'An unexpected error occurred during image analysis.'
      return res.status(uploadErr?.status || 500).json({
        error: cleanMessage,
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

// ----------------------------------------------------
// CONTINUOUS SELF-TRAINING & ADAPTIVE MEMORY ENDPOINTS
// ----------------------------------------------------

// GET /api/memories - Fetch all learned memories for the authenticated user
app.get('/api/memories', async (req, res) => {
  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }
    const memories = await getUserMemories(user.id, scopedClient)
    return res.status(200).json({ success: true, memories })
  } catch (err) {
    console.error('[Bujju AI Backend] Get memories error:', err)
    return res.status(500).json({ error: 'Failed to fetch learned memories.' })
  }
})

// POST /api/memories - Manually teach Bujju AI a new memory, rule, or preference
app.post('/api/memories', async (req, res) => {
  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }
    const { fact, category } = req.body || {}
    if (!fact || typeof fact !== 'string' || !fact.trim()) {
      return res.status(400).json({ error: 'A non-empty "fact" string is required.' })
    }
    const memory = await saveUserMemory(
      user.id,
      {
        fact: fact.trim(),
        category: category || 'instruction',
        source: 'manual_teach',
      },
      scopedClient,
    )
    return res.status(201).json({ success: true, memory })
  } catch (err) {
    console.error('[Bujju AI Backend] Save memory error:', err)
    return res.status(500).json({ error: 'Failed to save learned memory.' })
  }
})

// DELETE /api/memories/:id - Forget a specific learned memory
app.delete('/api/memories/:id', async (req, res) => {
  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }
    const { id } = req.params
    await deleteUserMemory(user.id, id, scopedClient)
    return res.status(200).json({ success: true, message: 'Memory item forgotten.' })
  } catch (err) {
    console.error('[Bujju AI Backend] Delete memory error:', err)
    return res.status(500).json({ error: 'Failed to delete memory.' })
  }
})

// DELETE /api/memories - Clear all learned memories for user
app.delete('/api/memories', async (req, res) => {
  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' })
    }
    await clearUserMemories(user.id, scopedClient)
    return res.status(200).json({ success: true, message: 'All learned memories cleared.' })
  } catch (err) {
    console.error('[Bujju AI Backend] Clear memories error:', err)
    return res.status(500).json({ error: 'Failed to clear learned memories.' })
  }
})

// ----------------------------------------------------
// USER REMINDERS ENDPOINTS (PHASE 2)
// ----------------------------------------------------

// 1. GET /api/reminders - Fetch all reminders for the authenticated user
app.get('/api/reminders', async (req, res) => {
  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in to view reminders.' })
    }

    if (scopedClient) {
      const { data, error } = await scopedClient
        .from('user_reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('due_at', { ascending: true })

      if (!error && Array.isArray(data)) {
        return res.status(200).json({ success: true, reminders: data })
      }
      if (error) {
        console.warn('[Bujju AI Backend] Supabase reminders select notice:', error.message)
      }
    }

    const localReminders = localStore.reminders
      .filter((r) => r.user_id === user.id)
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))

    return res.status(200).json({ success: true, reminders: localReminders })
  } catch (err) {
    console.error('[Bujju AI Backend] Get reminders error:', err.message)
    return res.status(500).json({ error: 'Failed to retrieve reminders.' })
  }
})

// 2. POST /api/reminders - Create a new reminder
app.post('/api/reminders', async (req, res) => {
  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in to create reminders.' })
    }

    const { title, notes, due_at } = req.body || {}

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'A reminder title is required.' })
    }
    if (title.trim().length > 200) {
      return res.status(400).json({ error: 'Reminder title must be under 200 characters.' })
    }

    if (!due_at) {
      return res.status(400).json({ error: 'A scheduled due date and time is required.' })
    }

    const parsedDue = new Date(due_at)
    if (isNaN(parsedDue.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduled date/time format.' })
    }

    const reminderId = randomUUID()
    const now = new Date().toISOString()
    const reminderRecord = {
      id: reminderId,
      user_id: user.id,
      title: title.trim(),
      notes: typeof notes === 'string' ? notes.trim().slice(0, 2000) : '',
      due_at: parsedDue.toISOString(),
      completed: false,
      created_at: now,
      updated_at: now,
    }

    if (scopedClient) {
      const { data, error } = await scopedClient
        .from('user_reminders')
        .insert([reminderRecord])
        .select()
        .single()

      if (!error && data) {
        localStore.reminders.unshift(data)
        return res.status(201).json({ success: true, reminder: data })
      }
      if (error) {
        console.warn('[Bujju AI Backend] Supabase reminder insert notice:', error.message)
      }
    }

    localStore.reminders.unshift(reminderRecord)
    return res.status(201).json({ success: true, reminder: reminderRecord })
  } catch (err) {
    console.error('[Bujju AI Backend] Create reminder error:', err.message)
    return res.status(500).json({ error: 'Failed to create reminder.' })
  }
})

// 3. PUT /api/reminders/:id - Update an existing reminder (edit title/time or toggle completion)
app.put('/api/reminders/:id', async (req, res) => {
  const { id } = req.params
  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid reminder ID format.' })
  }

  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in to update reminders.' })
    }

    const { title, notes, due_at, completed } = req.body || {}
    const updates = { updated_at: new Date().toISOString() }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Reminder title cannot be empty.' })
      }
      updates.title = title.trim().slice(0, 200)
    }

    if (notes !== undefined) {
      updates.notes = typeof notes === 'string' ? notes.trim().slice(0, 2000) : ''
    }

    if (due_at !== undefined) {
      const parsedDue = new Date(due_at)
      if (isNaN(parsedDue.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled date/time format.' })
      }
      updates.due_at = parsedDue.toISOString()
    }

    if (completed !== undefined) {
      updates.completed = Boolean(completed)
    }

    if (scopedClient) {
      const { data, error } = await scopedClient
        .from('user_reminders')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (!error && data) {
        const localIdx = localStore.reminders.findIndex((r) => r.id === id && r.user_id === user.id)
        if (localIdx !== -1) {
          localStore.reminders[localIdx] = { ...localStore.reminders[localIdx], ...data }
        }
        return res.status(200).json({ success: true, reminder: data })
      }
    }

    const localIdx = localStore.reminders.findIndex((r) => r.id === id && r.user_id === user.id)
    if (localIdx === -1) {
      return res.status(404).json({ error: 'Reminder not found or access denied.' })
    }

    localStore.reminders[localIdx] = { ...localStore.reminders[localIdx], ...updates }
    return res.status(200).json({ success: true, reminder: localStore.reminders[localIdx] })
  } catch (err) {
    console.error('[Bujju AI Backend] Update reminder error:', err.message)
    return res.status(500).json({ error: 'Failed to update reminder.' })
  }
})

// 4. DELETE /api/reminders/:id - Delete a reminder
app.delete('/api/reminders/:id', async (req, res) => {
  const { id } = req.params
  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid reminder ID format.' })
  }

  try {
    const { user, scopedClient } = await getAuthenticatedUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in to delete reminders.' })
    }

    if (scopedClient) {
      await scopedClient
        .from('user_reminders')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
    }

    localStore.reminders = localStore.reminders.filter((r) => !(r.id === id && r.user_id === user.id))
    return res.status(200).json({ success: true, message: 'Reminder deleted.' })
  } catch (err) {
    console.error('[Bujju AI Backend] Delete reminder error:', err.message)
    return res.status(500).json({ error: 'Failed to delete reminder.' })
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

    // Check server-authoritative daily message quota
    const currentUsage = await getUserUsage(user.id, scopedClient)
    if (currentUsage.remaining <= 0) {
      return res.status(429).json({
        error: 'Daily AI limit reached. Your limit resets at midnight UTC.',
        limitReached: true,
        usage: currentUsage,
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
    const mode = req.body?.mode || 'chat'
    const codeLanguage = req.body?.language || ''
    const codeContext = req.body?.codeContext || ''
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
      let docTypeLabel = 'Document'
      const ext = (attachedFile.file_type || path.extname(attachedFile.filename || '')).toLowerCase()
      if (ext === '.pdf') {
        docTypeLabel = 'PDF document'
      } else if (ext === '.docx') {
        docTypeLabel = 'Word DOCX document'
      } else if (ext === '.csv') {
        docTypeLabel = 'CSV spreadsheet data'
      } else if (ext === '.json') {
        docTypeLabel = 'JSON structured data'
      } else if (ext === '.txt') {
        docTypeLabel = 'Plain text file'
      }

      let contentToInject = attachedFile.extracted_text || ''
      if (contentToInject.length > 100000) {
        contentToInject = contentToInject.slice(0, 100000) + '\n\n[Note: Document content truncated to first 100,000 characters for optimal reasoning.]'
      }

      systemInstruction = `You are Bujju AI, a helpful, highly intelligent AI assistant.
The user has attached a ${docTypeLabel} named "${attachedFile.filename}".

ATTACHED DOCUMENT CONTENT:
"""
${contentToInject}
"""

INSTRUCTIONS:
1. Answer the user's questions, summarize, calculate, inspect, or analyze accurately using the information in the attached ${docTypeLabel} above.
2. If the user asks for summaries, insights, specific entries, rows, keys, or patterns, provide clear, structured, and insightful answers.
3. If the requested information is genuinely not present in the attached file, state clearly:
"I couldn't find that specific information in the attached ${docTypeLabel}."
4. Do NOT fabricate facts that are not supported by the document.`
      promptContents = `User question: ${message}`
    } else if (mode === 'code') {
      systemInstruction = `You are Bujju AI Coding Assistant, a world-class principal software engineer and expert programming copilot.
Your objective is to provide clean, robust, efficient, secure, and production-grade code.
Active Language: ${codeLanguage || 'General'}.

Coding Guidelines:
1. When generating code, always wrap it in fenced markdown code blocks with the accurate language tag (e.g. \`\`\`${codeLanguage || 'javascript'}, \`\`\`python, \`\`\`html, \`\`\`css, \`\`\`java, \`\`\`cpp).
2. If the user asks for web applications (HTML/CSS/JS), produce self-contained, working HTML with inline styles and scripts that can render directly inside an iframe live preview.
3. Write clean, idiomatic code with helpful inline comments explaining core logic.
4. If asked to explain, debug, or refactor code, explain the findings concisely and follow with the complete corrected or improved code.
5. Strictly adhere to security best practices (no dangerous patterns, sanitize inputs).`

      if (codeContext && typeof codeContext === 'string' && codeContext.trim()) {
        promptContents = `Current Editor Code (${codeLanguage || 'code'}):
\`\`\`${codeLanguage || ''}
${codeContext.slice(0, 20000)}
\`\`\`

User Request:
${message}`
      }
    } else if (isWebSearch) {
      systemInstruction = `${GEMINI_SYSTEM_INSTRUCTION}
Web Search is active. Provide current, accurate, and comprehensive information. When presenting facts, cite sources or references clearly.`
      promptContents = `User question: ${message}`
    }

    // Inject dynamically learned user memories & self-training knowledge
    try {
      const memoryPrompt = await buildMemoryPrompt(user.id, scopedClient)
      if (memoryPrompt) {
        systemInstruction = `${systemInstruction}\n${memoryPrompt}`
      }
    } catch (memPromptErr) {
      console.warn('[Bujju AI Memory] Memory prompt build notice:', memPromptErr.message)
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

    let currentModel = normalizeGeminiModel(activeGeminiModel)
    let streamResult = null
    let responseResult = null
    let useGoogleSearch = isWebSearch

    for (let attempt = 1; attempt <= GEMINI_CANDIDATE_MODELS.length + 1; attempt++) {
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

        const nextModel = getNextCandidateModel(currentModel)
        if (shouldFailoverModel(activeErr) && nextModel && nextModel !== currentModel) {
          console.warn(
            `[Bujju AI Backend] Chat model ${currentModel} error (status: ${activeErr?.status || 'failover'}), safely switching to ${nextModel}...`,
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

      // Continuously extract and learn durable facts/preferences from the conversation
      extractMemoriesFromConversation({
        userId: user.id,
        userMessage: message,
        aiReply: replyText,
        apiKey,
        scopedClient,
      }).catch((learnErr) => {
        console.warn('[Bujju AI Self-Training] Background extraction error:', learnErr.message)
      })
    }

    // Handle Streaming Response (Server-Sent Events)
    if (wantsStream && streamResult) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')
      res.flushHeaders?.()

      let replyText = ''
      let sources = []

      try {
        for await (const chunk of streamResult) {
          const chunkText = chunk.text
          if (chunkText) {
            replyText += chunkText
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`)
            if (typeof res.flush === 'function') res.flush()
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

        // Calculate updated usage immediately so client receives instant feedback
        const updatedUsage = {
          used: (currentUsage?.used || 0) + 1,
          limit: currentUsage?.limit || DAILY_MESSAGE_LIMIT,
          remaining: Math.max(0, (currentUsage?.remaining ?? DAILY_MESSAGE_LIMIT) - 1),
          resetAt: currentUsage?.resetAt || getUsageResetTime(),
        }

        // Send final done event and close SSE stream immediately
        res.write(`data: ${JSON.stringify({
          type: 'done',
          reply: replyText,
          conversation_id: conversationId,
          title: currentTitle,
          file_id: attachedFile?.id || null,
          file_name: attachedFile?.filename || null,
          sources: sources.length > 0 ? sources : undefined,
          usage: updatedUsage,
        })}\n\n`)
        if (typeof res.flush === 'function') res.flush()
        res.end()

        // Asynchronously persist AI message & increment usage in background without blocking client stream
        const aiNow = new Date().toISOString()
        const aiMsgId = randomUUID()
        Promise.allSettled([
          incrementUserUsage(user.id, scopedClient),
          persistAiMessage(replyText, aiMsgId, aiNow),
        ]).catch((bgErr) => {
          console.warn('[Bujju AI Backend] Background persistence notice:', bgErr.message)
        })
        return
      } catch (streamErr) {
        console.error('[Bujju AI Backend] Streaming error:', streamErr)
        res.write(`data: ${JSON.stringify({ type: 'error', error: streamErr.message || 'AI streaming interrupted.' })}\n\n`)
        if (typeof res.flush === 'function') res.flush()
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

    // Increment verified server-side daily message quota
    const updatedUsage = await incrementUserUsage(user.id, scopedClient)

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
      usage: updatedUsage,
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

// Serve static client assets in production (Full-stack single service deployment)
const distPath = path.resolve(__dirname, '../dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'))
    }
    next()
  })
}

// Start server
app.listen(PORT, () => {
  console.log(`[Bujju AI Backend] Server running on http://localhost:${PORT}`)
})
