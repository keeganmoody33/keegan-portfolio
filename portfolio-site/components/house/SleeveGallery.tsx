'use client'

import Image from 'next/image'
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type UIEvent,
} from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import type { SleeveImage } from '@/lib/catalog'
import { posthog } from '@/lib/posthog-client'
import {
  galleryAspect,
  galleryIndexFromScroll,
  wrapGalleryIndex,
} from '@/lib/sleeve-gallery'

export default function SleeveGallery({
  slug,
  title,
  images,
}: {
  slug: string
  title: string
  images: SleeveImage[]
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const reducedMotion = useReducedMotion()
  const aspect = galleryAspect(images)
  const scrollerId = `sleeve-gallery-${slug}`
  const current = images[index] ?? images[0]
  const hasChrome = images.length > 1
  const hasCaption = images.some((image) => Boolean(image.caption))

  const go = useCallback(
    (delta: number, method: 'button' | 'keyboard') => {
      if (images.length < 2) return
      const next = wrapGalleryIndex(index + delta, images.length)
      const scroller = scrollerRef.current
      setIndex(next)
      if (scroller) {
        scroller.scrollTo({
          left: next * scroller.clientWidth,
          behavior: reducedMotion ? 'auto' : 'smooth',
        })
      }
      posthog.capture('sleeve_gallery_nav', {
        slug,
        index: next,
        method,
      })
    },
    [images.length, index, reducedMotion, slug],
  )

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget
    const next = galleryIndexFromScroll(target.scrollLeft, target.clientWidth, images.length)
    if (next !== index) setIndex(next)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!hasChrome) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      go(-1, 'keyboard')
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      go(1, 'keyboard')
    }
  }

  return (
    <div className="w-full border border-[var(--house-line)] bg-[var(--house-bg)]">
      <div
        id={scrollerId}
        ref={scrollerRef}
        className="sleeve-gallery-scroller flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden touch-pan-x motion-reduce:scroll-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)]"
        style={{ ['--sleeve-gallery-aspect']: `${aspect.width} / ${aspect.height}` } as CSSProperties}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} art, image ${index + 1} of ${images.length}`}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
      >
        {images.map((image, slideIndex) => (
          <figure
            key={image.src}
            className="sleeve-gallery-slide m-0 snap-start"
            role="group"
            aria-roledescription="slide"
            aria-label={`${slideIndex + 1} of ${images.length}`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority={slideIndex === 0}
              className="h-full w-full object-contain"
            />
          </figure>
        ))}
      </div>

      {hasChrome ? (
        <div className="flex items-center justify-between gap-4 border-t border-[var(--house-line)] px-3 py-2">
          <button
            type="button"
            className="house-text-button"
            aria-controls={scrollerId}
            aria-label={`previous ${title} image`}
            onClick={() => go(-1, 'button')}
          >
            prev
          </button>
          <span
            className="min-w-[7ch] text-center font-[family-name:var(--house-font-lcd)] text-[13px] font-extrabold leading-none tracking-[0.04em] text-[var(--house-dim)] tabular-nums"
            aria-hidden
          >
            {String(index + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
          </span>
          <button
            type="button"
            className="house-text-button"
            aria-controls={scrollerId}
            aria-label={`next ${title} image`}
            onClick={() => go(1, 'button')}
          >
            next
          </button>
        </div>
      ) : null}

      {hasCaption ? (
        <p className="house-source min-h-6 border-t border-[var(--house-line)] px-3 py-2">
          {current?.caption ?? ''}
        </p>
      ) : null}
    </div>
  )
}
