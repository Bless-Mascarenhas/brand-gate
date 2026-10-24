-- Optional Supabase storage for Brand Gate (Phase 8).
-- Run once in the Supabase SQL editor (or `supabase db push`) before setting
-- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_STORAGE_MODE=supabase.
create table if not exists public.brand_gate_kv (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security on with no policies: anon/authenticated clients get no
-- access at all. Only the server route /api/storage, using the service-role
-- key (which bypasses RLS), reads and writes this table.
alter table public.brand_gate_kv enable row level security;
