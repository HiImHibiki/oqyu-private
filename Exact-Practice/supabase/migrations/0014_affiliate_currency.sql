-- =========================================================================
-- 0014 — komisi tidak boleh dijumlahkan lintas mata uang
--
-- Aplikasi menjual dalam empat mata uang: rupiah lewat Midtrans, sisanya
-- lewat Stripe. Kedua fungsi di bawah menjumlahkan `sum(amount)` tanpa
-- memandang mata uang, sehingga rupiah dan dolar masuk ke satu angka yang
-- bukan keduanya.
--
-- Terukur di driver berkas sebelum diperbaiki: seorang afiliasi dengan satu
-- pembeli Indonesia (komisi Rp 52.350) dan satu pembeli Amerika (komisi
-- US$ 9) melihat «Rp 52.359», dan akan dibayar Rp 9 untuk komisi US$ 9.
--
-- Tidak dikonversi ke satu mata uang: sistem ini tidak punya kurs, dan
-- mengarang kurs berarti menukar kesalahan yang kelihatan dengan kesalahan
-- yang tersembunyi. Angkanya dipisah, dan yang memilih mata uang adalah
-- pemanggilnya.
-- =========================================================================

-- ------------------------------------------------- statistik afiliasi
-- Fungsi ini BERHENTI melaporkan uang sama sekali.
--
-- Versi bergrup-mata-uang sempat dicoba, tetapi ia mengembalikan nol baris
-- ketika afiliasinya belum punya komisi — dan klik serta pendaftar ikut
-- hilang bersamanya. Jumlah klik dan pendaftar tidak bermata uang, jadi
-- keduanya tetap di sini; saldo dihitung driver langsung dari tabel, dipisah
-- per mata uang. Satu fungsi yang mengembalikan angka benar lebih baik
-- daripada satu fungsi yang mengembalikan segalanya dengan satu angka salah.
drop function if exists public.affiliate_stats(uuid);

create or replace function public.affiliate_stats(p_user uuid)
returns table (clicks bigint, signups bigint, conversions bigint)
language sql stable security definer set search_path = public as $$
  with a as (select code from public.affiliates where user_id = p_user)
  select
    (select count(*) from public.referral_clicks c where c.code in (select code from a)),
    (select count(*) from public.referrals r where r.code in (select code from a)),
    (select count(*) from public.commissions m where m.affiliate_user_id = p_user and m.status <> 'void');
$$;

revoke all on function public.affiliate_stats(uuid) from public, anon;

-- --------------------------------------------------- ringkasan admin
-- `commissionOwedIdr` sebelumnya menjumlahkan seluruh mata uang lalu
-- menyebutnya rupiah. Diganti dengan rincian per mata uang; namanya pun
-- diubah supaya tidak ada yang membacanya sebagai rupiah lagi.
create or replace function public.admin_overview()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'users',              (select count(*) from public.profiles),
    'paidOrders',         (select count(*) from public.orders where status = 'paid'),
    'revenueIdr',         (select coalesce(sum(amount),0) from public.orders where status = 'paid' and currency = 'IDR'),
    'attempts',           (select count(*) from public.attempts),
    'submitted',          (select count(*) from public.attempts where status = 'submitted'),
    'demoAttempts',       (select count(*) from public.attempts where is_demo),
    'affiliates',         (select count(*) from public.affiliates),
    'commissionOwedIdr',  (select coalesce(sum(amount),0) from public.commissions
                            where status in ('pending','approved') and currency = 'IDR'),
    'commissionOwed',     (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
                            from (select currency, sum(amount) as total
                                    from public.commissions
                                   where status in ('pending','approved')
                                   group by currency) x),
    'payoutsRequested',   (select count(*) from public.payouts where status = 'requested'),
    'flaggedAttempts',    (select count(*) from public.attempts
                            where status = 'submitted'
                              and coalesce((integrity->>'integrityScore')::numeric, 100) < 60)
  );
$$;

revoke all on function public.admin_overview() from public, anon, authenticated;
