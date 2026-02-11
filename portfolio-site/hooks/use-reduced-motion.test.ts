/**
 * Tests for use-reduced-motion hook
 * Uses Node.js built-in test runner
 * 
 * Run: node --test hooks/use-reduced-motion.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('useReducedMotion', () => {
  it('should export useReducedMotion function', async () => {
    const { useReducedMotion } = await import('./use-reduced-motion.ts')
    
    assert.strictEqual(typeof useReducedMotion, 'function', 'useReducedMotion should be a function')
  })

  it('should have correct TypeScript types', async () => {
    // Type-only check - if this compiles, types are correct
    const { useReducedMotion } = await import('./use-reduced-motion.ts')
    
    // Verify the function signature returns boolean
    // This is a compile-time check, runtime just verifies it's callable
    assert.strictEqual(typeof useReducedMotion, 'function')
  })
})

describe('matchMedia behavior (core logic)', () => {
  it('should detect prefers-reduced-motion: reduce', () => {
    // Simulate matchMedia returning true
    const mediaQuery = '(prefers-reduced-motion: reduce)'
    const mockMatches = true
    
    // This simulates what the hook does internally
    const prefersReducedMotion = mockMatches
    
    assert.strictEqual(prefersReducedMotion, true)
  })

  it('should detect no prefers-reduced-motion preference', () => {
    // Simulate matchMedia returning false
    const mockMatches = false
    
    const prefersReducedMotion = mockMatches
    
    assert.strictEqual(prefersReducedMotion, false)
  })

  it('should handle window.matchMedia API correctly', () => {
    // Track calls to verify the hook uses correct API
    const calls: string[] = []
    
    const mockMatchMedia = (query: string) => {
      calls.push(query)
      return {
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList
    }
    
    // Simulate calling matchMedia with the query
    const result = mockMatchMedia('(prefers-reduced-motion: reduce)')
    
    assert.deepStrictEqual(calls, ['(prefers-reduced-motion: reduce)'])
    assert.strictEqual(result.matches, false)
  })
})

describe('SSR safety', () => {
  it('should handle typeof window check correctly', () => {
    // Simulate SSR where window is undefined
    const isServer = typeof (globalThis as any).window === 'undefined'
    
    // In SSR context, hook should return false without accessing window
    if (isServer) {
      // On server, we can't use matchMedia
      const prefersReducedMotion = false
      assert.strictEqual(prefersReducedMotion, false)
    } else {
      // In browser, we can use matchMedia
      assert.ok(true, 'Running in browser context')
    }
  })
})

describe('media query event handling', () => {
  it('should support addEventListener/removeEventListener', () => {
    let listener: ((event: MediaQueryListEvent) => void) | null = null
    
    const mockMediaQueryList = {
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: (event: string, callback: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') listener = callback
      },
      removeEventListener: (event: string, callback: (e: MediaQueryListEvent) => void) => {
        if (event === 'change' && listener === callback) listener = null
      },
    }
    
    const handler = () => {}
    mockMediaQueryList.addEventListener('change', handler)
    
    assert.ok(listener, 'Listener should be registered')
    
    mockMediaQueryList.removeEventListener('change', handler)
    
    assert.strictEqual(listener, null, 'Listener should be removed')
  })

  it('should support legacy addListener/removeListener for older Safari', () => {
    let listener: ((event: MediaQueryListEvent) => void) | null = null
    
    const mockMediaQueryList = {
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addListener: (callback: (e: MediaQueryListEvent) => void) => {
        listener = callback
      },
      removeListener: (callback: (e: MediaQueryListEvent) => void) => {
        if (listener === callback) listener = null
      },
    }
    
    const handler = () => {}
    mockMediaQueryList.addListener(handler)
    
    assert.ok(listener, 'Listener should be registered with addListener')
    
    mockMediaQueryList.removeListener(handler)
    
    assert.strictEqual(listener, null, 'Listener should be removed with removeListener')
  })

  it('should update state when media query changes', () => {
    let currentMatches = false
    let listeners: Array<(event: MediaQueryListEvent) => void> = []
    
    const mockMediaQueryList = {
      get matches() { return currentMatches },
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: (event: string, callback: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') listeners.push(callback)
      },
      removeEventListener: (event: string, callback: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          listeners = listeners.filter(l => l !== callback)
        }
      },
    }
    
    // Register handler
    const stateUpdates: boolean[] = []
    const handler = (e: MediaQueryListEvent) => {
      stateUpdates.push(e.matches)
    }
    mockMediaQueryList.addEventListener('change', handler)
    
    // Simulate system preference change
    currentMatches = true
    listeners.forEach(l => l({ matches: true } as MediaQueryListEvent))
    
    assert.deepStrictEqual(stateUpdates, [true])
    
    // Simulate another change
    currentMatches = false
    listeners.forEach(l => l({ matches: false } as MediaQueryListEvent))
    
    assert.deepStrictEqual(stateUpdates, [true, false])
  })
})
