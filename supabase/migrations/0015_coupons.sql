-- =========================================================================
-- 0015 — kupon pada pesanan
--
-- Kupon itu sendiri TIDAK disimpan di basis data: daftarnya ada di
-- src/lib/coupons.ts dan ikut ter-review bersama kode. Yang disimpan di sini
-- hanyalah jejaknya pada pesanan, supaya kampanye bisa dievaluasi (berapa
-- yang terpakai, berapa potongan yang diberikan) dan supaya batas pemakaian
-- bisa dihitung dari pesanan yang benar-benar lunas.
--
-- `amount` tetap berarti nominal yang ditagih — sudah bersih dari potongan.
-- Laporan pendapatan lama karena itu tidak berubah artinya.
-- =========================================================================

alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount integer not null default 0;
alter table public.orders drop constraint if exists orders_discount_check;
alter table public.orders add constraint orders_discount_check check (discount >= 0);

-- Dipakai untuk menghitung pemakaian satu kode; hanya pesanan lunas yang relevan.
create index if not exists orders_coupon_idx
  on public.orders (coupon_code)
  where coupon_code is not null and status = 'paid';
