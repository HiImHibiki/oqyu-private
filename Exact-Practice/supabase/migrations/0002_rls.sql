-- =====================================================================
-- Row Level Security
-- Prinsip: siswa hanya melihat datanya sendiri; SOAL tidak pernah
-- terbaca langsung oleh client (jawaban ada di payload) — pengambilan
-- soal selalu lewat RPC/route handler yang menyaring kunci jawaban.
-- =====================================================================

alter table public.profiles       enable row level security;
alter table public.orders         enable row level security;
alter table public.entitlements   enable row level security;
alter table public.questions      enable row level security;
alter table public.exam_forms     enable row level security;
alter table public.form_items     enable row level security;
alter table public.attempts       enable row level security;
alter table public.responses      enable row level security;
alter table public.proctor_events enable row level security;
alter table public.demo_leads     enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','reviewer'));
$$;

-- profiles ------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- orders / entitlements ------------------------------------------------
drop policy if exists orders_self on public.orders;
create policy orders_self on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists ent_self on public.entitlements;
create policy ent_self on public.entitlements for select
  using (auth.uid() = user_id or public.is_admin());
-- INSERT/UPDATE orders & entitlements hanya lewat service-role (webhook pembayaran).

-- questions ------------------------------------------------------------
-- Tidak ada policy SELECT untuk anon/authenticated: bank soal tertutup.
drop policy if exists questions_admin on public.questions;
create policy questions_admin on public.questions for all
  using (public.is_admin()) with check (public.is_admin());

-- exam_forms bisa dibaca (judul saja dipakai di UI)
drop policy if exists forms_read on public.exam_forms;
create policy forms_read on public.exam_forms for select using (is_active);

drop policy if exists form_items_admin on public.form_items;
create policy form_items_admin on public.form_items for all
  using (public.is_admin()) with check (public.is_admin());

-- attempts -------------------------------------------------------------
drop policy if exists attempts_self_read on public.attempts;
create policy attempts_self_read on public.attempts for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists attempts_self_insert on public.attempts;
create policy attempts_self_insert on public.attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists attempts_self_update on public.attempts;
create policy attempts_self_update on public.attempts for update
  using (auth.uid() = user_id and status = 'in_progress')
  with check (auth.uid() = user_id);

-- responses ------------------------------------------------------------
drop policy if exists responses_self on public.responses;
create policy responses_self on public.responses for all
  using (exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid() and a.status = 'in_progress'));

-- proctor --------------------------------------------------------------
drop policy if exists proctor_insert on public.proctor_events;
create policy proctor_insert on public.proctor_events for insert
  with check (exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()));

drop policy if exists proctor_read on public.proctor_events;
create policy proctor_read on public.proctor_events for select using (public.is_admin());

-- demo leads -----------------------------------------------------------
drop policy if exists demo_insert on public.demo_leads;
create policy demo_insert on public.demo_leads for insert with check (true);
