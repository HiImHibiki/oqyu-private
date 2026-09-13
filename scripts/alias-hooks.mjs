/* Membuat impor "@/..." bisa diselesaikan di Node polos.
 * Next menyediakannya lewat tsconfig paths; skrip uji tidak lewat Next, jadi
 * pemetaannya diulang di sini agar berkas uji memuat modul yang SAMA dengan
 * yang dipakai aplikasi — bukan salinannya. */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Meniru resolusi ekstensi TypeScript: "x" → x.ts, x.tsx, x/index.ts. */
function withExtension(base) {
  if (path.extname(base)) return base;
  for (const c of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(c)) return c;
  }
  return base;
}

const NEXT_HEADERS_STUB = pathToFileURL(path.join(ROOT, "scripts", "next-headers-stub.mjs")).href;

export function resolve(specifier, context, next) {
  // next/headers tidak ada di luar runtime Next — lihat next-headers-stub.mjs.
  if (specifier === "next/headers") return { url: NEXT_HEADERS_STUB, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const file = withExtension(path.join(ROOT, "src", specifier.slice(2)));
    return next(pathToFileURL(file).href, context);
  }
  // Impor relatif tanpa ekstensi di dalam modul TS juga perlu diselesaikan.
  if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL) {
    const base = path.dirname(fileURLToPath(context.parentURL));
    const file = withExtension(path.resolve(base, specifier));
    if (existsSync(file)) return next(pathToFileURL(file).href, context);
  }
  return next(specifier, context);
}
