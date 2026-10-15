'use client'

import { useState, useRef, useEffect } from 'react'
import posthog from 'posthog-js'
import { getPostHogDistinctIdHeader } from '@/lib/posthog-client'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_QUESTIONS = [
  "What does a GTM Engineer actually do?",
  "How did you go from science to sales?",
  "What are you building right now?",
]

export function useConversation() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const sendMessage = async (question: string, isSuggested: boolean = false) => {
    if (!question.trim() || isLoading) return

    // Track message sent event
    posthog.capture('chat_message_sent', {
      message_length: question.length,
      is_suggested_question: isSuggested,
      message_count: messages.length + 1
    })

    const userMessage: Message = { role: 'user', content: question }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getPostHogDistinctIdHeader(),
        },
        body: JSON.stringify({ question }),
      })

      const data = await response.json()

      if (!response.ok || data.error || typeof data.answer !== 'string') {
        throw new Error(data.error)
      }

      // Track successful response
      posthog.capture('chat_response_received', {
        response_length: data.answer?.length || 0,
        message_count: messages.length + 2
      })

      const assistantMessage: Message = { role: 'assistant', content: data.answer }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      setInput(question)
      console.error('Chat error:', error)

      // Track chat error
      posthog.capture('chat_error', {
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      posthog.captureException(error)

      const errorMessage: Message = {
        role: 'assistant',
        content: 'The AI could not answer right now. Your question is still here. Try again, or email me at 33@lecturesfrom.com.',
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return { messages, setMessages, input, setInput, isLoading, sendMessage }
}

export default function Chat({ conversation }: { conversation: ReturnType<typeof useConversation> }) {
  const { messages, setMessages, input, setInput, isLoading, sendMessage } = conversation
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (messages.length && root.current?.contains(document.activeElement)) {
      messagesEndRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }, [messages])

  const restoreInputFocus = () => requestAnimationFrame(() => {
    const input = inputRef.current
    if (input?.getClientRects().length && (document.activeElement === document.body || root.current?.contains(document.activeElement))) {
      input.focus({ preventScroll: true })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void sendMessage(input).then(restoreInputFocus)
  }

  return (
    <div ref={root} className="w-full">
      {/* Suggested Questions (show when no messages) */}
      {messages.length === 0 && (
        <div className="mb-6">
          <p className="text-[var(--text-muted)] font-mono text-sm mb-3">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  posthog.capture('chat_suggested_question_clicked', {
                    question: q,
                    question_index: i
                  })
                  void sendMessage(q, true).then(restoreInputFocus)
                }}
                aria-label={q}
                className="min-h-11 px-3 py-2 text-sm bg-[var(--bg-body)] border border-[var(--border-dim)]
                         text-[var(--text-muted)] rounded hover:border-[var(--accent-lime)]
                         hover:text-[var(--accent-lime)] transition-colors font-mono"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div role="log" aria-label="Conversation" aria-live="polite" className="experience-card rounded-lg mb-4 max-h-96 overflow-y-auto">
          <div className="p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg ${message.role === 'user'
                    ? 'bg-[var(--accent-lime)] text-[var(--bg-body)]'
                    : 'bg-[var(--bg-body)] border border-[var(--border-dim)] text-[var(--text-main)]'
                    }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[var(--bg-body)] border border-[var(--border-dim)] px-4 py-2 rounded-lg">
                  <div className="flex space-x-1" role="status">
                    <span className="sr-only">Preparing an answer...</span>
                    <div className="w-2 h-2 bg-[var(--accent-lime)] rounded-full animate-bounce motion-reduce:animate-none" />
                    <div className="w-2 h-2 bg-[var(--accent-lime)] rounded-full animate-bounce motion-reduce:animate-none" style={{ animationDelay: '100ms' }} />
                    <div className="w-2 h-2 bg-[var(--accent-lime)] rounded-full animate-bounce motion-reduce:animate-none" style={{ animationDelay: '200ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What would you like to know?"
          aria-label="Ask a question"
          className="min-w-0 flex-1 px-4 py-3 border border-[var(--border-dim)] rounded-lg
                   bg-[var(--bg-body)] text-[var(--text-main)] font-mono text-sm
                   placeholder:text-[var(--text-muted)]
                   focus:outline-none focus:border-[var(--accent-lime)]"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
          className="px-4 sm:px-6 py-3 bg-[var(--accent-lime)] text-[var(--bg-body)] font-mono text-sm
                   rounded-lg hover:bg-[var(--accent-orange)]
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Waiting...' : 'Send'}
        </button>
      </form>

      {/* Clear Chat */}
      {messages.length > 0 && (
        <button
          onClick={() => {
            posthog.capture('chat_cleared', {
              messages_cleared: messages.length
            })
            setMessages([])
          }}
          aria-label="Clear conversation"
          disabled={isLoading}
          className="mt-2 min-h-11 text-sm text-[var(--text-muted)] hover:text-[var(--accent-lime)] font-mono"
        >
          Clear chat
        </button>
      )}
    </div>
  )
}
