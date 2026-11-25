import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Router teks & vision AI hemat biaya untuk fitur Studio di Vercel.
// Urutan teks: Groq (gratis cepat) → NVIDIA NIM → Gemini → OpenRouter (:free) → Cloudflare → Claude Haiku (cadangan terakhir).
// Urutan vision: Gemini → Groq Vision (Llama 4 Scout) → OpenRouter → Claude Haiku.
// Set STUDIO_TANPA_CLAUDE=1 untuk mematikan pemakaian Claude Studio sepenuhnya (0 rupiah saldo Claude).

export type Penyedia = "groq" | "nvidia" | "gemini" | "openrouter" | "cloudflare" | "claude";

/** Bentuk pemakaian yang disimpan di naskah.pemakaian (sama dengan studio/lib/bank/otak.mjs + penyedia/tahap). */
export type PemakaianLlm = {
  tahap?: string;
  penyedia: Penyedia;
  model: string;
  input: number;
  output: number;
  biayaUsd: number;
};

export type GambarInput = {
  mimeType: string;
  /** Base64 tanpa prefix data:...;base64, */
  data: string;
};

export type OpsiLlm = {
  system: string;
  prompt: string;
  /** Daftar gambar / bingkai video (opsional, untuk analisis Vision nyata). */
  gambar?: GambarInput[];
  /** JSON Schema keluaran. */
  skema?: Record<string, unknown>;
  suhu?: number;
  maksToken?: number;
  /** Aktifkan Google Search Grounding (khusus Gemini) untuk riset tren live & analisis link. */
  pakaiSearch?: boolean;
  /** Jawaban yang tidak lolos dianggap gagal → lanjut ke penyedia berikutnya. */
  valid?: (data: unknown) => boolean;
};

// Harga per 1 juta token (USD), perkiraan.
const HARGA: Record<string, { input: number; output: number }> = {
  groq: { input: 0, output: 0 },
  nvidia: { input: 0, output: 0 },
  openrouter: { input: 0, output: 0 },
  gemini: { input: 0.3, output: 2.5 },
  cloudflare: { input: 0.29, output: 2.25 },
  "claude-haiku": { input: 0.1, output: 0.5 },
  "claude-sonnet": { input: 2, output: 10 },
};

const biaya = (input: number, output: number, h: { input: number; output: number }) =>
  Math.round(((input * h.input + output * h.output) / 1e6) * 1e6) / 1e6;

/** Sakelar keras untuk mematikan pemakaian Claude di Studio walau ANTHROPIC_API_KEY dipakai Bot Telegram. */
export function claudeDimatikan(): boolean {
  return /^(1|true|ya|on)$/i.test(String(process.env.STUDIO_TANPA_CLAUDE ?? "").trim());
}

/** Buang pagar ```json dan teks pembuka/penutup bila penyedia menambahkannya. */
function ekstrakJson(teks: string): string {
  const t = teks.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const bersih = m ? m[1].trim() : t;
  const awal = bersih.search(/[[{]/);
  if (awal < 0) return bersih;
  const buka = bersih[awal];
  const tutup = buka === "{" ? "}" : "]";
  const akhir = bersih.lastIndexOf(tutup);
  return akhir > awal ? bersih.slice(awal, akhir + 1) : bersih.slice(awal);
}

const teksSkema = (skema?: Record<string, unknown>) =>
  skema ? `\n\nJawab HANYA dengan JSON valid (tanpa markdown, tanpa komentar) yang mengikuti JSON Schema ini:\n${JSON.stringify(skema)}` : "";

/** Helper bersama untuk penyedia API berformat OpenAI Chat Completions (Groq, NVIDIA NIM, OpenRouter). */
async function panggilOpenAiKompatibel(
  opsi: OpsiLlm,
  konfig: {
    nama: Penyedia;
    label: string;
    url: string;
    apiKey: string;
    kandidatModel: string[];
    headerTambahan?: Record<string, string>;
    izinkanGambar?: boolean;
    statusLanjutModel?: number[];
  },
) {
  const daftarGambar = konfig.izinkanGambar && opsi.gambar?.length ? opsi.gambar.slice(0, 5) : [];
  const isiUser: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] =
    daftarGambar.length > 0
      ? [
          { type: "text", text: opsi.prompt },
          ...daftarGambar.map((g) => ({
            type: "image_url" as const,
            image_url: { url: `data:${g.mimeType || "image/jpeg"};base64,${g.data}` },
          })),
        ]
      : opsi.prompt;

  let j: {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null = null;
  let modelDipakai = konfig.kandidatModel[0];
  let galatTerakhir: unknown = null;
  const statusLanjut = new Set(konfig.statusLanjutModel ?? [404, 410]);

  for (const model of konfig.kandidatModel) {
    modelDipakai = model;
    try {
      const res = await fetch(konfig.url, {
        method: "POST",
        signal: AbortSignal.timeout(25_000),
        headers: {
          Authorization: `Bearer ${konfig.apiKey}`,
          "Content-Type": "application/json",
          ...konfig.headerTambahan,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: opsi.system + teksSkema(opsi.skema) },
            { role: "user", content: isiUser },
          ],
          temperature: opsi.suhu ?? 0.7,
          max_tokens: opsi.maksToken ?? 4096,
        }),
      });
      if (!res.ok) {
        const msg = `${konfig.label} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
        if (statusLanjut.has(res.status)) {
          galatTerakhir = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }
      j = await res.json();
      break;
    } catch (e) {
      galatTerakhir = e;
      const msg = String(e);
      if (![...statusLanjut].some((s) => msg.includes(`${konfig.label} ${s}`))) throw e;
    }
  }

  if (!j) throw galatTerakhir ?? new Error(`${konfig.label} gagal merespons.`);
  const teks = String(j.choices?.[0]?.message?.content ?? "{}");
  const data = JSON.parse(ekstrakJson(teks));
  const input = Number(j.usage?.prompt_tokens) || Math.round((opsi.system.length + opsi.prompt.length) / 4);
  const output = Number(j.usage?.completion_tokens) || Math.round(teks.length / 4);
  const tarif = HARGA[konfig.nama] ?? { input: 0, output: 0 };
  return {
    data,
    pemakaian: { penyedia: konfig.nama, model: modelDipakai, input, output, biayaUsd: biaya(input, output, tarif) },
  };
}

async function panggilGroq(opsi: OpsiLlm) {
  const adaGambar = Boolean(opsi.gambar?.length);
  const kandidatModel = adaGambar
    ? ([process.env.STUDIO_GROQ_VISION, "meta-llama/llama-4-scout-17b-16e-instruct"].filter(Boolean) as string[])
    : ([
        process.env.STUDIO_GROQ_TEKS,
        "llama-3.3-70b-versatile",
        "meta-llama/llama-4-scout-17b-16e-instruct",
      ].filter(Boolean) as string[]);

  return panggilOpenAiKompatibel(opsi, {
    nama: "groq",
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: process.env.GROQ_API_KEY!,
    kandidatModel: [...new Set(kandidatModel)],
    izinkanGambar: true,
    statusLanjutModel: [404, 410],
  });
}

async function panggilNvidia(opsi: OpsiLlm) {
  const baseUrl = (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
  const kandidatModel = [
    ...new Set(
      [
        process.env.STUDIO_NVIDIA_TEKS,
        "qwen/qwen2.5-72b-instruct",
        "deepseek-ai/deepseek-v3.2",
        "meta/llama-3.1-70b-instruct",
      ].filter(Boolean) as string[],
    ),
  ];

  return panggilOpenAiKompatibel(opsi, {
    nama: "nvidia",
    label: "NVIDIA",
    url: `${baseUrl}/chat/completions`,
    apiKey: process.env.NVIDIA_API_KEY!,
    kandidatModel,
    izinkanGambar: false,
    statusLanjutModel: [404, 410],
  });
}

async function panggilOpenRouter(opsi: OpsiLlm) {
  const kandidatModel = [
    ...new Set(
      [
        process.env.STUDIO_OPENROUTER_MODEL,
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "google/gemini-2.0-flash-exp:free",
      ].filter(Boolean) as string[],
    ),
  ];

  return panggilOpenAiKompatibel(opsi, {
    nama: "openrouter",
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: process.env.OPENROUTER_API_KEY!,
    kandidatModel,
    headerTambahan: {
      "HTTP-Referer": "https://bakafrawi.com",
      "X-Title": "Bakafrawi Studio",
    },
    izinkanGambar: true,
    statusLanjutModel: [404, 410, 429, 503],
  });
}

async function panggilGemini(opsi: OpsiLlm) {
  const kunci = process.env.GEMINI_API_KEY!;
  const kandidatModel = [...new Set([process.env.STUDIO_GEMINI_TEKS, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean) as string[])];

  const bagianUser = [
    ...(opsi.gambar ?? []).map((g) => ({ inline_data: { mime_type: g.mimeType, data: g.data } })),
    { text: opsi.prompt },
  ];

  const kirim = async (model: string, pakaiSkema: boolean, search: boolean) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(25_000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": kunci },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: opsi.system + (pakaiSkema && !search ? "" : teksSkema(opsi.skema)) }] },
        contents: [{ role: "user", parts: bagianUser }],
        ...(search ? { tools: [{ google_search: {} }] } : {}),
        generationConfig: {
          temperature: opsi.suhu ?? 0.8,
          maxOutputTokens: opsi.maksToken ?? 8000,
          ...(!search ? { responseMimeType: "application/json" } : {}),
          ...(pakaiSkema && !search && opsi.skema ? { responseJsonSchema: opsi.skema } : {}),
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return res.json();
  };

  let j;
  let modelDipakai = kandidatModel[0];
  let galatTerakhir: unknown = null;
  for (const model of kandidatModel) {
    modelDipakai = model;
    try {
      if (opsi.pakaiSearch) {
        try {
          j = await kirim(model, false, true);
        } catch {
          j = await kirim(model, true, false).catch(() => kirim(model, false, false));
        }
      } else {
        try {
          j = await kirim(model, true, false);
        } catch (e) {
          if (!opsi.skema || !String(e).includes("Gemini 400")) throw e;
          j = await kirim(model, false, false);
        }
      }
      break;
    } catch (e) {
      galatTerakhir = e;
      if (!String(e).includes("Gemini 404")) throw e;
    }
  }
  if (!j) throw galatTerakhir ?? new Error("Gemini gagal merespons.");
  const teks = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("") || "{}";
  const u = j.usageMetadata ?? {};
  const input = Number(u.promptTokenCount) || 0;
  const output = (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0);
  return { data: JSON.parse(ekstrakJson(teks)), pemakaian: { penyedia: "gemini" as const, model: modelDipakai, input, output, biayaUsd: biaya(input, output, HARGA.gemini) } };
}

async function panggilCloudflare(opsi: OpsiLlm) {
  const model = process.env.STUDIO_CF_TEKS || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${model}`, {
    method: "POST",
    signal: AbortSignal.timeout(25_000),
    headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: opsi.system + teksSkema(opsi.skema) },
        { role: "user", content: opsi.prompt },
      ],
      temperature: opsi.suhu ?? 0.7,
      max_tokens: opsi.maksToken ?? 4000,
    }),
  });
  if (!res.ok) throw new Error(`Cloudflare AI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const j = await res.json();
  const r = j.result?.response;
  const data = typeof r === "string" ? JSON.parse(ekstrakJson(r)) : r ?? {};
  const input = Number(j.result?.usage?.prompt_tokens) || Math.round((opsi.system.length + opsi.prompt.length) / 4);
  const output = Number(j.result?.usage?.completion_tokens) || Math.round(JSON.stringify(data).length / 4);
  return { data, pemakaian: { penyedia: "cloudflare" as const, model, input, output, biayaUsd: biaya(input, output, HARGA.cloudflare) } };
}

/** Claude Structured Outputs mewajibkan `additionalProperties: false` di setiap node `type: "object"`. */
function rapikanSkemaClaude(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(rapikanSkemaClaude);
  if (!node || typeof node !== "object") return node;
  const salin: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    salin[k] = rapikanSkemaClaude(v);
  }
  if (salin.type === "object" && salin.additionalProperties === undefined) {
    salin.additionalProperties = false;
  }
  return salin;
}

async function panggilClaude(opsi: OpsiLlm) {
  const model = process.env.STUDIO_CLAUDE_TEKS || "claude-haiku-5-5";
  const skemaClaude = opsi.skema ? (rapikanSkemaClaude(opsi.skema) as Record<string, unknown>) : undefined;
  const kontenUser: Anthropic.MessageParam["content"] = opsi.gambar?.length
    ? [
        ...opsi.gambar.map((g) => ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: (g.mimeType === "image/png" || g.mimeType === "image/webp" ? g.mimeType : "image/jpeg") as "image/jpeg" | "image/png" | "image/webp",
            data: g.data,
          },
        })),
        { type: "text" as const, text: opsi.prompt },
      ]
    : opsi.prompt;
  const res = await new Anthropic().messages.create({
    model,
    max_tokens: opsi.maksToken ?? 8000,
    output_config: skemaClaude ? { effort: "low", format: { type: "json_schema", schema: skemaClaude } } : undefined,
    system: opsi.system,
    messages: [{ role: "user", content: kontenUser }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude menolak permintaan ini.");
  const teks = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
  const input = res.usage?.input_tokens ?? 0;
  const output = res.usage?.output_tokens ?? 0;
  const h = model.includes("sonnet") ? HARGA["claude-sonnet"] : HARGA["claude-haiku"];
  return { data: JSON.parse(ekstrakJson(teks)), pemakaian: { penyedia: "claude" as const, model, input, output, biayaUsd: biaya(input, output, h) } };
}

type HasilPanggil = { data: unknown; pemakaian: Omit<PemakaianLlm, "tahap"> };

const PENYEDIA: {
  nama: Penyedia;
  kode: string[];
  gratis: boolean;
  peran: string;
  ada: () => boolean;
  panggil: (o: OpsiLlm) => Promise<HasilPanggil>;
}[] = [
  { nama: "groq", kode: ["groq"], gratis: true, peran: "Prioritas 1 (Teks & Vision)", ada: () => !!process.env.GROQ_API_KEY, panggil: panggilGroq },
  { nama: "nvidia", kode: ["nvidia", "nim"], gratis: true, peran: "Prioritas 2 (Teks)", ada: () => !!process.env.NVIDIA_API_KEY, panggil: panggilNvidia },
  { nama: "gemini", kode: ["gemini"], gratis: true, peran: "Prioritas 3 (Search & Vision)", ada: () => !!process.env.GEMINI_API_KEY, panggil: panggilGemini },
  { nama: "openrouter", kode: ["openrouter", "or"], gratis: true, peran: "Prioritas 4 (:free)", ada: () => !!process.env.OPENROUTER_API_KEY, panggil: panggilOpenRouter },
  { nama: "cloudflare", kode: ["cf", "cloudflare"], gratis: true, peran: "Prioritas 5 (Teks & Gambar)", ada: () => !!(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN), panggil: panggilCloudflare },
  {
    nama: "claude",
    kode: ["claude", "anthropic"],
    gratis: false,
    peran: "Cadangan Terakhir (Haiku)",
    ada: () => !claudeDimatikan() && !!process.env.ANTHROPIC_API_KEY,
    panggil: panggilClaude,
  },
];

/** Status penyedia AI Studio untuk ditampilkan di tab Sambungan (tanpa pernah membocorkan isi kunci). */
export function statusPenyediaLlm() {
  return {
    claudeDimatikan: claudeDimatikan(),
    daftar: PENYEDIA.map((p) => ({
      nama: p.nama,
      aktif: p.ada(),
      gratis: p.gratis,
      peran: p.nama === "claude" && claudeDimatikan() ? "Dimatikan (STUDIO_TANPA_CLAUDE)" : p.peran,
    })),
  };
}

/**
 * Satu jawaban JSON dari penyedia pertama yang berhasil (dan lolos `valid`).
 * Memulangkan { data, pemakaian } — simpan pemakaian supaya biaya tampil di Deck.
 */
export async function panggilLlmJson<T>(opsi: OpsiLlm, tahap?: string): Promise<{ data: T; pemakaian: PemakaianLlm }> {
  const paksa = process.env.STUDIO_AI_PROVIDER?.toLowerCase();
  const adaGambar = Boolean(opsi.gambar?.length);
  const urut = [...PENYEDIA].sort((a, b) => {
    const skorPaksa = Number(b.kode.includes(paksa ?? "")) - Number(a.kode.includes(paksa ?? ""));
    if (skorPaksa !== 0) return skorPaksa;
    // Saat pakai Google Search atau Vision gambar, utamakan Gemini sebelum penyedia gratis lain.
    if (opsi.pakaiSearch || adaGambar) return Number(b.nama === "gemini") - Number(a.nama === "gemini");
    return 0;
  });
  const galat: string[] = [];
  for (const p of urut.filter((x) => x.ada())) {
    // NVIDIA teks & Cloudflare Llama teks belum mendukung gambar vision — lewati bila ada input gambar.
    if (adaGambar && (p.nama === "cloudflare" || p.nama === "nvidia")) continue;
    try {
      const r = await p.panggil(opsi);
      if (opsi.valid && !opsi.valid(r.data)) throw new Error("jawaban tidak sesuai format");
      return { data: r.data as T, pemakaian: { ...r.pemakaian, ...(tahap ? { tahap } : {}) } };
    } catch (e) {
      galat.push(`${p.nama}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 220));
      console.warn(`AI ${p.nama} gagal, coba penyedia berikutnya.`, galat.at(-1));
    }
  }
  if (!galat.length) {
    throw new Error("Belum ada kunci AI aktif (isi GROQ_API_KEY, NVIDIA_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, atau CF_ACCOUNT_ID + CF_API_TOKEN di Vercel).");
  }
  throw new Error(`Semua penyedia AI gagal — ${galat.join(" | ")}`);
}
