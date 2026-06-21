# Design Migration Plan — Claude Desktop App Aesthetic

## TL;DR

The current look (`app/globals.css`) is a minimalist "light academic" theme: cool
off-white background (`#FAFAF8`), indigo-blue accent (`#5B6B9A`) used for *every*
interactive element (buttons, links, progress bars, badges, focus rings), tracked-out
uppercase panel labels, and fairly heavy box-shadows. That combination is what reads as
"AI slop" — it's the default Tailwind-adjacent look every generated app converges on.

Claude's desktop app reads differently because of a few deliberate, consistent choices:

1. **Warm paper background, not cool gray-white.** Everything sits on a cream/off-white
   (`#FAFAF8`-ish but warm, not blue-tinted) rather than pure white or cool gray.
2. **Color roles are split, not unified.** Black = primary action. Blue = focus/toggle/
   link. Terracotta orange = brand mark only, used rarely and deliberately. Proofer
   currently uses one blue for all four roles — this is the single biggest visual tell.
3. **Flat surfaces, thin borders, almost no shadow.** Cards are white-on-cream with a
   1px warm-gray border. Shadows are nearly absent except on floating overlays (modals).
4. **Two-typeface system.** Sans-serif for all UI chrome (nav, labels, buttons, body
   text). A serif display face appears *only* on a handful of large centered hero
   headings (empty states, landing-style pages) — not on every `<h1>`.
5. **Pill-shaped everything for controls, soft-rounded rectangles for content.** Segmented
   tabs, filter chips, and status badges are fully rounded (999px). Cards, panels, and
   modals use 12–20px radii. Buttons sit in between (8–10px).
6. **Inline code/data spans get color-coded pill treatment**, not a flat monospace gray
   background — e.g. a CSS variable name renders in a soft coral pill, not a gray box.

This plan translates those rules into concrete edits to the existing CSS-variable
system in `app/globals.css`, in the order the `/loop` design-overhaul work should apply
them. It does not introduce a CSS framework — Proofer has no Tailwind and shouldn't
gain one; everything below stays inside the existing `--*` custom-property convention.

---

## Source material

Extracted from 12 screenshots of the Claude desktop app: chat thread, sidebar, Settings
modal, Routines/Cowork pages, Customize landing, plugin detail page, sidebar-customize
modal, a dark-mode Code-tab view, an Artifacts empty state, and a real Chat-mode
response rendering long-form markdown (math notes with prose, a callout block, and
inline LaTeX). The dark-mode and long-form-response screenshots arrived after the
first draft of this plan and changed two things below — noted inline where relevant.

---

## Phase 0 — Design tokens (`app/globals.css` `:root` / `[data-theme="dark"]`)

This is the foundation; every later phase depends on these values existing first.

### Light tokens

| Token | Current | New | Notes |
|---|---|---|---|
| `--bg` | `#FAFAF8` | `#FAF9F5` | Warmer, slightly more cream. Subtle but sets the whole tone. |
| `--bg-soft` | `#F3F3F0` | `#F3F1EA` | Warm-shifted version of the above, used for input fills / hover rows. |
| `--panel` | `#FFFFFF` | `#FFFFFF` | Unchanged — cards stay pure white against the cream bg, that contrast is part of the look. |
| `--border` | `#E4E4E1` | `#E8E6E0` | Warm light gray-beige, barely visible — Claude's borders are *very* faint. |
| `--text` | `#1C1C1C` | `#262420` | Warm near-black, not pure black. |
| `--muted` | `#6B7280` | `#87867E` | Warm gray, not cool blue-gray. This alone fixes a lot of the "generated app" feel. |
| `--accent` | `#5B6B9A` (indigo) | `#2F6FED` | **Role change, not just recolor** — see "Accent color split" below. This becomes the focus-ring/toggle/link blue. |
| `--accent-soft` | `#EEF0F6` | `#E8EFFD` | Soft version of the new blue. |
| `--accent-strong` *(new token)* | — | `#1A1A18` | Near-black, used for primary buttons (`.btn-primary`, `.cta`, `New project`-style CTAs). |
| `--brand` *(new token)* | — | `#D97757` | Terracotta. Reserved for nav-brand wordmark, the orange "spotlight" left-border accent already on the home page, and any small one-off brand flourish. **Not** used for buttons/links/progress bars. |
| `--brand-soft` *(new token)* | — | `#F7E9E1` | Soft terracotta, for the inline-code-pill treatment (Phase 5). |
| `--warn-soft` *(new token)* | — | `#F5E6BE` | The amber/tan toast & "Bypass permissions"-pill background seen in the screenshots — distinct from `--amber-soft`, slightly more saturated/tan. |
| `--green` / `--amber` / `--red` / `--purple` | unchanged | unchanged | These are semantic (verdict colors), not brand colors — Claude's UI doesn't define equivalents, keep Proofer's existing palette. |
| `--panel-shadow` | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | `0 1px 2px rgba(0,0,0,0.03)` | Much lighter. Claude's cards are nearly flat; the current double-shadow is what makes panels look "designed" rather than native. |

### Dark tokens (now screenshot-confirmed, not purely derived)

A dark-mode Code-tab screenshot confirms the direction: background is a genuinely warm
near-black (not the cool `#1A1B1E` Proofer uses today), borders are barely visible, and
the active-orange dot/sparkle stays fully saturated against dark — Claude doesn't
desaturate the brand color for dark mode the way Proofer currently dims its other
accent colors.

| Token | New |
|---|---|
| `--bg` | `#1C1B18` |
| `--bg-soft` | `#262420` |
| `--panel` | `#222019` |
| `--border` | `#37352D` |
| `--text` | `#E8E6DF` |
| `--muted` | `#94928A` |
| `--accent` | `#5C8DFF` (lightened blue for dark bg) |
| `--accent-soft` | `#1E2A4A` |
| `--accent-strong` | `#F0EEE8` (unverified — see note below) |
| `--brand` | `#E8714A` (confirmed: stays bright/saturated on dark, doesn't mute like other accents) |
| `--brand-soft` | `#3A2A22` |
| `--warn-soft` | `#332B16` (confirmed direction: dark olive-amber, not a desaturated pastel) |

**One real correction from the screenshot:** the closest thing to a primary CTA visible
in dark mode (`Create PR`) rendered as a dark ghost/outline button — light border, no
fill — not an inverted white block. That's a single data point, not a pattern, but it
suggests `--accent-strong` inverting to near-white may be too aggressive; consider
defaulting dark-mode `.btn-primary` to an outlined treatment (`background: transparent;
border: 1px solid var(--text)`) instead of a solid near-white fill, and revisit once a
real primary-button-in-dark screenshot is available.

### Accent color split — the key structural change

Today, `--accent` drives: `.btn-primary` background, `.cta` background, all link
colors (`a { color: var(--accent) }`), every progress `.bar > span`, `.pill.unlock`,
focus rings, badge accents, the nav active-underline, mode-option selection borders —
essentially every "this is interactive/important" signal in the app.

Claude's app never does this — black means "primary action," blue means "focus or
toggle," and the brand color means "this is Claude," full stop. Mapping:

- **`.btn-primary`, `.cta`, any solid filled CTA** → background becomes
  `var(--accent-strong)` (near-black), not `var(--accent)`. White text stays.
- **Links (`a`), focus rings, `:focus-visible`, toggle/checkbox accent-color,
  `.mode-option.active` border** → stay on `var(--accent)`, which is now blue
  (`#2F6FED`) instead of indigo. Visually this is the smallest change since it's
  still "a blue," just a cleaner, more saturated one.
- **Progress bars (`.bar > span`, `.session-progress-bar`, `.goal-pill-fill`,
  mastery bars)** → this is genuinely ambiguous in Claude's app since it has no
  progress-bar pattern to copy. Recommend keeping these on `var(--accent)` (blue) for
  continuity rather than forcing brand orange into a role Claude doesn't actually use
  it for — progress/mastery is Proofer's own pattern, not something being copied.
- **`var(--brand)` (terracotta)** → reserved for: `.nav-brand` text color (a
  one-word wordmark, not body text, mirrors how sparingly Claude uses orange), the
  existing `.panel-spotlight` left-border accent on the home page (this already reads
  as "this is the one warm/branded panel" — good instinct already in place, just
  needs the right hex), and nothing else for now. Resist the urge to spread it further;
  Claude's restraint with orange is part of why it doesn't look "AI slop."

---

## Phase 1 — Typography

Claude's UI sans-serif looks like a humanist grotesque (Styrene/similar — not
available as a web font without licensing). Closest free-to-use equivalent: **Inter**,
which is also already in the current `font-family` stack as a fallback. Promote it to
primary and load it properly instead of relying on system-font fallback so weights
render consistently cross-platform.

For serif, use **Lora** or **Source Serif 4** (both free, both close to the
Tiempos-family look) loaded via `next/font/google` — do not self-host a paid face.

**Revised after seeing a real Chat-mode response and an Artifacts empty state** — serif
in Claude's app has two distinct jobs, not one:

1. **Hero/empty-state section titles** — "Customize Claude," the empty "Projects"
   title, the empty "Artifacts" title. Large, bold, centered or near-top-of-page. This
   is the use case the first draft of this plan covered.
2. **Long-form prose body text in Chat-mode responses** — the math-notes screenshot
   shows the *entire response body* (paragraphs, bold emphasis, the callout block) set
   in serif, including inline bold like "**no degenerat**." This is the bigger find:
   Claude reserves serif for "reading" contexts specifically, and **Cowork/Code-agent
   responses stay sans-serif** (the "Daily proofer" Cowork screenshot from the first
   batch is plain sans-serif body text) — the split is reading vs. tool-output, not
   page-type vs. heading-type.

That second case maps directly onto Proofer's `.markdown` class — node content,
AI explanations, problem statements are exactly the "reading" content Claude sets in
serif, as opposed to grading feedback / hint panels / tool-like UI which stay
sans-serif (those are closer to Cowork tool-output than to reading prose).

```css
/* app/globals.css */
html, body {
  font-family: var(--font-sans, "Inter", -apple-system, BlinkMacSystemFont,
    "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
}

.hero-title {
  font-family: var(--font-serif, "Lora", Georgia, serif);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.markdown {
  font-family: var(--font-serif, "Lora", Georgia, serif);
  /* headings inherit the serif family too — Claude's response used one
     family throughout, varying only weight/size, not switching families
     between heading and body within the same piece of reading content. */
}
```

Wire `--font-sans` / `--font-serif` via `next/font/google` in `app/layout.tsx`
(the standard Next.js 15 pattern — avoids a render-blocking `<link>` and gives
`font-display: swap` for free).

**Where serif actually applies, now with real examples to anchor to:**
- `.hero-title` → empty-state page titles. Proofer doesn't have one used today, but
  now has three confirmed Claude precedents (Customize/Projects/Artifacts empty
  states) instead of two — worth retrofitting onto a genuine empty state (e.g. the
  empty `/quality` "no issues found" view, zero-result `/browse` search) rather than
  treating it as theoretical.
- `.markdown` → **this one now has a strong case for landing on real, current pages**:
  node content (`app/node/[slug]/page.tsx`), `ReExplain`, `CompareWith`, and the
  problem/answer text in `ProblemCard`. This is a more confident recommendation than
  the first draft gave it.
- Regular page headers (`Routines`, `Dispatch`, `Productivity`, node title `<h1>`
  itself, nav, breadcrumbs, buttons) stay sans-serif — confirmed unchanged by the new
  screenshots, these are still plain bold sans in every example.

### Callout/blockquote restyle (new, from the math-notes screenshot)

The formal-statement callout in the response renders as a thick left border on the
*same* background as the surrounding text — no filled box. Proofer's current
`.markdown blockquote` fills with `var(--bg-soft)` and rounds the right corners, which
reads as a distinct "card," not an inline emphasis device. Replace:

```css
.markdown blockquote {
  border-left: 3px solid var(--text);   /* was var(--border) — Claude's bar reads dark/solid, not faint */
  background: none;                      /* was var(--bg-soft) */
  border-radius: 0;                      /* was 0 8px 8px 0 */
  margin: 16px 0; padding: 4px 0 4px 18px;
  color: var(--text);
}
```

### Response action-row (observed, optional — not a current Proofer gap)

Both chat screenshots show a row of plain muted-gray icon buttons under each assistant
turn: copy, run/play, thumbs-up, thumbs-down, regenerate, plus a timestamp — no
backgrounds, generous spacing, icons only. Proofer's `.copy-btn` already matches this
treatment (bordered icon button, muted color, border-color shifts to accent on hover).
No change needed; noting only because it confirms the existing `.copy-btn` pattern is
already correct and shouldn't be "improved" into something heavier during this
migration.

Drop the tracked-out uppercase panel-label convention currently on `.panel h2`
(`text-transform: uppercase; letter-spacing: 0.1em`). Nothing in the Claude screenshots
uses small-caps/tracked-out labels — section headers ("Settings", "Outputs", "General")
are plain bold sentence case at normal size. Change `.panel h2` to:

```css
.panel h2 {
  font-size: 14px; font-weight: 700; color: var(--text);
  text-transform: none; letter-spacing: normal; margin: 0 0 14px;
}
```

This is a bigger visual shift than it sounds — the uppercase-tracked micro-label is
one of the most recognizable "generated SaaS dashboard" signatures, and removing it
across every `.panel h2` (stat labels stay separate, see Phase 3) does a lot of the
de-slop work by itself.

---

## Phase 2 — Core surfaces: panels, buttons, inputs

### Panels / cards (`.panel`, `.area-card`, `.score-chip`, `.daily-goal-bar`, etc.)

```css
.panel {
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px;
  box-shadow: var(--panel-shadow); /* now the much lighter Phase 0 value */
}
```
Radius goes from `10px` → `12px`. Shadow already updated in Phase 0 — no other change
needed here, the token swap does the work.

### Buttons

```css
.btn-primary {
  background: var(--accent-strong); color: #FFFFFF;
  border-radius: 999px;            /* was 8px — Claude's primary CTAs are full pills */
  padding: 9px 20px; font-weight: 600; font-size: 14px;
  transition: opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.85; }

.btn-ghost {
  background: var(--panel); color: var(--text);
  border: 1px solid var(--border); border-radius: 999px;  /* was 8px */
  padding: 9px 18px; font-size: 14px;
}
.btn-ghost:hover:not(:disabled) { background: var(--bg-soft); border-color: var(--muted); }
```
Every screenshot button — "New project," "Copy link," "Done," "Update," "New routine"
— is a full pill, not a slightly-rounded rectangle. This is a small CSS change
(`border-radius: 999px`) with an outsized visual impact; do it everywhere `.btn-primary`
/`.btn-ghost`/`.cta` are used rather than introducing a new class.

### Inputs

```css
input[type="text"], input[type="email"], input[type="search"],
input[type="number"], input[type="password"], .answer-box, .form-input {
  background: var(--bg-soft); border: 1px solid var(--border);
  border-radius: 10px; /* keep — Claude's inputs are 10-12px, not pills */
}
input:focus, .answer-box:focus {
  border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus-ring);
}
```
No structural change needed — Proofer's input styling already matches Claude's
(rounded rect, not pill; blue focus ring). Just update `--focus-ring` to derive from
the new blue `--accent` (it already does, via `var(--accent)` reference — confirm
after Phase 0 lands).

### Segmented tab controls (new pattern — `.tab-bar` / `.tab-link` redesign)

Claude's "Chat / Cowork / Code" and "All / Calendar" controls are pill-track segmented
switches, not underlined tabs. Proofer's `.tab-bar`/`.tab-link` (quality page, node
page sections) currently use an underline-on-active pattern. Recommend introducing this
as the new default tab style, replacing the underline pattern:

```css
.tab-bar {
  display: inline-flex; gap: 2px; padding: 3px;
  background: var(--bg-soft); border-radius: 10px; border: none;
  margin-bottom: 20px;
}
.tab-link {
  padding: 6px 14px; font-size: 13px; font-weight: 500; color: var(--muted);
  border-radius: 8px; border: none; margin: 0;
}
.tab-link.active {
  background: var(--panel); color: var(--text); font-weight: 600;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
```
This replaces the current `border-bottom`/`-1px` underline trick entirely.

---

## Phase 3 — Nav, header, stat row

### `.app-nav`

Currently uses `--panel-translucent` + `backdrop-filter: blur(8px)`, which is fine and
matches the floating-toolbar feel of Claude's title bar — keep. Update
`--panel-translucent` light value to `rgba(255, 255, 255, 0.92)` (was `0.95`) for
slightly more warmth-through, and dark value proportionally.

### `.nav-brand`

```css
.nav-brand { color: var(--brand); font-weight: 700; }
```
This is the one place `--brand` (terracotta) replaces what is currently plain
`var(--text)`. Small, deliberate, exactly mirrors how restrained Claude's own orange
usage is (their sparkle mark, not body chrome).

### Stat row (`.stat-row`, `.stat`)

Drop the heavy bordered-pill-row treatment in favor of plainer flat numbers, matching
the metadata-row pattern from the plugin-detail screenshot (`Source / Version /
Author / Last updated`, plain labels over plain values, no borders/dividers between
cells):

```css
.stat-row { border: none; box-shadow: none; background: none; gap: 32px; }
.stat { border-right: none; padding: 0; }
.stat .l { text-transform: none; letter-spacing: normal; font-size: 12px; }
```

### Pills / badges (`.pill`, `.type-badge`, `.edge-type`, reason tags)

Already fully-rounded (`border-radius: 999px`) — no radius change needed. Tone down
saturation slightly to match the muted pastel badges in the screenshots (`.t-Definition`
etc. are already close). The one real change: status dots. Claude uses small solid
circles (not pills) for "unread"/"running" indicators in list rows (sidebar recents,
Cowork run history). Proofer's closest equivalent is `.verdict-dot`/`.progress-dot` —
no change needed structurally, just confirm they stay solid-fill circles, not outlined.

---

## Phase 4 — Modals

Settings/Customize-sidebar modal pattern: white panel, `border-radius: 20px` (bigger
than card radius), centered, minimal border, soft shadow only on the modal itself (not
on its internal cards, which stay flat per Phase 2).

```css
.modal-overlay { background: rgba(0,0,0,0.45); backdrop-filter: blur(1px); }
.modal-panel /* new shared class, currently each modal hand-rolls its panel */ {
  background: var(--panel); border-radius: 20px;
  border: 1px solid var(--border);
  box-shadow: 0 20px 60px rgba(0,0,0,0.18);
  padding: 28px;
}
```
Proofer doesn't currently have a single shared `.modal-panel` class — `.shortcuts-panel`
and the keyboard-shortcuts modal hand-roll their own box. Worth consolidating into one
class during this phase rather than fixing each modal's radius/shadow independently.

---

## Phase 5 — Inline code / data pills (markdown + diff stats)

The most distinctive small detail: inline code spans (CSS variables, class names,
file paths) inside assistant/markdown text render as soft coral pill chips, not gray
monospace boxes.

```css
.markdown code {
  background: var(--brand-soft); color: #A8503A;
  border: none; border-radius: 6px; padding: 2px 7px;
  font-size: 0.88em;
}
[data-theme="dark"] .markdown code { background: var(--brand-soft); color: #E0A188; }
```
This only applies to **inline** `code`, not `pre code` blocks (those stay the current
gray monospace-block treatment — Claude's full code blocks in the Code tab use
standard syntax highlighting, not pill styling; the pill treatment is specifically an
inline-span thing seen in prose).

Diff-stat coloring (`+640 -167` in the bottom toolbar) — Proofer doesn't have an
equivalent UI element currently, no action needed, but if one is ever added
(e.g. an attempt-history diff view), use `var(--green)`/`var(--red)` directly with no
background, matching the bare colored-number pattern in the screenshot rather than
wrapping in a pill.

---

## Execution order (respecting this repo's git workflow)

Per [CLAUDE.md](CLAUDE.md): one branch per logical change, `design/<summary>` naming,
squash-merge via PR, `npx tsc --noEmit` clean before each merge. Suggested phase →
branch mapping (each is independently shippable and reviewable):

1. `design/claude-color-tokens` — Phase 0 only. Highest-risk, highest-impact; touches
   every component indirectly via CSS vars. Verify via `preview_eval(getComputedStyle)`
   on a panel, a button, and a link in both themes before merging, per the existing
   `/loop` verification convention.
2. `design/claude-typography` — Phase 1. Add `next/font/google` Inter + Lora, switch
   `.markdown` to serif (node content, `ReExplain`, `CompareWith`, `ProblemCard`
   problem/answer text), restyle `.markdown blockquote`, drop uppercase panel-label
   tracking. `.hero-title` itself can land unused (no current page needs it yet) —
   just the token + class, not a retrofit.
3. `design/claude-buttons-panels` — Phase 2. Pill buttons, panel radius/shadow, new
   segmented `.tab-bar`.
4. `design/claude-nav-stats` — Phase 3. Nav brand color, stat-row de-bordering.
5. `design/claude-modals` — Phase 4. Shared `.modal-panel` class.
6. `design/claude-code-pills` — Phase 5. Inline-code coral pills.

Each branch should be one coherent visual change verified in the running dev server
(via Claude Preview tools) before opening its PR — not a single mega-branch covering
all six, per the existing "one branch = one coherent idea" rule already established
for this repo's design work.

---

## Open questions / risks before starting

- **Accent role split (Phase 0) is the one decision that needs sign-off before coding**
  — it changes what color means "clickable" across roughly 30+ existing classes.
  Confirm: primary buttons → black, links/focus/toggles → blue, brand orange → nav
  wordmark + spotlight border only, progress/mastery bars stay blue (not orange).
- **Dark-mode primary button is still a guess.** The dark Code-tab screenshot showed
  background/border/text tokens directly, but the only CTA-adjacent button visible
  (`Create PR`) was a ghost/outline style, not a clear "solid primary button in dark
  mode" example. Recommend defaulting `.btn-primary` in dark mode to an outline
  treatment rather than an inverted-white fill (see the Phase 0 dark-tokens note), and
  revisiting if a clearer example turns up.
- **`.markdown` going serif is the other real decision needing sign-off** — it's a much
  bigger visual change than the hero-title case since it touches live, current pages
  (every node page, every AI explanation) rather than a not-yet-built empty state.
  Worth a quick visual gut-check on one node page before committing app-wide — spin it
  up on `app/node/[slug]/page.tsx` only, screenshot both themes, confirm before
  extending it to `ReExplain`/`CompareWith`/`ProblemCard`.
- **No serif hero heading currently has a home in Proofer.** Phase 1 adds the
  font-loading plumbing for `.hero-title` but intentionally doesn't force it onto any
  existing page — flag if you'd rather retrofit it onto the home page hero or
  node-of-the-day spotlight instead of waiting for a future empty state.
