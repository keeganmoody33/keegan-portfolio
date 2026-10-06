import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server.js'

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

export function cronGate(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return new NextResponse(null, { status: 404 })
  }
  if (!cronSecretEqual(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}
