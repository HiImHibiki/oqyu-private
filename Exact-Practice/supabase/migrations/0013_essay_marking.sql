-- =========================================================================
-- 0013 — penilaian esai
--
-- Soal bernilai rubrik tidak bisa dinilai mesin. Sebelum ini tidak ada satu
-- pun jalan untuk menilainya: tidak ada antrean, tidak ada layar pemberian
-- nilai, dan skornya diam-diam nol. Migrasi 0012 dan perubahan penilaian
-- sudah membuat soal itu DIKELUARKAN dari hitungan alih-alih dianggap salah —
-- jujur, tetapi artinya bagian esai belum benar-benar dilatih.
--
-- Dua kolom:
--   pending_rubric  id soal esai dalam paket ini, ditulis saat attempt
--                   ditutup. Antrean penilai dibangun dari sini, bukan dengan
--                   membuka bank soal — sehingga soal yang kemudian
--                   dipensiunkan tetap muncul untuk dinilai kalau sudah ada
--                   yang mengerjakannya.
--   marks           nilai per soal: poin tiap kriteria, jumlah, komentar,
--                   siapa yang menilai, dan kapan. Menyimpan penilai dan
--                   waktunya bukan kelengkapan administratif — tanpa itu,
--                   «sudah dinilai guru» hanyalah klaim yang tidak bisa
--                   ditelusuri saat peserta mempersoalkan nilainya.
-- =========================================================================

alter table public.attempts
  add column if not exists pending_rubric text[],
  add column if not exists marks jsonb not null default '{}'::jsonb;

comment on column public.attempts.pending_rubric is
  'Id soal esai dalam paket ini. Ditulis sekali saat attempt ditutup.';
comment on column public.attempts.marks is
  'questionId -> { awarded[], total, comment, by, at }. Diisi pengajar.';

-- Antrean penilai: attempt selesai yang masih punya esai belum dinilai.
create index if not exists attempts_pending_rubric_idx
  on public.attempts (submitted_at desc)
  where status = 'submitted' and pending_rubric is not null;

-- Peserta boleh MEMBACA nilai esainya sendiri lewat kebijakan attempts yang
-- sudah ada, tetapi tidak boleh menulisnya. Kolom `marks` karena itu dikunci
-- ke service role, sama seperti time_multiplier.
create or replace function public.guard_marks()
returns trigger language plpgsql security definer as $$
begin
  if new.marks is distinct from old.marks
     and auth.jwt() ->> 'role' <> 'service_role' then
    raise exception 'marks hanya boleh diubah lewat service role';
  end if;
  return new;
end $$;

drop trigger if exists attempts_guard_marks on public.attempts;
create trigger attempts_guard_marks
  before update on public.attempts
  for each row execute function public.guard_marks();
