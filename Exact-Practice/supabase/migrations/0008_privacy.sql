-- =========================================================================
-- 0008 — persetujuan dan hak atas data pribadi
--
-- Dua hal yang wajib bisa dibuktikan saat ditanya regulator:
--   1. KAPAN seseorang menyetujui, dan versi dokumen MANA yang disetujui.
--   2. Bahwa penghapusan tidak meninggalkan identitas di catatan keuangan.
-- =========================================================================

alter table public.profiles
  add column if not exists consent jsonb,
  add column if not exists deletion_requested_at timestamptz;

comment on column public.profiles.consent is
  'Bukti persetujuan: { terms, privacy, version, ip }. Versi lama tidak berlaku untuk dokumen yang sudah berubah.';

-- Penghapusan akun MENGANONIMKAN pesanan, bukan menghapusnya: kewajiban
-- pembukuan menuntut transaksi tetap ada (GDPR Art. 17(3)(b)). Karena itu
-- kolomnya harus boleh NULL dan foreign key-nya tidak boleh ikut menghapus.
alter table public.orders alter column user_id drop not null;

alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- Baris tanpa pemilik hanya boleh dibaca service role; RLS bawaan sudah
-- menolaknya karena auth.uid() tidak pernah sama dengan NULL.

create index if not exists orders_user_idx on public.orders(user_id);
