import { put } from '@vercel/blob'

export function blobReadWriteToken(
  env: Record<string, string | undefined> = process.env
): string | null {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim()
  return token ? token : null
}

export type CoverBlobPut = {
  url: string
  pathname: string
}

export async function putCoverBlob(
  pathname: string,
  body: Buffer | Uint8Array | Blob,
  options: {
    token?: string | null
    contentType?: string
    putImpl?: typeof put
  } = {}
): Promise<CoverBlobPut | null> {
  const token = options.token === undefined ? blobReadWriteToken() : options.token
  if (!token) return null
  const putImpl = options.putImpl ?? put
  try {
    const result = await putImpl(pathname, body, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
      contentType: options.contentType,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    })
    return { url: result.url, pathname: result.pathname }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'blob put failed'
    console.error(`cover blob put skipped: ${message}`)
    return null
  }
}
