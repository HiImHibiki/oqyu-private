-- =========================================================================
-- 0009 — jejak tinjauan soal
--
-- Status «approved» tidak memberi tahu siapa yang memeriksa, kapan, dan apa
-- yang ia periksa. Tanpa itu, klaim «sudah ditinjau guru» tidak bisa
-- dibuktikan pada saat yang paling penting: ketika ada soal keliru yang
-- lolos ke ujian berbayar.
-- =========================================================================

alter table public.questions
  add column if not exists review jsonb;

comment on column public.questions.review is
  'Jejak tinjauan: { by, at, verdict: correct|returned, note }. Diisi lewat /admin/soal.';

-- Mencari soal yang belum pernah diperiksa manusia adalah pertanyaan harian
-- bagi tim penulis, jadi diberi indeks parsial.
create index if not exists questions_unreviewed_idx
  on public.questions (exam, section)
  where review is null;
