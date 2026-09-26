import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const HOUSE_SHARE_SIZE = { width: 1200, height: 630 } as const

export async function houseSharePngResponse(): Promise<Response> {
  const file = await readFile(join(process.cwd(), 'brand/house-share.png'))
  return new Response(file, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
