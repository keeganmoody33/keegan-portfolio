# Human/Machine Toggle — Feature Spec

**Status:** LOCKED
**Created:** Feb 2, 2026
**Updated:** Feb 2, 2026
**Priority:** High (differentiator feature)
**Inspiration:** [Parallel.ai](https://parallel.ai)

---

## Final Decisions (Locked Feb 2, 2026)

| Decision | Answer |
|----------|--------|
| **Dual content v1** | Hero + About + one "Proof" section (not full site day one) |
| **Main proof section** | **JD Analyzer** — `POST /api/jd-analyze`, JSON Schema for I/O, example payloads |
| **Secondary proof** | **Chat API** — OpenAI-compatible style, streaming flag, context injection (abstract) |
| **Priority order** | Hero/About → How it works → Example workflows → Everything else after tooling |
| **Schema depth** | Start with A (abstracted/simplified), design to evolve to B/C later |
| **`?view=machine` landing** | "Config loading" turntable — runtime config panel, shows schema version, sample request |

---

## Overview

A toggle that switches between **Human mode** (traditional visual web design) and **Machine mode** (structured data, API schemas, AI-readable formats). Shows visitors how the same content is consumed by humans vs. AI agents.

**Why this matters for LecturesFrom:**
- The portfolio is already AI-queryable (Supabase + Claude integration)
- This feature makes that architecture *visible* and *educational*
- Meta-demonstration: the portfolio shows how it works
- Aligns with "honest context" philosophy — nothing hidden

---

## Core Concept

> "The web is transitioning from being designed purely for human consumption to also serving AI agents that need structured, declarative, and semantically rich data."

When users toggle between modes, they see the same content presented in radically different ways:

| Human Mode | Machine Mode |
|------------|--------------|
| Marketing copy, visuals, emotion | Structured schemas, API docs, code |
| Visual hierarchy, whitespace | Information density, type definitions |
| "Why you should care" | "How it technically works" |
| Benefit-focused | Capability-focused |

---

## Toggle Component

### Visual Design (from Parallel.ai observation)
- Horizontal toggle: `[● HUMAN]` `[○ MACHINE]`
- Pill shape with radio-button style indicators
- Active state: filled circle indicator (●)
- Inactive state: empty circle indicator (○)
- **Position: Sticky/floating at bottom center of viewport**
- Always accessible regardless of scroll position

### Behavior (observed)
- **Instant swap** — no transition animation
- **Scroll position preserved** when toggling
- Nav visible in both modes (just restyled)
- Content structure identical — only rendering changes

### States
```typescript
type ViewMode = 'human' | 'machine';

interface ModeContextValue {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}
```

### Interaction
- Click to toggle
- Keyboard: Space/Enter
- URL param: `?view=machine` for direct linking
- LocalStorage: remember preference (optional)

---

## Parallel.ai Transformation Patterns (Observed)

| Element | Human Mode | Machine Mode |
|---------|------------|--------------|
| Navigation | Visual navbar, dropdowns, styled buttons | Markdown links with visible URLs |
| Headlines | Typography hierarchy, gradients | `#` and `##` markdown headers |
| Features | Card grid, bold headings, icons | `###` headers with plain text descriptions |
| Data tables | Interactive charts, scatter plots | Markdown tables with pipe separators |
| CTAs | Styled buttons (orange, pill shape) | `[Button Text](https://url)` |
| Logos | Visual logo images | Company names as text |
| Background | Gradients, visual effects | Solid dark (#000 or similar) |
| Font | Sans-serif, varied weights | Monospace, uniform weight |

---

## Content Transformation Examples

### Hero Section

**Human:**
```
Keegan Moody
GTM Engineer | Builder | Researcher

I connect people to products through systems, strategy, and story.
```

**Machine:**
```json
{
  "candidate": {
    "name": "Keegan Moody",
    "role": "GTM Engineer",
    "core_competencies": ["systems_building", "strategy", "storytelling"],
    "api_endpoint": "/api/chat",
    "model": "claude-opus-4-5-20251101",
    "context_source": "supabase/ai_instructions"
  }
}
```

### Experience Timeline

**Human:**
- Visual cards with company logos
- Date ranges, job titles
- Narrative descriptions

**Machine:**
```sql
SELECT * FROM experiences
WHERE candidate_id = 'keegan-moody'
ORDER BY start_date DESC;

-- Schema: id, company, title, start_date, end_date,
--         description, skills[], achievements[]
```

### Projects Grid

**Human:**
- Album cover tiles
- Hover reveals goal + stack
- Click → detail page

**Machine:**
```typescript
interface ProjectMeta {
  id: string;
  title: string;
  category: ProjectCategory;
  shortGoal: string;
  technicalStack: string[];
  keyLearnings: string[];
  // ... full schema
}

// API: GET /api/projects?category=personal-projects
```

### Chat Interface

**Human:**
- Alan Iverson intro animation
- Conversational chat UI
- Natural language responses

**Machine:**
```yaml
chat_architecture:
  entry_point: /api/chat
  model: claude-opus-4-5-20251101
  context_injection:
    - supabase.ai_instructions
    - supabase.candidate_profile
    - supabase.experiences
    - supabase.skills
  persona_layer: "Alan Iverson cameo → Keegan voice"
  guardrails:
    - "Never volunteer weaknesses"
    - "Honest but not self-sabotaging"
```

---

## Technical Implementation

### Context Provider

```tsx
// lib/mode-context.tsx
import { createContext, useContext, useState, useEffect } from 'react';

type ViewMode = 'human' | 'machine';

const ModeContext = createContext<{
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}>({
  mode: 'human',
  setMode: () => {}
});

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ViewMode>('human');

  // Check URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'machine') {
      setMode('machine');
    }
  }, []);

  // Optional: persist to localStorage
  useEffect(() => {
    localStorage.setItem('viewMode', mode);
  }, [mode]);

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export const useMode = () => useContext(ModeContext);
```

### Toggle Component

```tsx
// components/ModeToggle.tsx
import { useMode } from '@/lib/mode-context';
import { motion } from 'framer-motion';

export function ModeToggle() {
  const { mode, setMode } = useMode();

  return (
    <div className="flex rounded-full border border-white/20 p-1">
      <button
        className={`px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider transition-all ${
          mode === 'human'
            ? 'bg-white text-black'
            : 'text-white/60 hover:text-white'
        }`}
        onClick={() => setMode('human')}
        aria-pressed={mode === 'human'}
      >
        Human
      </button>
      <button
        className={`px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider transition-all ${
          mode === 'machine'
            ? 'bg-white text-black'
            : 'text-white/60 hover:text-white'
        }`}
        onClick={() => setMode('machine')}
        aria-pressed={mode === 'machine'}
      >
        Machine
      </button>
    </div>
  );
}
```

### Content Renderer

```tsx
// components/DualContent.tsx
import { useMode } from '@/lib/mode-context';
import { AnimatePresence, motion } from 'framer-motion';

interface DualContentProps {
  human: React.ReactNode;
  machine: React.ReactNode;
}

export function DualContent({ human, machine }: DualContentProps) {
  const { mode } = useMode();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        {mode === 'human' ? human : machine}
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## Machine Mode Styling

### Typography
- Font: Monospace (JetBrains Mono, Fira Code)
- Color: Green-on-black terminal aesthetic, or clean white-on-dark
- Code blocks: Syntax highlighting
- Reduced visual hierarchy — more information density

### Layout
- Less whitespace
- Grid-based data display
- Collapsible sections for deep schemas
- Horizontal scroll for wide code blocks

### Visual Treatment Options

**Option A: Terminal Aesthetic**
- Black background, green/amber text
- Cursor blink effects
- "Typing" animation for content reveal

**Option B: Clean Technical**
- Dark mode with syntax highlighting
- Card-based schema displays
- Mermaid diagrams for architecture

**Option C: Hybrid**
- Mostly clean, with terminal accents
- Code blocks in terminal style
- Prose in clean technical sans-serif

---

## Content Schema

Each section needs dual representations:

```typescript
interface DualContentSection {
  id: string;
  human: {
    type: 'hero' | 'timeline' | 'grid' | 'narrative';
    content: HumanContent;
    assets?: string[];  // images, videos
  };
  machine: {
    type: 'schema' | 'api' | 'sql' | 'config';
    content: string;    // code/structured data
    language?: string;  // for syntax highlighting
    source?: string;    // link to actual file/endpoint
  };
}
```

---

## Integration with Existing Features

### Turntable Loading
- Human mode: Full vinyl experience
- Machine mode: Skip intro, show session config

### Navigation Pathways
- Human mode: Vinyl grid overlay
- Machine mode: JSON project manifest, API endpoints

### Alan Iverson Chat
- Human mode: Full animation + conversational UI
- Machine mode: Show prompt engineering, context injection, model config

### Banner Widgets
- Human mode: Visual widgets (Tidal, GitHub, Discogs)
- Machine mode: API response payloads, webhook configs

---

## Accessibility

### Requirements
- ARIA labels: `aria-pressed="true/false"`
- Keyboard navigation: Tab → Space/Enter to toggle
- Screen reader: Announce mode change
- Focus management when content transforms
- Respect `prefers-reduced-motion`

### Implementation
```tsx
<button
  role="switch"
  aria-checked={mode === 'machine'}
  aria-label="Toggle between human and machine view"
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setMode(mode === 'human' ? 'machine' : 'human');
    }
  }}
>
```

---

## Analytics

### Metrics to Track
- Toggle engagement rate (% who interact)
- Time spent in each mode
- Sections most viewed in machine mode
- Correlation with developer audience
- Return visit mode preference

### Events
```typescript
analytics.track('mode_toggle', {
  from: 'human',
  to: 'machine',
  section: 'hero',
  session_id: '...'
});
```

---

## Implementation Phases

### Phase 1: Core Toggle
- [ ] ModeContext provider
- [ ] ModeToggle component
- [ ] Place in header
- [ ] Basic transition animation

### Phase 2: Hero + About
- [ ] Dual content for hero section
- [ ] Dual content for about/bio
- [ ] Show actual Supabase schema in machine mode

### Phase 3: Projects + Timeline
- [ ] Dual content for experience timeline
- [ ] Dual content for projects grid
- [ ] API endpoint documentation in machine mode

### Phase 4: Chat Integration
- [ ] Show chat architecture in machine mode
- [ ] Display prompt engineering / context injection
- [ ] Model config and guardrails visible

### Phase 5: Polish
- [ ] URL param support (`?view=machine`)
- [ ] LocalStorage persistence
- [ ] Analytics integration
- [ ] Performance optimization
- [ ] Accessibility audit

---

## Resolved Questions

1. ~~**Toggle placement**~~ ✅ Sticky/floating at bottom center (from Parallel.ai observation)
2. ~~**Machine mode depth**~~ ✅ Start abstracted (A), design to evolve to B/C
3. ~~**Turntable in machine mode**~~ ✅ "Config loading" version — runtime config panel
4. ~~**Which sections first**~~ ✅ Hero + About + JD Analyzer proof section

## Remaining TBD

1. **Default for developers**: Auto-detect and default to machine? (nice-to-have)
2. **Mobile treatment**: Same experience or simplified?

---

## Dependencies

- Framer Motion (animations)
- React Context (state management)
- Syntax highlighting library (Prism, Shiki, or highlight.js)
- Existing Supabase schema (source of truth for machine content)

---

## Related Features

| Feature | Relation |
|---------|----------|
| Turntable Loading | Entry point — may skip in machine mode |
| Alan Iverson Chat | Shows underlying architecture in machine mode |
| Navigation Pathways | Project data schemas visible in machine mode |
| Banner Widgets | API responses visible in machine mode |

---

*Spec v1.0 — Feb 2, 2026*
*Source: Parallel.ai Human/Machine toggle concept*
