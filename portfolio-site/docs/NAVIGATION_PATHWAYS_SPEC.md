# Navigation & Pathways Architecture — Feature Spec

**Status:** LOCKED
**Created:** Feb 2, 2026
**Updated:** Feb 2, 2026
**Priority:** High (defines entire site structure)

---

## Final Decisions (Locked Feb 2, 2026)

| Decision | Answer |
|----------|--------|
| **Vinyl grid overlay** | Personal Projects + My Stack of Wax ONLY |
| **Physical Products** | Placeholder page for now (no content yet) |
| **Other nav items** | Just pages (Who I Am, About LecturesFrom, Contact, Work With Me) |
| **Built-out project click** | Route to `/projects/[id]` page |
| **Non-built project click** | Stay in overlay (simpler treatment) |
| **UX/UI transitions** | TBD in Aura — not specifying now |

---

## Overview

This spec defines the header navigation system, vinyl stack pathway model, project metadata schema, and detail page structure. It's the architectural foundation that everything else plugs into.

**Core metaphor:** Album covers / vinyl collection — tiles that flip, rotate, reveal details on hover, and route to deep-dive pages.

---

## 1. Information Architecture

### Top-Level Navigation Items

| # | Label | Slug | Type | Notes |
|---|-------|------|------|-------|
| 1 | Personal Projects | `/personal-projects` | collection | What I've been building on my own — **VINYL GRID** |
| 2 | Physical Products | `/physical-products` | page | **PLACEHOLDER** — no content yet |
| 3 | My Stack of Wax | `/stack-of-wax` | collection | Discogs API — **VINYL GRID** |
| 4 | Who I Am | `/about` | page | About me |
| 5 | About LecturesFrom | `/about-lecturesfrom` | page | The business side |
| 6 | Contact | `/contact` | page | Contact form/info |
| 7 | Work With Me | `/work-with-me` | page | For hire, collab, contract inquiries |

### Behavior Matrix

| Type | Click Behavior |
|------|----------------|
| `collection` | Opens vinyl grid overlay (Personal Projects, Stack of Wax) |
| `page` | Routes directly to page |
| `external` | Opens in new tab |

### Project Tile Click Behavior

| Project Status | Click Behavior |
|----------------|----------------|
| **Built-out** (has repo, visuals, lots to explain) | Route to `/projects/[id]` page |
| **Not fully built** (concept, WIP, minimal content) | Stay in overlay (simpler treatment) |

---

## 2. File Structure

```
portfolio-site/
├── lib/
│   ├── nav.ts              # Navigation config source of truth
│   └── projects.ts         # Project metadata (local JSON → Supabase later)
├── components/
│   ├── header/
│   │   └── NavBar.tsx      # Consumes nav.ts
│   └── pathways/
│       ├── VinylOverlay.tsx    # Full-screen overlay grid
│       └── VinylTile.tsx       # Individual project tile
├── app/
│   ├── projects/
│   │   └── [id]/
│   │       └── page.tsx    # Dynamic project detail page
│   ├── personal-projects/
│   │   └── page.tsx        # Alternative direct route
│   ├── physical-products/
│   │   └── page.tsx
│   ├── stack-of-wax/
│   │   └── page.tsx        # Discogs collection
│   ├── about/
│   │   └── page.tsx
│   ├── about-lecturesfrom/
│   │   └── page.tsx
│   ├── contact/
│   │   └── page.tsx
│   └── work-with-me/
│       └── page.tsx
```

---

## 3. Navigation Config (`lib/nav.ts`)

```typescript
export type NavItemType = "collection" | "page" | "external";

export type ProjectCategory =
  | "personal-projects"
  | "physical-products"
  | "stack-of-wax";

export interface NavItem {
  id: string;
  label: string;
  slug: string;
  type: NavItemType;
  collectionKey?: ProjectCategory;  // For collection types
  description?: string;             // Short copy for overlay header
}

export const navItems: NavItem[] = [
  {
    id: "personal-projects",
    label: "Personal Projects",
    slug: "/personal-projects",
    type: "collection",
    collectionKey: "personal-projects",
    description: "What I've been building on my own time"
  },
  {
    id: "physical-products",
    label: "Physical Products",
    slug: "/physical-products",
    type: "collection",
    collectionKey: "physical-products",
    description: "Ideations and product concepts"
  },
  {
    id: "stack-of-wax",
    label: "My Stack of Wax",
    slug: "/stack-of-wax",
    type: "collection",
    collectionKey: "stack-of-wax",
    description: "My vinyl collection via Discogs"
  },
  {
    id: "who-i-am",
    label: "Who I Am",
    slug: "/about",
    type: "page"
  },
  {
    id: "about-lecturesfrom",
    label: "About LecturesFrom",
    slug: "/about-lecturesfrom",
    type: "page"
  },
  {
    id: "contact",
    label: "Contact",
    slug: "/contact",
    type: "page"
  },
  {
    id: "work-with-me",
    label: "Work With Me",
    slug: "/work-with-me",
    type: "page"
  }
];
```

---

## 4. Project Metadata Schema (`lib/projects.ts`)

```typescript
export type ProjectCategory =
  | "personal-projects"
  | "physical-products"
  | "stack-of-wax";

export interface ProjectLink {
  type: "demo" | "source" | "doc";
  label: string;
  url: string;
}

export interface ProjectMeta {
  id: string;                    // slug
  title: string;
  category: ProjectCategory;
  shortGoal: string;             // tile "goal / purpose" (1-2 lines)
  technicalStack: string[];      // chips
  keyLearnings: string[];        // 2-3 bullets
  primaryImage: string;          // URL for tile art (album cover)
  secondaryImages?: string[];

  // Narrative content (for detail page)
  why: string;                   // "Why I Built It"
  technicalBreakdown: string;    // Architecture, implementation details
  outcome: string;               // What happened, shipped?, learnings

  links?: ProjectLink[];
}

// Helper functions
export function getProjectsByCategory(category: ProjectCategory): ProjectMeta[] {
  return projects.filter(p => p.category === category);
}

export function getProjectById(id: string): ProjectMeta | undefined {
  return projects.find(p => p.id === id);
}

// Data (start local, migrate to Supabase later)
export const projects: ProjectMeta[] = [
  // TODO: Populate with actual projects
];
```

**Migration path:** This local JSON can be swapped to Supabase without touching the UI — just change the data source in the helper functions.

---

## 5. Interaction Model: Vinyl Stack Pathways

### Pathway State Management

```typescript
// In layout or context provider
type Pathway =
  | { type: "collection"; category: ProjectCategory }
  | { type: "page"; slug: string }
  | null;

const [activePathway, setActivePathway] = useState<Pathway>(null);
```

### Header → Vinyl Grid Flow

```
[User hovers nav item]
         ↓
[Subtle preview effect: scale/underline]
         ↓
[User clicks collection item]
         ↓
[Full-screen VinylOverlay opens]
         ↓
[Shows: Title, description, tiles from getProjectsByCategory()]
         ↓
[User clicks a tile]
         ↓
[Routes to /projects/[id]]
```

### Single Page Flow

```
[User clicks page item (About, Contact, etc.)]
         ↓
[Routes directly to page]
```

---

## 6. VinylTile Component

### Tile Content (Front)

| Element | Description |
|---------|-------------|
| Hero visual | Square, album cover style |
| Project name | Bold, readable |
| Short goal | 1-2 line purpose statement |

### Tile Content (Hover/Flip)

| Element | Description |
|---------|-------------|
| Stack chips | Technical components used |
| Key learnings | 1-3 bullet insights |
| Subtle movement | Record being pulled/rotated (10-15° tilt) |

### Component Interface

```tsx
interface VinylTileProps {
  title: string;
  goal: string;
  stack: string[];
  learnings: string[];
  image: string;
  href: string;
}

<VinylTile
  title={p.title}
  goal={p.shortGoal}
  stack={p.technicalStack}
  learnings={p.keyLearnings}
  image={p.primaryImage}
  href={`/projects/${p.id}`}
/>
```

### Micro-interactions

| Interaction | Effect | Implementation |
|-------------|--------|----------------|
| Hover | Scale + tilt (10-15°) | CSS transform |
| Mouse tracking | 3D axis tilt follows cursor | Unicorn Studio or CSS perspective |
| Click | Slight press effect | Scale down briefly |
| Appear | Slide in as overlay opens | Staggered animation |

---

## 7. Project Detail Page Structure

**Route:** `app/projects/[id]/page.tsx`

### Sections

#### 1. Hero Block
- Title
- Tagline / goal
- Category badge
- Hero album-style visual

#### 2. Narrative: "Why I Built It"
- Tie into LecturesFrom context (honest, not polished)
- Personal motivation
- Problem being solved

#### 3. Technical Breakdown
- Stack overview (chips)
- Architecture sketch (text or diagram)
- Implementation details:
  - Edge functions
  - Multi-provider LLM routing
  - Supabase schema considerations
  - etc.

#### 4. Outcome / Impact
- Did it ship?
- What changed about how you build?
- Live usage metrics or qualitative outcomes
- Honest assessment (works, doesn't work, learned X)

#### 5. Links
- Source repo
- Live demo
- Related docs

---

## 8. Tool Integration

### Aura.build (Visual Layout Engine)

**Purpose:** Generate real HTML/Tailwind that can be transplanted into Next.js

**Use for:**
1. **Header + Overlay Layout**
   - Prompt: "Design a dark-mode portfolio header with bold, vinyl-inspired tiles for navigation. When a nav tile is active, show a full-screen grid of album-like project cards that can be exported to HTML/Tailwind."
   - Use Advanced Design Mode for spacing/breakpoints
   - Export and transplant into NavBar + VinylOverlay

2. **Card Component**
   - Design generic VinylTile with cover image, overlay gradient, title, purpose, stack row
   - Save as reusable component snippet

3. **Responsive Behavior**
   - Auto Breakpoints for 2-column (tablet) and 1-column (mobile)
   - Measurement overlays for spacing consistency

4. **Presentation Canvas**
   - Map pathways visually (useful for teaching decks later)

### Unicorn Studio (Motion & Atmosphere)

**Purpose:** Add depth, motion, and atmosphere

**Use for:**
1. **Hero Vinyl Stack Scene**
   - 3-6 vinyl covers in 3D space
   - Slow rotation, mouse tracking tilt
   - Subtle light trail on cursor movement
   - Export as embed for homepage or /stack-of-wax

2. **Micro Interactions**
   - Appear events for tiles sliding in
   - Mouse tracking + 3D axis tilt for "record under cursor" vibe

3. **Export Strategy**
   - Embed for specific routes (/, /stack-of-wax)
   - Or JSON scene data for runtime control

---

## 9. Discogs Integration (Stack of Wax)

### API Integration

```typescript
// lib/discogs.ts
const DISCOGS_USERNAME = 'lecturesfrom';
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;

export async function getCollection() {
  const res = await fetch(
    `https://api.discogs.com/users/${DISCOGS_USERNAME}/collection/folders/0/releases`,
    {
      headers: {
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
        'User-Agent': 'LecturesFrom/1.0'
      }
    }
  );
  return res.json();
}
```

### Data Mapping

Discogs releases → VinylTile format:
```typescript
{
  id: release.id.toString(),
  title: release.basic_information.title,
  artist: release.basic_information.artists[0].name,
  image: release.basic_information.cover_image,
  year: release.basic_information.year,
  genre: release.basic_information.genres[0]
}
```

---

## 10. Implementation Phases

### Phase 0 — Content Prep
- [ ] Finalize categories + list 6-12 projects for first run
- [ ] For each project, draft:
  - Title
  - Goal / purpose (1-2 lines)
  - Tech stack (3-8 items)
  - 2-3 learnings
  - Why / technical breakdown / outcome paragraphs
  - Links to repos/demos

### Phase 1 — Code Skeleton
- [ ] Add `lib/nav.ts` with nav items array
- [ ] Add `lib/projects.ts` with schema + helper functions
- [ ] Implement `NavBar` with clickable items that set Pathway state
- [ ] Implement basic `VinylOverlay` (Tailwind only, no Unicorn yet)
- [ ] Tiles route to `/projects/[id]`

### Phase 2 — Project Pages
- [ ] Create dynamic route `app/projects/[id]/page.tsx`
- [ ] Render 4 main sections using projects metadata
- [ ] Apply LecturesFrom "honest context" tone

### Phase 3 — Aura Integration
- [ ] Generate nav + overlay layout in Aura
- [ ] Generate vinyl card component
- [ ] Export HTML/Tailwind
- [ ] Refit into NavBar + VinylTile with data bindings
- [ ] Dial in mobile/tablet breakpoints

### Phase 4 — Unicorn Integration
- [ ] Build hero "vinyl stack" scene
- [ ] Add mouse tracking, 3D tilt, appear events
- [ ] Export as embed
- [ ] Slot into / hero or /stack-of-wax

### Phase 5 — Perplexity Labs Test Loop
- [ ] Point Labs at GitHub repo
- [ ] Attach product spec
- [ ] Generate UX tweaks (copy, ordering, empty states)
- [ ] Propose A/B variants
- [ ] Capture findings in PATHWAYS_NOTES.md

---

## 11. Project Inventory

### Personal Projects (all 15 confirmed)
| Project | Status | Notes |
|---------|--------|-------|
| demonstr8 | TBD | |
| scuttleWUTT | TBD | |
| the watchers | TBD | |
| bull-ish | TBD | |
| bucket BOOTH | TBD | |
| CAPTURE INGEST | TBD | |
| SUMMRRRSALT | TBD | |
| ACCOLADE | TBD | |
| punch2pen | TBD | |
| FEATURE FLIP | TBD | |
| pastthe\|margin | TBD | |
| ANGLES ALEDGED | TBD | |
| chatgpt \| avid-studio-engineer | TBD | |
| FROZEN CAMPAIGNS | TBD | |
| SPLIT \| MIN | TBD | |

*Not all complete — easy to add/subtract in the future*

### Physical Products
*Placeholder for now — no content yet*

---

## 12. Resolved Questions

1. ~~**Physical Products**~~ ✅ Placeholder page for now
2. ~~**Overlay vs Route**~~ ✅ Vinyl grid for Personal Projects + Stack of Wax; others are pages
3. ~~**Project tile behavior**~~ ✅ Built-out → page, not built → stay in overlay

## Remaining TBD (Design Phase)

1. **Mobile behavior** — Same vinyl grid or simplified list view?
2. **Overlay transitions/animations** — TBD in Aura
3. **Tile hover effects** — TBD in Aura/Unicorn Studio

---

## 13. Confirmed Accounts

| Service | Username/Handle |
|---------|-----------------|
| Discogs | lecturesfrom |
| GitHub | keeganmoody33 |

---

## 14. Dependencies

- Next.js App Router (existing)
- Tailwind CSS (existing)
- Supabase (existing, for later migration)
- Discogs API token (env var)
- Aura.build account
- Unicorn Studio account

---

## Related Features

| Feature | Relation |
|---------|----------|
| Turntable Loading | Entry experience before this navigation |
| Banner Widgets | Lives in header alongside nav |
| Alan Iverson | Chat overlay, separate from nav pathways |

---

*Spec v1.0 — Feb 2, 2026*
