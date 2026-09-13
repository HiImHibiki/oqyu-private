-- =====================================================================
-- Leaderboard, rata-rata skor, dan progres journey
-- =====================================================================

-- Skor terbaik & rata-rata tiap user per ujian ---------------------------
create or replace view public.v_user_exam_stats as
select
  a.user_id,
  a.exam,
  count(*)                                              as attempts,
  round(avg((a.score->>'total')::numeric), 1)           as avg_total,
  max((a.score->>'total')::numeric)                     as best_total,
  max(a.submitted_at)                                   as last_at,
  round(avg((a.integrity->>'integrityScore')::numeric), 1) as avg_integrity
from public.attempts a
where a.status = 'submitted' and a.is_demo = false and a.score is not null
group by a.user_id, a.exam;

-- Papan peringkat: rata-rata dari SEMUA tes yang diambil ------------------
create or replace view public.v_leaderboard as
select
  p.id                                            as user_id,
  p.full_name,
  p.school,
  s.exam,
  s.attempts,
  s.avg_total,
  s.best_total,
  s.last_at,
  rank() over (partition by s.exam order by s.best_total desc nulls last)  as rank_best,
  rank() over (partition by s.exam order by s.avg_total desc nulls last)   as rank_avg
from public.v_user_exam_stats s
join public.profiles p on p.id = s.user_id;

-- RPC: leaderboard aman (tanpa membocorkan email) ------------------------
create or replace function public.leaderboard(p_exam exam_code, p_limit int default 50)
returns table (
  rank int, user_id uuid, display_name text, school text,
  attempts bigint, avg_total numeric, best_total numeric, is_me boolean
)
language sql stable security definer set search_path = public as $$
  select
    (row_number() over (order by l.best_total desc nulls last))::int as rank,
    l.user_id,
    case when length(coalesce(l.full_name,'')) = 0 then 'Peserta'
         else split_part(l.full_name,' ',1) || ' ' ||
              coalesce(nullif(left(split_part(l.full_name,' ',2),1),''),'') ||
              case when split_part(l.full_name,' ',2) <> '' then '.' else '' end
    end as display_name,
    l.school,
    l.attempts, l.avg_total, l.best_total,
    (l.user_id = auth.uid()) as is_me
  from public.v_leaderboard l
  where l.exam = p_exam
  order by l.best_total desc nulls last
  limit p_limit;
$$;

-- RPC: ringkasan dashboard ----------------------------------------------
create or replace function public.my_summary()
returns table (
  exam exam_code, attempts bigint, avg_total numeric, best_total numeric,
  last_at timestamptz, quota_left int
)
language sql stable security definer set search_path = public as $$
  select
    e.exam,
    coalesce(s.attempts, 0),
    s.avg_total,
    s.best_total,
    s.last_at,
    greatest(0, sum(e.attempts_total - e.attempts_used))::int
  from public.entitlements e
  left join public.v_user_exam_stats s on s.user_id = e.user_id and s.exam = e.exam
  where e.user_id = auth.uid()
  group by e.exam, s.attempts, s.avg_total, s.best_total, s.last_at;
$$;

-- RPC: kekuatan/kelemahan per domain ------------------------------------
create or replace function public.my_domain_breakdown(p_exam exam_code)
returns table (domain text, total bigint, correct bigint, pct numeric)
language sql stable security definer set search_path = public as $$
  select q.domain,
         count(*)                                   as total,
         count(*) filter (where r.correct)          as correct,
         round(100.0 * count(*) filter (where r.correct) / nullif(count(*),0), 1) as pct
  from public.responses r
  join public.attempts a on a.id = r.attempt_id
  join public.questions q on q.id = r.question_id
  where a.user_id = auth.uid() and a.exam = p_exam and a.status = 'submitted'
  group by q.domain
  order by pct asc nulls first;
$$;
