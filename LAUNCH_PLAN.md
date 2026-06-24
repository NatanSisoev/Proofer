# Launch Plan — Sharing Proofer with Others

## TL;DR

**GitHub Pages cannot run this app.** Pages only serves static HTML/CSS/JS — there's no
Node process, no filesystem, no way to run server code. Proofer needs all three:

- API routes (`app/api/**/route.ts`) that call an LLM and read/write a database on every
  request — this is server logic, not something that can be pre-rendered once and served
  as a static file.
- An embedded SQLite database (`node:sqlite`, file at `data/graph.db`) — Pages has no
  persistent filesystem at all.
- Secrets (Anthropic/Gemini API keys) — Pages has no concept of server-side secrets; anything
  shipped to a static site is visible to every visitor.

So the real question isn't "how do I deploy to Pages," it's "where do I run a small
persistent Node server," plus a product decision: **do multiple people share one
mastery/progress state, or does each person get their own?** That second question matters
more than the hosting choice — see Phase 1 below.

This is not "too much" — it's a half-day to 2-day project depending on which path you pick.

---

## Current architecture, as it affects launch

- `lib/db.ts` opens **one SQLite file** for the whole process (`global.__prooferDb`). Every
  request — from anyone — reads and writes the same `mastery`, `attempts`, `settings`,
  `bookmarks`, `node_notes` rows. There is no `user_id` anywhere in the schema.
- `app/api/settings/route.ts` stores LLM API keys **in that same database**, editable by
  whoever opens `/settings`. Anyone with the URL can read or overwrite your key, your daily
  goal, etc.
- `lib/llm.ts` picks a provider from `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` env vars, overridable
  by the settings-table values above. Every practice generation/grading/explain call spends
  your API credits, with **no per-user rate limiting or quota**.
- The app requires `node --experimental-sqlite`, set via `NODE_OPTIONS` in `package.json`
  scripts. The host you pick must let you run `next start` as a real Node process with
  that flag — not every "serverless function" platform supports a native experimental flag
  or a writable persistent disk.

These three facts (shared DB, exposed key-management UI, no auth) are the actual blockers
to "share it so others can use it," not the absence of a build step for GitHub Pages.

---

## Phase 1 — Decide: shared demo, or real multi-user?

### Option A — Single shared instance (fastest, "look but don't trust it")
Deploy as-is, behind nothing but the URL. Good for: "check out what I built," a few friends
poking at it, screenshots/demo. **Not good for**: anyone actually using it to track their
own learning, since every visitor mutates the same mastery numbers and could see/clear your
API key in Settings.

Minimum changes before sharing even this far:
- [ ] Remove or password-gate `/settings` (or move API keys to env vars only, strip the
      key fields from the Settings UI so visitors can't see/replace them).
- [ ] Put your own `ANTHROPIC_API_KEY` (or `GEMINI_API_KEY`) in host env vars, set a request
      budget/alert on that provider's dashboard so a curious visitor can't run up a bill.
- [ ] Add basic abuse protection: a global rate limit on `/api/practice/*` and `/api/node/*`
      routes (e.g. `@upstash/ratelimit` if you add Redis, or a simple in-memory token bucket
      if one server instance and low traffic is fine).
- [ ] Decide if the *content* (your imported Mathematics vault) is what you want public —
      it will be readable by anyone with the URL.

### Option B — Real multi-user (each person gets their own progress)
Needed if the goal is "other people use this to actually learn," not just "see a demo."
Requires:
- [ ] **Auth** — simplest fit for a Next.js app this size is
      [Auth.js (NextAuth)](https://authjs.dev/) with a GitHub/Google OAuth provider, or
      [Clerk](https://clerk.com/) if you want hosted UI and less config.
- [ ] **Per-user data isolation** — add a `user_id` column to `mastery`, `mastery_history`,
      `attempts`, `bookmarks`, `node_notes`, `settings`, scope every query in `lib/queries.ts`
      to the signed-in user. This is the single biggest code change in this plan — `lib/queries.ts`
      is ~1100 lines and most of it currently assumes a global, unscoped dataset.
  - `nodes`/`edges`/`problems`/`llm_cache` can stay global/shared (they're the knowledge graph
    and LLM cache, not personal state) — only the *tables that track an individual's progress*
    need scoping.
- [ ] **A database that supports concurrent multi-user writes properly** — see Phase 2.
- [ ] **API key handling moves server-side only** — drop the Settings-page key fields entirely;
      keys live in host secrets, never touched by any user.
- [ ] **Per-user or global LLM cost controls** — at minimum a daily cap per account so one
      user can't exhaust your API budget.

Recommendation: **start with Option A to get a working public URL fast, then layer in
Option B's auth + per-user scoping as a follow-up branch** — don't block "show people the
project" on finishing multi-tenancy.

---

## Phase 2 — Hosting & database

`node:sqlite` + a local file is fine for one person on one laptop; it gets awkward the moment
multiple server instances or restarts are involved (most hosts wipe/replace the filesystem on
every deploy, and serverless functions don't have a writable persistent disk at all).

| Option | Fit | Notes |
|---|---|---|
| **Single small VM** (Railway, Render, Fly.io, a $5–6/mo VPS) running `next start` with a persistent volume mounted at `data/` | **Recommended for launch** | Matches current architecture almost exactly — no DB migration needed. One always-on process, one disk, `node --experimental-sqlite` works as today. Fly.io and Railway both support persistent volumes; Render does too on paid tiers. |
| **Vercel** | Not recommended | Serverless functions have an ephemeral, read-only-except-`/tmp` filesystem — `data/graph.db` would reset on every cold start and isn't shared across function instances. Would require swapping to a hosted DB (see below) first. |
| **Turso / libSQL** (SQLite-compatible, hosted, has edge replicas) | Good if you outgrow one VM | Same SQL surface as `node:sqlite`, but you'd swap `lib/db.ts`'s `DatabaseSync` for Turso's client — a real (if mechanical) code change, not zero-cost. Worth it if you want to deploy on Vercel/serverless later. |
| **Postgres (Neon, Supabase, Railway Postgres)** | Best long-term if Option B (multi-user) is the goal | More natural fit once you add auth providers like Clerk/Supabase Auth that expect Postgres anyway. Bigger migration than Turso (different SQL dialect nuances), but most "real product" launches end up here eventually. |

**Concrete recommendation:** ship on a single VM/container host (Fly.io or Railway) with a
persistent volume, keeping `node:sqlite` exactly as-is. Re-evaluate a hosted DB only if you
move to Option B and need true concurrent multi-user writes at scale, or want to deploy on
Vercel specifically.

---

## Phase 3 — Secrets & cost control

- [ ] `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` set as **host environment variables**, never
      committed, never exposed through `/settings` to visitors.
- [ ] Set a spending cap / billing alert on whichever LLM provider you use — `lib/llm.ts`
      has no built-in budget guard, so a traffic spike (or someone hammering `/api/practice/generate`)
      translates directly into API spend.
- [ ] `.env.local` stays out of git (confirm it's already gitignored — check before pushing).
- [ ] If keeping Option A's shared instance, consider Gemini's free tier as the default
      provider (`lib/llm.ts` already prefers `GEMINI_API_KEY` first) to keep cost at $0 while
      sharing.

---

## Phase 4 — Pre-launch checklist

- [ ] `npx tsc --noEmit` passes (per `CLAUDE.md` — required before anything ships).
- [ ] `pnpm run build && pnpm run start` works locally against a fresh `data/graph.db` (don't
      ship your personal dev database with your own attempts/mastery history unless that's
      intentional — `pnpm run import` rebuilds the graph from the vault, but `mastery`/
      `attempts`/`bookmarks`/`settings` persist across imports, so start the public instance
      from a clean DB file if you don't want to publish your own learning history).
- [ ] Decide what vault content ships — the public instance will expose whatever's in
      `data/graph.db`'s `nodes`/`edges` (your Mathematics notes). Re-import from a vault you're
      OK making public, or scrub anything personal first.
- [ ] Custom domain (optional) — point a domain at the host; most of the above hosts handle
      this with one DNS record.
- [ ] Smoke-test the deployed instance end-to-end: generate a practice problem, grade an
      answer, check `/quality` and `/graph` render, confirm Settings page doesn't leak your key.

---

## Suggested order of work

1. Pick a host (Fly.io or Railway) and get `pnpm run build && pnpm run start` running there
   with a persistent volume — this alone gets you a shareable URL (Option A).
2. Lock down `/settings` and add a rate limit before telling anyone the URL.
3. If/when you want real per-user progress: branch off, add Auth.js, add `user_id` scoping
   to `lib/queries.ts` and the relevant tables, ship as a separate `feat/multi-user` branch
   per the existing git workflow in `CLAUDE.md`.
