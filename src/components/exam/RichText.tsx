"use client";
import katex from "katex";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { applyHighlights, type Span } from "@/lib/exams/highlight";

/* Renderer teks soal: subset Markdown + LaTeX ($...$ inline, $$...$$ display).
 * Sengaja tidak memakai library markdown penuh agar HTML yang dihasilkan
 * terkendali (soal berasal dari AI - semua tag lain di-escape). */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(s: string) {
  let out = esc(s);
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-[var(--bg-sunken)] px-1 py-0.5 text-[.9em]">$1</code>');
  return out;
}

function renderMath(src: string, display: boolean) {
  try {
    return katex.renderToString(src, {
      displayMode: display,
      throwOnError: false,
      output: "html",
      strict: false,
    });
  } catch {
    return esc(src);
  }
}

/** Penggambar tag diagram: isi tag tanpa kurung siku → HTML. */
export type GambarTag = (inner: string) => string;

const RE_TAG = /\[\[([\s\S]*?)\]\]/g;
const RE_SISIP_TAG = /\u27E6D(\d+)\u27E7/g;
const RE_BLOK_TAG = /^(?:\u27E6D\d+\u27E7\s*)+$/;

export function toHtml(src: string, gambarTag?: GambarTag): string {
  if (!src) return "";
  /* 0. tag diagram "[[grafik: …]]" diangkat keluar PALING AWAL. Isinya penuh
   * karakter yang berarti bagi parser di bawah ini — tanda $, tanda bintang,
   * garis bawah — jadi kalau dibiarkan, LaTeX dan markdown akan mengacak
   * parameternya sebelum sempat digambar. */
  const tag: string[] = [];
  src = src.replace(RE_TAG, (_m, isi: string) => `\u27E6D${tag.push(String(isi).trim()) - 1}\u27E7`);

  // 1. amankan blok math supaya tidak tersentuh parser markdown
  const math: string[] = [];
  let s = src.replace(/\$\$([\s\S]+?)\$\$/g, (_m, m: string) => `\u27E6M${math.push(renderMath(m, true)) - 1}\u27E7`);
  s = s.replace(/\$([^$\n]+?)\$/g, (_m, m: string) => `\u27E6M${math.push(renderMath(m, false)) - 1}\u27E7`);

  // 2. blok
  const blocks = s.split(/\n{2,}/).map((raw) => {
    const b = raw.trim();
    if (!b) return "";
    /* Diagram adalah blok tersendiri — dibungkus <p> ia akan mewarisi
     * perataan teks dan jarak baris paragraf, dan <div> di dalam <p> ditutup
     * paksa oleh peramban sehingga sisa paragrafnya terlempar keluar. */
    if (RE_BLOK_TAG.test(b)) return b;
    if (/^#{1,4}\s/.test(b)) {
      const lvl = b.match(/^#+/)![0].length;
      return `<h${lvl + 2} class="mt-3 mb-1 font-semibold">${inline(b.replace(/^#+\s/, ""))}</h${lvl + 2}>`;
    }
    if (/^>\s/.test(b)) {
      return `<blockquote class="my-2 border-l-2 pl-3 italic" style="border-color:var(--border-strong)">${inline(
        b.replace(/^>\s?/gm, ""),
      )}</blockquote>`;
    }
    if (/^(\d+[.)]\s)/.test(b)) {
      const items = b.split("\n").map((l) => `<li>${inline(l.replace(/^\d+[.)]\s/, ""))}</li>`).join("");
      return `<ol class="my-2 list-decimal space-y-1 pl-6">${items}</ol>`;
    }
    if (/^[-*]\s/.test(b)) {
      const items = b.split("\n").map((l) => `<li>${inline(l.replace(/^[-*]\s/, ""))}</li>`).join("");
      return `<ul class="my-2 list-disc space-y-1 pl-6">${items}</ul>`;
    }
    if (/^\|/.test(b)) {
      const rows = b.split("\n").filter((r) => !/^\|[\s:|-]+\|$/.test(r));
      const cells = rows.map((r) => r.split("|").slice(1, -1).map((c) => c.trim()));
      const head = cells[0] ?? [];
      const body = cells.slice(1);
      const th = head
        .map((h) => `<th class="border px-2 py-1 text-left" style="border-color:var(--border-strong);background:var(--bg-sunken)">${inline(h)}</th>`)
        .join("");
      const tb = body
        .map((r) => `<tr>${r.map((c) => `<td class="border px-2 py-1" style="border-color:var(--border)">${inline(c)}</td>`).join("")}</tr>`)
        .join("");
      return `<div class="overflow-x-auto"><table class="my-2 w-full border-collapse text-sm"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`;
    }
    return `<p>${inline(b).replace(/\n/g, "<br/>")}</p>`;
  });

  // 3. kembalikan math, lalu diagram
  return blocks
    .join("")
    .replace(/\u27E6M(\d+)\u27E7/g, (_m, i: string) => math[Number(i)])
    .replace(RE_SISIP_TAG, (_m, i: string) => {
      const isi = tag[Number(i)] ?? "";
      if (!gambarTag) return '<span class="ws-diagram-memuat">memuat diagram…</span>';
      return gambarTag(isi) || "";
    });
}

/* Penggambar diagram itu 240 KB — terlalu berat untuk ikut di setiap halaman
 * ujian, padahal kebanyakan soal tidak berdiagram. Jadi modulnya baru diambil
 * saat ada teks yang benar-benar memuat "[[", lalu dipakai ulang untuk semua
 * soal berikutnya. */
let modulDiagram: GambarTag | null = null;
const pelanggan = new Set<Dispatch<SetStateAction<GambarTag | null>>>();
let sedangMuat = false;

function useGambarDiagram(perlu: boolean): GambarTag | null {
  /* useState(fn) memperlakukan fungsi sebagai inisialisator malas dan
   * memanggilnya, jadi penggambar harus dibungkus — begitu pula saat diisi
   * lewat setGambar di bawah. */
  const [gambar, setGambar] = useState<GambarTag | null>(() => modulDiagram);
  useEffect(() => {
    if (!perlu || modulDiagram) return;
    pelanggan.add(setGambar);
    if (!sedangMuat) {
      sedangMuat = true;
      void import("@/lib/practice/diagrams.js").then((m) => {
        modulDiagram = m.renderDiagramTag;
        pelanggan.forEach((f) => f(() => modulDiagram!));
        pelanggan.clear();
      });
    }
    return () => { pelanggan.delete(setGambar); };
  }, [perlu]);
  return perlu ? gambar : null;
}

export function RichText(
  { children, className = "", highlights }: { children: string; className?: string; highlights?: Span[] },
) {
  const gambar = useGambarDiagram(children.includes("[["));
  const html = useMemo(
    () => applyHighlights(toHtml(children, gambar ?? undefined), highlights ?? []),
    [children, highlights, gambar],
  );
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Versi inline (tanpa pembungkus paragraf) untuk teks opsi jawaban. */
export function RichInline({ children, className = "" }: { children: string; className?: string }) {
  const html = useMemo(() => {
    const math: string[] = [];
    let s = children.replace(/\$([^$\n]+?)\$/g, (_m, m: string) => `\u27E6M${math.push(renderMath(m, false)) - 1}\u27E7`);
    s = inline(s);
    return s.replace(/\u27E6M(\d+)\u27E7/g, (_m, i: string) => math[Number(i)]);
  }, [children]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
