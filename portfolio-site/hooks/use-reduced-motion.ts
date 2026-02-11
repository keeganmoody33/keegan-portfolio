/**
 * useReducedMotion hook
 * Detects prefers-reduced-motion system preference
 * Works in SSR context and listens for changes
 */

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Returns true if the user prefers reduced motion
 * Returns false if no preference or prefers motion
 * Updates automatically when system preference changes
 * Safe for SSR (returns false during SSR)
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    // Guard for SSR - window is not defined during server rendering
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(QUERY)
    
    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches)

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    // Use addEventListener if available (modern browsers)
    // Fall back to addListener for older browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
    } else {
      // Legacy API for older Safari
      mediaQuery.addListener(handleChange)
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange)
      } else {
        // Legacy API for older Safari
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [])

  return prefersReducedMotion
}
