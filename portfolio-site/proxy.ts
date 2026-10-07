import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import {
  appendVaryAccept,
  htmlPathForMarkdownUrl,
  internalMarkdownPath,
  isHouseHtmlPath,
  linkHeaderValue,
  markdownNotFoundBody,
  normalizePath,
  requestWantsMarkdown,
  shouldBypassAgentMiddleware,
} from '@/lib/agent'
import { classifyUserAgent, isCountablePageRequest } from '@/lib/tally'
import { recordHit } from '@/lib/tally-store'

function markdown404(): NextResponse {
  return new NextResponse(markdownNotFoundBody(), {
    status: 404,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
    },
  })
}

function applyHouseHeaders(response: NextResponse, pathname: string): NextResponse {
  const link = linkHeaderValue(pathname)
  if (link) {
    response.headers.set('Link', link)
  }
  appendVaryAccept(response.headers)
  return response
}

export function proxy(request: NextRequest, event?: NextFetchEvent) {
  const pathname = normalizePath(request.nextUrl.pathname)

  if (shouldBypassAgentMiddleware(pathname)) {
    return NextResponse.next()
  }

  // Footer tally: one Redis pipeline, fire-and-forget. Never delay humans or crawlers.
  if (event && isCountablePageRequest(request.method, pathname, request.headers)) {
    event.waitUntil(recordHit(classifyUserAgent(request.headers.get('user-agent'))))
  }

  const wantsMarkdown = requestWantsMarkdown(request)

  if (pathname.endsWith('.md')) {
    const htmlPath = htmlPathForMarkdownUrl(pathname)
    const internal = internalMarkdownPath(pathname)
    if (!htmlPath || !internal) {
      return markdown404()
    }
    const url = request.nextUrl.clone()
    url.pathname = internal
    return applyHouseHeaders(NextResponse.rewrite(url), htmlPath)
  }

  if (wantsMarkdown) {
    const internal = internalMarkdownPath(pathname)
    if (internal && isHouseHtmlPath(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = internal
      return applyHouseHeaders(NextResponse.rewrite(url), pathname)
    }
    if (pathname === '/keeganmoody33' || pathname === '/keegan') {
      return NextResponse.next()
    }
    return markdown404()
  }

  if (isHouseHtmlPath(pathname) || pathname === '/keeganmoody33') {
    return applyHouseHeaders(NextResponse.next(), pathname)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|js|css|map|woff2?|glb|hdr|txt|xml|json)$).*)',
  ],
}
