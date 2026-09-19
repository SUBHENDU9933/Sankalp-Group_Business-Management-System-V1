-- Estimate V2 item/preset catalog schema
-- Applied to production Supabase migration: create_estimate_v2_item_presets

create table if not exists public.estimate_v2_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  unit text not null default 'sqft',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimate_v2_presets (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.estimate_v2_items(id) on delete cascade,
  name text not null,
  rate numeric(12,2) not null default 0,
  specification text not null default '',
  measurement_type text not null default 'LxW',
  unit text not null default 'sqft',
  default_length numeric(10,2),
  default_width numeric(10,2),
  default_height numeric(10,2),
  default_quantity numeric(10,2) not null default 1,
  allow_measurement_edit boolean not null default true,
  formula text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(item_id, name)
);

alter table public.estimate_v2_items enable row level security;
alter table public.estimate_v2_presets enable row level security;