# Bujju AI — Next-Gen Full-Stack AI Assistant

Bujju AI is an enterprise-ready, production-grade conversational AI assistant powered by Google's Gemini models, Supabase Authentication & PostgreSQL persistence, with multimodal PDF analysis, image understanding, real-time web search grounding, and browser speech recognition and synthesis.

---

## ✨ Features

- **Conversational Intelligence:** Powered by Google Gemini (`gemini-3.8-flash`), with contextual memory and multi-turn chat dialogs.
- **Supabase Authentication:** Secure email/password signup and login, session persistence, and Row-Level Security (RLS) policies.
- **Persistent Chat History:** Seamless conversation management in the sidebar (create, view, switch, and delete chats) saved to PostgreSQL.
- **PDF Document Analysis:** Upload PDF files up to 10 MB with automated text extraction (`pdf-parse`) and conversational Q&A.
- **Multimodal Image Understanding:** Upload `.jpg`, `.jpeg`, `.png`, and `.webp` images up to 10 MB for visual reasoning and detailed scene inspection.
- **Real-Time Web Search:** Grounded web search querying up-to-date information with live source citations.
- **Voice Input & Text-to-Speech:** Browser Web Speech API integration for speech-to-text recognition and text-to-speech audio playback with adjustable speed and accent controls.
- **Production Hardened:** 
  - Express backend protected by Helmet HTTP security headers.
  - Strict Cross-Origin Resource Sharing (CORS) whitelisting.
  - Rate limiting via `express-rate-limit` (general and AI-specific tiers).
  - Strict input and UUID validation on all endpoints.
  - Sanitized error handling that prevents internal traces or database schemas from leaking.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS (Dark theme UI)
- **Icons:** Lucide React
- **Client Libraries:** `@supabase/supabase-js`
- **Speech APIs:** Web Speech API (`SpeechRecognition` & `SpeechSynthesis`)

### Backend
- **Runtime:** Node.js + Express
- **AI SDK:** `@google/genai` (Google Gemini 2.5 Flash)
- **Security:** `helmet`, `cors`, `express-rate-limit`
- **File Processing:** `multer` (in-memory buffering), `pdf-parse`
- **Database Client:** `@supabase/supabase-js`

---

## 📋 Environment Variables

Create `.env` files based on `.env.example`.

### Frontend (`.env` or platform environment settings)
```env
# Supabase project URL and public anon key
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend API URL (leave empty in local development to use the Vite dev proxy)
# For production (e.g. deployed on Vercel pointing to Render backend):
# VITE_API_URL=https://bujju-ai-backend.onrender.com
VITE_API_URL=
```

### Backend (`.env` or platform environment settings)
```env
# Port for Express server (defaults to 5000)
PORT=5000

# Google Gemini API key
GEMINI_API_KEY=your_gemini_api_key

# Web Search API key (optional Google Custom Search or SerpApi)
SEARCH_API_KEY=

# Supabase Server Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_service_role_or_anon_key

# Allowed Frontend URL for CORS in production
# In local development: http://localhost:5173
# In production: https://bujju-ai.vercel.app
FRONTEND_URL=http://localhost:5173
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

### 2. Installation
Clone the repository and install dependencies:

```bash
# Install root/frontend dependencies
npm install

# (Optional) Verify backend dependencies are present
npm install express @google/genai @supabase/supabase-js multer pdf-parse cors dotenv helmet express-rate-limit
```

### 3. Database Setup (Supabase)
Run the migration script located in `supabase_schema.sql` in your Supabase SQL Editor to provision:
- `conversations` table (with RLS policies bound to `auth.uid()`)
- `messages` table (with RLS policies bound to `auth.uid()`)
- `files` table (for extracted text and attachment metadata)

### 4. Running the Development Server

You can run both backend and frontend concurrently:

**Terminal 1 — Backend:**
```bash
node server/index.js
```
*Backend runs on `http://localhost:5000` (Health check at `http://localhost:5000/api/health`).*

**Terminal 2 — Frontend:**
```bash
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 🌐 Production Deployment

### Frontend (e.g., Vercel)
1. Import the repository into Vercel.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_URL` (URL of your deployed backend, e.g. `https://bujju-ai-backend.onrender.com`)
6. Deploy. The repository includes `vercel.json` with SPA routing configuration.

### Backend (e.g., Render)
1. Create a new **Web Service** on Render.
2. Root Directory: `./`.
3. Runtime: **Node**.
4. Build Command: `npm install`.
5. Start Command: `node server/index.js`.
6. Environment Variables:
   - `NODE_ENV=production`
   - `PORT=5000`
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `FRONTEND_URL` (URL of your deployed frontend, e.g. `https://bujju-ai.vercel.app`)
7. Deploy. The repository includes `render.yaml` for infrastructure-as-code deployment.

---

## 🔒 Security & Best Practices

- **Zero Client Secrets:** Sensitive keys (`GEMINI_API_KEY`, `SUPABASE_KEY`) are kept exclusively on the Express backend.
- **JWT Verification:** Authenticated endpoints verify the user's Supabase access token on every request.
- **Payload Sanitization:** Messages are capped at 20,000 characters; file and image uploads are strictly validated for MIME type, file extension, and 10 MB size limits.
- **Rate Limiting:** Protects AI generation endpoints against abuse and DDoS attacks.
- **Sanitized Error Messaging:** Prevents exposure of internal database errors, network URIs, or stack traces to end users.
