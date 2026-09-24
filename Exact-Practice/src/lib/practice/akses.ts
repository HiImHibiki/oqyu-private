/* Siapa boleh membuka latihan.
 *
 * Murid Exact Course — akun Exact Canvas atau pendaftar kode kelas yang sudah
 * disetujui (role student) — gratis. Pengguna umum (role umum) datang lewat
 * tautan afiliasi murid dan membayar paket berjangka; mereka boleh masuk
 * selama masih punya entitlement LATIHAN yang belum kedaluwarsa. */
import { getDb } from "@/lib/db";
import { usableEntitlements } from "@/lib/entitlements";
import type { CurrentUser } from "@/lib/auth";

export interface Akses {
  boleh: boolean;
  /** murid bimbel (gratis, boleh tanya guru) */
  murid: boolean;
  /** akhir masa berlaku paket pengguna umum, bila ada */
  sampai?: string | null;
  alasan?: string;
}

export async function aksesLatihan(user: CurrentUser | null): Promise<Akses> {
  if (!user) return { boleh: false, murid: false, alasan: "Perlu masuk" };
  if (user.role === "menunggu") return { boleh: false, murid: false, alasan: "Akunmu belum disetujui guru" };
  if (user.role !== "umum") return { boleh: true, murid: true };
  /* Entitlement "-bonus" (hadiah 1 attempt untuk pendaftar rujukan, warisan
   * Try Out) tidak dihitung: kalau ikut, pembeli paket seminggu lewat tautan
   * afiliasi mendapat akses setahun. */
  const aktif = usableEntitlements(await getDb().entitlements(user.id))
    .filter((e) => e.exam === "LATIHAN" && !e.packageId.endsWith("-bonus"));
  if (!aktif.length) return { boleh: false, murid: false, sampai: null, alasan: "Paket latihanmu belum aktif atau sudah habis" };
  const sampai = aktif.map((e) => e.expiresAt ?? "").filter(Boolean).sort().pop() ?? null;
  return { boleh: true, murid: false, sampai };
}
