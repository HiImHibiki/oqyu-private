"use client";
import katex from "katex";
import { useMemo } from "react";
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

export function toHtml(src: string): string {
  if (!src) return "";
  // 1. amankan blok math dulu supaya tidak tersentuh parser markdown
  const math: string[] = [];
  let s = src.replace(/\$\$([\s\S]+?)\$\$/g, (_m, m: string) => `\u27E6M${math.push(renderMath(m, true)) - 1}\u27E7`);
  s = s.replace(/\$([^$\n]+?)\$/g, (_m, m: string) => `\u27E6M${math.push(renderMath(m, false)) - 1}\u27E7`);

  // 2. blok
  const blocks = s.split(/\n{2,}/).map((raw) => {
    const b = raw.trim();
    if (!b) return "";
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

  // 3. kembalikan math
  return blocks.join("").replace(/\u27E6M(\d+)\u27E7/g, (_m, i: string) => math[Number(i)]);
}

export function RichText(
  { children, className = "", highlights }: { children: string; className?: string; highlights?: Span[] },
) {
  const html = useMemo(
    () => applyHighlights(toHtml(children), highlights ?? []),
    [children, highlights],
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
