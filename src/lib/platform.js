/**
 * ====================================================================
 * BUJJU AI - UNIVERSAL PLATFORM & DEVICE ABSTRACTION LAYER
 * Prepares the codebase for Web, PWA, Tablets, Mobile, and future
 * Tauri (Desktop) and Capacitor (Android/iOS) native containers.
 * ====================================================================
 */

export const Platform = {
  // Device & Form Factor
  isTouch: typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),

  get isMobile() {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  },

  get isTablet() {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 768 && window.innerWidth < 1024
  },

  get isDesktop() {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 1024
  },

  // Operating System detection
  get isIOS() {
    if (typeof window === 'undefined') return false
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    )
  },

  get isAndroid() {
    if (typeof window === 'undefined') return false
    return /Android/.test(navigator.userAgent)
  },

  // Container & Environment
  get isPWA() {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    )
  },

  // Future Native Container Hooks (Phase 4 compatibility)
  get isTauri() {
    return typeof window !== 'undefined' && Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__)
  },

  get isCapacitor() {
    return typeof window !== 'undefined' && Boolean(window.Capacitor)
  },

  /**
   * Unified notification dispatcher with multi-device fallbacks
   */
  async notify(title, options = {}) {
    // 1. Future Tauri desktop notification
    if (this.isTauri && window.__TAURI__?.notification) {
      try {
        await window.__TAURI__.notification.sendNotification({ title, body: options.body || '' })
        return true
      } catch {
        // Fall back to web Notification
      }
    }

    // 2. Standard Web Notifications API
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          icon: '/pwa-192.png',
          badge: '/favicon.svg',
          ...options,
        })
        return true
      } catch (err) {
        console.warn('[Platform] Notification error:', err)
      }
    }

    return false
  },
}
