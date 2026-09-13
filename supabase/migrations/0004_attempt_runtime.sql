-- =====================================================================
-- Runtime attempt: waktu dipegang server, form dibangun saat berjalan
-- =====================================================================

-- Form boleh kosong: paket dibangun dari bank soal saat attempt dimulai.
alter table public.attempts alter column form_id drop not null;

alter table public.attempts
  add column if not exists form_title        text,
  add column if not exists question_ids      text[] not null default '{}',
  -- kode section -> tenggat absolut. INI SUMBER KEBENARAN WAKTU UJIAN.
  add column if not exists section_deadlines jsonb  not null default '{}'::jsonb,
  -- jawaban yang sedang dikerjakan; dimaterialisasi ke public.responses saat submit
  add column if not exists responses_draft   jsonb  not null default '{}'::jsonb;

alter table public.responses alter column position set default 0;

-- Tenggat hanya boleh ditetapkan sekali per section. Trigger ini menolak
-- upaya memperpanjang tenggat yang sudah ada, bahkan lewat service-role.
create or replace function public.guard_section_deadlines() returns trigger
language plpgsql as $$
declare k text;
begin
  for k in select jsonb_object_keys(old.section_deadlines) loop
    if new.section_deadlines ? k
       and (new.section_deadlines ->> k) <> (old.section_deadlines ->> k) then
      raise exception 'Tenggat section % sudah ditetapkan dan tidak dapat diubah', k;
    end if;
    if not (new.section_deadlines ? k) then
      raise exception 'Tenggat section % tidak boleh dihapus', k;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists attempts_guard_deadlines on public.attempts;
create trigger attempts_guard_deadlines before update on public.attempts
  for each row execute function public.guard_section_deadlines();

-- Siswa tidak boleh menulis kolom waktu/skor sendiri.
-- (RLS mengizinkan update baris miliknya; kolom sensitif dikunci di sini.)
create or replace function public.guard_attempt_columns() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.score        := old.score;
    new.status       := old.status;
    new.submitted_at := old.submitted_at;
    new.started_at   := old.started_at;
    new.exam         := old.exam;
    new.is_demo      := old.is_demo;
    new.question_ids := old.question_ids;
    new.section_deadlines := old.section_deadlines;
  end if;
  return new;
end $$;

drop trigger if exists attempts_guard_columns on public.attempts;
create trigger attempts_guard_columns before update on public.attempts
  for each row execute function public.guard_attempt_columns();

-- Attempt dengan skor integritas rendah tidak masuk papan peringkat.
create or replace view public.v_user_exam_stats as
select
  a.user_id,
  a.exam,
  count(*)                                                 as attempts,
  round(avg((a.score->>'total')::numeric), 1)              as avg_total,
  max((a.score->>'total')::numeric)                        as best_total,
  max(a.submitted_at)                                      as last_at,
  round(avg((a.integrity->>'integrityScore')::numeric), 1) as avg_integrity
from public.attempts a
where a.status = 'submitted'
  and a.is_demo = false
  and a.score is not null
  and coalesce((a.integrity->>'integrityScore')::numeric, 100) >= 60
group by a.user_id, a.exam;

-- Statistik butir untuk kalibrasi IRT (lihat docs/RECOMMENDATIONS.md 2.1-2.2)
create or replace function public.refresh_item_stats() returns void
language sql security definer set search_path = public as $$
  update public.questions q
  set times_served  = s.served,
      times_correct = s.correct,
      avg_time_sec  = s.avg_time
  from (
    select r.question_id,
           count(*)                                  as served,
           count(*) filter (where r.correct)         as correct,
           avg(nullif(r.time_spent_sec, 0))::real    as avg_time
    from public.responses r
    join public.attempts a on a.id = r.attempt_id
    where a.status = 'submitted' and a.is_demo = false
    group by r.question_id
  ) s
  where q.id = s.question_id;
$$;

-- Demo gratis dikerjakan tanpa akun, jadi attempt demo boleh tanpa user_id.
alter table public.attempts alter column user_id drop not null;

alter table public.attempts drop constraint if exists attempts_user_required;
alter table public.attempts add constraint attempts_user_required
  check (is_demo or user_id is not null);

-- Attempt demo tidak boleh terbaca lewat RLS; aksesnya hanya lewat
-- route handler ber-service-role yang tahu id-nya.
