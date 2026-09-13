-- =====================================================================
-- Akses internasional: mata uang, negara, bahasa, zona waktu
-- =====================================================================

-- Pesanan tidak lagi selalu dalam rupiah.
alter table public.orders rename column amount_idr to amount;
alter table public.orders add column if not exists currency text not null default 'IDR';
alter table public.orders drop constraint if exists orders_amount_idr_check;
alter table public.orders add constraint orders_amount_check check (amount >= 0);

-- Profil peserta internasional.
alter table public.profiles
  add column if not exists country   text,
  add column if not exists time_zone text,
  add column if not exists currency  text not null default 'USD';

-- Nomor telepon disimpan dalam bentuk E.164 (+6281234567890).
comment on column public.profiles.phone is 'Nomor telepon dalam format E.164, mis. +6281234567890';

-- Komisi afiliasi mengikuti mata uang pesanannya.
alter table public.commissions rename column amount_idr to amount;
alter table public.commissions add column if not exists currency text not null default 'IDR';

alter table public.payouts rename column amount_idr to amount;
alter table public.payouts add column if not exists currency text not null default 'IDR';

-- Papan peringkat dan ringkasan admin membaca kolom yang baru.
create or replace function public.admin_overview()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'users',              (select count(*) from public.profiles),
    'paidOrders',         (select count(*) from public.orders where status = 'paid'),
    'revenueIdr',         (select coalesce(sum(amount),0) from public.orders where status = 'paid' and currency = 'IDR'),
    'attempts',           (select count(*) from public.attempts),
    'submitted',          (select count(*) from public.attempts where status = 'submitted'),
    'demoAttempts',       (select count(*) from public.attempts where is_demo),
    'affiliates',         (select count(*) from public.affiliates),
    'commissionOwedIdr',  (select coalesce(sum(amount),0) from public.commissions where status in ('pending','approved')),
    'payoutsRequested',   (select count(*) from public.payouts where status = 'requested'),
    'flaggedAttempts',    (select count(*) from public.attempts
                            where status = 'submitted'
                              and coalesce((integrity->>'integrityScore')::numeric, 100) < 60)
  );
$$;

revoke all on function public.admin_overview() from public, anon, authenticated;

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
    coalesce((select sum(amount) from public.commissions where affiliate_user_id = p_user and status = 'pending'), 0),
    coalesce((select sum(amount) from public.commissions where affiliate_user_id = p_user and status = 'approved'), 0),
    coalesce((select sum(amount) from public.commissions where affiliate_user_id = p_user and status = 'paid'), 0);
$$;
