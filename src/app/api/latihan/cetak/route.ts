import { NextResponse } from "next/server";
import { currentUser, menunggu } from "@/lib/auth";
import { isAdmin } from "@/lib/adminGuard";
import { aksesLatihan } from "@/lib/practice/akses";
import { getPaket, savePaket } from "@/lib/practice/paket";
import { questionsByIds } from "@/lib/exams/bank";
import { ambilPdf, questionKeButir, renderPdf } from "@/lib/practice/worksheet";

/** GET ?id=<paket>&kunci=1 → PDF lembar soal (kunci hanya guru). Dicetak
 *  sekali lewat Exact Worksheet lalu nama berkasnya disimpan di paket. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });
  if (menunggu(user)) return NextResponse.json({ error: "Akunmu belum disetujui guru" }, { status: 403 });
  const akses = await aksesLatihan(user);
  if (!akses.boleh) return NextResponse.json({ error: akses.alasan }, { status: 402 });
  const u = new URL(req.url);
  const id = u.searchParams.get("id") || "";
  const kunci = u.searchParams.get("kunci") === "1";
  if (kunci && !isAdmin(user)) return NextResponse.json({ error: "Kunci hanya untuk guru" }, { status: 403 });
  const p = await getPaket(id);
  if (!p || (!p.terbit && !isAdmin(user))) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });

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
  const r = await ambilPdf(nama);
  if (!r.ok) return NextResponse.json({ error: "Berkas PDF tidak ditemukan di Desktop Mac" }, { status: 404 });
  return new Response(r.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(nama)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
