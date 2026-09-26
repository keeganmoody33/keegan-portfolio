import { NextResponse } from 'next/server'
import { markdownForInternalPath, markdownHeaders, markdownNotFoundBody } from '@/lib/markdown'

export const revalidate = 300
export const runtime = 'nodejs'

type RouteProps = {
  params: Promise<{ path: string[] }>
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { path } = await params
  const body = await markdownForInternalPath(path)
  if (!body) {
    return new NextResponse(markdownNotFoundBody(), {
      status: 404,
      headers: markdownHeaders(),
    })
  }
  return new NextResponse(body, { headers: markdownHeaders() })
}
