'use client'

import { useState } from 'react'
import Image from 'next/image'
import NoArtTile from '@/components/house/NoArtTile'
import {
  crateCoverSizes,
  isSelfHostedCoverUrl,
} from '@/lib/crate/cover-display'

const frame = 'border border-[var(--house-line)] object-cover'

export { crateCoverSizes }

function MissingCover({
  kind,
  artist,
  title,
  catno,
}: {
  kind: 'grid' | 'detail'
  artist?: string
  title?: string
  catno?: string | null
}) {
  if (kind === 'detail') {
    return (
      <div className="flex aspect-square w-full max-w-[480px] items-center justify-center border border-[var(--house-line)] bg-[var(--house-line)] min-[1280px]:max-w-none">
        {catno ? (
          <p className="px-4 text-center font-mono text-sm text-[var(--house-ink)] [overflow-wrap:anywhere]">
            {catno}
          </p>
        ) : null}
      </div>
    )
  }
  return <NoArtTile artist={artist ?? ''} title={title ?? ''} />
}

export default function CrateCover({
  src,
  thumbSrc,
  width,
  height,
  alt,
  artist,
  title,
  catno,
  kind,
  eager = false,
  priority = false,
}: {
  src: string
  thumbSrc?: string
  width?: number
  height?: number
  alt: string
  artist?: string
  title?: string
  catno?: string | null
  kind: 'grid' | 'detail'
  eager?: boolean
  priority?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const frameClass =
    kind === 'detail'
      ? `aspect-square w-full max-w-[480px] ${frame} min-[1280px]:max-w-none`
      : `aspect-square w-full ${frame}`

  if (!src || broken) {
    return (
      <MissingCover kind={kind} artist={artist} title={title} catno={catno} />
    )
  }

  const safeWidth = width && width > 0 ? width : 600
  const safeHeight = height && height > 0 ? height : 600
  const unoptimized = !isSelfHostedCoverUrl(src)
  const sizes = crateCoverSizes(kind)

  if (kind !== 'detail' || !thumbSrc || thumbSrc === src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={safeWidth}
        height={safeHeight}
        sizes={sizes}
        loading={eager ? 'eager' : 'lazy'}
        priority={priority}
        unoptimized={unoptimized}
        onError={() => setBroken(true)}
        className={frameClass}
      />
    )
  }

  return (
    <div className="relative aspect-square w-full max-w-[480px] overflow-hidden border border-[var(--house-line)] min-[1280px]:max-w-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbSrc}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-105 object-cover blur-sm motion-reduce:scale-100 motion-reduce:blur-none"
      />
      <Image
        src={src}
        alt={alt}
        width={safeWidth}
        height={safeHeight}
        sizes={crateCoverSizes('detail')}
        loading="eager"
        priority={priority}
        unoptimized={unoptimized}
        onError={() => setBroken(true)}
        className="relative z-[1] aspect-square h-full w-full object-cover"
      />
    </div>
  )
}
