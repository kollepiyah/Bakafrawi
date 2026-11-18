import { writeFile } from 'node:fs/promises';

// Gambar suasana (latar poster & kartu video) dari AI. Penyedia dicoba berurutan — bawaan
// cloudflare → gemini, ubah lewat STUDIO_GAMBAR_URUTAN — pola yang sama dengan Studio Lek Kopi:
//   • cloudflare — Workers AI FLUX.2 klein: 10.000 Neuron gratis/hari (± 60 gambar).
//   • gemini     — model gambar Gemini; tak punya kuota gratis (tanpa billing → 429).
// Menambah penyedia (mis. Together): satu entri di PENYEDIA berisi ada() & buat().

const UKURAN = { '9:16': [720, 1280], '4:5': [1024, 1280], '1:1': [1024, 1024] };

function prompt(adegan) {
  return (
    `${adegan}\n\nPhotorealistic, natural light, warm cinematic color grade, Indonesian setting and people. ` +
    'Absolutely no text, letters, logos, watermarks, or readable screens in the image. Leave calm space for overlaid text.'
  );
}

function galat(pesan, kuota = false) {
  const e = new Error(pesan);
  e.kuota = kuota;
  return e;
}

// --- Cloudflare Workers AI
const CF_BAWAAN = '@cf/black-forest-labs/flux-2-klein-4b';
const CF_PERSEGI = '@cf/black-forest-labs/flux-1-schnell';

async function cfJalankan(model, body, headers) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, ...headers },
    body,
  });
  const teks = await r.text();
  let j = null;
  try {
    j = JSON.parse(teks);
  } catch {
    /* bukan JSON */
  }
  if (!r.ok || j?.success === false) {
    const pesan = (j?.errors ?? []).map((x) => x.message).join('; ') || teks.slice(0, 160);
    throw galat(`Cloudflare ${model.split('/').pop()} gagal (${r.status}): ${pesan}`, r.status === 429 || /exceed|allocation|quota|neuron/i.test(pesan));
  }
  if (!j?.result?.image) throw galat(`Cloudflare ${model} tidak mengembalikan gambar`);
  return j.result.image;
}

const cloudflare = {
  nama: 'cloudflare',
  ada: () => Boolean(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN),
  async buat(adegan, rasio) {
    const model = process.env.STUDIO_CF_GAMBAR || CF_BAWAAN;
    const [w, h] = UKURAN[rasio] ?? UKURAN['1:1'];
    try {
      // FLUX.2 lewat REST memakai multipart form.
      const form = new FormData();
      form.append('prompt', prompt(adegan));
      form.append('width', String(w));
      form.append('height', String(h));
      return await cfJalankan(model, form, {});
    } catch (e) {
      if (e.kuota || model === CF_PERSEGI) throw e;
      // Cadangan: schnell (JSON, selalu persegi — dipotong cover oleh templat).
      console.log(`FLUX.2 gagal (${e.message.slice(0, 100)}), pakai schnell`);
      return cfJalankan(CF_PERSEGI, JSON.stringify({ prompt: prompt(adegan), steps: 4 }), { 'Content-Type': 'application/json' });
    }
  },
};

// --- Gemini
const API_GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
let modelGemini = null;

async function pilihModelGemini() {
  if (process.env.STUDIO_GEMINI_GAMBAR) return process.env.STUDIO_GEMINI_GAMBAR;
  if (modelGemini) return modelGemini;
  const res = await fetch(`${API_GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } });
  if (!res.ok) throw galat(`Daftar model Gemini gagal (${res.status})`);
  const calon = ((await res.json()).models ?? [])
    .filter((m) => /image/i.test(m.name) && !/tts|embed|veo|video/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  // Utamakan "flash" (murah & cepat) dan versi non-preview.
  calon.sort((a, b) => Number(/preview|exp/.test(a)) - Number(/preview|exp/.test(b)) || Number(!/flash/.test(a)) - Number(!/flash/.test(b)));
  if (!calon.length) throw galat('Tidak ada model gambar Gemini yang bisa dipakai kunci ini.');
  modelGemini = calon[0];
  return modelGemini;
}

const gemini = {
  nama: 'gemini',
  ada: () => Boolean(process.env.GEMINI_API_KEY),
  async buat(adegan, rasio) {
    const model = await pilihModelGemini();
    const res = await fetch(`${API_GEMINI}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(adegan) }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: rasio } },
      }),
    });
    if (!res.ok) throw galat(`Gemini gagal (${res.status}): ${(await res.text()).slice(0, 160)}`, res.status === 429);
    const data = ((await res.json()).candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data)?.inlineData;
    if (!data) throw galat('Gemini tidak mengembalikan gambar.');
    return data.data;
  },
};

const PENYEDIA = { cloudflare, gemini };

function urutan() {
  const teks = process.env.STUDIO_GAMBAR_URUTAN || 'cloudflare,gemini';
  return [...new Set(teks.split(',').map((x) => x.trim().toLowerCase()))].map((n) => PENYEDIA[n]).filter((p) => p?.ada());
}

export const adaGambarAi = () => urutan().length > 0;

// Penyedia yang kuotanya habis dilewati sampai putaran ini selesai.
const habis = new Set();

/**
 * Buat satu gambar dari deskripsi adegan; `rasio` "9:16" | "1:1" | "4:5". Semua penyedia kehabisan
 * kuota → pesan memuat "(429)" supaya studio.mjs berhenti mencoba gambar berikutnya.
 */
export async function buatGambarAi(adegan, rasio, keluar) {
  const daftar = urutan();
  const gagal = [];
  for (const p of daftar) {
    if (habis.has(p.nama)) continue;
    try {
      const b64 = await p.buat(adegan, rasio);
      await writeFile(keluar, Buffer.from(b64, 'base64'));
      console.log(`Gambar AI dari ${p.nama} (${rasio})`);
      return keluar;
    } catch (e) {
      if (e.kuota) habis.add(p.nama);
      gagal.push(e.message);
    }
  }
  const semuaHabis = daftar.length > 0 && daftar.every((p) => habis.has(p.nama));
  throw new Error(`${semuaHabis ? 'Kuota semua penyedia gambar habis (429). ' : ''}${gagal.join(' · ') || 'Belum ada penyedia gambar AI.'}`);
}
