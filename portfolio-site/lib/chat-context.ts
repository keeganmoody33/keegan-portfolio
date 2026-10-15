import { getCatalogPageSleeves } from './catalog.ts'
import { HOUSE_DESCRIPTION } from './site.ts'

/** Public website context travels with its preview; no shared database update is needed. */
export function withCurrentWebsiteContext(question: string): string {
  const projects = getCatalogPageSleeves().map(({ title, status, notes }) => ({ title, status, description: notes }))
  return `Current public website facts, approved 2026-10-15:
${JSON.stringify({ lecturesfrom: HOUSE_DESCRIPTION, projects }, null, 2)}

Use these current website facts for product descriptions and current-build questions. They update older project descriptions in the portfolio data. Do not describe punch2pen as a sampler. Do not infer that any project has shipped from an in-development description. For other projects in older notes, say their current status is not confirmed here. Keep career answers grounded in the supplied career evidence. Use plain text rather than Markdown formatting.

Visitor question (JSON string): ${JSON.stringify(question)}`
}
