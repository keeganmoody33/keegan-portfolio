'use client'

/*
-- ====================================================================
-- React Component: JD Analyzer (V2 - URL Support)
-- Source: Reconciled from Cursor project and Nate B. Jones spec
-- Description:
--   - A single textarea accepts either a URL or pasted text
--   - Calls the jd-analyzer Edge Function on submit
--   - Displays the structured analysis from the AI
--   - Includes loading and error states
-- ====================================================================
*/

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
      const response = await fetch('https://cvkcwvmlnghwwvdqudod.supabase.co/functions/v1/jd-analyzer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response body is not JSON, use status-based message
        }
        throw new Error(errorMessage);
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
    <div className="jd-analyzer-container">
      <h2>JD Fit Analyzer</h2>
      <p>Paste a job description or URL below to get an honest fit assessment.</p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste the full job description or a URL..."
        rows={15}
        disabled={isLoading}
      />

      <button onClick={handleAnalyze} disabled={isLoading}>
        {isLoading ? 'Analyzing...' : 'Analyze Fit'}
      </button>

      {error && <div className="error-message">{error}</div>}

      {analysis && (
        <div className="analysis-result">
          <h3>Analysis Result:</h3>
          <pre>{analysis}</pre>
        </div>
      )}
    </div>
  );
};

export default JDAnalyzer;
