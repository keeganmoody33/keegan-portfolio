import { NextResponse } from 'next/server'
import { discoveryDocument } from '@/lib/markdown'

export function GET() {
  const catalog = discoveryDocument()
  return NextResponse.json(
    {
      specVersion: catalog.specVersion,
      host: catalog.host,
      entries: catalog.entries,
      name: catalog.name,
      legalName: catalog.legalName,
      url: catalog.url,
      description: catalog.description,
      llms: catalog.llms,
      pages: catalog.pages,
      markdown: catalog.markdown,
      sameAs: catalog.sameAs,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    }
  )
}
