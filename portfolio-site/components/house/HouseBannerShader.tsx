'use client'

import { useEffect, useRef } from 'react'

const IDLE_MS = 420
const MAX_POINTS = 48
const MAX_DPR = 2

type Point = { x: number; y: number }

/**
 * Faint two-tone cursor stroke behind the banner. Canvas only; no
 * extra libraries. Starts after idle so boot/LCP are not competing.
 * Idles (stops the rAF loop, leaves the last strokes) when the
 * pointer stops. Honors prefers-reduced-motion via CSS + unmount.
 */
export default function HouseBannerShader() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return undefined

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches) return undefined

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return undefined

    const surface = wrap
    const layer = canvas
    const brush = ctx

    let raf = 0
    let started = false
    let lastMove = 0
    let drawing = false
    let cssWidth = 0
    let cssHeight = 0
    let dpr = 1
    let cursor = { x: 0, y: 0 }
    const ink: Point[] = []
    const orange: Point[] = []
    let idleHandle = 0
    let usedIdleCallback = false

    function token(name: string, fallback: string): string {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim()
      return value || fallback
    }

    function resize(): void {
      const box = surface.getBoundingClientRect()
      cssWidth = Math.max(1, box.width)
      cssHeight = Math.max(1, box.height)
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      layer.width = Math.round(cssWidth * dpr)
      layer.height = Math.round(cssHeight * dpr)
    }

    function localPoint(event: PointerEvent): Point | null {
      const box = surface.getBoundingClientRect()
      const x = event.clientX - box.left
      const y = event.clientY - box.top
      if (x < -24 || y < -24 || x > box.width + 24 || y > box.height + 24) {
        return null
      }
      return { x, y }
    }

    function push(points: Point[], point: Point): void {
      const last = points[points.length - 1]
      if (last && Math.hypot(last.x - point.x, last.y - point.y) < 1.5) return
      points.push(point)
      if (points.length > MAX_POINTS) points.shift()
    }

    function stroke(points: Point[], color: string, width: number, alpha: number): void {
      if (points.length < 2) return
      brush.save()
      brush.scale(dpr, dpr)
      brush.beginPath()
      brush.moveTo(points[0]!.x, points[0]!.y)
      for (let i = 1; i < points.length; i += 1) {
        brush.lineTo(points[i]!.x, points[i]!.y)
      }
      brush.strokeStyle = color
      brush.globalAlpha = alpha
      brush.lineWidth = width
      brush.lineCap = 'round'
      brush.lineJoin = 'round'
      brush.stroke()
      brush.restore()
    }

    function paint(): void {
      brush.clearRect(0, 0, layer.width, layer.height)
      stroke(ink, token('--house-ink', '#ececec'), 1.7, 0.2)
      stroke(orange, token('--house-orange', '#e23d00'), 1.15, 0.16)
    }

    function tick(): void {
      raf = 0
      if (Date.now() - lastMove > IDLE_MS) {
        drawing = false
        paint()
        return
      }
      push(ink, cursor)
      push(orange, { x: cursor.x + 5, y: cursor.y - 4 })
      paint()
      raf = window.requestAnimationFrame(tick)
    }

    function onMove(event: PointerEvent): void {
      const point = localPoint(event)
      if (!point) return
      cursor = point
      lastMove = Date.now()
      if (!drawing) {
        drawing = true
        if (raf === 0) raf = window.requestAnimationFrame(tick)
      }
    }

    function start(): void {
      if (started || motion.matches) return
      started = true
      resize()
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('resize', resize)
    }

    if (typeof window.requestIdleCallback === 'function') {
      usedIdleCallback = true
      idleHandle = window.requestIdleCallback(start, { timeout: 800 })
    } else {
      idleHandle = window.setTimeout(start, 200)
    }

    return () => {
      started = true
      if (usedIdleCallback) {
        window.cancelIdleCallback(idleHandle)
      } else {
        window.clearTimeout(idleHandle)
      }
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      className="house-banner-shader"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="house-banner-shader-canvas" />
    </div>
  )
}
