-- DREAMORA: starting prices + free quotas. Run AFTER 005_credits_v2.sql. Safe to re-run; edit numbers any time (no code change).
-- 1 credit ~ 0.25 EGP at the Starter pack (100 EGP = 400 credits). Costs below assume gemini flash-lite pricing,
-- USD = 55 EGP, x1.5 safety factor, Paymob fees. They are ESTIMATES: log real token usage (numbers only) and re-check.
-- Quotas are deliberately tighter than the first draft: easier to widen later than to take away.
-- Crisis replies are NOT priced here on purpose: they are always free and never call reserve_credits.

insert into public.feature_pricing (feature, model, credits_cost, free_quota, free_period, min_plan, enabled) values
  ('companion_message',   '*',    4,  2, 'day',      'free', true),
  ('dream_scene',         '*',    6,  6, 'month',    'free', true),
  ('journal_summary',     '*',    3,  3, 'month',    'free', true),
  ('future_self_message', '*',    4,  3, 'month',    'free', true),
  ('voice_reply_server',  '*',    8,  0, 'month',    'free', true),
  ('dream_avatar',        '*',   45,  1, 'lifetime', 'free', true),
  ('dream_world_image',   '*',   50,  1, 'lifetime', 'free', true),
  ('cinema_storyboard',   '*',  250,  0, 'month',    'free', true),
  ('cinema_video',        'lite', 430, 0, 'month',   'free', true),
  ('cinema_video',        'fast', 1300, 0, 'month',  'free', true)
on conflict (feature, model) do update
  set credits_cost = excluded.credits_cost,
      free_quota   = excluded.free_quota,
      free_period  = excluded.free_period,
      min_plan     = excluded.min_plan,
      enabled      = excluded.enabled,
      updated_at   = now();
