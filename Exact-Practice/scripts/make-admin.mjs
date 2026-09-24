#!/usr/bin/env node
/**
 * Menjadikan satu akun sebagai admin.
 *
 *   node --env-file-if-exists=.env.local scripts/make-admin.mjs kamu@email.com
 *
 * Mode Supabase  : memperbarui public.profiles.role
 * Mode berkas    : memperbarui .data/db.json
 *
 * Alternatif tanpa skrip: isi ADMIN_EMAILS di .env.local sebelum mendaftar,
 * maka akun dengan email itu langsung menjadi admin saat dibuat.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const role = process.argv[3] ?? "admin";
if (!email) {
  console.error("Pemakaian: node scripts/make-admin.mjs <email> [admin|reviewer|student]");
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (url && key) {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("profiles").update({ role }).eq("email", email).select("id,email,role").maybeSingle();
  if (error) { console.error("Gagal:", error.message); process.exit(1); }
  if (!data) { console.error(`Tidak ada profil dengan email ${email}. Daftarkan akunnya lebih dulu.`); process.exit(1); }
  console.log(`✓ ${data.email} sekarang berperan ${data.role}`);
} else {
  const file = path.join(process.cwd(), ".data", "db.json");
  if (!existsSync(file)) { console.error("Tidak ada .data/db.json. Jalankan aplikasi dan daftar lebih dulu."); process.exit(1); }
  const db = JSON.parse(readFileSync(file, "utf8"));
  const u = (db.users ?? []).find((x) => x.email === email);
  if (!u) { console.error(`Tidak ada pengguna dengan email ${email}.`); process.exit(1); }
  u.role = role;
  writeFileSync(file, JSON.stringify(db, null, 2));
  console.log(`✓ ${u.email} sekarang berperan ${role} (mode pengembangan)`);
}
