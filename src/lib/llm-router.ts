import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Router teks AI hemat biaya untuk fitur Studio di Vercel (usulan arahan, riset Reels, naskah bank).
// Urutan bawaan: Gemini (free tier/murah) → Cloudflare Workers AI (kuota gratis harian) → Claude (cadangan).
// STUDIO_AI_PROVIDER=gemini|cf|claude memaksa satu penyedia didahulukan (sisanya tetap jadi cadangan).

export type Penyedia = "gemini" | "cloudflare" | "claude";

/** Bentuk pemakaian yang disimpan di naskah.pemakaian (sama dengan studio/lib/bank/otak.mjs + penyedia/tahap). */
export type PemakaianLlm = {
  tahap?: string;
  penyedia: Penyedia;
  model: string;
  input: number;
  output: number;
  biayaUsd: number;
};

export type OpsiLlm = {
  system: string;
  prompt: string;
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
  gemini: { input: 0.3, output: 2.5 },
  cloudflare: { input: 0.29, output: 2.25 },
  "claude-haiku": { input: 0.1, output: 0.5 },
  "claude-sonnet": { input: 2, output: 10 },
};

const biaya = (input: number, output: number, h: { input: number; output: number }) =>
  Math.round(((input * h.input + output * h.output) / 1e6) * 1e6) / 1e6;

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

async function panggilGemini(opsi: OpsiLlm) {
  const kunci = process.env.GEMINI_API_KEY!;
  const kandidatModel = [...new Set([process.env.STUDIO_GEMINI_TEKS, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean) as string[])];

  const kirim = async (model: string, pakaiSkema: boolean, search: boolean) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(25_000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": kunci },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: opsi.system + (pakaiSkema && !search ? "" : teksSkema(opsi.skema)) }] },
        contents: [{ role: "user", parts: [{ text: opsi.prompt }] }],
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
      // Bila bukan 404 (mis. kuota habis / kunci salah), tak perlu coba nama model lain.
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
  const model = process.env.STUDIO_CLAUDE_TEKS || "claude-sonnet-5-5";
  const skemaClaude = opsi.skema ? (rapikanSkemaClaude(opsi.skema) as Record<string, unknown>) : undefined;
  const res = await new Anthropic().messages.create({
    model,
    max_tokens: opsi.maksToken ?? 8000,
    output_config: skemaClaude ? { effort: "low", format: { type: "json_schema", schema: skemaClaude } } : undefined,
    system: opsi.system,
    messages: [{ role: "user", content: opsi.prompt }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude menolak permintaan ini.");
  const teks = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
  const input = res.usage?.input_tokens ?? 0;
  const output = res.usage?.output_tokens ?? 0;
  const h = model.includes("haiku") ? HARGA["claude-haiku"] : HARGA["claude-sonnet"];
  return { data: JSON.parse(ekstrakJson(teks)), pemakaian: { penyedia: "claude" as const, model, input, output, biayaUsd: biaya(input, output, h) } };
}

type HasilPanggil = { data: unknown; pemakaian: Omit<PemakaianLlm, "tahap"> };

const PENYEDIA: { nama: Penyedia; kode: string[]; ada: () => boolean; panggil: (o: OpsiLlm) => Promise<HasilPanggil> }[] = [
  { nama: "gemini", kode: ["gemini"], ada: () => !!process.env.GEMINI_API_KEY, panggil: panggilGemini },
  { nama: "cloudflare", kode: ["cf", "cloudflare"], ada: () => !!(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN), panggil: panggilCloudflare },
  { nama: "claude", kode: ["claude", "anthropic"], ada: () => !!process.env.ANTHROPIC_API_KEY, panggil: panggilClaude },
];

/**
 * Satu jawaban JSON dari penyedia pertama yang berhasil (dan lolos `valid`).
 * Memulangkan { data, pemakaian } — simpan pemakaian supaya biaya tampil di Deck.
 */
export async function panggilLlmJson<T>(opsi: OpsiLlm, tahap?: string): Promise<{ data: T; pemakaian: PemakaianLlm }> {
  const paksa = process.env.STUDIO_AI_PROVIDER?.toLowerCase();
  const urut = [...PENYEDIA].sort((a, b) => Number(b.kode.includes(paksa ?? "")) - Number(a.kode.includes(paksa ?? "")));
  const galat: string[] = [];
  for (const p of urut.filter((x) => x.ada())) {
    try {
      const r = await p.panggil(opsi);
      if (opsi.valid && !opsi.valid(r.data)) throw new Error("jawaban tidak sesuai format");
      return { data: r.data as T, pemakaian: { ...r.pemakaian, ...(tahap ? { tahap } : {}) } };
    } catch (e) {
      galat.push(`${p.nama}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 220));
      console.warn(`AI ${p.nama} gagal, coba penyedia berikutnya.`, galat.at(-1));
    }
  }
  if (!galat.length) throw new Error("Belum ada kunci AI (isi GEMINI_API_KEY, CF_ACCOUNT_ID + CF_API_TOKEN, atau ANTHROPIC_API_KEY di Vercel).");
  throw new Error(`Semua penyedia AI gagal — ${galat.join(" | ")}`);
}
