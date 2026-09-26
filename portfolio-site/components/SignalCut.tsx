'use client'

import { useCallback, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'lf-signal-cut-count'

type SignalCutProps = {
  href: string
  fromId: string
  toId: string
  children: ReactNode
  className?: string
  'aria-label'?: string
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function readCount(): number {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function bumpCount(): number {
  const next = readCount() + 1
  sessionStorage.setItem(STORAGE_KEY, String(next))
  return next
}

function fillNoise(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.createImageData(width, height)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
}

function playSignalCut(opts: {
  href: string
  fromId: string
  toId: string
  navigate: () => void
}) {
  const reduced = prefersReducedMotion()
  const crossing = bumpCount()
  const first = crossing === 1
  const total = reduced ? 80 : first ? 420 : 160

  const overlay = document.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;pointer-events:none;background:#0000;overflow:hidden'

  const tear = document.createElement('div')
  tear.style.cssText =
    'position:absolute;left:0;right:0;height:10px;background:#ececec;opacity:0.85;transform:translateY(-12px)'

  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0'
  canvas.width = Math.min(window.innerWidth, 960)
  canvas.height = Math.min(window.innerHeight, 540)

  const idLine = document.createElement('p')
  idLine.textContent = `${opts.fromId}  →  ${opts.toId}`
  idLine.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;margin:0;font-family:Roboto Mono,monospace;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#ececec;opacity:0'

  overlay.appendChild(canvas)
  overlay.appendChild(tear)
  overlay.appendChild(idLine)
  document.body.appendChild(overlay)

  const started = performance.now()
  let noiseTimer: number | null = null
  const ctx = canvas.getContext('2d')

  const showSnow = !reduced && first
  const showTear = !reduced

  const tick = (now: number) => {
    const t = now - started

    if (showTear && t < 60) {
      const y = (t / 60) * window.innerHeight
      tear.style.transform = `translateY(${y}px)`
      overlay.style.background = 'transparent'
    } else {
      tear.style.opacity = '0'
    }

    if (showSnow && t >= 60 && t < 280) {
      overlay.style.background = '#0a0a0a'
      canvas.style.opacity = '1'
      if (ctx && noiseTimer === null) {
        const paint = () => {
          fillNoise(ctx, canvas.width, canvas.height)
          noiseTimer = window.setTimeout(paint, 32)
        }
        paint()
      }
    } else if (noiseTimer !== null && t >= 280) {
      window.clearTimeout(noiseTimer)
      noiseTimer = null
      canvas.style.opacity = '0'
    }

    if (reduced) {
      overlay.style.background = '#0a0a0a'
    } else if (t >= 280 || (!first && t >= 60)) {
      overlay.style.background = '#0a0a0a'
      idLine.style.opacity = '1'
    }

    if (t >= total - 60 && t < total) {
      overlay.style.opacity = String(Math.max(0, 1 - (t - (total - 60)) / 60))
    }

    if (t < total) {
      requestAnimationFrame(tick)
    } else {
      if (noiseTimer !== null) window.clearTimeout(noiseTimer)
      overlay.remove()
    }
  }

  requestAnimationFrame(tick)

  const navigateAt = reduced ? 80 : first ? 360 : 120
  window.setTimeout(() => {
    opts.navigate()
  }, navigateAt)

  window.setTimeout(() => {
    if (overlay.isConnected) overlay.remove()
  }, total + 80)
}

export default function SignalCut({
  href,
  fromId,
  toId,
  children,
  className,
  'aria-label': ariaLabel,
}: SignalCutProps) {
  const router = useRouter()

  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return
      }
      event.preventDefault()
      playSignalCut({
        href,
        fromId,
        toId,
        navigate: () => router.push(href),
      })
    },
    [href, fromId, toId, router]
  )

  return (
    <Link href={href} onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  )
}
