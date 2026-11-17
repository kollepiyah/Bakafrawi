import { writeFile } from 'node:fs/promises';

// Gambar suasana (latar poster & pembuka video) dari model gambar Gemini — kunci GEMINI_API_KEY,
// boleh sama dengan Lek Kopi. Nama model gambar Google sering berganti, jadi bila STUDIO_GEMINI_GAMBAR
// kosong, model dicari sendiri dari daftar model yang bisa dipakai kunci ini.
const API = 'https://generativelanguage.googleapis.com/v1beta';
const kunci = () => process.env.GEMINI_API_KEY ?? '';
let modelTerpilih = null;

export const adaGambarAi = () => Boolean(kunci());

async function pilihModel() {
  if (process.env.STUDIO_GEMINI_GAMBAR) return process.env.STUDIO_GEMINI_GAMBAR;
  if (modelTerpilih) return modelTerpilih;
  const res = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': kunci() } });
  if (!res.ok) throw new Error(`Daftar model Gemini gagal (${res.status})`);
  const calon = ((await res.json()).models ?? [])
    .filter((m) => /image/i.test(m.name) && !/tts|embed/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  // Utamakan "flash" (murah & cepat) dan versi non-preview.
  calon.sort((a, b) => Number(/preview|exp/.test(a)) - Number(/preview|exp/.test(b)) || Number(!/flash/.test(a)) - Number(!/flash/.test(b)));
  if (!calon.length) throw new Error('Tidak ada model gambar Gemini yang bisa dipakai kunci ini.');
  modelTerpilih = calon[0];
  console.log(`Model gambar AI: ${modelTerpilih}`);
  return modelTerpilih;
}

/** Buat satu gambar dari deskripsi adegan; `rasio` "9:16" | "1:1" | "4:5". */
export async function buatGambarAi(adegan, rasio, keluar) {
  const model = await pilihModel();
  const prompt =
    `${adegan}\n\nPhotorealistic, natural light, warm cinematic color grade, Indonesian setting and people. ` +
    'Absolutely no text, letters, logos, watermarks, or readable screens in the image. Leave calm space for overlaid text.';
  const res = await fetch(`${API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': kunci(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: rasio } },
    }),
  });
  if (!res.ok) throw new Error(`Gambar AI gagal (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const bagian = (await res.json()).candidates?.[0]?.content?.parts ?? [];
  const data = bagian.find((p) => p.inlineData?.data)?.inlineData;
  if (!data) throw new Error('Model tidak mengembalikan gambar.');
  await writeFile(keluar, Buffer.from(data.data, 'base64'));
  return keluar;
}
