-- =========================================================================
-- 0010 — routing modul adaptif SAT
--
-- Modul 2 disusun dalam dua varian saat attempt dibuat; server memilih satu
-- setelah modul 1 selesai. Pilihan itu harus tersimpan, karena penilaian
-- bergantung padanya: peserta yang dirutekan ke modul mudah dipetakan ke
-- rentang 200–600, bukan 200–800.
--
-- Kolom ini ditulis SEKALI. Kalau bisa ditulis ulang, peserta yang memanggil
-- endpoint section dua kali akan dapat mencoba kedua varian.
-- =========================================================================

alter table public.attempts
  add column if not exists routing jsonb;

comment on column public.attempts.routing is
  'Varian modul adaptif yang dipilih: { "sat_rw_m2": "easier"|"harder", ... }. Ditulis sekali oleh server.';
