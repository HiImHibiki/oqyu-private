import type { FullDb } from "./types";
import { devDb } from "./dev";
import { supabaseDb } from "./supabase";

/** true selama project Supabase belum dikonfigurasi. */
export const usingDev = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Satu-satunya pintu ke penyimpanan. Route handler tidak boleh mengimpor
 *  devDb atau supabaseDb secara langsung. */
export function getDb(): FullDb {
  return usingDev() ? devDb : supabaseDb;
}

export * from "./types";
