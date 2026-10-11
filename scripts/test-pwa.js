// ====================================================================
// BUJJU AI - PHASE 4 PWA VERIFICATION SUITE
// Tests web app manifest, service worker caching security boundaries,
// offline fallback handling, install logic, and asset integrity
// ====================================================================

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

let passed = 0
let failed = 0

function test(description, fn) {
  try {
    fn()
    console.log(`  ✓ ${description}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${description}`)
    console.error(`    Error: ${err.message}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed')
}

console.log('======================================================')
console.log('       BUJJU AI - PHASE 4 PWA VERIFICATION SUITE       ')
console.log('======================================================\n')

// --------------------------------------------------------------------
// 1. WEB APP MANIFEST VALIDATION
// --------------------------------------------------------------------
console.log('[PART 1] WEB APP MANIFEST VALIDATION')

const manifestPath = path.join(rootDir, 'public/manifest.webmanifest')
const manifestJsonPath = path.join(rootDir, 'public/manifest.json')

test('manifest.webmanifest exists and is valid JSON', () => {
  assert(fs.existsSync(manifestPath), 'manifest.webmanifest does not exist')
  const content = fs.readFileSync(manifestPath, 'utf8')
  const parsed = JSON.parse(content)
  assert(parsed.name === 'Bujju AI', `Expected name "Bujju AI", got "${parsed.name}"`)
  assert(parsed.short_name === 'Bujju AI', `Expected short_name "Bujju AI", got "${parsed.short_name}"`)
  assert(parsed.start_url === '/', `Expected start_url "/", got "${parsed.start_url}"`)
  assert(parsed.display === 'standalone', `Expected display "standalone", got "${parsed.display}"`)
  assert(parsed.theme_color === '#131314', `Expected theme_color "#131314", got "${parsed.theme_color}"`)
  assert(parsed.background_color === '#131314', `Expected background_color "#131314", got "${parsed.background_color}"`)
  assert(Array.isArray(parsed.icons) && parsed.icons.length >= 3, 'Expected at least 3 icons')
})

test('manifest.json exists and mirrors manifest.webmanifest', () => {
  assert(fs.existsSync(manifestJsonPath), 'manifest.json does not exist')
  const webm = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const json = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'))
  assert(webm.name === json.name, 'Manifest name mismatch')
  assert(webm.start_url === json.start_url, 'Manifest start_url mismatch')
  assert(webm.display === json.display, 'Manifest display mismatch')
})

test('Manifest icons exist on disk and have valid sizes', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  for (const icon of manifest.icons) {
    const iconFilePath = path.join(rootDir, 'public', icon.src.replace(/^\//, ''))
    assert(fs.existsSync(iconFilePath), `Icon file ${icon.src} does not exist at ${iconFilePath}`)
    const stat = fs.statSync(iconFilePath)
    assert(stat.size > 0, `Icon file ${icon.src} is empty (0 bytes)`)
  }
})

test('Maskable and high-resolution icons are provided', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const has192 = manifest.icons.some((i) => i.sizes === '192x192' && i.type === 'image/png')
  const has512 = manifest.icons.some((i) => i.sizes === '512x512' && i.type === 'image/png')
  const hasMaskable = manifest.icons.some((i) => i.purpose === 'maskable')
  assert(has192, 'Missing 192x192 PNG icon')
  assert(has512, 'Missing 512x512 PNG icon')
  assert(hasMaskable, 'Missing maskable icon for Android adaptive launch')
})

// --------------------------------------------------------------------
// 2. HTML HEAD & METADATA CONFIGURATION
// --------------------------------------------------------------------
console.log('\n[PART 2] HTML & META TAGS VERIFICATION')

const indexHtmlPath = path.join(rootDir, 'index.html')
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8')

test('index.html links to manifest.webmanifest', () => {
  assert(indexHtml.includes('rel="manifest"'), 'Missing rel="manifest" tag in index.html')
  assert(indexHtml.includes('/manifest.webmanifest'), 'Manifest link must point to /manifest.webmanifest')
})

test('index.html contains dark theme-color and viewport-fit=cover', () => {
  assert(indexHtml.includes('name="theme-color" content="#131314"'), 'Missing theme-color #131314')
  assert(indexHtml.includes('viewport-fit=cover'), 'Missing viewport-fit=cover for safe-area insets')
})

test('index.html provides Apple Touch Icon for iOS Safari', () => {
  assert(indexHtml.includes('rel="apple-touch-icon"'), 'Missing rel="apple-touch-icon"')
  const appleIconPath = path.join(rootDir, 'public/apple-touch-icon.png')
  assert(fs.existsSync(appleIconPath), 'apple-touch-icon.png does not exist in public/')
})

test('index.html includes Apple mobile web app capable tags', () => {
  assert(indexHtml.includes('name="apple-mobile-web-app-capable" content="yes"'), 'Missing apple-mobile-web-app-capable')
  assert(indexHtml.includes('name="apple-mobile-web-app-status-bar-style"'), 'Missing apple status bar style')
})

// --------------------------------------------------------------------
// 3. SERVICE WORKER & CACHE SECURITY BOUNDARIES
// --------------------------------------------------------------------
console.log('\n[PART 3] SERVICE WORKER CACHING & PRIVACY BOUNDARIES')

const swPath = path.join(rootDir, 'public/sw.js')
const swContent = fs.readFileSync(swPath, 'utf8')

test('sw.js exists and defines static shell cache versioning', () => {
  assert(fs.existsSync(swPath), 'sw.js missing in public/')
  assert(swContent.includes('CACHE_VERSION'), 'Missing cache version in sw.js')
  assert(swContent.includes('STATIC_CACHE'), 'Missing static cache name in sw.js')
})

test('Security Rule: sw.js STRICTLY excludes /api/ requests from cache', () => {
  assert(swContent.includes("url.pathname.startsWith('/api/')"), 'sw.js must bypass all /api/ endpoints')
})

test('Security Rule: sw.js STRICTLY excludes Supabase auth & database requests', () => {
  assert(swContent.includes("url.hostname.includes('supabase.co')"), 'sw.js must bypass Supabase calls')
})

test('Security Rule: sw.js STRICTLY excludes Google Gemini API endpoints', () => {
  assert(swContent.includes('googleapis.com') && swContent.includes('generativelanguage'), 'sw.js must bypass Gemini API')
})

test('Security Rule: sw.js excludes Authorization headers and token params', () => {
  assert(swContent.includes("request.headers.has('authorization')"), 'sw.js must bypass auth headers')
  assert(swContent.includes("url.searchParams.has('access_token')"), 'sw.js must bypass token search params')
})

test('Security Rule: sw.js strictly bypasses non-GET methods (POST, PUT, DELETE)', () => {
  assert(swContent.includes("request.method !== 'GET'"), 'sw.js must never cache non-GET methods')
})

test('sw.js handles navigation fallback to offline.html', () => {
  assert(swContent.includes("request.mode === 'navigate'"), 'sw.js must handle navigate mode')
  assert(swContent.includes('OFFLINE_FALLBACK_URL'), 'sw.js must define offline fallback URL')
})

// --------------------------------------------------------------------
// 4. OFFLINE FALLBACK PAGE INTEGRITY
// --------------------------------------------------------------------
console.log('\n[PART 4] OFFLINE FALLBACK PAGE INTEGRITY')

const offlinePath = path.join(rootDir, 'public/offline.html')
const offlineContent = fs.readFileSync(offlinePath, 'utf8')

test('offline.html exists and explains network requirement', () => {
  assert(fs.existsSync(offlinePath), 'offline.html is missing in public/')
  assert(offlineContent.includes('Offline') || offlineContent.includes('offline'), 'Missing offline text')
  assert(offlineContent.includes('requires an active internet connection'), 'Must explain internet connection requirement')
})

test('offline.html explicitly DOES NOT claim AI chat works offline', () => {
  assert(!offlineContent.includes('chat works offline'), 'Must NOT claim chat works offline')
  assert(offlineContent.includes('Google Gemini'), 'Must mention Google Gemini connection requirement')
})

test('offline.html uses self-contained styles without external CDN links', () => {
  assert(!offlineContent.includes('cdn.tailwindcss.com'), 'Offline page must not depend on runtime external CDNs')
  assert(!offlineContent.includes('fonts.googleapis.com'), 'Offline page must not depend on external font CDNs')
})

// --------------------------------------------------------------------
// 5. CLIENT-SIDE PWA REGISTRATION & INSTALL EXPERIENCE
// --------------------------------------------------------------------
console.log('\n[PART 5] CLIENT-SIDE PWA HOOKS & INSTALL UI')

const pwaUtilPath = path.join(rootDir, 'src/utils/pwa.js')
const pwaUtilContent = fs.readFileSync(pwaUtilPath, 'utf8')

test('pwa.js exports registerServiceWorker with update detection', () => {
  assert(pwaUtilContent.includes('export function registerServiceWorker'), 'Missing registerServiceWorker')
  assert(pwaUtilContent.includes("register('/sw.js')") && pwaUtilContent.includes('navigator.serviceWorker'), 'Must register /sw.js')
})

test('pwa.js exports usePwaInstall hook with installApp and platform info', () => {
  assert(pwaUtilContent.includes('export function usePwaInstall'), 'Missing usePwaInstall hook')
  assert(pwaUtilContent.includes('beforeinstallprompt'), 'Must listen to beforeinstallprompt')
  assert(pwaUtilContent.includes('appinstalled'), 'Must listen to appinstalled')
  assert(pwaUtilContent.includes('deferredPrompt.prompt()'), 'Must trigger native prompt')
})

test('PwaInstallModal provides custom instructions for iOS Safari and other browsers', () => {
  const modalPath = path.join(rootDir, 'src/components/PwaInstallModal.jsx')
  assert(fs.existsSync(modalPath), 'PwaInstallModal.jsx is missing')
  const modalContent = fs.readFileSync(modalPath, 'utf8')
  assert(modalContent.includes('Add to Home Screen'), 'Must include iOS Add to Home Screen instructions')
  assert(modalContent.includes('Share'), 'Must include iOS Share button guidance')
  assert(modalContent.includes('Firefox'), 'Must include non-native browser fallback guidance')
})

test('Sidebar preserves native install button while supporting iOS & guide modal', () => {
  const sidebarPath = path.join(rootDir, 'src/components/Sidebar.jsx')
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8')
  assert(sidebarContent.includes('onInstallApp'), 'Must pass onInstallApp handler')
  assert(sidebarContent.includes('onOpenInstallGuide'), 'Must pass onOpenInstallGuide handler')
  assert(sidebarContent.includes('isInstallable'), 'Must respect isInstallable prop')
})

// --------------------------------------------------------------------
// 6. PRODUCTION BUILD ARTIFACTS
// --------------------------------------------------------------------
console.log('\n[PART 6] PRODUCTION BUILD ASSETS IN dist/')

const distDir = path.join(rootDir, 'dist')

test('dist directory contains sw.js, manifest.webmanifest, and offline.html', () => {
  assert(fs.existsSync(distDir), 'dist/ directory does not exist. Run npm run build.')
  assert(fs.existsSync(path.join(distDir, 'sw.js')), 'dist/sw.js missing')
  assert(fs.existsSync(path.join(distDir, 'manifest.webmanifest')), 'dist/manifest.webmanifest missing')
  assert(fs.existsSync(path.join(distDir, 'manifest.json')), 'dist/manifest.json missing')
  assert(fs.existsSync(path.join(distDir, 'offline.html')), 'dist/offline.html missing')
  assert(fs.existsSync(path.join(distDir, 'pwa-192.png')), 'dist/pwa-192.png missing')
  assert(fs.existsSync(path.join(distDir, 'pwa-512.png')), 'dist/pwa-512.png missing')
})

console.log('\n======================================================')
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
console.log('======================================================')

if (failed > 0) {
  process.exit(1)
}
