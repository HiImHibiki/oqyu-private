/* Jembatan ke Exact Canvas: murid "bertanya" dari ruang ujian, soalnya masuk
 * antrean pertanyaan guru di kanvas (lengkap dengan gambarnya), lalu murid
 * diarahkan ke layar murid meet2 untuk menyimak pembahasannya. */

const URL_LOKAL = process.env.EXACT_CANVAS_URL || "http://127.0.0.1:4747";
const URL_PUBLIK = process.env.EXACT_CANVAS_PUBLIC || "https://meet2.exactprintsolution.com";
const PIN = process.env.EXACT_CANVAS_PIN || "";

const kepala = () => ({ "Content-Type": "application/json", ...(PIN ? { "x-exact-pin": PIN } : {}) });

export interface HasilTanya { ok: boolean; pesan?: string; url?: string; kode?: string }

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

/** Pesan galat Canvas berkode: TUNGGU:<detik>:<pesan> | ANTRE:<pesan> | MUTED:<pesan> */
function urai(pesan: string): { kode: string; teks: string } {
  const m = pesan.match(/^(TUNGGU|ANTRE|MUTED):(?:\d+:)?(.*)$/s);
  return m ? { kode: m[1], teks: m[2].trim() } : { kode: "LAIN", teks: pesan };
}

export async function tanyaGuru(input: {
  muridId: string; nama: string; teks: string; fotoDataUrl?: string | null;
}): Promise<HasilTanya> {
  if (!PIN) return { ok: false, pesan: "PIN Exact Canvas belum diatur di server (EXACT_CANVAS_PIN)." };
  // Murid harus terdaftar dulu di kelas — id-nya id akun Practice, jadi
  // pertanyaan orang yang sama selalu menumpuk di satu nama.
  const masuk = await fetch(`${URL_LOKAL}/api/kelas/masuk`, {
    method: "POST", headers: kepala(), body: JSON.stringify({ murid: input.muridId, nama: input.nama }),
  }).catch((e: Error) => ({ ok: false, status: 0, text: async () => e.message } as unknown as Response));
  if (!masuk.ok) return { ok: false, pesan: `Exact Canvas tidak bisa dihubungi (${masuk.status || "mati"}).` };

  const r = await fetch(`${URL_LOKAL}/api/kelas/tanya`, {
    method: "POST", headers: kepala(),
    body: JSON.stringify({ murid: input.muridId, nama: input.nama, teks: input.teks, fotos: input.fotoDataUrl ? [input.fotoDataUrl] : [] }),
  });
  if (!r.ok) {
    const { kode, teks } = urai(await r.text());
    return { ok: false, kode, pesan: teks || `Canvas menolak (HTTP ${r.status})` };
  }
  return { ok: true, url: `${URL_PUBLIK}/tv?murid=1` };
}
