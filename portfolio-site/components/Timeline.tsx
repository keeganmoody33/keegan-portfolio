'use client'

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
  return date.getFullYear().toString()
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
              {index === 0 && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-[var(--accent-lime-dim)] text-[var(--accent-lime)] font-mono text-xs border border-[var(--accent-lime)]">
                  Current
                </span>
              )}
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
                    {exp.company_name}
                  </h4>
                  <p className="text-[var(--accent-orange)] font-mono text-sm uppercase tracking-wider">
                    {exp.role_title}
                  </p>
                </div>
                <CompanyIcon company={exp.company_name} />
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
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompanyIcon({ company }: { company: string }) {
  // Simple icon mapping based on company
  const iconMap: Record<string, string> = {
    'Mixmax': '📧',
    'TraceAir': '✈️',
    'Trace Air': '✈️',
    'Biofourmis': '💊',
    'Home Depot': '🏠',
    'BariNav': '🧭',
    'Barbour Orthopedics': '🦴',
    'Chapel Hill': '🏈',
  }

  const icon = Object.entries(iconMap).find(([key]) => 
    company.toLowerCase().includes(key.toLowerCase())
  )?.[1] || '💼'

  return (
    <span className="text-2xl opacity-50">{icon}</span>
  )
}

function getTechStack(company: string): string[] {
  // Tech stack mapping - ideally this would come from database
  const techMap: Record<string, string[]> = {
    'Mixmax': ['Clay', 'SmartLead', 'HeyReach', 'Octave'],
    'TraceAir': ['Outreach', 'Salesforce', 'LinkedIn Sales Nav'],
    'Trace Air': ['Outreach', 'Salesforce', 'LinkedIn Sales Nav'],
    'Biofourmis': ['Salesforce', 'Outreach', 'ZoomInfo'],
  }

  return Object.entries(techMap).find(([key]) => 
    company.toLowerCase().includes(key.toLowerCase())
  )?.[1] || []
}
