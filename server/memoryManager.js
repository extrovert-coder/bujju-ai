import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { GoogleGenAI } from '@google/genai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.resolve(__dirname, 'data')
const MEMORIES_FILE = path.resolve(DATA_DIR, 'memories.json')

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  } catch (err) {
    console.warn('[Bujju AI Memory] Could not create data directory:', err.message)
  }
}

// In-memory cache loaded from JSON file
let memoriesCache = {}

function loadMemoriesFromFile() {
  try {
    if (fs.existsSync(MEMORIES_FILE)) {
      const data = fs.readFileSync(MEMORIES_FILE, 'utf8')
      memoriesCache = JSON.parse(data)
    } else {
      memoriesCache = {}
      fs.writeFileSync(MEMORIES_FILE, JSON.stringify({}, null, 2), 'utf8')
    }
  } catch (err) {
    console.warn('[Bujju AI Memory] Failed to read memories file:', err.message)
    memoriesCache = {}
  }
}

function persistMemoriesToFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(MEMORIES_FILE, JSON.stringify(memoriesCache, null, 2), 'utf8')
  } catch (err) {
    console.warn('[Bujju AI Memory] Failed to persist memories to file:', err.message)
  }
}

// Initialize on load
loadMemoriesFromFile()

/**
 * Get all learned memories for a user
 */
export async function getUserMemories(userId, scopedClient = null) {
  if (!userId) return []

  // Check Supabase if configured
  if (scopedClient) {
    try {
      const { data, error } = await scopedClient
        .from('user_memories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data) && data.length > 0) {
        return data
      }
    } catch {
      // Fall through to local cache if table does not exist
    }
  }

  const userItems = memoriesCache[userId] || []
  return Array.isArray(userItems) ? userItems : []
}

/**
 * Save or update a learned memory for a user
 */
export async function saveUserMemory(userId, memoryData, scopedClient = null) {
  if (!userId || !memoryData?.fact) return null

  const now = new Date().toISOString()
  const cleanFact = memoryData.fact.trim()
  const cleanCategory = memoryData.category || 'fact'

  const newMemory = {
    id: memoryData.id || randomUUID(),
    user_id: userId,
    category: cleanCategory,
    fact: cleanFact,
    confidence: memoryData.confidence || 0.9,
    source: memoryData.source || 'conversation',
    created_at: memoryData.created_at || now,
    updated_at: now,
  }

  // Update in-memory / file cache
  if (!Array.isArray(memoriesCache[userId])) {
    memoriesCache[userId] = []
  }

  // Check for duplicate fact (fuzzy match)
  const existingIdx = memoriesCache[userId].findIndex(
    (m) => m.fact.toLowerCase() === cleanFact.toLowerCase(),
  )

  if (existingIdx !== -1) {
    memoriesCache[userId][existingIdx].updated_at = now
    memoriesCache[userId][existingIdx].category = cleanCategory
  } else {
    memoriesCache[userId].unshift(newMemory)
  }

  // Keep up to 60 key memories per user
  if (memoriesCache[userId].length > 60) {
    memoriesCache[userId] = memoriesCache[userId].slice(0, 60)
  }

  persistMemoriesToFile()

  // Try saving to Supabase if table exists
  if (scopedClient) {
    try {
      await scopedClient.from('user_memories').upsert([newMemory])
    } catch {
      // Ignore Supabase error if table not migrated
    }
  }

  return newMemory
}

/**
 * Delete a specific memory item
 */
export async function deleteUserMemory(userId, memoryId, scopedClient = null) {
  if (!userId || !memoryId) return false

  if (Array.isArray(memoriesCache[userId])) {
    memoriesCache[userId] = memoriesCache[userId].filter((m) => m.id !== memoryId)
    persistMemoriesToFile()
  }

  if (scopedClient) {
    try {
      await scopedClient
        .from('user_memories')
        .delete()
        .eq('id', memoryId)
        .eq('user_id', userId)
    } catch {
      // Ignore error
    }
  }

  return true
}

/**
 * Clear all learned memories for a user
 */
export async function clearUserMemories(userId, scopedClient = null) {
  if (!userId) return false

  memoriesCache[userId] = []
  persistMemoriesToFile()

  if (scopedClient) {
    try {
      await scopedClient.from('user_memories').delete().eq('user_id', userId)
    } catch {
      // Ignore error
    }
  }

  return true
}

/**
 * Build dynamic memory prompt for system instructions
 */
export async function buildMemoryPrompt(userId, scopedClient = null) {
  if (!userId) return ''

  const memories = await getUserMemories(userId, scopedClient)
  if (!memories || memories.length === 0) return ''

  const lines = memories.map((m) => {
    const cat = (m.category || 'Fact').toUpperCase()
    return `- [${cat}]: ${m.fact}`
  })

  return `
---
[BUJJU AI CONTINUOUS SELF-TRAINING & ADAPTIVE USER MEMORY]
The following personalized preferences, project specifications, guidelines, and corrections were learned directly from your previous conversations with this user.
Always respect and seamlessly incorporate this learned knowledge in your reasoning and responses:
${lines.join('\n')}
---`
}

/**
 * Autonomous Memory Extraction Engine
 * Analyzes conversation turns in background to identify facts, preferences, corrections, and instructions
 */
export async function extractMemoriesFromConversation({
  userId,
  userMessage,
  aiReply,
  apiKey,
  model = null,
  scopedClient = null,
}) {
  if (!userId || !userMessage || !apiKey) return []

  const msgTrimmed = userMessage.trim()
  // Skip trivial greetings or very short messages
  if (msgTrimmed.length < 5 && /^(hi|hello|hey|ok|thanks|bye|yes|no)$/i.test(msgTrimmed)) {
    return []
  }

  const candidateModels = [
    model,
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-3.5-flash-lite',
  ]
    .filter(Boolean)
    .map((m) => m.replace(/^models\//, ''))
    .filter((m, i, arr) => arr.indexOf(m) === i)

  try {
    const ai = new GoogleGenAI({ apiKey })

    const extractionInstruction = `You are the Autonomous Self-Training & Memory Engine for Bujju AI.
Your job is to automatically detect and extract durable knowledge, user preferences, project context, guidelines, or corrections that the user revealed about themselves, their tech stack, their work, or how they want Bujju AI to behave.

CRITICAL RULES:
1. ONLY extract permanent or durable information (e.g., "I work with Vue 3", "My name is Priya", "I prefer TypeScript over JS", "Our database is PostgreSQL", "Never use semicolons in JavaScript", "I live in Berlin", "I'm building an e-commerce platform").
2. DO NOT extract one-off transient requests (e.g., "Write a poem", "What is 2+2", "Summarize this article", "Fix this bug").
3. DO NOT hallucinate facts not stated by the user.
4. If there is nothing durable or personal to learn from the user's message, return strictly an empty array: []

Categories:
- "preference": Coding style, language, framework, design taste, tone preferences.
- "project": What project they are working on, architecture, stack, goals.
- "fact": Name, role, background, tools used, location, timezone.
- "instruction": Standing instructions on how they want the AI to format or answer.
- "correction": Direct corrections where user told the AI that an answer was incorrect or how to do it right.

Respond strictly with valid JSON array in this format:
[
  {
    "category": "preference" | "project" | "fact" | "instruction" | "correction",
    "fact": "Concise declarative fact statement (e.g., 'User prefers Tailwind CSS and Next.js for web projects')"
  }
]`

    const prompt = `User said: "${msgTrimmed}"
AI replied: "${(aiReply || '').slice(0, 300)}"`

    let rawText = ''
    for (const testModel of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: testModel,
          contents: [
            {
              role: 'user',
              parts: [{ text: `${extractionInstruction}\n\n${prompt}` }],
            },
          ],
          config: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        })
        rawText = response?.text?.trim() || ''
        if (rawText) break
      } catch (err) {
        // Continue to next fallback model
      }
    }
    if (!rawText) return []

    let parsed = []
    try {
      parsed = JSON.parse(rawText)
    } catch {
      // Try extracting json block if any
      const match = rawText.match(/\[[\s\S]*\]/)
      if (match) {
        parsed = JSON.parse(match[0])
      }
    }

    if (!Array.isArray(parsed) || parsed.length === 0) return []

    const savedItems = []
    for (const item of parsed) {
      if (item && typeof item.fact === 'string' && item.fact.trim().length > 3) {
        const saved = await saveUserMemory(
          userId,
          {
            category: item.category || 'fact',
            fact: item.fact.trim(),
            confidence: 0.95,
            source: 'conversation_learning',
          },
          scopedClient,
        )
        if (saved) savedItems.push(saved)
      }
    }

    if (savedItems.length > 0) {
      console.log(
        `[Bujju AI Self-Training] Learned ${savedItems.length} new knowledge items for user ${userId}:`,
        savedItems.map((s) => s.fact),
      )
    }

    return savedItems
  } catch (err) {
    console.warn('[Bujju AI Self-Training] Background memory extraction notice:', err.message)
    return []
  }
}
