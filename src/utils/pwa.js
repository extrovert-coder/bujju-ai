import { useState, useEffect } from 'react'

/**
 * Register Progressive Web App Service Worker with update detection
 */
export function registerServiceWorker(onUpdateAvailable) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  // Register on window load
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing
          if (!installingWorker) return

          installingWorker.addEventListener('statechange', () => {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New service worker version is waiting
              if (typeof onUpdateAvailable === 'function') {
                onUpdateAvailable(registration)
              }
            }
          })
        })
      })
      .catch((err) => {
        // Safe logging without interrupting app execution
        console.warn('[PWA] Service worker registration notice:', err.message)
      })
  })
}

/**
 * Helper to detect browser environment for PWA installation
 */
export function getBrowserInstallInfo() {
  if (typeof window === 'undefined') {
    return {
      isIos: false,
      isAndroid: false,
      isChrome: false,
      isEdge: false,
      isFirefox: false,
      isSafari: false,
      canNativeInstall: false,
    }
  }

  const ua = navigator.userAgent || ''
  const isIos =
    (/iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
    !window.MSStream

  const isAndroid = /Android/i.test(ua)
  const isEdge = /Edg\//i.test(ua)
  const isChrome = /Chrome\//i.test(ua) && !isEdge
  const isFirefox = /Firefox\//i.test(ua)
  const isSafari = /Safari\//i.test(ua) && !isChrome && !isEdge
  const canNativeInstall = 'BeforeInstallPromptEvent' in window || (!isIos && !isFirefox && !isSafari)

  return { isIos, isAndroid, isChrome, isEdge, isFirefox, isSafari, canNativeInstall }
}

/**
 * Custom React hook for installable PWA experience
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    )
  })

  // Detect platform info once
  const [installInfo] = useState(() => getBrowserInstallInfo())

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Monitor standalone mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleMediaChange = (e) => {
      setIsInstalled(e.matches || window.navigator.standalone === true)
    }

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange)
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange)
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const installApp = async () => {
    if (!deferredPrompt) return false
    try {
      deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true)
        setIsInstallable(false)
        setDeferredPrompt(null)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return {
    isInstallable,
    isInstalled,
    installApp,
    isIos: installInfo.isIos,
    installInfo,
  }
}

