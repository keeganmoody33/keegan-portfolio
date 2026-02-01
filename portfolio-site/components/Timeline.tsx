'use client'

import Publications from './Publications'

interface Experience {
  id: number
  company_name: string
  role_title: string
  start_date: string
  end_date: string | null
  duration_months: number
  public_bullets: string[]
}

interface TimelineProps {
  experiences: Experience[]
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatDuration(months: number): string {
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  
  if (years === 0) return `${remainingMonths} mo`
  if (remainingMonths === 0) return `${years} yr`
  return `${years} yr ${remainingMonths} mo`
}

export default function Timeline({ experiences }: TimelineProps) {
  if (!experiences || experiences.length === 0) {
    return (
      <div className="text-[var(--text-muted)] font-mono text-sm">
        Loading experiences...
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline Line */}
      <div className="absolute left-[100px] top-0 bottom-0 w-px timeline-line" />

      {/* Timeline Items */}
      <div className="space-y-8">
        {experiences.map((exp, index) => (
          <div key={exp.id} className="flex gap-8">
            {/* Date Column */}
            <div className="w-[100px] flex-shrink-0 text-right">
              <div className="text-[var(--text-bright)] font-mono text-sm">
                {formatDate(exp.start_date)} — {exp.end_date ? formatDate(exp.end_date) : 'Present'}
              </div>
              <div className="text-[var(--text-muted)] font-mono text-xs">
                {formatDuration(exp.duration_months)}
              </div>
{/* Removed "Current" label - Keegan is actively job seeking */}
            </div>

            {/* Timeline Node */}
            <div className="relative flex-shrink-0">
              <div className="w-3 h-3 rotate-45 bg-[var(--bg-body)] border border-[var(--border-dim)] timeline-node" />
            </div>

            {/* Content Card */}
            <div className="flex-1 experience-card p-6 rounded-lg">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-xl font-bold text-[var(--text-bright)]">
                    <CompanyLink company={exp.company_name} />
                  </h4>
                  <p className="text-[var(--accent-orange)] font-mono text-sm uppercase tracking-wider">
                    {exp.role_title}
                  </p>
                </div>
              </div>

              {/* Bullets */}
              {exp.public_bullets && exp.public_bullets.length > 0 && (
                <p className="text-[var(--text-main)] mb-4 leading-relaxed">
                  {exp.public_bullets.join(' ')}
                </p>
              )}

              {/* Tech Stack - would need to add to database */}
              <div className="flex flex-wrap gap-2">
                {getTechStack(exp.company_name).map((tech, i) => (
                  <span key={i} className="tech-pill">
                    {tech}
                  </span>
                ))}
              </div>

              {/* Publications Section - for ASGM Research */}
              {isASGMResearch(exp.company_name) && (
                <div className="mt-6 pt-4 border-t border-[var(--border-dim)]">
                  <h5 className="text-[var(--accent-lime)] font-mono text-xs mb-3 uppercase tracking-wider">
                    Peer-Reviewed Publications
                  </h5>
                  <Publications />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompanyLink({ company }: { company: string }) {
  // Company URL mapping - all AI-domain companies linked
  const urlMap: Record<string, string> = {
    'Mixmax': 'https://mixmax.ai',
    'Mobb': 'https://mobb.ai',
    'TraceAir': 'https://traceair.net',
    'Trace Air': 'https://traceair.net',
    'Biofourmis': 'https://biofourmis.com',
    'Bariatric': 'https://bcofa.com',
    'BARINAV': 'https://bcofa.com',
    'Barbour': 'https://barbourortho.com',
    'Camp Horizon': 'https://camphorizon.net',
    'Chapel Hill': 'https://www.fultonschools.org',
  }

  const url = Object.entries(urlMap).find(([key]) =>
    company.toLowerCase().includes(key.toLowerCase())
  )?.[1]

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-[var(--accent-lime)] transition-colors"
      >
        {company}
      </a>
    )
  }

  return <span>{company}</span>
}

function getTechStack(company: string): string[] {
  // Tech stack mapping - ideally this would come from database
  const techMap: Record<string, string[]> = {
    'Mixmax': ['Clay', 'SmartLead', 'HeyReach', 'Scalemail', 'Disco', 'Notion', 'LinkedIn Sales Nav'],
    'Mobb': ['Koncert', 'Apollo.io', 'HubSpot', 'LinkedIn Sales Nav'],
    'TraceAir': ['SalesLoft', 'Salesforce', 'HubSpot', 'Clay', 'LinkedIn Sales Nav'],
    'Trace Air': ['SalesLoft', 'Salesforce', 'HubSpot', 'Clay', 'LinkedIn Sales Nav'],
    'Biofourmis': ['Salesforce', 'HubSpot', 'ZoomInfo', 'Outreach', 'LinkedIn Sales Nav'],
    'Bariatric': ['HubSpot', 'LinkedIn Sales Nav'],
  }

  return Object.entries(techMap).find(([key]) =>
    company.toLowerCase().includes(key.toLowerCase())
  )?.[1] || []
}

function isASGMResearch(company: string): boolean {
  const keywords = ['asgm', 'mercury', 'epa', 'research']
  return keywords.some(keyword => company.toLowerCase().includes(keyword))
}
