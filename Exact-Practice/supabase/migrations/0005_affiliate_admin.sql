-- =====================================================================
-- Program afiliasi + peran admin
-- =====================================================================

do $$ begin
  create type commission_status as enum ('pending','approved','paid','void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_status as enum ('requested','paid','rejected');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------ afiliasi
create table if not exists public.affiliates (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  code          text not null unique,
  rate          numeric(4,3) not null default 0.150 check (rate >= 0 and rate <= 0.5),
  status        text not null default 'active',
  payout_method jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists affiliates_code_idx on public.affiliates (upper(code));

create table if not exists public.referral_clicks (
  id         bigserial primary key,
  code       text not null,
  created_at timestamptz not null default now()
);
create index if not exists referral_clicks_code_idx on public.referral_clicks (code, created_at desc);

create table if not exists public.referrals (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  first_order_id   uuid references public.orders(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists referrals_code_idx on public.referrals (code);

create table if not exists public.commissions (
  id                uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id  uuid not null references auth.users(id) on delete cascade,
  order_id          uuid not null unique references public.orders(id) on delete cascade,
  amount_idr        integer not null check (amount_idr >= 0),
  rate              numeric(4,3) not null,
  status            commission_status not null default 'pending',
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);
create index if not exists commissions_aff_idx on public.commissions (affiliate_user_id, status);

create table if not exists public.payouts (
  id                uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  amount_idr        integer not null check (amount_idr > 0),
  status            payout_status not null default 'requested',
  method            jsonb,
  note              text,
  requested_at      timestamptz not null default now(),
  paid_at           timestamptz
);
create index if not exists payouts_aff_idx on public.payouts (affiliate_user_id, status);

-- kolom penanda asal pendaftar
alter table public.profiles add column if not exists referred_by text;

-- ------------------------------------------------------------------ RLS
alter table public.affiliates      enable row level security;
alter table public.referrals       enable row level security;
alter table public.commissions     enable row level security;
alter table public.payouts         enable row level security;
alter table public.referral_clicks enable row level security;

drop policy if exists aff_self on public.affiliates;
create policy aff_self on public.affiliates for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists aff_self_update on public.affiliates;
create policy aff_self_update on public.affiliates for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ref_read on public.referrals;
create policy ref_read on public.referrals for select
  using (public.is_admin() or exists (
    select 1 from public.affiliates a where a.user_id = auth.uid() and a.code = referrals.code
  ));

drop policy if exists comm_self on public.commissions;
create policy comm_self on public.commissions for select
  using (auth.uid() = affiliate_user_id or public.is_admin());

drop policy if exists payout_self on public.payouts;
create policy payout_self on public.payouts for select
  using (auth.uid() = affiliate_user_id or public.is_admin());

-- INSERT/UPDATE commissions & payouts hanya lewat service-role.
drop policy if exists clicks_admin on public.referral_clicks;
create policy clicks_admin on public.referral_clicks for select using (public.is_admin());

-- --------------------------------------------------------- RPC ringkasan
create or replace function public.affiliate_stats(p_user uuid)
returns table (
  clicks bigint, signups bigint, conversions bigint,
  pending_idr bigint, approved_idr bigint, paid_idr bigint
)
language sql stable security definer set search_path = public as $$
  with a as (select code from public.affiliates where user_id = p_user)
  select
    (select count(*) from public.referral_clicks c where c.code in (select code from a)),
    (select count(*) from public.referrals r where r.code in (select code from a)),
    (select count(*) from public.commissions m where m.affiliate_user_id = p_user and m.status <> 'void'),
    coalesce((select sum(amount_idr) from public.commissions where affiliate_user_id = p_user and status = 'pending'), 0),
    coalesce((select sum(amount_idr) from public.commissions where affiliate_user_id = p_user and status = 'approved'), 0),
    coalesce((select sum(amount_idr) from public.commissions where affiliate_user_id = p_user and status = 'paid'), 0);
$$;

-- ------------------------------------------------------------ ringkasan admin
create or replace function public.admin_overview()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'users',              (select count(*) from public.profiles),
    'paidOrders',         (select count(*) from public.orders where status = 'paid'),
    'revenueIdr',         (select coalesce(sum(amount_idr),0) from public.orders where status = 'paid'),
    'attempts',           (select count(*) from public.attempts),
    'submitted',          (select count(*) from public.attempts where status = 'submitted'),
    'demoAttempts',       (select count(*) from public.attempts where is_demo),
    'affiliates',         (select count(*) from public.affiliates),
    'commissionOwedIdr',  (select coalesce(sum(amount_idr),0) from public.commissions where status in ('pending','approved')),
    'payoutsRequested',   (select count(*) from public.payouts where status = 'requested'),
    'flaggedAttempts',    (select count(*) from public.attempts
                            where status = 'submitted'
                              and coalesce((integrity->>'integrityScore')::numeric, 100) < 60)
  );
$$;

revoke all on function public.admin_overview() from public, anon, authenticated;
