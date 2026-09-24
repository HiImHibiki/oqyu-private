-- =====================================================================
-- Exact Try Out — skema inti
-- Jalankan di Supabase SQL Editor (atau `supabase db push`)
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------- enum
do $$ begin
  create type exam_code as enum ('SAT','CSCA','UTBK','ALEVEL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending','paid','failed','expired','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attempt_status as enum ('in_progress','submitted','expired','voided');
exception when duplicate_object then null; end $$;

do $$ begin
  create type question_status as enum ('draft','in_review','approved','retired');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text not null default '',
  phone        text not null default '',
  school       text,
  grade_level  text,
  theme_id     text not null default 'porcelain',
  locale       text not null default 'id',
  target_note  text,
  role         text not null default 'student',      -- student | reviewer | admin
  password_set boolean not null default false,       -- true setelah ganti password pasca-OTP
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- --------------------------------------------------------------- orders
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  package_id    text not null,
  exam          exam_code not null,
  amount_idr    integer not null check (amount_idr >= 0),
  status        order_status not null default 'pending',
  provider      text not null default 'midtrans',
  provider_ref  text,
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

-- --------------------------------------------------------- entitlements
create table if not exists public.entitlements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  order_id       uuid references public.orders(id) on delete set null,
  package_id     text not null,
  exam           exam_code not null,
  attempts_total integer not null default 0,
  attempts_used  integer not null default 0,
  expires_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists entitlements_user_idx on public.entitlements (user_id, exam);

-- ------------------------------------------------------------ questions
-- payload jsonb = objek Question (lihat src/lib/types.ts / prompts/_schema)
create table if not exists public.questions (
  id           text primary key,
  exam         exam_code not null,
  section      text not null,
  domain       text not null,
  skill        text not null,
  difficulty   char(1) not null check (difficulty in ('E','M','H')),
  irt_b        real,
  calc_allowed boolean not null default false,
  locale       text not null default 'en',
  qtype        text not null,
  payload      jsonb not null,
  status       question_status not null default 'draft',
  source       text,                       -- 'ai' | 'manual' | 'imported'
  model        text,
  reviewed_by  uuid references auth.users(id),
  reviewed_at  timestamptz,
  /* statistik hidup, dikalibrasi ulang oleh job */
  times_served integer not null default 0,
  times_correct integer not null default 0,
  avg_time_sec real,
  created_at   timestamptz not null default now()
);
create index if not exists questions_pick_idx on public.questions (exam, section, difficulty, status);
create index if not exists questions_domain_idx on public.questions (exam, domain, skill);

-- ----------------------------------------------------------- exam forms
create table if not exists public.exam_forms (
  id          uuid primary key default gen_random_uuid(),
  exam        exam_code not null,
  title       text not null,
  slug        text unique,
  is_demo     boolean not null default false,
  is_active   boolean not null default true,
  config      jsonb not null default '{}'::jsonb,   -- override durasi/section
  created_at  timestamptz not null default now()
);

create table if not exists public.form_items (
  form_id      uuid not null references public.exam_forms(id) on delete cascade,
  section_code text not null,
  position     integer not null,
  question_id  text not null references public.questions(id) on delete restrict,
  /* untuk SAT: 'base' | 'hard' | 'easy' (routing modul 2) */
  variant      text not null default 'base',
  primary key (form_id, section_code, variant, position)
);

-- ------------------------------------------------------------- attempts
create table if not exists public.attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  form_id          uuid not null references public.exam_forms(id),
  exam             exam_code not null,
  entitlement_id   uuid references public.entitlements(id),
  is_demo          boolean not null default false,
  status           attempt_status not null default 'in_progress',
  current_section  integer not null default 0,
  current_index    integer not null default 0,
  section_deadline timestamptz,
  route            jsonb not null default '{}'::jsonb,  -- {sat_rw_m2:'hard'}
  score            jsonb,                                -- ScoreReport
  integrity        jsonb not null default '{}'::jsonb,   -- ProctorLog ringkas
  started_at       timestamptz not null default now(),
  submitted_at     timestamptz
);
create index if not exists attempts_user_idx on public.attempts (user_id, started_at desc);
create index if not exists attempts_board_idx on public.attempts (exam, status, submitted_at desc);

-- ------------------------------------------------------------ responses
create table if not exists public.responses (
  attempt_id     uuid not null references public.attempts(id) on delete cascade,
  question_id    text not null references public.questions(id),
  section_code   text not null,
  position       integer not null,
  raw            jsonb,
  flagged        boolean not null default false,
  crossed_out    text[] not null default '{}',
  time_spent_sec integer not null default 0,
  visited        boolean not null default false,
  credit         real,
  correct        boolean,
  primary key (attempt_id, question_id)
);

-- ------------------------------------------------------- proctor events
create table if not exists public.proctor_events (
  id         bigserial primary key,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  ts         timestamptz not null default now(),
  type       text not null,      -- blur | fullscreen_exit | copy | paste | contextmenu | resize | devtools
  detail     text
);
create index if not exists proctor_attempt_idx on public.proctor_events (attempt_id, ts);

-- --------------------------------------------------------------- demo
-- lead demo gratis (sebelum user punya akun)
create table if not exists public.demo_leads (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  full_name  text,
  phone      text,
  exam       exam_code not null,
  score_pct  real,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------- trigger util
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- profil otomatis saat user baru dibuat
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone','')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
