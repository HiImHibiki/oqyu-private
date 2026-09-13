import Anthropic from "@anthropic-ai/sdk";

/* =========================================================================
 * Tiga penyedia AI di balik satu antarmuka.
 *
 * Claude memakai SDK resmi Anthropic; Gemini dan OpenAI memakai HTTP langsung
 * karena SDK-nya tidak dipasang di proyek ini.
 *
 * Kunci API dibaca dari environment di sisi server dan TIDAK PERNAH dikirim
 * ke browser — panel admin hanya tahu penyedia mana yang sudah dikonfigurasi.
 * ========================================================================= */

export type ProviderId = "anthropic" | "google" | "openai";

export interface ModelOption { id: string; label: string; note?: string }

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  envVar: string;
  models: ModelOption[];
  supportsPdf: boolean;
  docsUrl: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    envVar: "ANTHROPIC_API_KEY",
    supportsPdf: true,
    docsUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-opus-5", label: "Claude Opus 5", note: "paling teliti untuk menulis soal" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "lebih murah, cukup untuk drill" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "paling murah" },
    ],
  },
  {
    id: "google",
    name: "Gemini (Google)",
    envVar: "GOOGLE_API_KEY",
    supportsPdf: true,
    docsUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "lebih cepat dan murah" },
    ],
  },
  {
    id: "openai",
    name: "ChatGPT (OpenAI)",
    envVar: "OPENAI_API_KEY",
    supportsPdf: true,
    docsUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-5", label: "GPT-5" },
      { id: "gpt-5-mini", label: "GPT-5 mini", note: "lebih murah" },
      { id: "gpt-4.1", label: "GPT-4.1" },
    ],
  },
];

export function providerAvailability() {
  return PROVIDERS.map((p) => ({
    ...p,
    configured: Boolean(process.env[p.envVar]),
  }));
}

/* -------------------------------------------------------------- lampiran */

export interface Attachment {
  /** "image/png" | "image/jpeg" | "application/pdf" */
  mediaType: string;
  /** base64 tanpa awalan data: */
  data: string;
  name?: string;
}

export const isPdf = (a: Attachment) => a.mediaType === "application/pdf";
export const isImage = (a: Attachment) => a.mediaType.startsWith("image/");

export interface GenerateInput {
  provider: ProviderId;
  model: string;
  system: string;
  user: string;
  attachments?: Attachment[];
  maxTokens?: number;
}

export interface GenerateOutput {
  text: string;
  model: string;
  usage?: { input?: number; output?: number };
}

export async function generate(input: GenerateInput): Promise<GenerateOutput> {
  switch (input.provider) {
    case "anthropic": return viaAnthropic(input);
    case "google": return viaGemini(input);
    case "openai": return viaOpenAI(input);
    default: throw new Error("Penyedia tidak dikenal");
  }
}

/* ------------------------------------------------------------- Anthropic */

async function viaAnthropic(input: GenerateInput): Promise<GenerateOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY belum diisi di .env.local");

  const client = new Anthropic({ apiKey });

  const content: Anthropic.ContentBlockParam[] = [];
  for (const a of input.attachments ?? []) {
    if (isPdf(a)) {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: a.data },
      });
    } else if (isImage(a)) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: a.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: a.data,
        },
      });
    }
  }
  content.push({ type: "text", text: input.user });

  // Menulis 10 soal berikut bacaan bisa panjang, jadi selalu streaming —
  // permintaan non-streaming dengan max_tokens besar mudah kena timeout HTTP.
  const stream = client.messages.stream({
    model: input.model,
    max_tokens: input.maxTokens ?? 32000,
    system: input.system,
    output_config: { effort: "high" },
    messages: [{ role: "user", content }],
  });

  const msg = await stream.finalMessage();

  if (msg.stop_reason === "refusal") {
    throw new Error(
      `Model menolak permintaan ini (${msg.stop_details?.category ?? "tanpa kategori"}). ` +
      "Coba ubah tema atau instruksi tambahannya.",
    );
  }

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return {
    text,
    model: msg.model,
    usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens },
  };
}

/* ---------------------------------------------------------------- Gemini */

async function viaGemini(input: GenerateInput): Promise<GenerateOutput> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY belum diisi di .env.local");

  const parts: unknown[] = (input.attachments ?? []).map((a) => ({
    inline_data: { mime_type: a.mediaType, data: a.data },
  }));
  parts.push({ text: input.user });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: input.maxTokens ?? 32000, temperature: 0.6 },
      }),
    },
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini menolak: ${body?.error?.message ?? res.status}`);
  }

  const cand = body?.candidates?.[0];
  if (!cand) throw new Error("Gemini tidak mengembalikan kandidat jawaban");
  if (cand.finishReason === "SAFETY") throw new Error("Gemini memblokir permintaan ini karena filter keamanan");

  const text = (cand.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("\n");

  return {
    text,
    model: input.model,
    usage: {
      input: body?.usageMetadata?.promptTokenCount,
      output: body?.usageMetadata?.candidatesTokenCount,
    },
  };
}

/* ---------------------------------------------------------------- OpenAI */

async function viaOpenAI(input: GenerateInput): Promise<GenerateOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY belum diisi di .env.local");

  // Responses API dipakai karena ia menerima gambar DAN berkas PDF;
  // chat/completions hanya menerima gambar.
  const content: unknown[] = [];
  for (const a of input.attachments ?? []) {
    if (isPdf(a)) {
      content.push({
        type: "input_file",
        filename: a.name ?? "lampiran.pdf",
        file_data: `data:application/pdf;base64,${a.data}`,
      });
    } else if (isImage(a)) {
      content.push({ type: "input_image", image_url: `data:${a.mediaType};base64,${a.data}` });
    }
  }
  content.push({ type: "input_text", text: input.user });

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: input.model,
      instructions: input.system,
      input: [{ role: "user", content }],
      max_output_tokens: input.maxTokens ?? 32000,
    }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`OpenAI menolak: ${body?.error?.message ?? res.status}`);

  const text: string =
    body.output_text ??
    (body.output ?? [])
      .flatMap((o: { content?: { type: string; text?: string }[] }) => o.content ?? [])
      .filter((c: { type: string }) => c.type === "output_text")
      .map((c: { text?: string }) => c.text ?? "")
      .join("\n");

  if (!text) throw new Error("OpenAI tidak mengembalikan teks");

  return {
    text,
    model: body.model ?? input.model,
    usage: { input: body?.usage?.input_tokens, output: body?.usage?.output_tokens },
  };
}

/* ------------------------------------------------- mengambil JSON dari teks */

/** Model kadang tetap membungkus JSON dengan pagar kode atau kalimat pengantar
 *  meski diminta tidak. Ambil array JSON pertama yang utuh. */
export function extractJsonArray(text: string): { ok: true; value: unknown[] } | { ok: false; error: string } {
  const trimmed = text.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], trimmed].filter(Boolean) as string[];

  for (const c of candidates) {
    const start = c.indexOf("[");
    const end = c.lastIndexOf("]");
    if (start === -1 || end <= start) continue;
    try {
      const parsed = JSON.parse(c.slice(start, end + 1));
      if (Array.isArray(parsed)) return { ok: true, value: parsed };
    } catch { /* coba kandidat berikutnya */ }
  }

  // mungkin satu objek soal saja
  try {
    const one = JSON.parse(trimmed);
    if (one && typeof one === "object") return { ok: true, value: [one] };
  } catch { /* menyerah */ }

  return { ok: false, error: "Keluaran model bukan JSON array yang bisa diurai" };
}
