'use client'

import { Component, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import Chat from '@/components/Chat'
import JDAnalyzer from '@/components/JDAnalyzer'
import SprayText from '@/components/SprayText'
import Timeline from '@/components/Timeline'
import ActivityStream from '@/components/ActivityStream'
import Marquee from '@/components/Marquee'
import RecentDigs from '@/components/RecentDigs'
import posthog from 'posthog-js'

/** Error boundary — Discogs API failure never crashes the page */
class WidgetErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    console.error('WidgetErrorBoundary caught:', error)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

interface Profile {
  id: string
  first_name: string
  last_name: string
  headline: string
  summary: string
  linkedin_url: string
  github_url: string
}

interface Experience {
  id: number
  company_name: string
  role_title: string
  start_date: string
  end_date: string | null
  duration_months: number
  public_bullets: string[]
  display_order: number
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [showChat, setShowChat] = useState(false)
  const [showJD, setShowJD] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)

  // Event handlers with PostHog tracking
  const handleOpenChat = () => {
    posthog.capture('chat_modal_opened', {
      source: 'page_interaction'
    })
    setShowChat(true)
  }

  const handleCloseChat = () => {
    posthog.capture('chat_modal_closed')
    setShowChat(false)
  }

  const handleToggleSidebar = () => {
    const newState = !showSidebar
    posthog.capture('activity_sidebar_toggled', {
      sidebar_visible: newState
    })
    setShowSidebar(newState)
  }

  const handleExternalLinkClick = (linkName: string, url: string) => {
    posthog.capture('external_link_clicked', {
      link_name: linkName,
      destination_url: url
    })
  }

  useEffect(() => {
    async function fetchData() {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('candidate_profile')
        .select('*')
        .eq('id', 'keegan-moody-001')
        .single()
      
      if (profileData) setProfile(profileData)

      // Fetch experiences
      const { data: expData } = await supabase
        .from('experiences')
        .select('*')
        .eq('candidate_id', 'keegan-moody-001')
        .order('display_order', { ascending: true })
      
      if (expData) setExperiences(expData)
    }

    fetchData()
  }, [])

  return (
    <div className="min-h-screen">
      {/* Marquee Ticker */}
      <Marquee />

      {/* Recent Digs — Discogs widget */}
      <WidgetErrorBoundary>
        <RecentDigs />
      </WidgetErrorBoundary>

      {/* Main Layout */}
      <div className="flex">
        {/* Main Content */}
        <main className={`flex-1 px-8 lg:px-16 py-8 ${showSidebar ? 'lg:pr-[400px]' : ''}`}>
          {/* Navigation */}
          <nav className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-mono text-sm">/</span>
              <span className="text-[var(--text-bright)] font-space">lecturesfrom</span>
            </div>
            <div className="flex items-center gap-8">
              <a href="#experience" className="text-[var(--text-muted)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors">
                XP
              </a>
              <a href="#projects" className="text-[var(--text-muted)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors">
                Projects <span className="text-[var(--text-muted)]">[P]</span>
              </a>
              <a href="#contact" className="text-[var(--text-muted)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors">
                Contact <span className="text-[var(--text-muted)]">[C]</span>
              </a>
              <button
                onClick={handleOpenChat}
                className="ask-ai-btn px-4 py-2 font-mono text-sm"
              >
                Ask AI
              </button>
            </div>
          </nav>

          {/* Hero Section */}
          <section className="mb-24">
            {/* Taglines */}
            <div className="space-y-2 mb-8">
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <span className="text-[var(--accent-orange)]">//</span>
                <span className="font-mono text-sm">Revenue systems. Built from zero.</span>
              </div>
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <span className="text-[var(--accent-lime)]">//</span>
                <span className="font-mono text-sm">Useful in every room.</span>
              </div>
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <span className="text-[var(--accent-red)]">//</span>
                <span className="font-mono text-sm">Here for the long build.</span>
              </div>
            </div>

            {/* Name */}
            <h1 className="text-7xl lg:text-9xl font-bold tracking-tight mb-8">
              <SprayText 
                text={profile?.first_name?.toUpperCase() || 'KEEGAN'} 
                className="text-[var(--accent-lime)]"
              />
              <br />
              <SprayText 
                text={profile?.last_name?.toUpperCase() || 'MOODY'} 
                className="text-[var(--accent-orange)]"
                delay={500}
              />
            </h1>

            {/* CTA */}
            <div className="flex items-start gap-4">
              <div className="w-1 h-16 bg-[var(--accent-lime)]" />
              <div>
                <p className="text-[var(--text-muted)] font-mono text-sm mb-4">
                  Don't guess. Query the system directly.<br />
                  The answer is in the data.
                </p>
                <button
                  onClick={handleOpenChat}
                  className="ask-ai-btn px-6 py-3 font-mono"
                >
                  Ask AI
                </button>
              </div>
            </div>
          </section>

          {/* Career Timeline */}
          <section id="experience" className="mb-24">
            <h2 className="text-[var(--accent-orange)] font-mono text-sm mb-8">
              // Chronological Execution Log
            </h2>
            <h3 className="text-3xl font-bold text-[var(--text-bright)] mb-12">
              Career Timeline
            </h3>
            <Timeline experiences={experiences} />
          </section>

          {/* JD Analyzer */}
          <section id="projects" className="mb-24">
            <h2 className="text-[var(--accent-orange)] font-mono text-sm mb-8">
              // Fit Analysis Tool
            </h2>
            <h3 className="text-3xl font-bold text-[var(--text-bright)] mb-8">
              JD Fit Analyzer
            </h3>
            <p className="text-[var(--text-muted)] mb-8 max-w-xl">
              Paste a job description. I'll give you an honest assessment of fit—including where I fall short.
            </p>
            <JDAnalyzer />
          </section>

          {/* Footer */}
          <footer id="contact" className="border-t border-[var(--border-dim)] pt-8">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)] font-mono text-sm">
                © 2026 lecturesfrom
              </span>
              <div className="flex gap-6">
                <a
                  href={profile?.linkedin_url || 'https://linkedin.com/in/keeganmoody33'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleExternalLinkClick('linkedin', profile?.linkedin_url || 'https://linkedin.com/in/keeganmoody33')}
                  className="text-[var(--text-muted)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
                >
                  LINKEDIN
                </a>
                <a
                  href="https://x.com/keeganmoody33"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleExternalLinkClick('x', 'https://x.com/keeganmoody33')}
                  className="text-[var(--text-muted)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
                >
                  X
                </a>
                <a
                  href="https://substack.com/@keeganmoody33"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleExternalLinkClick('substack', 'https://substack.com/@keeganmoody33')}
                  className="text-[var(--text-muted)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
                >
                  SUBSTACK
                </a>
                <a
                  href={profile?.github_url || 'https://github.com/keeganmoody33'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleExternalLinkClick('github', profile?.github_url || 'https://github.com/keeganmoody33')}
                  className="text-[var(--text-muted)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
                >
                  GITHUB
                </a>
                <a
                  href="https://discord.com/users/lecturesfrom"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleExternalLinkClick('discord', 'https://discord.com/users/lecturesfrom')}
                  className="text-[var(--text-muted)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
                >
                  DISCORD
                </a>
                <a
                  href="https://bsky.app/profile/lecturesfrom.bsky.social"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleExternalLinkClick('bluesky', 'https://bsky.app/profile/lecturesfrom.bsky.social')}
                  className="text-[var(--text-muted)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
                >
                  BLUESKY
                </a>
              </div>
            </div>
          </footer>
        </main>

        {/* Sidebar Toggle Button */}
        <button
          onClick={handleToggleSidebar}
          className="hidden lg:flex fixed right-4 bottom-4 z-40 items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-muted)] hover:text-[var(--accent-lime)] hover:border-[var(--accent-lime)] font-mono text-xs transition-colors"
        >
          {showSidebar ? 'Hide' : 'Show'} Activity
        </button>

        {/* Right Sidebar - Activity Stream (toggleable) */}
        {showSidebar && (
          <aside className="hidden lg:block fixed right-0 top-0 w-[380px] h-screen border-l border-[var(--border-dim)] bg-[var(--bg-glass)] p-6 overflow-y-auto">
            <ActivityStream />
          </aside>
        )}
      </div>

      {/* Chat Modal */}
      {showChat && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-dim)]">
              <h3 className="text-[var(--text-bright)] font-mono">Ask AI</h3>
              <button
                onClick={handleCloseChat}
                className="text-[var(--text-muted)] hover:text-[var(--text-bright)]"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
              <Chat />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
