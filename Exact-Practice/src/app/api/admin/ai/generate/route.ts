import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { buildPrompt, type Criteria } from "@/lib/ai/promptRegistry";
import { generate, extractJsonArray, PROVIDERS, type Attachment, type ProviderId } from "@/lib/ai/providers";
import { validateQuestions } from "@/lib/exams/validate";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 300;   // menulis 10 soal bisa lama

const MAX_ATTACH_BYTES = 12 * 1024 * 1024;   // 12 MB total, setelah base64 di-decode

interface Body extends Criteria {
  provider: ProviderId;
  model: string;
  attachments?: Attachment[];
}

export async function POST(req: Request) {
  const me = await adminOrNull();
  if (!me) return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });

  // panggilan ke API AI berbayar — batasi supaya satu klik beruntun tidak
  // menghabiskan kuota
  const limit = rateLimit(`ai:${me.id}`, 20, 3600);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Batas 20 pembuatan per jam tercapai. Coba lagi dalam ${Math.ceil(limit.retryAfterSec / 60)} menit.` },
      { status: 429 },
    );
  }

  const body = (await req.json()) as Body;
  const provider = PROVIDERS.find((p) => p.id === body.provider);
  if (!provider) return NextResponse.json({ error: "Penyedia tidak dikenal" }, { status: 400 });
  if (!provider.models.some((m) => m.id === body.model)) {
    return NextResponse.json({ error: "Model tidak dikenal untuk penyedia ini" }, { status: 400 });
  }
  if (!process.env[provider.envVar]) {
    return NextResponse.json(
      { error: `${provider.name} belum dikonfigurasi. Isi ${provider.envVar} di .env.local lalu jalankan ulang server.` },
      { status: 400 },
    );
  }

  const attachments = (body.attachments ?? []).slice(0, 8);
  const bytes = attachments.reduce((a, x) => a + Math.ceil((x.data?.length ?? 0) * 0.75), 0);
  if (bytes > MAX_ATTACH_BYTES) {
    return NextResponse.json({ error: "Total lampiran melebihi 12 MB" }, { status: 400 });
  }
  const badPdf = attachments.some((a) => a.mediaType === "application/pdf" && !provider.supportsPdf);
  if (badPdf) {
    return NextResponse.json({ error: `${provider.name} tidak menerima PDF` }, { status: 400 });
  }

  const jumlah = Math.max(1, Math.min(30, Number(body.jumlah) || 8));

  try {
    const built = await buildPrompt({ ...body, jumlah });

    const out = await generate({
      provider: body.provider,
      model: body.model,
      system: built.system,
      user: built.user,
      attachments,
    });

    const parsed = extractJsonArray(out.text);
    if (!parsed.ok) {
      return NextResponse.json({
        ok: false,
        error: parsed.error,
        raw: out.text.slice(0, 4000),
        model: out.model,
        usage: out.usage,
      });
    }

    const report = validateQuestions(parsed.value, { strict: false });

    return NextResponse.json({
      ok: true,
      model: out.model,
      usage: out.usage,
      questions: parsed.value,
      accepted: report.accepted,
      checked: report.checked,
      blockers: report.blockers,
      majors: report.majors,
      minors: report.minors,
      findings: report.findings.slice(0, 100),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal memanggil API AI" },
      { status: 502 },
    );
  }
}
