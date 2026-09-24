-- =========================================================================
-- 0012 — akomodasi waktu
--
-- SAT dan UTBK sungguhan memberi waktu 1,5× atau 2× kepada peserta yang
-- berhak. Sebelum ini durasi diambil langsung dari blueprint tanpa pengali
-- per peserta, sehingga akomodasi tidak mungkin diberikan sama sekali —
-- untuk produk yang menjual kesetiaan pada ujian aslinya, itu bukan fitur
-- tambahan melainkan syarat.
--
-- Dua kolom, dua peran yang berbeda:
--   profiles.time_multiplier  hak yang melekat pada peserta; hanya admin
--                             yang boleh mengubahnya.
--   attempts.time_multiplier  yang benar-benar berlaku pada satu attempt,
--                             DIBEKUKAN saat attempt dibuat. Durasinya sudah
--                             ikut dikalikan ke dalam form_layout, jadi kolom
--                             ini untuk ditampilkan dan diaudit — dan supaya
--                             mengubah hak peserta di tengah ujian tidak
--                             pernah mengubah ujian yang sedang berjalan,
--                             ke arah mana pun.
-- =========================================================================

alter table public.profiles
  add column if not exists time_multiplier numeric(2,1) not null default 1
  check (time_multiplier in (1, 1.5, 2));

alter table public.attempts
  add column if not exists time_multiplier numeric(2,1) not null default 1
  check (time_multiplier in (1, 1.5, 2));

comment on column public.profiles.time_multiplier is
  'Akomodasi waktu peserta: 1, 1.5, atau 2. Hanya admin yang boleh mengubah.';
comment on column public.attempts.time_multiplier is
  'Akomodasi yang berlaku saat attempt ini dibuat. Dibekukan — jangan diperbarui.';

-- Peserta tidak boleh menaikkan akomodasinya sendiri. Kebijakan update pada
-- profiles yang ada memakai auth.uid() = id, jadi kolom ini harus dikunci
-- terpisah lewat trigger.
create or replace function public.guard_time_multiplier()
returns trigger language plpgsql security definer as $$
begin
  if new.time_multiplier is distinct from old.time_multiplier
     and auth.jwt() ->> 'role' <> 'service_role' then
    raise exception 'time_multiplier hanya boleh diubah lewat service role';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_time_multiplier on public.profiles;
create trigger profiles_guard_time_multiplier
  before update on public.profiles
  for each row execute function public.guard_time_multiplier();
