import { NextRequest, NextResponse } from 'next/server'
import { getPostHogClient } from '@/lib/posthog-server'

export async function POST(request: NextRequest) {
  const posthog = getPostHogClient()

  // Get distinct ID from header if available (passed from client)
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anonymous_server'

  try {
    const { question } = await request.json()

    if (!question || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      )
    }

    // Track server-side chat request
    posthog.capture({
      distinctId,
      event: 'api_chat_request',
      properties: {
        question_length: question.length,
        source: 'api_route'
      }
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      posthog.capture({
        distinctId,
        event: 'api_chat_error',
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

    // Call Supabase Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ question }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Edge function error:', error)

      posthog.capture({
        distinctId,
        event: 'api_chat_error',
        properties: {
          error_type: 'edge_function_error',
          error_message: 'Failed to get response from AI',
          status_code: response.status
        }
      })

      return NextResponse.json(
        { error: 'Failed to get response from AI' },
        { status: 500 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('API route error:', error)

    posthog.capture({
      distinctId,
      event: 'api_chat_error',
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
