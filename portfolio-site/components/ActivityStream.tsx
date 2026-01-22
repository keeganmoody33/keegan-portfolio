'use client'

import { useEffect, useState } from 'react'

interface LogEntry {
  type: 'success' | 'warn' | 'info'
  message: string
  timestamp: Date
}

export default function ActivityStream() {
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    // Simulated activity stream - in production this could be real-time data
    const initialLogs: LogEntry[] = [
      { type: 'success', message: 'Portfolio site deployed v2.1...', timestamp: new Date() },
      { type: 'info', message: 'AI instructions updated', timestamp: new Date(Date.now() - 1000 * 60 * 5) },
      { type: 'warn', message: 'Edge function cold start detected', timestamp: new Date(Date.now() - 1000 * 60 * 15) },
      { type: 'info', message: 'Skills database refreshed', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
      { type: 'success', message: 'JD Analyzer endpoint active', timestamp: new Date(Date.now() - 1000 * 60 * 60) },
    ]
    setLogs(initialLogs)
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-lime)] animate-pulse" />
        <span className="text-[var(--text-muted)] font-mono text-xs uppercase tracking-wider">
          System_Logs
        </span>
      </div>

      <h2 className="text-2xl font-bold text-[var(--text-bright)] mb-2">
        Activity Stream
      </h2>
      <p className="text-[var(--text-muted)] text-sm mb-6">
        Live output of engineering milestones and protocol executions.
      </p>

      {/* Log Window */}
      <div className="flex-1 activity-stream rounded-lg p-4 font-mono text-sm overflow-y-auto">
        <div className="text-[var(--text-muted)] mb-4">monitor_v2.log</div>
        
        {logs.map((log, i) => (
          <div key={i} className="mb-2">
            <span className={`
              ${log.type === 'success' ? 'log-success' : ''}
              ${log.type === 'warn' ? 'log-warn' : ''}
              ${log.type === 'info' ? 'log-info' : ''}
            `}>
              [{log.type.toUpperCase()}]
            </span>
            <span className="text-[var(--text-main)] ml-2">
              {log.message}
            </span>
          </div>
        ))}
      </div>

      {/* Theme Toggle */}
      <div className="mt-6 flex gap-2">
        <button 
          onClick={() => document.documentElement.removeAttribute('data-theme')}
          className="w-8 h-8 rounded border border-[var(--border-dim)] bg-[#121212] hover:border-[var(--accent-lime)]"
          title="Dark Mode"
        />
        <button 
          onClick={() => document.documentElement.setAttribute('data-theme', 'light')}
          className="w-8 h-8 rounded border border-[var(--border-dim)] bg-[#E8E2D2] hover:border-[var(--accent-lime)]"
          title="Light Mode"
        />
      </div>
    </div>
  )
}
