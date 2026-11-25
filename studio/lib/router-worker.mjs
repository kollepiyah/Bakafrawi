// Router AI hemat terpusat untuk semua skrip di folder `studio/` (mandiri tanpa impor dari `src/`).
// Urutan teks:   Groq (gratis) → NVIDIA NIM → Gemini → OpenRouter (:free) → Cloudflare → Claude Haiku (cadangan terakhir)
// Urutan vision: Gemini → Groq Vision (Llama 4 Scout) → OpenRouter → Claude Haiku (cadangan terakhir)
// Set STUDIO_TANPA_CLAUDE=1 untuk mematikan pemakaian Claude sepenuhnya di Studio.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

export const MODEL_CLAUDE_BAWAAN = process.env.STUDIO_MODEL || 'claude-haiku-5-5';

const HARGA_WORKER = {
  groq: { input: 0, output: 0 },
  nvidia: { input: 0, output: 0 },
  openrouter: { input: 0, output: 0 },
  gemini: { input: 0.3, output: 2.5 },
  cloudflare: { input: 0.29, output: 2.25 },
  'claude-haiku': { input: 0.1, output: 0.5 },
  'claude-sonnet': { input: 2, output: 10 },
};

export function claudeWorkerDimatikan(env = process.env) {
  return /^(1|true|ya|on)$/i.test(String(env?.STUDIO_TANPA_CLAUDE ?? '').trim());
}

export function catatBiayaWorker(tahap, u = {}, penyedia = 'claude', model = MODEL_CLAUDE_BAWAAN) {
  const h = penyedia === 'claude'
    ? (String(model).includes('sonnet') ? HARGA_WORKER['claude-sonnet'] : HARGA_WORKER['claude-haiku'])
    : (HARGA_WORKER[penyedia] ?? { input: 0, output: 0 });
  const input = (u.input_tokens ?? u.input ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const output = u.output_tokens ?? u.output ?? 0;
  return {
    tahap,
    penyedia,
    model,
    input,
    output,
    biayaUsd: Math.round(((input * h.input + output * h.output) / 1e6) * 1e6) / 1e6,
  };
}

export function ekstrakJson(teks) {
  const t = String(teks ?? '').trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const bersih = m ? m[1].trim() : t;
  const awal = bersih.search(/[[{]/);
  if (awal < 0) return bersih;
  const buka = bersih[awal];
  const tutup = buka === '{' ? '}' : ']';
  const akhir = bersih.lastIndexOf(tutup);
  return akhir > awal ? bersih.slice(awal, akhir + 1) : bersih.slice(awal);
}

/** Hitung urutan penyedia AI yang aktif untuk teks maupun vision. Murni. */
export function urutanPenyediaWorker({
  adaGambar = false,
  paksa = process.env.STUDIO_AI_PROVIDER,
  tanpaClaude = null,
  env = process.env,
} = {}) {
  const matikanClaude = typeof tanpaClaude === 'boolean' ? tanpaClaude : claudeWorkerDimatikan(env);
  const paksaBersih = String(paksa ?? '').trim().toLowerCase();

  const daftarTeks = [
    { nama: 'groq', kode: ['groq'], ada: () => !!env?.GROQ_API_KEY },
    { nama: 'nvidia', kode: ['nvidia', 'nim'], ada: () => !adaGambar && !!env?.NVIDIA_API_KEY },
    { nama: 'gemini', kode: ['gemini'], ada: () => !!env?.GEMINI_API_KEY },
    { nama: 'openrouter', kode: ['openrouter', 'or'], ada: () => !!env?.OPENROUTER_API_KEY },
    { nama: 'cloudflare', kode: ['cf', 'cloudflare'], ada: () => !adaGambar && !!(env?.CF_ACCOUNT_ID && env?.CF_API_TOKEN) },
    { nama: 'claude', kode: ['claude', 'anthropic'], ada: () => !matikanClaude && !!env?.ANTHROPIC_API_KEY },
  ];

  const urutanDasar = adaGambar
    ? ['gemini', 'groq', 'openrouter', 'claude'].map((n) => daftarTeks.find((x) => x.nama === n))
    : daftarTeks;

  return urutanDasar
    .filter((p) => p && p.ada())
    .sort((a, b) => Number(b.kode.includes(paksaBersih)) - Number(a.kode.includes(paksaBersih)));
}

export const KANDIDAT_MODEL_WORKER = {
  nvidia: [
    'meta/llama-3.3-70b-instruct',
    'nvidia/llama-3.3-nemotron-super-49b-v1',
    'qwen/qwen2.5-72b-instruct',
    'mistralai/mistral-large-2-instruct',
  ],
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-2.0-flash',
  ],
  cloudflare: [
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/meta/llama-4-scout-17b-16e-instruct',
    '@cf/meta/llama-3.1-8b-instruct-fast',
  ],
};

const STATUS_LANJUT_WORKER = [404, 410, 429, 500, 502, 503, 504];

function bolehLanjutModelWorker(err, label, statusLanjut) {
  if (err instanceof SyntaxError) return true;
  if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/timeout|timed out|aborted/i.test(msg)) return true;
  for (const s of statusLanjut) {
    if (msg.includes(`${label} ${s}`)) return true;
  }
  return false;
}

async function panggilOpenAiWorker({ label, penyedia, url, apiKey, kandidatModel, system, prompt, gambar = [], suhu = 0.75, maksToken = 4096, headerTambahan = {}, statusLanjut = STATUS_LANJUT_WORKER }) {
  const isiUser = gambar.length
    ? [
        ...gambar.slice(0, 5).flatMap((g) => [
          ...(g.label ? [{ type: 'text', text: g.label }] : []),
          { type: 'image_url', image_url: { url: `data:${g.mimeType || 'image/jpeg'};base64,${g.data}` } },
        ]),
        { type: 'text', text: prompt },
      ]
    : prompt;

  const lanjutSet = new Set(statusLanjut);
  let galat = null;
  for (const model of kandidatModel) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(45_000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...headerTambahan },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: isiUser }],
          temperature: suhu,
          max_tokens: maksToken,
        }),
      });
      if (!res.ok) {
        throw new Error(`${label} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
      }
      const j = await res.json();
      const teks = String(j.choices?.[0]?.message?.content ?? '{}');
      return {
        data: JSON.parse(ekstrakJson(teks)),
        penyedia,
        model,
        usage: { input: Number(j.usage?.prompt_tokens) || 0, output: Number(j.usage?.completion_tokens) || 0 },
      };
    } catch (e) {
      galat = e;
      if (!bolehLanjutModelWorker(e, label, lanjutSet)) throw e;
    }
  }
  throw galat ?? new Error(`${label} gagal merespons.`);
}

async function panggilGeminiWorker({ system, prompt, gambar = [], suhu = 0.75, maksToken = 6000 }) {
  const kandidat = [...new Set([process.env.STUDIO_GEMINI_TEKS, ...KANDIDAT_MODEL_WORKER.gemini].filter(Boolean))];
  const parts = [
    ...gambar.flatMap((g) => [
      ...(g.label ? [{ text: g.label }] : []),
      { inline_data: { mime_type: g.mimeType || 'image/jpeg', data: g.data } },
    ]),
    { text: prompt },
  ];
  const lanjutSet = new Set(STATUS_LANJUT_WORKER);
  let galat = null;
  for (const model of kandidat) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(45_000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: suhu, maxOutputTokens: maksToken, responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) {
        throw new Error(`Gemini ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
      }
      const j = await res.json();
      const teks = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('') || '{}';
      const u = j.usageMetadata ?? {};
      return {
        data: JSON.parse(ekstrakJson(teks)),
        penyedia: 'gemini',
        model,
        usage: { input: Number(u.promptTokenCount) || 0, output: (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0) },
      };
    } catch (e) {
      galat = e;
      if (!bolehLanjutModelWorker(e, 'Gemini', lanjutSet)) throw e;
    }
  }
  throw galat ?? new Error('Gemini gagal merespons.');
}

async function panggilCloudflareWorker({ system, prompt, suhu = 0.75, maksToken = 4096 }) {
  const kandidat = [...new Set([process.env.STUDIO_CF_TEKS, ...KANDIDAT_MODEL_WORKER.cloudflare].filter(Boolean))];
  const lanjutSet = new Set([400, ...STATUS_LANJUT_WORKER]);
  let galat = null;
  for (const model of kandidat) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${model}`, {
        method: 'POST',
        signal: AbortSignal.timeout(35_000),
        headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          temperature: suhu,
          max_tokens: maksToken,
        }),
      });
      if (!res.ok) throw new Error(`Cloudflare ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
      const j = await res.json();
      const r = j.result?.response;
      const data = typeof r === 'string' ? JSON.parse(ekstrakJson(r)) : (r ?? {});
      return {
        data,
        penyedia: 'cloudflare',
        model,
        usage: { input: Number(j.result?.usage?.prompt_tokens) || 0, output: Number(j.result?.usage?.completion_tokens) || 0 },
      };
    } catch (e) {
      galat = e;
      if (!bolehLanjutModelWorker(e, 'Cloudflare', lanjutSet)) throw e;
    }
  }
  throw galat ?? new Error('Cloudflare gagal merespons.');
}

/**
 * Panggil penyedia AI berurutan (Groq → NVIDIA → Gemini → OpenRouter → Cloudflare → Claude Haiku terakhir)
 * dengan validasi Zod opsional. Memulangkan { data, sumber, penyedia, model, pemakaian }.
 */
export async function panggilRouterWorkerJson({
  system,
  prompt,
  gambar = [],
  maksToken = 4096,
  suhu = 0.75,
  skemaZod = null,
  petunjukJson = '',
  namaTahap = 'naskah',
  effortClaude = 'low',
}) {
  const adaGambar = Array.isArray(gambar) && gambar.length > 0;
  const penyediaAktif = urutanPenyediaWorker({ adaGambar });
  if (!penyediaAktif.length) {
    throw new Error('Belum ada penyedia AI aktif (set GROQ_API_KEY / NVIDIA_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY / CF).');
  }

  const galat = [];
  for (const p of penyediaAktif) {
    try {
      let r;
      if (p.nama === 'claude') {
        const model = process.env.STUDIO_MODEL || MODEL_CLAUDE_BAWAAN;
        const client = new Anthropic();
        const kontenUser = adaGambar
          ? [
              ...gambar.flatMap((g) => [
                ...(g.label ? [{ type: 'text', text: g.label }] : []),
                { type: 'image', source: { type: 'base64', media_type: g.mimeType || 'image/jpeg', data: g.data } },
              ]),
              { type: 'text', text: prompt },
            ]
          : prompt;

        if (skemaZod) {
          let pakaiFallback = false;
          try {
            const res = await client.messages.parse({
              model,
              max_tokens: Math.max(maksToken, 6000),
              output_config: { effort: effortClaude, format: zodOutputFormat(skemaZod) },
              system,
              messages: [{ role: 'user', content: kontenUser }],
            });
            if (res.stop_reason === 'refusal' || !res.parsed_output) {
              pakaiFallback = true;
            } else {
              r = { data: res.parsed_output, penyedia: 'claude', model, usage: res.usage };
            }
          } catch {
            pakaiFallback = true;
          }
          if (pakaiFallback) {
            const res = await client.messages.create({
              model,
              max_tokens: Math.max(maksToken, 6000),
              output_config: { effort: effortClaude },
              system: system + petunjukJson,
              messages: [{ role: 'user', content: kontenUser }],
            });
            if (res.stop_reason === 'refusal') throw new Error('Claude menolak.');
            const teks = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
            if (!teks) throw new Error(`Claude respons kosong (${res.stop_reason ?? 'unknown'}).`);
            r = { data: JSON.parse(ekstrakJson(teks)), penyedia: 'claude', model, usage: res.usage };
          }
        } else {
          const res = await client.messages.create({
            model,
            max_tokens: maksToken,
            output_config: { effort: effortClaude },
            system: system + petunjukJson,
            messages: [{ role: 'user', content: kontenUser }],
          });
          const teks = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
          if (!teks) throw new Error(`Claude respons kosong (${res.stop_reason ?? 'unknown'}).`);
          r = { data: JSON.parse(ekstrakJson(teks)), penyedia: 'claude', model, usage: res.usage };
        }
      } else if (p.nama === 'groq') {
        const kandidat = adaGambar
          ? [...new Set([process.env.STUDIO_GROQ_VISION, 'meta-llama/llama-4-scout-17b-16e-instruct'].filter(Boolean))]
          : [...new Set([process.env.STUDIO_GROQ_TEKS, 'llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'].filter(Boolean))];
        r = await panggilOpenAiWorker({
          label: 'Groq',
          penyedia: 'groq',
          url: 'https://api.groq.com/openai/v1/chat/completions',
          apiKey: process.env.GROQ_API_KEY,
          kandidatModel: kandidat,
          system: system + petunjukJson,
          prompt,
          gambar,
          suhu,
          maksToken,
          statusLanjut: STATUS_LANJUT_WORKER,
        });
      } else if (p.nama === 'nvidia') {
        const baseUrl = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
        const kandidat = [...new Set([process.env.STUDIO_NVIDIA_TEKS, ...KANDIDAT_MODEL_WORKER.nvidia].filter(Boolean))];
        r = await panggilOpenAiWorker({
          label: 'NVIDIA',
          penyedia: 'nvidia',
          url: `${baseUrl}/chat/completions`,
          apiKey: process.env.NVIDIA_API_KEY,
          kandidatModel: kandidat,
          system: system + petunjukJson,
          prompt,
          suhu,
          maksToken,
          statusLanjut: STATUS_LANJUT_WORKER,
        });
      } else if (p.nama === 'openrouter') {
        const kandidat = [...new Set([process.env.STUDIO_OPENROUTER_MODEL, 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen-2.5-72b-instruct:free', 'google/gemini-2.0-flash-exp:free'].filter(Boolean))];
        r = await panggilOpenAiWorker({
          label: 'OpenRouter',
          penyedia: 'openrouter',
          url: 'https://openrouter.ai/api/v1/chat/completions',
          apiKey: process.env.OPENROUTER_API_KEY,
          kandidatModel: kandidat,
          system: system + petunjukJson,
          prompt,
          gambar,
          suhu,
          maksToken,
          headerTambahan: { 'HTTP-Referer': 'https://bakafrawi.com', 'X-Title': 'Bakafrawi Studio' },
          statusLanjut: [404, 410, 429, 503],
        });
      } else if (p.nama === 'gemini') {
        r = await panggilGeminiWorker({ system: system + petunjukJson, prompt, gambar, suhu, maksToken: Math.max(maksToken, 6000) });
      } else {
        r = await panggilCloudflareWorker({ system: system + petunjukJson, prompt, suhu, maksToken });
      }

      if (skemaZod) {
        const cek = skemaZod.safeParse(r.data);
        if (!cek.success) throw new Error(`Format JSON tidak cocok (${cek.error?.issues?.[0]?.path?.join('.') || 'skema'})`);
        r.data = cek.data;
      }

      return {
        data: r.data,
        sumber: `${r.penyedia}:${r.model}`,
        penyedia: r.penyedia,
        model: r.model,
        pemakaian: [catatBiayaWorker(namaTahap, r.usage, r.penyedia, r.model)],
      };
    } catch (e) {
      galat.push(`${p.nama}: ${e.message}`);
      console.warn(`${namaTahap} (${p.nama}) gagal, coba penyedia berikutnya:`, e.message);
    }
  }

  throw new Error(galat.join(' | ') || 'Semua penyedia AI gagal.');
}
