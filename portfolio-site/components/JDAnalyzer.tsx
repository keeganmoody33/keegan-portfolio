'use client'

import { useState } from 'react'

export default function JDAnalyzer() {
  const [input, setInput] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!input.trim()) {
      setError('Please paste a job description or URL.')
      return
    }

    setLoading(true)
    setError(null)
    setAnalysis('')

    try {
      // Get the anon key from environment
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const response = await fetch('https://cvkcwvmlnghwwvdqudod.supabase.co/functions/v1/jd-analyzer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ input }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.details || 'Failed to analyze job description')
      }

      const data = await response.json()
      setAnalysis(data.analysis)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="experience-card p-6 rounded-lg">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste a job description or URL here..."
        className="w-full h-40 bg-[var(--bg-body)] border border-[var(--border-dim)] rounded-lg p-4 
                   text-[var(--text-main)] font-mono text-sm resize-none
                   focus:outline-none focus:border-[var(--accent-lime)]
                   placeholder:text-[var(--text-muted)]"
      />
      
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className={`mt-4 px-6 py-3 font-mono text-sm border border-[var(--border-dim)] 
                   text-[var(--text-bright)] rounded transition-all
                   ${loading 
                     ? 'opacity-50 cursor-not-allowed' 
                     : 'sketch-btn hover:border-[var(--accent-lime)]'
                   }`}
      >
        {loading ? 'Analyzing...' : 'Analyze Fit'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-[var(--accent-red)]/10 border border-[var(--accent-red)] rounded-lg">
          <span className="text-[var(--accent-red)] font-mono text-sm">{error}</span>
        </div>
      )}

      {analysis && (
        <div className="mt-6 p-6 bg-[var(--bg-body)] border border-[var(--border-dim)] rounded-lg">
          <h4 className="text-[var(--accent-lime)] font-mono text-sm mb-4">// Analysis Result</h4>
          <div className="text-[var(--text-main)] whitespace-pre-wrap leading-relaxed">
            {analysis}
          </div>
        </div>
      )}
    </div>
  )
}
