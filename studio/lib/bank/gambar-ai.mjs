// gambar-ai.mjs — gambar suasana dari AI (KB §111), dengan daftar penyedia berurutan.
//
// Dipakai untuk adegan video bertag "ai" (gambar lalu dihidupkan zoompan seperti foto bank) dan
// latar poster. Menu/minuman tetap foto asli bank — aturan itu dijaga di naskah (konten_murni.ts).
//
// Penyedia dicoba berurutan (bawaan cloudflare → gemini, ubah lewat STUDIO_GAMBAR_URUTAN):
//   • cloudflare — Workers AI FLUX.2 klein: 10.000 Neuron gratis/hari ≈ 60 gambar tegak.
//   • gemini     — model gambar Gemini; TIDAK punya kuota gratis (tanpa billing → 429).
// Menambah penyedia (mis. Together): satu entri di PENYEDIA berisi ada(), buat(), lalu namanya
// di urutan bawaan — pemanggil (render.mjs, poster.mjs) tidak perlu diubah.
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

export const TAG_AI = 'ai'

/** Ukuran per rasio (kelipatan 16). FLUX ditagih per petak 512×512: 720×1280 = 6 petak. */
export const UKURAN_RASIO = { '9:16': [720, 1280], '4:5': [1024, 1280], '1:1': [1024, 1024] }

export function promptGambar(deskripsi) {
  const teks = String(deskripsi).trim()
  const adalahStudio = /studio|editorial|minimalis|minimalist|krem|cream|#f3ebdf|splash|floating|melayang|latte art|espresso pour/i.test(teks)
  const gaya = adalahStudio
    ? 'High-end commercial editorial studio product photography, soft warm cream aesthetic, ultra clean studio lighting, shallow depth of field, magazine quality.'
    : 'Photorealistic photo, natural light, warm cinematic color grade, East Java (Sidoarjo) setting and Indonesian people.'
  return `${teks}\n\n${gaya} `
    + 'Absolutely no text, letters, logos, watermarks, signage, or readable screens. No coffee cup brand. Clean uncluttered composition.'
}

/** Galat kuota/billing — gambar berikutnya pasti gagal juga, berhenti mencoba. */
export const galatKuota = (e) => !!e?.kuota || /\(429\)/.test(String(e?.message ?? e))

function galat(pesan, kuota = false) {
  const e = new Error(pesan)
  e.kuota = kuota
  return e
}

const simpanBase64 = async (b64, keluarTanpaEkstensi, jenis = 'image/jpeg') => {
  const keluar = `${keluarTanpaEkstensi}.${/png/i.test(jenis) ? 'png' : 'jpg'}`
  await writeFile(keluar, Buffer.from(b64, 'base64'))
  return keluar
}

// ------------------------------------------------------------- Cloudflare Workers AI
const CF_BAWAAN = '@cf/black-forest-labs/flux-2-klein-4b'
const CF_PERSEGI = '@cf/black-forest-labs/flux-1-schnell'
// Harga resmi (Nov 2026, $0,011 / 1.000 Neuron): klein-4b 26,05 Neuron per petak keluaran,
// schnell 4,8/petak + 9,6/langkah (4 langkah). Di bawah jatah harian tetap gratis.
const petak = ([w, h]) => Math.ceil(w / 512) * Math.ceil(h / 512)
const hargaCf = (model, ukuran) => (model === CF_PERSEGI ? (4 * 4.8 + 4 * 9.6) : petak(ukuran) * 26.05) * 0.011 / 1000

async function cfJalankan(model, isi, ambil) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${model}`
  const r = await ambil(url, { method: 'POST', headers: { authorization: `Bearer ${process.env.CF_API_TOKEN}`, ...isi.headers }, body: isi.body })
  const teks = await r.text()
  let j = null
  try { j = JSON.parse(teks) } catch { /* bukan JSON */ }
  if (!r.ok || j?.success === false) {
    const pesan = (j?.errors ?? []).map((x) => x.message).join('; ') || teks.slice(0, 160)
    // Jatah harian habis: 429 atau pesan "exceeded … neurons/allocation".
    throw galat(`Cloudflare ${model.split('/').pop()} gagal (${r.status}): ${pesan}`, r.status === 429 || /exceed|allocation|quota|neuron/i.test(pesan))
  }
  const b64 = j?.result?.image
  if (!b64) throw galat(`Cloudflare ${model} tidak mengembalikan gambar`)
  return b64
}

const cloudflare = {
  nama: 'cloudflare',
  ada: () => !!(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN),
  async buat(deskripsi, rasio, keluar, ambil) {
    const model = process.env.STUDIO_CF_GAMBAR || CF_BAWAAN
    const ukuran = UKURAN_RASIO[rasio] ?? UKURAN_RASIO['1:1']
    try {
      // FLUX.2 lewat REST memakai multipart form (prompt, width, height).
      const form = new FormData()
      form.append('prompt', promptGambar(deskripsi))
      form.append('width', String(ukuran[0]))
      form.append('height', String(ukuran[1]))
      const b64 = await cfJalankan(model, { body: form, headers: {} }, ambil)
      return { berkas: await simpanBase64(b64, keluar), biayaUsd: hargaCf(model, ukuran), model }
    } catch (e) {
      if (galatKuota(e) || model === CF_PERSEGI) throw e
      // Cadangan di Cloudflare sendiri: schnell (JSON, selalu persegi — dipotong saat dirakit).
      const b64 = await cfJalankan(CF_PERSEGI, { body: JSON.stringify({ prompt: promptGambar(deskripsi), steps: 4 }), headers: { 'content-type': 'application/json' } }, ambil)
      return { berkas: await simpanBase64(b64, keluar), biayaUsd: hargaCf(CF_PERSEGI), model: CF_PERSEGI, catatan: `FLUX.2 gagal (${e.message.slice(0, 80)}), pakai schnell persegi` }
    }
  },
}

// ------------------------------------------------------------- Gemini
const API_GEMINI = 'https://generativelanguage.googleapis.com/v1beta'
const HARGA_GEMINI_USD = 0.039

/** Nama model gambar Google sering berganti: cari sendiri bila STUDIO_GEMINI_GAMBAR kosong (flash & non-preview didahulukan). */
export function urutkanModel(models) {
  const calon = (models ?? [])
    .filter((m) => /image/i.test(m.name) && !/tts|embed|veo|video/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
  return calon.sort((a, b) => Number(/preview|exp/.test(a)) - Number(/preview|exp/.test(b)) || Number(!/flash/.test(a)) - Number(!/flash/.test(b)))
}

let modelGemini = null
async function pilihModelGemini(ambil) {
  if (process.env.STUDIO_GEMINI_GAMBAR) return process.env.STUDIO_GEMINI_GAMBAR
  if (modelGemini) return modelGemini
  const r = await ambil(`${API_GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } })
  if (!r.ok) throw galat(`Daftar model Gemini gagal (${r.status})`)
  const [m] = urutkanModel((await r.json()).models)
  if (!m) throw galat('Tidak ada model gambar Gemini untuk kunci ini')
  modelGemini = m
  return m
}

const gemini = {
  nama: 'gemini',
  ada: () => !!process.env.GEMINI_API_KEY,
  async buat(deskripsi, rasio, keluar, ambil) {
    const model = await pilihModelGemini(ambil)
    const r = await ambil(`${API_GEMINI}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptGambar(deskripsi) }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: rasio } },
      }),
    })
    if (!r.ok) throw galat(`Gemini gagal (${r.status}): ${(await r.text()).slice(0, 160)}`, r.status === 429)
    const data = ((await r.json()).candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data)?.inlineData
    if (!data) throw galat('Gemini tidak mengembalikan gambar')
    return { berkas: await simpanBase64(data.data, keluar, data.mimeType), biayaUsd: HARGA_GEMINI_USD, model }
  },
}

// ------------------------------------------------------------- daftar & urutan
export const PENYEDIA = { cloudflare, gemini }

/** Penyedia aktif sesuai urutan (yang tak dikenal / tanpa kunci dilewati). */
export function urutanPenyedia(teks = process.env.STUDIO_GAMBAR_URUTAN || 'cloudflare,gemini', daftar = PENYEDIA) {
  return [...new Set(teks.split(',').map((x) => x.trim().toLowerCase()))].map((n) => daftar[n]).filter((p) => p?.ada())
}

export const adaGambarAi = () => urutanPenyedia().length > 0

// Penyedia yang kuotanya habis dilewati sampai putaran Studio berakhir (proses baru).
const habis = new Set()

/**
 * Satu gambar dari penyedia pertama yang berhasil → { berkas, biayaUsd, penyedia, catatan? }.
 * Semua kehabisan kuota → galat ber-kuota (pemanggil berhenti mencoba gambar berikutnya).
 */
export async function buatGambarAi(deskripsi, rasio, keluarTanpaEkstensi, { ambil = fetch, penyedia = urutanPenyedia() } = {}) {
  const gagal = []
  for (const p of penyedia) {
    if (habis.has(p.nama)) continue
    try {
      return { ...(await p.buat(deskripsi, rasio, keluarTanpaEkstensi, ambil)), penyedia: p.nama }
    } catch (e) {
      if (galatKuota(e)) habis.add(p.nama)
      gagal.push(e)
    }
  }
  if (!penyedia.length) throw galat('Belum ada penyedia gambar AI (CF_ACCOUNT_ID + CF_API_TOKEN, atau GEMINI_API_KEY)')
  const semuaHabis = penyedia.every((p) => habis.has(p.nama))
  throw galat(gagal.map((e) => e.message).join(' · ') || 'Semua penyedia gambar AI sedang kehabisan kuota', semuaHabis)
}

/** Untuk uji: lupakan penyedia yang ditandai habis. */
export const lupakanKuota = () => habis.clear()

/** Hasil pembuat gambar boleh path (uji lama) atau { berkas, biayaUsd }. */
export const rapikanHasil = (h) => (typeof h === 'string' ? { berkas: h, biayaUsd: 0 } : h)

/** Biaya gambar dalam bentuk pemakaian otak.mjs, supaya ikut terjumlah di layar Kantor AI. */
export function pemakaianGambar(jumlah, biayaUsd = 0) {
  return jumlah > 0 ? { model: 'gambar-ai', input: 0, output: 0, cacheTulis: 0, cacheBaca: 0, biayaUsd: Math.round(biayaUsd * 1e6) / 1e6 } : null
}

/** Tag bank pengganti bila gambar AI tak bisa dibuat: suasana dulu, lalu tag pertama. */
export function tagCadangan(bank) {
  const tag = [...new Set(bank.filter((m) => m.jenis === 'foto' || m.jenis === 'video').map((m) => m.tag))].sort()
  return tag.find((t) => t.split('/')[0] === 'suasana') ?? tag[0] ?? null
}

/**
 * Adegan bertag "ai" → gambar 9:16 sebagai media bank tiruan bertag unik `ai/<nomor>`
 * (render.mjs menghidupkannya dengan zoompan). Gagal / tanpa penyedia → adegan memakai tag cadangan.
 * @param buat (deskripsi, rasio, keluarTanpaEkstensi) → path | { berkas, biayaUsd }; null = tanpa penyedia
 * @returns { adegan, media, catatan, jumlah, biayaUsd }
 */
export async function siapkanAdeganAi(adegan, bank, folder, buat) {
  const catatan = []
  const media = []
  let biayaUsd = 0
  let berhenti = !buat
  if (!buat && adegan.some((a) => a.tag === TAG_AI)) catatan.push('gambar AI dilewati: belum ada penyedia (Cloudflare/Gemini)')
  const hasil = []
  for (const [i, a] of adegan.entries()) {
    if (a.tag !== TAG_AI) { hasil.push(a); continue }
    if (!berhenti) {
      try {
        const h = rapikanHasil(await buat(a.bidikan, '9:16', path.join(folder, `ai-${i + 1}`)))
        biayaUsd += Number(h.biayaUsd) || 0
        if (h.catatan) catatan.push(h.catatan)
        const tag = `${TAG_AI}/${i + 1}`
        media.push({ path: h.berkas, tag, jenis: 'foto', durasi: 0, ai: true, kurasi: { deskripsi: a.bidikan, kualitas: 8, layak: true } })
        hasil.push({ ...a, tag })
        continue
      } catch (e) {
        if (galatKuota(e)) {
          catatan.push(`gambar AI berhenti: kuota penyedia habis (${String(e.message).slice(0, 120)})`)
          berhenti = true
        } else catatan.push(`gambar AI adegan ${i + 1} gagal: ${String(e.message).slice(0, 120)}`)
      }
    }
    const ganti = tagCadangan(bank)
    if (!ganti) throw new Error('Bank media kosong dan gambar AI tidak bisa dibuat')
    hasil.push({ ...a, tag: ganti })
  }
  return { adegan: hasil, media, catatan, jumlah: media.length, biayaUsd }
}
