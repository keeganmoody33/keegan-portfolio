import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const runtime = 'nodejs'
export const alt = 'lecturesfrom'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const file = await readFile(join(process.cwd(), 'brand/house-share.png'))
  return new Response(file, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
