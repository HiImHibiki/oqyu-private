import { NextResponse } from "next/server";
import { currentUser, idCanvasDari, menunggu } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { questionsByIds } from "@/lib/exams/bank";
import { potretHtml } from "@/lib/practice/worksheet";
import { tanyaGuru } from "@/lib/practice/canvas";
import { aksesLatihan } from "@/lib/practice/akses";
import type { Question } from "@/lib/types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Gambar soal untuk kanvas guru: HTML sederhana + KaTeX auto-render, dipotret
 * Chrome kendali Exact Worksheet. Rumus tetap ditulis $…$ sebagaimana di bank. */
function htmlSoal(q: Question, nomor: number, judul: string) {
  const opsi = (q.choices ?? []).map((c) => `<div class="o"><b>${esc(c.id)}.</b> ${esc(c.text)}</div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<style>body{font:20px/1.5 Georgia,serif;margin:0;padding:28px 32px;color:#111;background:#fff;width:836px}
.k{font:13px sans-serif;color:#666;margin-bottom:10px}.s{white-space:pre-wrap}.o{margin:6px 0 0 8px}</style></head>
<body><div class="k">${esc(judul)} — Soal ${nomor}</div><div class="s">${esc(q.stem)}</div>${opsi}
<script>document.addEventListener("DOMContentLoaded",()=>renderMathInElement(document.body,{delimiters:[{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],throwOnError:false}))</script>
</body></html>`;
}

function teksSoal(q: Question, nomor: number, judul: string) {
  const opsi = (q.choices ?? []).map((c) => `${c.id}. ${c.text}`).join("\n");
  return `[${judul} — Soal ${nomor}]\n${q.stem}${opsi ? "\n" + opsi : ""}`;
}

/** body: { attemptId, questionId, number } → { url } layar murid Exact Canvas */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });
  if (menunggu(user)) return NextResponse.json({ error: "Akunmu belum disetujui guru" }, { status: 403 });
  // Tanya guru hanya untuk murid bimbel — pengguna umum tidak punya kelas di Exact Canvas.
  if (!(await aksesLatihan(user)).murid) return NextResponse.json({ error: "Tanya guru hanya untuk murid Exact Course" }, { status: 403 });
  const { attemptId, questionId, number } = (await req.json()) as { attemptId: string; questionId: string; number?: number };
  const a = await getDb().getAttempt(attemptId);
  if (!a || a.userId !== user.id) return NextResponse.json({ error: "Attempt tidak ditemukan" }, { status: 404 });
  if (a.exam !== "LATIHAN") return NextResponse.json({ error: "Bertanya hanya untuk latihan" }, { status: 403 });
  const ids = a.formLayout.flatMap((s) => s.questionIds);
  if (!ids.includes(questionId)) return NextResponse.json({ error: "Soal bukan bagian attempt ini" }, { status: 400 });
  const q = (await questionsByIds([questionId])).get(questionId);
  if (!q) return NextResponse.json({ error: "Soal tidak ditemukan di bank" }, { status: 404 });
  const nomor = number ?? ids.indexOf(questionId) + 1;

  // Gambar itu pelengkap: kalau Exact Worksheet sedang sibuk, teksnya tetap dikirim.
  let foto: string | null = null;
  try {
    foto = `data:image/png;base64,${(await potretHtml(htmlSoal(q, nomor, a.formTitle), 900)).toString("base64")}`;
  } catch (e) {
    console.warn("tanya: potret gagal, kirim teks saja:", e instanceof Error ? e.message : e);
  }
  const hasil = await tanyaGuru({
    // Akun dari Exact Canvas memakai id aslinya, jadi pertanyaannya menumpuk di murid yang sama di kanvas.
    muridId: idCanvasDari(user.email) ?? `prc-${user.id}`, nama: user.fullName || user.email,
    teks: teksSoal(q, nomor, a.formTitle), fotoDataUrl: foto,
  });
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan, kode: hasil.kode }, { status: 502 });
  return NextResponse.json({ url: hasil.url });
}
