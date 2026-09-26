/* Jembatan ke Exact Canvas: kanvas pribadi murid ditanam di halaman latihan
 * (sesi akun Canvas atau akun otomatis untuk murid username Practice), dan
 * login murid dengan akun Canvas (lihat lib/auth.ts). */
const URL_LOKAL = process.env.EXACT_CANVAS_URL || "http://127.0.0.1:4747";
const URL_PUBLIK = process.env.EXACT_CANVAS_PUBLIC || "http://localhost:4747";
const PIN = process.env.EXACT_CANVAS_PIN || "";

const kepala = () => ({ "Content-Type": "application/json", ...(PIN ? { "x-exact-pin": PIN } : {}) });

/** Asal (origin) layar murid Canvas — untuk memeriksa postMessage dari iframe papan guru. */
export const ASAL_CANVAS = URL_PUBLIK;

/** Alamat layar murid yang ditanam di halaman latihan: sudah membawa sesi, tanpa masuk lagi. */
export function urlPapan(token: string): string {
  return `${URL_PUBLIK}/tv?murid=1&embed=1&sesi=${encodeURIComponent(token)}`;
}

/** Sesi Canvas atas nama akun murid (hanya akun Canvas yang sudah disetujui).
 *  Endpoint-nya cuma menerima permintaan loopback ber-PIN, jadi hanya server
 *  Practice di Mac yang sama yang bisa memintanya. null = tidak bisa/tidak ada. */
export async function sesiCanvasUntuk(idAkun: string): Promise<string | null> {
  if (!PIN) return null;
  try {
    const r = await fetch(`${URL_LOKAL}/api/akun/sesi`, { method: "POST", headers: kepala(), body: JSON.stringify({ id: idAkun }) });
    if (!r.ok) return null;
    const j = (await r.json()) as { token?: string };
    return j.token ?? null;
  } catch {
    return null;
  }
}

/** Sesi Canvas untuk murid Practice (login username): Canvas membuat akun
 *  otomatis — disetujui, izin coret menyala, kanvas pribadi disiapkan — jadi
 *  coretan murid di halaman latihan langsung tampil di Mac guru, tanpa "Tanya"
 *  dulu. Loopback + PIN, seperti sesiCanvasUntuk. null = Canvas mati/PIN kosong. */
export async function sesiPracticeUntuk(userId: string, nama: string): Promise<string | null> {
  if (!PIN) return null;
  try {
    const r = await fetch(`${URL_LOKAL}/api/akun/practice`, {
      method: "POST", headers: kepala(), body: JSON.stringify({ id: userId, nama: nama || "Murid" }),
    });
    if (!r.ok) return null;
    return ((await r.json()) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

/** Id kanvas pribadi murid Practice di Canvas (dibuat bila belum ada) — untuk
 *  layar pantau guru. null = Canvas mati/PIN kosong. */
export async function kanvasMurid(userId: string, nama: string): Promise<string | null> {
  if (!PIN) return null;
  try {
    const r = await fetch(`${URL_LOKAL}/api/akun/practice`, {
      method: "POST", headers: kepala(), body: JSON.stringify({ id: userId, nama: nama || "Murid" }),
    });
    if (!r.ok) return null;
    return ((await r.json()) as { kanvas?: string | null }).kanvas ?? null;
  } catch {
    return null;
  }
}

/** Layar lihat-saja (mode TV) yang terpaku ke satu kanvas murid: goresannya
 *  tampil seketika. Membawa PIN — hanya untuk halaman guru. */
export function urlLihatKanvas(kanvasId: string): string {
  return `${URL_PUBLIK}/tv?tv=1&mode=fit&pin=${encodeURIComponent(PIN)}&lihat=${encodeURIComponent(kanvasId)}`;
}

/** Tiket admin sementara (12 jam) dari Canvas — supaya editor web Canvas bisa
 *  ditanam di halaman guru tanpa mengetik sandi admin. Loopback + PIN. */
export async function tiketAdminCanvas(): Promise<string | null> {
  if (!PIN) return null;
  try {
    const r = await fetch(`${URL_LOKAL}/api/admin/tiket`, { method: "POST", headers: kepala(), body: "{}" });
    if (!r.ok) return null;
    return ((await r.json()) as { tiket?: string }).tiket ?? null;
  } catch {
    return null;
  }
}

/** Editor Canvas lengkap (bisa menulis) yang langsung membuka kanvas murid. */
export function urlEditorKanvas(kanvasId: string, tiket: string): string {
  return `${URL_PUBLIK}/admin?admin=${encodeURIComponent(tiket)}&buka=${encodeURIComponent(kanvasId)}`;
}
