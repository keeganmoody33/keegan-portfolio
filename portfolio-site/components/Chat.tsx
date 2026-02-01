'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_QUESTIONS = [
  "What does a GTM Engineer actually do?",
  "How did you go from science to sales?",
  "What are you building right now?",
]

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: question }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ question }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const assistantMessage: Message = { role: 'assistant', content: data.answer }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="w-full">
      {/* Suggested Questions (show when no messages) */}
      {messages.length === 0 && (
        <div className="mb-6">
          <p className="text-[var(--text-muted)] font-mono text-sm mb-3">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="px-3 py-1.5 text-sm bg-[var(--bg-body)] border border-[var(--border-dim)] 
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
        <div className="experience-card rounded-lg mb-4 max-h-96 overflow-y-auto">
          <div className="p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg ${
                    message.role === 'user'
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
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-[var(--accent-lime)] rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-[var(--accent-lime)] rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                    <div className="w-2 h-2 bg-[var(--accent-lime)] rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
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
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about my experience, skills, or work history..."
          className="flex-1 px-4 py-3 border border-[var(--border-dim)] rounded-lg 
                   bg-[var(--bg-body)] text-[var(--text-main)] font-mono text-sm
                   placeholder:text-[var(--text-muted)]
                   focus:outline-none focus:border-[var(--accent-lime)]"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-3 bg-[var(--accent-lime)] text-[var(--bg-body)] font-mono text-sm
                   rounded-lg hover:bg-[var(--accent-orange)] 
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>

      {/* Clear Chat */}
      {messages.length > 0 && (
        <button
          onClick={() => setMessages([])}
          className="mt-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-lime)] font-mono"
        >
          Clear chat
        </button>
      )}
    </div>
  )
}
