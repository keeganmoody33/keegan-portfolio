---
name: canonical-docs-system
description: Enforces a documentation-first workflow by interrogating requirements, drafting the six canonical docs (PRD, APP_FLOW, TECH_STACK, FRONTEND_GUIDELINES, BACKEND_STRUCTURE, IMPLEMENTATION_PLAN), cross-referencing them, and maintaining CLAUDE.md/progress.txt. Use when starting a project, creating or refreshing canonical docs, or turning a plan into authoritative documentation.
---

# Canonical Docs System

## Quick start

1. Read existing docs (if any): `PRD.md`, `APP_FLOW.md`, `TECH_STACK.md`, `FRONTEND_GUIDELINES.md`, `BACKEND_STRUCTURE.md`, `IMPLEMENTATION_PLAN.md`.
2. Read session context: `CLAUDE.md`, `progress.txt`, and `lessons.md`.
3. If requirements are unclear, run the interrogation step before drafting docs.
4. Draft the six canonical docs using the templates below.
5. Cross-reference and validate consistency across all docs.
6. Do not start implementation work until docs are complete and consistent.

## Interrogation (requirements discovery)

Ask until assumptions are removed:

- Who is this for?
- What is the core user action?
- What happens on success?
- What happens on error?
- What data is saved?
- What data is displayed?
- Does it require login?
- Does it require a database?
- Does it need to work on mobile?
- What is explicitly out of scope?

Use the answers as the source material for the docs.

## Canonical docs: required sections

### PRD.md

- Product definition and purpose
- Target users and goals
- In scope
- Out of scope
- Features with status (shipped / in-progress / planned / parking lot)
- User stories
- Success criteria (definition of done)
- Non-goals
- Open questions
- References to the other five docs

### APP_FLOW.md

- Route inventory (all pages and routes)
- Primary user journey
- Flow details for each interaction:
  - Trigger
  - Steps
  - Success state
  - Error state
  - Empty state
- Mobile vs desktop differences
- References to the other five docs

### TECH_STACK.md

- Framework/runtime versions (exact)
- Dependencies (exact versions)
- Tooling (build, lint, test, format)
- External APIs/services
- Environment variables by layer
- Deployment targets
- Constraints/forbidden tech
- References to the other five docs

### FRONTEND_GUIDELINES.md

- Visual direction and tone
- Design tokens (color, type, spacing, radius, shadow)
- Layout rules and grids
- Component patterns and states
- Interaction/motion rules
- Responsive breakpoints
- Accessibility rules
- References to the other five docs

### BACKEND_STRUCTURE.md

- Data model overview
- Tables with columns, types, constraints
- Relationships and indexes
- Auth model
- API endpoint contracts
- Validation rules and edge cases
- Storage rules (if any)
- References to the other five docs

### IMPLEMENTATION_PLAN.md

- Phased build sequence
- Each step includes:
  - Goal
  - Inputs (docs/sections)
  - Outputs (files/artifacts)
  - Validation/checks
- Dependency ordering and rationale
- References to the other five docs

## Cross-reference checklist

- Each canonical doc references the other five.
- `CLAUDE.md` points to all six canonical docs plus `lessons.md` and `progress.txt`.
- `progress.txt` reflects current completion state.
- Terminology is consistent across docs (table names, feature names, route names).

## Output format

- Provide doc drafts in markdown with clear headings.
- Call out gaps, unknowns, and decisions needed before code.
- Stop after docs are drafted and consistency checks are listed.

## Additional resources

- See [reference.md](reference.md) for prompts, definitions, and examples.
