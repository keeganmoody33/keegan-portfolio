'use client'

import Chat from '@/components/Chat'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Keegan Moody
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-6">
            GTM Engineer
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            I build go-to-market infrastructure from scratch at early-stage startups.
            Not campaigns—systems. The methodology, automation, and intelligence layer
            that makes outbound repeatable.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          <StatCard label="TraceAir Quota" value="147%" />
          <StatCard label="Connection Rate" value="21%" sublabel="vs 4-6% avg" />
          <StatCard label="Closed Revenue" value="$216K" />
          <StatCard label="Orlando Health" value="90 days" sublabel="fastest close" />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-800 my-12" />

        {/* Chat Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
            Ask me anything
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
            Powered by AI with my verified portfolio data. Ask about my experience,
            skills, or work history.
          </p>
          <Chat />
        </div>

        {/* Honest Framing Note */}
        <div className="mt-12 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            <strong>Note:</strong> This AI is trained to be honest about my career,
            including setbacks. I&apos;ve been fired twice while hitting quota.
            I own that, and the AI will tell you about it if you ask.
          </p>
        </div>
      </div>
    </main>
  )
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      {sublabel && <div className="text-xs text-gray-400 dark:text-gray-500">{sublabel}</div>}
    </div>
  )
}
