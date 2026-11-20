# DREAMORA — Architecture & Plan

## 1. Architecture overview

- **Next.js 14 (App Router) + TypeScript**: Server Components for data pages, Route Handlers (`app/api/*`) for AI and privileged operations.
- **Supabase**: Postgres + Auth + Storage. Every private table has RLS (`user_id = auth.uid()`).
- **Two Supabase clients**: browser/server client with the user's session (RLS enforced), and a `service-role` client used ONLY in server code (admin panel, cron, account deletion).
- **AI layer** (`src/server/ai/`): provider-agnostic wrapper. API key stays server-side. Companion and Dream Scenes stream via SSE; crisis-language checks return a fixed safe response before generation.
- **Image generation**: server-side route `/api/dream/scene-image` calling an image provider, storing the result in Supabase Storage. If no provider key is configured, the scene is marked `image_source = 'none'` and the UI shows a gradient scene, never labeled as AI-generated.
- **i18n + RTL**: `next-intl`, locales `ar` (Egyptian) and `en`; `dir` set on `<html>` per locale.
- **Rate limiting**: Companion keeps its completed-turn limit; Dream Scenes applies the same per-user limits to completed Companion turns plus saved scenes. Both use RLS-scoped Postgres queries; Upstash is not wired in.
- **Future-letter delivery**: Vercel Cron hits `/api/cron/deliver-letters` daily; it creates a `notifications` row (and email later) for letters with `deliver_on <= today`.
- **Subscriptions**: `profiles.plan` + feature-gating helper. No payment provider wired in MVP; later Stripe webhooks update `plan`.
- **Faith**: `/ar/faith` and `/en/faith` use the `adhan` library with the Egyptian calculation method and city coordinates. Spiritual progress is opt-in, private, self-reported, and server-validated; reminder preferences stay on-device.
- **Demo credits**: an optional daily app-visit credit is kept in an append-only ledger and is never based on worship. No real rewards, coupons, or merchant partnerships are configured.

## 2. Directory structure

```
dreamora/
├─ .env.example
├─ package.json / tsconfig.json / tailwind.config.ts / next.config.mjs
├─ supabase/
│  └─ migrations/*.sql
├─ messages/ { en.json, ar.json }
└─ src/
   ├─ middleware.ts                 # session refresh + route protection + locale
   ├─ app/
   │  ├─ [locale]/
   │  │  ├─ (auth)/ login, signup, forgot-password, reset-password
   │  │  ├─ (app)/
   │  │  │  ├─ dashboard/
   │  │  │  ├─ companion/          # AI chat
   │  │  │  ├─ dream/              # discovery, generate, theater, action
   │  │  │  ├─ faith/              # prayer times, adhkar, tasbeeh, Quran goal
   │  │  │  ├─ mood/
   │  │  │  ├─ letters/
   │  │  │  ├─ peace/
   │  │  │  ├─ achievements/
   │  │  │  ├─ settings/           # profile, privacy, export, delete
   │  │  │  └─ admin/              # role-guarded server-side
   │  └─ api/ chat, dream-scenes, faith/*, dream/*, export, account/delete, cron/*, admin/*
   ├─ components/ { ui, layout, dashboard, chat, dream-scenes, dream, habits, charts }
   ├─ lib/ { supabase/{client,server,admin}.ts, validation/*.ts (zod), utils.ts }
   ├─ server/ { ai/{provider,prompts,crisis,dream-scenes}.ts, services/*, rate-limit.ts }
   └─ types/ database.ts
```

## 3. Database design (21 tables, see migrations)

profiles · user_preferences · conversations · messages · user_memory · dreams · dream_scenes · dream_scene_turns · goals · milestones · tasks · habits · habit_completions · mood_entries · journal_entries · achievements · future_letters · notifications · spiritual_daily_progress · credit_accounts · credit_ledger

- UUID PKs, `created_at/updated_at` with trigger.
- Child tables carry `user_id` directly, so RLS is one simple policy.
- `profiles.role` cannot be changed by the user (trigger blocks it); admin routes use server-side role check + service-role client.
- `user_memory` is written only when `user_preferences.ai_memory_enabled = true`.
- Spiritual progress has owner-only reads; validated writes and deletion use the server-only service client. Credit balances are read-only to users; a fixed-value database function awards at most one daily app-visit credit.

## 4. Design system

| Token | Value |
|---|---|
| bg-base | `#05060F` (near-black midnight) |
| bg-surface | `#0B1030` (deep navy) |
| glass | `rgba(255,255,255,0.05)` + `backdrop-blur-xl` + 1px `rgba(255,255,255,0.08)` border |
| primary | violet `#7C3AED` → `#A78BFA` gradient |
| accent-blue | `#3B82F6` soft glow |
| accent-gold | `#D4AF37` (highlights, badges, streaks only) |
| text | `#F4F4FB` / muted `#9CA3C7` (contrast ≥ 4.5:1) |
| Fonts | Arabic: Cairo · English headings: Fraunces · body: Inter |
| Radius | 16px cards, 999px pills |
| Motion | Framer Motion: 300ms ease-out page fades, 800ms scene cross-fades |

Components: Button, Card(glass), Input, Modal, Toast, Skeleton, EmptyState, ErrorState, ProgressRing, Badge.

## 5. Development plan

| Phase | Scope | Status |
|---|---|---|
| 1 | Architecture, structure, design tokens, auth, DB schema + RLS | **In progress** (SQL + env done) |
| 2 | Dashboard, AI companion, profile, i18n | Complete |
| 3 | Dream Scenes and Dream Mode | In progress |
| 4 | Daily Faith (prayers, adhkar, Quran reading, private progress) | Code complete; migration/setup pending |
| 5 | Mood, letters, Peace Mode, achievements | Pending |
| 6 | Admin, security review, tests, deployment | Pending |
