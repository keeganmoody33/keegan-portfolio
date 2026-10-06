import { timingSafeEqual } from 'node:crypto'

export function cronSecretEqual(header: string | null, secret: string): boolean {
  if (!header?.startsWith('Bearer ')) return false
  const token = header.slice('Bearer '.length)
  const left = Buffer.from(token)
  const right = Buffer.from(secret)
  const size = Math.max(left.length, right.length, 1)
  const paddedLeft = Buffer.alloc(size)
  const paddedRight = Buffer.alloc(size)
  left.copy(paddedLeft)
  right.copy(paddedRight)
  return timingSafeEqual(paddedLeft, paddedRight) && left.length === right.length
}
