import { NextRequest, NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'

export async function POST(request: NextRequest) {
  const posthog = getPostHogClient()

  // Get distinct ID from header if available (passed from client)
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anonymous_server'

  try {
    const { input } = await request.json()

    if (!input || input.trim().length === 0) {
      return NextResponse.json(
        { error: 'Job description or URL is required' },
        { status: 400 }
      )
    }

    const isUrl = input.trim().startsWith('http')
    posthog.capture({
      distinctId,
      event: 'api_jd_analysis_request',
      properties: {
        input_type: isUrl ? 'url' : 'text',
        input_length: input.length,
        source: 'api_route'
      }
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      posthog.capture({
        distinctId,
        event: 'api_jd_analysis_error',
        properties: {
          error_type: 'configuration_missing',
          error_message: 'Supabase configuration missing'
        }
      })
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/jd-analyzer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ input }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Failed to analyze job description'
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.error || errorData.details || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      console.error('JD analyzer edge function error:', errorText)

      posthog.capture({
        distinctId,
        event: 'api_jd_analysis_error',
        properties: {
          error_type: 'edge_function_error',
          error_message: errorMessage,
          status_code: response.status
        }
      })

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('JD analyzer API route error:', error)

    posthog.capture({
      distinctId,
      event: 'api_jd_analysis_error',
      properties: {
        error_type: 'internal_error',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
