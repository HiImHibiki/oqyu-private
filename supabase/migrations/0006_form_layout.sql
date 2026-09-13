-- =====================================================================
-- Susunan paket dibekukan pada attempt
--
-- Tanpa ini, penilaian membangun ulang paket dengan memilih ulang soal dari
-- bank. Begitu ada soal baru diimpor atau soal lama dipensiunkan di tengah
-- jalan, paket yang dibangun ulang berbeda dari yang dikerjakan siswa —
-- dan nilainya salah tanpa ada yang menyadari.
-- =====================================================================

alter table public.attempts
  add column if not exists form_layout jsonb not null default '[]'::jsonb;

-- Susunan paket tidak boleh berubah setelah attempt dibuat.
create or replace function public.guard_form_layout() returns trigger
language plpgsql as $$
begin
  if old.form_layout <> '[]'::jsonb and new.form_layout <> old.form_layout then
    raise exception 'Susunan paket attempt tidak dapat diubah setelah dibuat';
  end if;
  return new;
end $$;

drop trigger if exists attempts_guard_layout on public.attempts;
create trigger attempts_guard_layout before update on public.attempts
  for each row execute function public.guard_form_layout();
