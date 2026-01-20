'use client'

import { useState } from 'react'

export default function JDAnalyzer() {
  const [input, setInput] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    if (!input.trim()) {
      setError('Please enter a job description or URL')
      return
    }

    setLoading(true)
    setError('')
    setAnalysis('')

    try {
      const response = await fetch(
        'https://cvkcwvmlnghwwvdqudod.supabase.co/functions/v1/jd-analyzer',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input: input.trim() }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setAnalysis(data.analysis || 'No analysis returned')
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to get analysis.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: '3rem' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem', textAlign: 'center' }}>
        JD Fit Analyzer
      </h2>
      <p style={{ color: '#6b7280', textAlign: 'center', marginBottom: '2rem' }}>
        Paste a job description or URL below to get an honest fit assessment.
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste job description text or URL here..."
        style={{
          width: '100%',
          minHeight: '200px',
          padding: '1rem',
          border: '1px solid #d1d5db',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          fontFamily: 'monospace',
          marginBottom: '1rem',
          backgroundColor: '#1f2937',
          color: '#f9fafb',
        }}
      />

      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: loading ? '#6b7280' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '1rem',
        }}
      >
        {loading ? 'Analyzing...' : 'Analyze Fit'}
      </button>

      {error && (
        <div style={{ color: '#ef4444', marginTop: '1rem' }}>
          {error}
        </div>
      )}

      {analysis && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#1f2937',
            borderRadius: '0.5rem',
            border: '1px solid #374151',
          }}
        >
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
            Fit Assessment
          </h3>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#d1d5db' }}>
            {analysis}
          </div>
        </div>
      )}
    </div>
  )
}

