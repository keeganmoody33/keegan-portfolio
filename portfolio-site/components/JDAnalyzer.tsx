'use client'

import React, { useState } from 'react';

const JDAnalyzer: React.FC = () => {
  const [input, setInput] = useState('');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!input.trim()) {
      setError('Please paste a job description or URL.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      // Use the Next.js API route which handles authorization securely
      const response = await fetch('/api/jd-analyzer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get analysis.');
      }

      const data = await response.json();
      setAnalysis(data.analysis);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        JD Fit Analyzer
      </h2>
      <p style={{ marginBottom: '1rem', color: '#666' }}>
        Paste a job description or URL below to get an honest fit assessment.
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste the full job description or a URL..."
        rows={15}
        disabled={isLoading}
        style={{
          width: '100%',
          padding: '1rem',
          fontFamily: 'monospace',
          border: '1px solid #333',
          background: '#1a1a1a',
          color: '#fff',
          borderRadius: '4px',
          marginBottom: '1rem',
        }}
      />

      <button
        onClick={handleAnalyze}
        disabled={isLoading}
        style={{
          padding: '0.75rem 1.5rem',
          background: isLoading ? '#666' : '#4ade80',
          color: '#000',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        {isLoading ? 'Analyzing...' : 'Analyze Fit'}
      </button>

      {error && (
        <div style={{ color: '#ef4444', marginTop: '1rem' }}>
          {error}
        </div>
      )}

      {analysis && (
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '4px',
        }}>
          <h3 style={{ marginBottom: '1rem' }}>Analysis Result:</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', color: '#fff' }}>
            {analysis}
          </pre>
        </div>
      )}
    </div>
  );
};

export default JDAnalyzer;
