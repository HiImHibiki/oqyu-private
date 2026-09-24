/* `next/headers` hanya ada di dalam runtime Next.
 *
 * Skrip CLI mengimpor modul aplikasi yang sama dengan yang dipakai server —
 * itu memang tujuannya, supaya yang diuji bukan salinannya. Rantai impor itu
 * kadang menyentuh @/lib/supabase/server, yang mengimpor next/headers meski
 * skripnya berjalan di driver berkas dan tidak pernah menyentuh cookie.
 *
 * Stub ini mengembalikan wadah kosong, bukan nilai palsu: kalau ada kode yang
 * benar-benar bergantung pada sesi, ia akan gagal dengan jelas, bukan diam-diam
 * berjalan dengan identitas yang salah. */
const kosong = {
  get: () => undefined,
  getAll: () => [],
  has: () => false,
  set: () => {},
  delete: () => {},
};
export const cookies = async () => kosong;
export const headers = async () => new Headers();
export const draftMode = async () => ({ isEnabled: false, enable: () => {}, disable: () => {} });
