'use client'

import { useRef, useState } from 'react'
import posthog from 'posthog-js'
import { getPostHogDistinctIdHeader } from '@/lib/posthog-client'

export default function JDAnalyzer() {
  const [input, setInput] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resultRef = useRef<HTMLHeadingElement>(null)

  const handleAnalyze = async () => {
    if (!input.trim()) {
      setError('Please paste a job description or URL.')
      return
    }

    // Track analysis started - high intent action
    const isUrl = input.trim().startsWith('http')
    posthog.capture('jd_analysis_started', {
      input_type: isUrl ? 'url' : 'text',
      input_length: input.length
    })

    setLoading(true)
    setError(null)
    setAnalysis('')

    try {
      const response = await fetch('/api/jd-analyzer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getPostHogDistinctIdHeader(),
        },
        body: JSON.stringify({ input }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze job description')
      }

      // Track successful completion
      posthog.capture('jd_analysis_completed', {
        input_type: isUrl ? 'url' : 'text',
        analysis_length: data.analysis?.length || 0
      })

      if (typeof data.analysis !== 'string' || !data.analysis.trim()) throw new Error('Empty analysis')
      setAnalysis(data.analysis)
      requestAnimationFrame(() => resultRef.current?.focus())
    } catch (err: any) {
      // Track error
      posthog.capture('jd_analysis_error', {
        error_message: err.message
      })
      posthog.captureException(err)

      setError('The comparison could not load. Your description is still here. Try again, or email me at 33@lecturesfrom.com.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="experience-card p-4 sm:p-6 rounded-lg">
      <label htmlFor="role-description" className="mb-3 block font-mono text-sm text-[var(--text-bright)]">Job description or link</label>
      <p id="role-hint" className="mb-4 text-sm text-[var(--text-muted)]">Paste the full text for the most context. If a link cannot be read, try the description instead.</p>
      <textarea
        id="role-description"
        aria-describedby="role-hint"
        aria-invalid={Boolean(error)}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste a job description or URL here..."
        aria-label="Paste job description or URL"
        className="w-full h-40 bg-[var(--bg-body)] border border-[var(--border-dim)] rounded-lg p-4 
                   text-[var(--text-main)] font-mono text-base resize-y
                   focus:outline-none focus:border-[var(--accent-lime)]
                   placeholder:text-[var(--text-muted)]"
      />

      <button
        onClick={handleAnalyze}
        disabled={loading}
        aria-label="Compare role with Keegan’s experience"
        aria-busy={loading}
        className={`mt-4 px-6 py-3 font-mono text-sm border border-[var(--border-dim)] 
                   text-[var(--text-bright)] rounded transition-all
                   ${loading
            ? 'opacity-50 cursor-not-allowed'
            : 'sketch-btn hover:border-[var(--accent-lime)]'
          }`}
      >
        {loading ? 'Comparing the role...' : 'Compare this role'}
      </button>

      {error && (
        <div role="alert" className="mt-4 p-4 bg-[var(--accent-red)]/10 border border-[var(--accent-red)] rounded-lg">
          <span className="text-[var(--accent-red)] font-mono text-sm">{error}</span>
        </div>
      )}

      {analysis && (
        <div className="mt-6 p-4 sm:p-6 bg-[var(--bg-body)] border border-[var(--border-dim)] rounded-lg">
          <h4 ref={resultRef} tabIndex={-1} className="text-[var(--accent-lime)] font-mono text-sm mb-4">Role comparison</h4>
          <div className="text-[var(--text-main)] whitespace-pre-wrap leading-relaxed">
            {analysis}
          </div>
        </div>
      )}
    </div>
  )
}
