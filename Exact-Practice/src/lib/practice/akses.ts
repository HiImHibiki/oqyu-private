/* Siapa boleh membuka latihan.
 *
 * Exact Practice dipakai internal (les privat), tidak dijual: setiap akun yang
 * sudah masuk boleh berlatih. Gerbangnya ada di kode ujian per paket — murid
 * hanya melihat paket yang kodenya sudah ia masukkan (lihat paket.ts). */
import type { CurrentUser } from "@/lib/auth";

export interface Akses {
  boleh: boolean;
  /** murid bimbel (boleh tanya guru) */
  murid: boolean;
  alasan?: string;
}

export async function aksesLatihan(user: CurrentUser | null): Promise<Akses> {
  if (!user) return { boleh: false, murid: false, alasan: "Perlu masuk" };
  return { boleh: true, murid: true };
}
