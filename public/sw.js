// ====================================================================
// BUJJU AI - PROGRESSIVE WEB APP SERVICE WORKER
// Secure, privacy-preserving caching policy:
// - Caches ONLY static app shell assets (CSS, JS, images, offline page)
// - NEVER caches API requests, chat messages, auth tokens, or private data
// ====================================================================

const CACHE_VERSION = 'bujju-shell-v2'
const STATIC_CACHE = `bujju-static-${CACHE_VERSION}`
const OFFLINE_FALLBACK_URL = '/offline.html'

// Core static assets required to render the application shell
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/pwa-192.png',
  '/pwa-512.png',
  '/pwa-maskable-512.png',
  '/apple-touch-icon.png',
]

// 1. Install Event: Pre-cache static application shell safely
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        return Promise.allSettled(
          APP_SHELL_ASSETS.map((asset) =>
            cache.add(asset).catch((err) => {
              console.warn('[SW] Could not pre-cache asset:', asset, err?.message)
            })
          )
        )
      })
      .then(() => self.skipWaiting())
  )
})

// 2. Activate Event: Clean up outdated cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== STATIC_CACHE) {
              return caches.delete(name)
            }
          })
        )
      })
      .then(() => self.clients.claim())
  )
})

// Helper: Determine if a request is sensitive and must NEVER be cached
function isSensitiveRequest(request, url) {
  // Non-GET requests (POST, PUT, DELETE) must never be cached
  if (request.method !== 'GET') return true

  // Backend API endpoints (chat, search, files, reminders, memories, usage, auth)
  if (url.pathname.startsWith('/api/')) return true

  // Supabase Auth and Database queries
  if (url.hostname.includes('supabase.co')) return true

  // Google Gemini API endpoints
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('generativelanguage')) {
    return true
  }

  // Requests carrying authentication credentials or user identification headers
  if (request.headers.has('authorization') || request.headers.has('x-user-id')) {
    return true
  }

  // OAuth callbacks and query parameters containing tokens or secrets
  if (
    url.searchParams.has('access_token') ||
    url.searchParams.has('refresh_token') ||
    url.searchParams.has('code') ||
    url.searchParams.has('token')
  ) {
    return true
  }

  // Vite development tooling / HMR bypass
  if (url.pathname.startsWith('/@') || url.pathname.includes('node_modules')) {
    return true
  }

  return false
}

// 3. Fetch Event: Safe fetch routing with strict security boundaries
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // RULE 1: STRICT SECURITY BYPASS
  // All sensitive requests (APIs, tokens, user data) bypass cache completely
  if (isSensitiveRequest(request, url)) {
    event.respondWith(fetch(request))
    return
  }

  // RULE 2: Navigation Requests (HTML pages)
  // Network first with offline fallback page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          // If network failed and user is offline, return offline fallback page
          const cachedResponse = await caches.match(request)
          if (cachedResponse) return cachedResponse
          return (await caches.match(OFFLINE_FALLBACK_URL)) || Response.error()
        })
    )
    return
  }

  // RULE 3: Static App Shell Assets (/assets/*, fonts, icons, images)
  // Stale-While-Revalidate strategy for lightning-fast loading
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
            }
            return networkResponse
          })
          .catch(() => cachedResponse)

        return cachedResponse || fetchPromise
      })
    )
    return
  }

  // Default: Network fetch
  event.respondWith(fetch(request))
})

// Listen for message events (e.g. prompt user to reload on update)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
