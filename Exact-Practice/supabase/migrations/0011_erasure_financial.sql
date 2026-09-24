-- =========================================================================
-- 0011 — penghapusan akun tidak boleh menghancurkan catatan keuangan
--
-- Migrasi 0008 sudah menangani `orders`: kolom pemiliknya boleh NULL dan
-- foreign key-nya `on delete set null`, sehingga menghapus akun melepas
-- identitasnya tanpa menghapus transaksinya (GDPR Art. 17(3)(b)).
--
-- `commissions` dan `payouts` terlewat. Keduanya masih `on delete cascade`
-- ke auth.users, jadi memanggil auth.admin.deleteUser() MENGHAPUS seluruh
-- riwayat komisi dan pencairan orang itu — termasuk bukti bahwa uang pernah
-- dibayarkan kepadanya. Kode di src/lib/privacy.ts menyatakan catatan ini
-- «dipertahankan, dianonimkan»; driver berkas memang begitu, tetapi di
-- Supabase catatannya lenyap. Migrasi ini menyamakan keduanya.
-- =========================================================================

-- ---------------------------------------------------------------- komisi
alter table public.commissions alter column affiliate_user_id drop not null;
alter table public.commissions alter column referred_user_id  drop not null;

alter table public.commissions drop constraint if exists commissions_affiliate_user_id_fkey;
alter table public.commissions
  add constraint commissions_affiliate_user_id_fkey
  foreign key (affiliate_user_id) references public.profiles(id) on delete set null;

alter table public.commissions drop constraint if exists commissions_referred_user_id_fkey;
alter table public.commissions
  add constraint commissions_referred_user_id_fkey
  foreign key (referred_user_id) references public.profiles(id) on delete set null;

-- `order_id` sengaja TIDAK diubah: pesanannya sendiri sudah dipertahankan
-- oleh 0008, jadi rantai komisi → pesanan tetap utuh.

-- -------------------------------------------------------------- pencairan
alter table public.payouts alter column affiliate_user_id drop not null;

alter table public.payouts drop constraint if exists payouts_affiliate_user_id_fkey;
alter table public.payouts
  add constraint payouts_affiliate_user_id_fkey
  foreign key (affiliate_user_id) references public.profiles(id) on delete set null;

-- `method` menyimpan rekening tujuan — itu data pribadi, bukan angka
-- pembukuan, dan harus ikut terhapus. Dikosongkan oleh deleteUserData().

comment on column public.commissions.affiliate_user_id is
  'NULL berarti pemiliknya sudah menghapus akun. Barisnya sengaja dipertahankan untuk pembukuan.';
comment on column public.payouts.affiliate_user_id is
  'NULL berarti pemiliknya sudah menghapus akun. Barisnya sengaja dipertahankan untuk pembukuan.';

create index if not exists commissions_aff_null_idx on public.commissions (affiliate_user_id);
create index if not exists payouts_aff_null_idx     on public.payouts (affiliate_user_id);
