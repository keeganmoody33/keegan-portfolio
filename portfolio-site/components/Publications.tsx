'use client'

import { useState } from 'react'

interface Paper {
  title: string
  journal: string
  year: number
  role: string
  doi: string
  doiShort: string
  pubmedId?: string
  citationsUrl: string
  abstract: string
  citations: number
  impactFactor: number
  fieldwork?: string
}

const PAPERS: Paper[] = [
  {
    title: "Mercury emissions from Peruvian gold shops: Potential ramifications for Minamata compliance in artisanal and small-scale gold mining communities",
    journal: "Environmental Research",
    year: 2020,
    role: "First Author",
    doi: "https://doi.org/10.1016/j.envres.2019.109042",
    doiShort: "10.1016/j.envres.2019.109042",
    pubmedId: "32069769",
    citationsUrl: "https://www.sciencedirect.com/science/article/abs/pii/S0013935119308394",
    abstract: "Three communities in Madre de Dios, Peru were mapped to determine Hg vapor concentrations. ASGM communities exhibited concentrations exceeding 2,000,000 ng/m³ surrounding active gold shops — life-threatening levels according to EPA guidelines. This work highlights the difficulties of measuring mercury in ASGM communities and contributed to the development of Peruvian air quality protocols.",
    citations: 47,
    impactFactor: 8.3,
    fieldwork: "120+ days across South America"
  },
  {
    title: "Method for mapping Hg0 emissions from gold shops in artisanal and small-scale gold mining communities",
    journal: "MethodsX",
    year: 2020,
    role: "Co-Author",
    doi: "https://doi.org/10.1016/j.mex.2020.101060",
    doiShort: "10.1016/j.mex.2020.101060",
    pubmedId: "32953428",
    citationsUrl: "https://www.sciencedirect.com/science/article/pii/S2215016120302806",
    abstract: "A detailed method for obtaining and analyzing mercury concentration data collected near gold shops using portable atomic absorbance spectrometers with Zeeman correction, correlated to GPS position and mapped using GIS. Maps generated identify point sources of Hg contamination and assist local governments in urban planning.",
    citations: 12,
    impactFactor: 1.6
  }
]

export default function Publications() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="space-y-4">
      {PAPERS.map((paper, index) => (
        <div
          key={index}
          className="block relative"
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <div className={`p-4 border rounded-lg transition-all duration-200 ${
            hoveredIndex === index
              ? 'border-[var(--accent-lime)] bg-[var(--bg-surface)]'
              : 'border-[var(--border-dim)] bg-[var(--bg-body)]'
          }`}>
            {/* Top Row: Role Badge + Metrics */}
            <div className="flex items-start justify-between mb-2">
              <span className={`inline-block px-2 py-0.5 text-xs font-mono rounded ${
                paper.role === 'First Author'
                  ? 'bg-[var(--accent-lime-dim)] text-[var(--accent-lime)] border border-[var(--accent-lime)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-dim)]'
              }`}>
                {paper.role}
              </span>

              {/* Citation Stats */}
              <div className="flex items-center gap-3 text-xs font-mono">
                <a
                  href={paper.citationsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-orange)] hover:underline"
                  title="View citations on ScienceDirect"
                >
                  {paper.citations} cited
                </a>
                <span className="text-[var(--text-muted)]" title="Impact Factor">
                  IF: {paper.impactFactor}
                </span>
              </div>
            </div>

            {/* Title */}
            <h4 className="text-[var(--text-bright)] font-medium mb-1 leading-tight">
              {paper.title}
            </h4>

            {/* Journal, Year & DOI */}
            <div className="flex items-center gap-2 text-[var(--text-muted)] font-mono text-sm">
              <span>{paper.journal} ({paper.year})</span>
              <span className="text-[var(--border-dim)]">|</span>
              <span className="text-xs">DOI: {paper.doiShort}</span>
            </div>

            {/* Fieldwork Badge */}
            {paper.fieldwork && (
              <div className="mt-2">
                <span className="inline-block px-2 py-0.5 text-xs font-mono bg-[var(--bg-surface)] text-[var(--accent-orange)] border border-[var(--accent-orange)] rounded">
                  {paper.fieldwork}
                </span>
              </div>
            )}

            {/* Abstract on Hover */}
            {hoveredIndex === index && (
              <div className="mt-3 pt-3 border-t border-[var(--border-dim)]">
                <p className="text-[var(--text-main)] text-sm leading-relaxed mb-3">
                  {paper.abstract}
                </p>

                {/* Links Row */}
                <div className="flex items-center gap-4">
                  <a
                    href={paper.doi}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent-lime)] text-xs font-mono hover:underline"
                  >
                    View Full Paper →
                  </a>
                  {paper.pubmedId && (
                    <a
                      href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pubmedId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--text-muted)] text-xs font-mono hover:text-[var(--text-bright)]"
                    >
                      PubMed
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
