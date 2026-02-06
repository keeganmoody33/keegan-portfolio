# Canonical Docs System Reference

## Interrogation prompt (copy/paste)

Before writing any code, interrogate my idea in Planning mode only. Assume nothing. Ask questions until there are no assumptions left.

## Doc generation prompt (copy/paste)

Based on our interrogation, generate my canonical documentation files:

- PRD.md
- APP_FLOW.md
- TECH_STACK.md
- FRONTEND_GUIDELINES.md
- BACKEND_STRUCTURE.md
- IMPLEMENTATION_PLAN.md

Use the answers from our conversation as the source material. Be specific and exhaustive. No ambiguity.

## Core concepts (short definitions)

- UI vs UX: UI is how it looks. UX is how it feels to use.
- Component: Reusable UI block (button, card, form).
- Layout: Where elements live on the page (columns, grids, sections).
- State: Data that changes (open/closed, loading, input value).
- Styling: Visual rules (colors, spacing, typography).
- Responsive design: Layout adapts across screen sizes.
- Pages vs routes: Pages are screens, routes are URLs.
- Frontend vs backend: UI vs server-side logic/data.
- API: Interface for data exchange (GET/POST/PUT/DELETE).
- Database: Persistent data storage.
- Auth: Login/logout and identity verification.

## Canonical docs reminder

The six canonical docs define scope, flow, tech, design, data, and build order.
Do not implement code before these are locked.

## Session docs reminder

- `CLAUDE.md` is the operating manual for AI sessions.
- `progress.txt` is the session memory.
- `lessons.md` captures mistakes and fixes for future sessions.

## Example progress.txt

```text
COMPLETED:
- User auth (email + Google)
- Dashboard layout

IN PROGRESS:
- Product detail page

NEXT:
- Shopping cart
- Checkout

KNOWN BUGS:
- Mobile nav does not close after click
```

## Example prompt that uses the docs

Read `CLAUDE.md` and `progress.txt` first. Then build step 2.3 from
`IMPLEMENTATION_PLAN.md`. Follow the flow in `APP_FLOW.md` section 3 and
style per `FRONTEND_GUIDELINES.md`.

## Verification basics

- Test mobile and desktop.
- Check empty states and error states.
- Ensure secrets are not exposed in the frontend.
