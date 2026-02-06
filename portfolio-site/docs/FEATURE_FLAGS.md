# Feature Flags — Portfolio

**Created:** Feb 2, 2026
**Purpose:** Configuration flags for feature toggles and settings

---

## 🎛️ NAV

| Flag | Description | Default |
|------|-------------|---------|
| `nav.personalProjects.vinylGrid` | Opens vinyl grid overlay | `true` |
| `nav.stackOfWax.vinylGrid` | Opens vinyl grid overlay (Discogs) | `true` |
| `nav.physicalProducts.placeholder` | Shows "coming soon" treatment | `true` |
| `nav.staticPages` | Who I Am, About LecturesFrom, Contact, Work With Me | `true` |
| `nav.projectRouting.builtOut` | Built-out projects → `/projects/[id]` | `true` |
| `nav.projectRouting.overlay` | Non-built projects stay in overlay | `true` |

---

## 🎨 OVERLAYS

| Flag | Description | Default |
|------|-------------|---------|
| `overlay.vinylGrid.enabled` | Full-screen vinyl grid overlay | `true` |
| `overlay.vinylTile.hoverTilt` | 10-15° tilt on hover | `true` |
| `overlay.vinylTile.stackReveal` | Slide-up overlay with stack/learnings | `true` |
| `overlay.closeOnEscape` | ESC key closes overlay | `true` |

---

## 🤖 MACHINE MODE

| Flag | Description | Default |
|------|-------------|---------|
| `machineMode.toggle.enabled` | Human/Machine toggle visible | `true` |
| `machineMode.toggle.stickyBottom` | Fixed bottom-center position | `true` |
| `machineMode.urlParam` | Support `?view=machine` landing | `true` |
| `machineMode.localStorage` | Remember preference | `false` |
| `machineMode.turntable.configVersion` | Show config panel instead of visual turntable | `true` |
| `machineMode.content.hero` | Dual content for hero section | `true` |
| `machineMode.content.about` | Dual content for about section | `true` |
| `machineMode.content.jdAnalyzer` | JD Analyzer proof section | `true` |
| `machineMode.content.chatApi` | Chat API proof sub-block | `false` |

---

## 📦 WIDGETS (Banner)

| Flag | Description | Default |
|------|-------------|---------|
| `widgets.youtubePlayer.enabled` | Persistent YouTube player | `true` |
| `widgets.youtubePlayer.playlistBrowse` | Can switch tracks | `true` |
| `widgets.github.enabled` | GitHub activity widget | `true` |
| `widgets.github.retroBars` | Classic vertical bar style | `true` |
| `widgets.discogs.enabled` | Recent Digs widget | `true` |
| `widgets.worthyReads.enabled` | Curated reading list | `false` |
| `widgets.banner.hoverStop` | Marquee stops on hover | `true` |

---

## 🎬 TURNTABLE

| Flag | Description | Default |
|------|-------------|---------|
| `turntable.enabled` | Show turntable intro | `true` |
| `turntable.skipButton.enabled` | Subtle skip option | `true` |
| `turntable.skipButton.lameCopy` | "Lame" messaging instead of "skip" | `true` |
| `turntable.returnVisitor.skip` | localStorage skip for return visitors | `true` |
| `turntable.reducedMotion.skip` | Auto-skip for prefers-reduced-motion | `true` |

---

## 🏀 ALAN IVERSON

| Flag | Description | Default |
|------|-------------|---------|
| `alan.enabled` | Show Alan character | `true` |
| `alan.everyOpen` | Alan appears every chat open | `true` |
| `alan.introBubble.enabled` | "Practice" line bubble | `true` |
| `alan.introBubble.firstPerSession` | Only first open per session | `true` |
| `alan.idleState.enabled` | Alan stays visible after handoff | `true` |
| `alan.idleState.opacity` | Idle opacity level | `0.8` |
| `alan.idleState.animation` | Subtle blink/bounce | `true` |
| `alan.style.streetA` | Prototype Street 3D | `true` |
| `alan.style.comic60sB` | Prototype 60s Comic | `true` |

---

## ✨ MOTION

| Flag | Description | Default |
|------|-------------|---------|
| `motion.vinylTilt.enabled` | Hover tilt on tiles | `true` |
| `motion.vinylTilt.degrees` | Tilt amount | `12` |
| `motion.unicornStudio.enabled` | Unicorn Studio embeds | `false` |
| `motion.turntable.spin` | Record spinning animation | `true` |
| `motion.alan.swoop` | Alan entrance animation | `true` |
| `motion.reducedMotion.respect` | Honor prefers-reduced-motion | `true` |

---

## 📊 ANALYTICS

| Flag | Description | Default |
|------|-------------|---------|
| `analytics.machineMode.toggleEngagement` | Track toggle interactions | `true` |
| `analytics.machineMode.timeInMode` | Track time spent per mode | `true` |
| `analytics.turntable.skipRate` | Track skip button usage | `true` |
| `analytics.alan.introBubbleSeen` | Track intro completion | `true` |

---

## 🔑 ACCOUNTS (Config)

```javascript
const config = {
  github: {
    username: "keeganmoody33"
  },
  discogs: {
    username: "lecturesfrom"
  },
  youtube: {
    playlistId: "PLK7yHtEENYGHUVVhW9oaFVKRhh-FORGOk"
  }
};
```

---

*Feature Flags v1.0 — Feb 2, 2026*
