import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminGuard";
import { bolehBuka, getPaket, savePaket } from "@/lib/practice/paket";
import { questionsByIds } from "@/lib/exams/bank";
import { ambilPdf, questionKeButir, renderPdf } from "@/lib/practice/worksheet";
import { getDb } from "@/lib/db";
import { gradeAnswer } from "@/lib/exams/grade";
import { attemptSelesaiPaket, jawabanMuridTeks } from "@/lib/practice/latihan";
import type { ResponseValue } from "@/lib/types";

/** GET ?id=<paket>&kunci=1 → PDF lembar soal (kunci hanya guru). Dicetak
 *  sekali lewat Exact Worksheet lalu nama berkasnya disimpan di paket. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });
  const u = new URL(req.url);
  const id = u.searchParams.get("id") || "";
  const kunci = u.searchParams.get("kunci") === "1";
  if (kunci && !isAdmin(user)) return NextResponse.json({ error: "Kunci hanya untuk guru" }, { status: 403 });
  const p = await getPaket(id);
  if (!p || !bolehBuka(user, p)) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });

  /* Sudah mengerjakan → lembarnya jadi lembar belajar miliknya sendiri: soal,
   * kunci, pembahasan, dan di depan tiap pembahasan jawaban yang tadi ia isi
   * beserta benar/salahnya. Belum mengerjakan → tetap lembar soal kosong di
   * bawah, supaya kuncinya tidak bocor sebelum dikerjakan.
   *
   * Sengaja TIDAK disimpan ke p.pdf: berkas itu dipakai bersama semua murid,
   * sedangkan lembar ini milik satu anak. */
  const attempt = kunci ? null : attemptSelesaiPaket(await getDb().attemptsOf(user.id), p);
  if (attempt) {
    const peta = await questionsByIds(p.questionIds);
    const resp = (attempt.responses ?? {}) as Record<string, ResponseValue>;
    const butir = p.questionIds.flatMap((qid, i) => {
      const q = peta.get(qid);
      if (!q) return [];
      const b = questionKeButir(q, i + 1);
      const raw = resp[qid]?.raw;
      const jawab = jawabanMuridTeks(q, raw);
      const kepala = jawab
        ? `Jawabanmu: ${jawab} — ${gradeAnswer(q, raw).correct ? "benar" : "salah"}.`
        : "Tidak dijawab.";
      b.pembahasan = [kepala, b.pembahasan].filter(Boolean).join(" ");
      return [b];
    });
    if (!butir.length) return NextResponse.json({ error: "Paket kosong" }, { status: 400 });
    let hasil;
    try {
      hasil = await renderPdf({
        butir, judul: `${p.judul} — ${user.fullName || "Jawabanku"}`,
        kop: { mapel: p.mapel, kelas: p.kelas, lembaga: "Exact Course" },
        kunci: true, pembahasan: true, kolom: "1",
      });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Cetak gagal" }, { status: 502 });
    }
    const rj = await ambilPdf(hasil.pdf);
    if (!rj.ok) return NextResponse.json({ error: "Berkas PDF tidak ditemukan di Desktop Mac" }, { status: 404 });
    return new Response(rj.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(hasil.pdf)}"`,
        /* Lembar ini memuat jawaban satu anak — jangan sampai tersimpan di
         * singgahan bersama lalu tersaji ke murid lain. */
        "Cache-Control": "private, no-store",
      },
    });
  }

  let nama = kunci ? p.pdfKunci : p.pdf;
  if (!nama) {
    const peta = await questionsByIds(p.questionIds);
    const butir = p.questionIds.map((qid, i) => peta.get(qid)).filter(Boolean).map((q, i) => questionKeButir(q!, i + 1));
    if (!butir.length) return NextResponse.json({ error: "Paket kosong" }, { status: 400 });
    try {
      const r = await renderPdf({
        butir, judul: p.judul, kop: { mapel: p.mapel, kelas: p.kelas, lembaga: "Exact Course" },
        kunci, pembahasan: kunci, kolom: "1",
      });
      nama = r.pdf;
      await savePaket({ ...p, ...(kunci ? { pdfKunci: nama } : { pdf: nama }) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Cetak gagal" }, { status: 502 });
    }
  }
  let r = await ambilPdf(nama);
  if (!r.ok) {
    /* PDF-nya tidak ada di Desktop Mac ini — paket diterbitkan dari Exact
     * Worksheet di Mac lain (nama berkasnya ikut, berkasnya tidak). Render
     * ulang dari bank soal di sini, lalu simpan namanya supaya berikutnya
     * langsung ketemu. */
    const peta = await questionsByIds(p.questionIds);
    const butir = p.questionIds.map((qid) => peta.get(qid)).filter(Boolean).map((q, i) => questionKeButir(q!, i + 1));
    if (!butir.length) return NextResponse.json({ error: "Paket kosong" }, { status: 400 });
    try {
      const h = await renderPdf({ butir, judul: p.judul, kop: { mapel: p.mapel, kelas: p.kelas, lembaga: "Exact Course" }, kunci, pembahasan: kunci, kolom: "1" });
      nama = h.pdf;
      await savePaket({ ...p, ...(kunci ? { pdfKunci: nama } : { pdf: nama }) });
      r = await ambilPdf(nama);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Cetak gagal" }, { status: 502 });
    }
    if (!r.ok) return NextResponse.json({ error: "Berkas PDF tidak ditemukan di Desktop Mac" }, { status: 404 });
  }
  return new Response(r.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(nama)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
