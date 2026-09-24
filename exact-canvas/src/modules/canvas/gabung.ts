/**
 * Penggabungan tiga arah untuk satu sketsa yang dibuka di dua tempat.
 *
 * Mac dan tablet sama-sama menyimpan seluruh dokumen. Tanpa penggabungan,
 * yang terakhir menyimpan menang, dan goresan dari sisi lain hilang. Di sini
 * yang dibandingkan adalah tiga salinan: `basis` (yang terakhir dimuat atau
 * disimpan oleh sisi ini), `saya` (keadaan sisi ini sekarang), dan `mereka`
 * (yang ada di vault). Aturannya per butir, dikenali dari id:
 *
 *   - ditambahkan salah satu pihak → ikut;
 *   - dihapus salah satu pihak → hilang;
 *   - diubah oleh saya (berbeda dari basis) → versi saya; selain itu versi mereka.
 *
 * Bukan CRDT penuh, tapi cukup untuk satu guru dengan dua alat: goresan tidak
 * pernah saling menimpa, dan menghapus di satu sisi tidak dihidupkan lagi oleh
 * sisi lain.
 */

import type { BerkasKanvas } from './strokes'

function samaJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function gabungKoleksi<T extends { id: string }>(basis: T[], saya: T[], mereka: T[]): T[] {
  const petaBasis = new Map(basis.map((x) => [x.id, x]))
  const petaSaya = new Map(saya.map((x) => [x.id, x]))
  const keluar: T[] = []
  const sudah = new Set<string>()

  // Urutan mereka jadi tulang punggung: itu urutan yang sudah tersimpan.
  for (const butir of mereka) {
    sudah.add(butir.id)
    const punyaku = petaSaya.get(butir.id)
    const asal = petaBasis.get(butir.id)
    if (asal && !punyaku) continue // saya menghapusnya
    if (punyaku && asal && !samaJson(punyaku, asal)) {
      keluar.push(punyaku) // saya mengubahnya (menggeser, memutar)
      continue
    }
    keluar.push(butir)
  }
  // Tambahan saya yang belum mereka punya. Yang ada di basis tapi tidak ada di
  // mereka berarti mereka menghapusnya — dibiarkan hilang.
  for (const butir of saya) {
    if (sudah.has(butir.id)) continue
    if (!petaBasis.has(butir.id)) keluar.push(butir)
  }
  return keluar
}

function pilih<T>(basis: T, saya: T, mereka: T): T {
  return samaJson(saya, basis) ? mereka : saya
}

export function gabungkan(basis: BerkasKanvas, saya: BerkasKanvas, mereka: BerkasKanvas): BerkasKanvas {
  return {
    id: saya.id,
    title: pilih(basis.title, saya.title, mereka.title),
    strokes: gabungKoleksi(basis.strokes, saya.strokes, mereka.strokes),
    images: gabungKoleksi(basis.images ?? [], saya.images ?? [], mereka.images ?? []),
    objects: gabungKoleksi(basis.objects ?? [], saya.objects ?? [], mereka.objects ?? []),
    texts: gabungKoleksi(basis.texts ?? [], saya.texts ?? [], mereka.texts ?? []),
    layers: pilih(basis.layers, saya.layers, mereka.layers),
    paper: pilih(basis.paper, saya.paper, mereka.paper),
    pages: Math.max(pilih(basis.pages ?? 1, saya.pages ?? 1, mereka.pages ?? 1), mereka.pages ?? 1),
    updated_at: Math.max(saya.updated_at, mereka.updated_at),
  }
}
