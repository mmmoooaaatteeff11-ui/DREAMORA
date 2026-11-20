# DREAMORA — Progress

## Phase 1
Done: auth, Supabase clients, i18n, and the temporary dashboard stub are implemented.
Verified: `npm install` completed; `npm run typecheck` passes. `@types/react-dom` includes
`useFormState`, and installed `next-intl` 3.26.5 supports the existing navigation/routing APIs.

## Setup
1. Done: install dependencies.
2. In progress: `.env.local` was copied from `.env.example`; add the Supabase URL, anon key,
   and service-role key locally. Do not share or commit these values.
3. Remaining: run `supabase/migrations/001_init.sql` in the Supabase SQL editor.
4. Remaining: add `http://localhost:3000/auth/callback` to Supabase Auth Redirect URLs.
5. Remaining: run the app and test signup, login, password reset, language switching, and signed-out redirect.

## Phase 2 — Companion
Done: the companion UI, API route, Gemini streaming, and conversation persistence are verified.
Responsive breakpoints, duplicate-send protection, retry/error handling, and completed-turn rate
counting are in place.

## Companion verification
The user applied `002_authenticated_app_grants.sql` in Supabase and confirmed the end-to-end chat
test succeeded: Gemini replied and the conversation persisted after reloading. The migration
retains RLS and the application rate limit; the earlier `42501` permission failure is resolved.
`npm run typecheck` and `npm run build` passed locally.

## Phase 3 — Step 1: Companion crisis detection
Done: Arabic and English crisis signals receive a fixed supportive response before Gemini is
called. Crisis messages are saved only in the ordinary chat message record; new conversation
titles stay generic, and prior conversation history is not loaded for a crisis response. Emergency
guidance uses local emergency services and a country helpline directory.

## Phase 3 — Dream Scenes
In progress: text-only immersive scenes stream in Arabic or English, continue through choices or
free text, and include a real-life first step. Scenes use the existing per-user AI limits, run crisis
detection before generation, and are stored in the RLS-protected `dream_scene_turns` table.
`npm run typecheck`, `npm run build`, and mocked output-format boundary checks pass. Apply
`supabase/migrations/003_dream_scene_turns.sql` before end-to-end testing; no Gemini or Supabase
integration call has been made for this feature.

## Phase 4 — Daily Faith
Implemented `/ar/faith` and `/en/faith` with Egyptian-method prayer-time calculations, cited
morning/evening/post-prayer adhkar references, a tasbeeh counter, an optional Quran page goal,
opt-in private progress, and browser-only gentle reminders. Progress is explicitly self-reported.
The optional demo daily-visit credit is isolated from worship tracking and has a server-side,
idempotent award function; no real rewards or coupons are offered.

Manual setup: apply the additive `supabase/migrations/004_faith_and_credits.sql` after migrations
001–003, and configure the existing server-only `SUPABASE_SERVICE_ROLE_KEY` locally for private
progress writes/deletion. The migration has not been run against a live Supabase project.
