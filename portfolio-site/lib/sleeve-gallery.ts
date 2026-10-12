import type { Sleeve, SleeveImage } from './catalog.ts'

export type SleeveMedia =
  | { kind: 'gallery'; images: SleeveImage[] }
  | { kind: 'cover'; src: string; alt: string }
  | { kind: 'plate' }

export function resolveSleeveMedia(
  sleeve: Pick<Sleeve, 'title' | 'cover' | 'images'>,
): SleeveMedia {
  if (sleeve.images && sleeve.images.length > 0) {
    return { kind: 'gallery', images: sleeve.images }
  }
  if (sleeve.cover) {
    return {
      kind: 'cover',
      src: sleeve.cover,
      alt: `${sleeve.title} cover`,
    }
  }
  return { kind: 'plate' }
}

export function wrapGalleryIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return ((index % length) + length) % length
}

export function galleryAspect(images: SleeveImage[]): { width: number; height: number } {
  const first = images[0]
  if (!first || first.width <= 0 || first.height <= 0) {
    return { width: 1, height: 1 }
  }
  return { width: first.width, height: first.height }
}

export function galleryIndexFromScroll(scrollLeft: number, clientWidth: number, length: number): number {
  if (clientWidth <= 0 || length <= 0) return 0
  return wrapGalleryIndex(Math.round(scrollLeft / clientWidth), length)
}
