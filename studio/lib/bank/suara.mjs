// suara.mjs — suara Indonesia tiap adegan (KB §77, §91, §93).
//
// Tiga jalur, dipilih otomatis (STUDIO_JALUR_SUARA=gemini|azure|edge memaksa salah satunya):
//   • gemini — Gemini TTS lewat kunci GEMINI_API_KEY (AI Studio, free tier tanpa kartu). Paling
//     alami; gaya bicaranya diatur kalimat (STUDIO_GEMINI_GAYA). Free tier hanya 10 permintaan
//     per hari per model, jadi seluruh narasi satu video diminta SEKALI lalu dipotong per adegan,
//     dan model Flash-Lite TTS (kuota sendiri) dicoba bila model utama habis kuotanya.
//   • azure  — Azure AI Speech, kalau AZURE_SPEECH_KEY & REGION diisi. Pendaftaran Kyai gagal
//     di verifikasi kartu (14 Nov 2026).
//   • edge   — edge-tts (paket msedge-tts, TIDAK resmi, tanpa akun). Suaranya SAMA dengan Azure
//     (id-ID-GadisNeural), dan jadi cadangan bila jalur lain gagal.
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { tidur, ulangi } from './alat.mjs'
import { ssml } from './rakit.mjs'

const SUARA = () => process.env.STUDIO_SUARA || 'id-ID-GadisNeural'
const LAJU = () => process.env.STUDIO_LAJU || '+5%'
const GEMINI_MODEL = () => process.env.STUDIO_GEMINI_MODEL || 'gemini-3.8-flash-tts'
const GEMINI_MODEL_CADANGAN = 'gemini-3.8-flash-lite-tts'
const GEMINI_SUARA = () => process.env.STUDIO_GEMINI_SUARA || 'Sulafat'
const GEMINI_GAYA = () => process.env.STUDIO_GEMINI_GAYA
  || 'natural everyday Indonesian with a standard, neutral Indonesian accent; casual, warm and friendly, like chatting with a friend; relaxed natural rhythm and intonation, not like reading a script'

/** Katalog profil suara & gaya bicara agar video tidak monoton (dipilih otomatis bergilir atau manual). */
export const PROFIL_SUARA = {
  santai_indo: {
    geminiSuara: 'Sulafat',
    geminiGaya: 'natural everyday Indonesian, warm, friendly, conversational like talking to a close friend, relaxed pacing with natural breath pauses',
    edgeSuara: 'id-ID-GadisNeural',
    laju: '+4%',
  },
  jawa_timur: {
    geminiSuara: 'Puck',
    geminiGaya: 'casual friendly East Javanese / Sidoarjo Indonesian speaker, warm down-to-earth neighborhood vibe, natural subtle East Java intonation, expressive and authentic like chatting at a local coffee shop',
    edgeSuara: 'id-ID-ArdiNeural',
    laju: '+5%',
  },
  storytelling_hangat: {
    geminiSuara: 'Aoede',
    geminiGaya: 'warm expressive Indonesian storyteller, gentle emotional delivery, clear pauses for dramatic effect, engaging and heartfelt like a viral Instagram Reels narrator',
    edgeSuara: 'id-ID-GadisNeural',
    laju: '+0%',
  },
  iklan_energik: {
    geminiSuara: 'Fenrir',
    geminiGaya: 'upbeat energetic Indonesian content creator, crisp and confident hook delivery, lively modern rhythm for short-form Reels and TikTok ads',
    edgeSuara: 'id-ID-ArdiNeural',
    laju: '+8%',
  },
  narator_sinematik: {
    geminiSuara: 'Charon',
    geminiGaya: 'deep calm authoritative Indonesian documentary narrator, steady thoughtful cadence, rich cinematic tone',
    edgeSuara: 'id-ID-ArdiNeural',
    laju: '-2%',
  },
  jawa_krama_ngoko: {
    geminiSuara: 'Kore',
    geminiGaya: 'authentic natural Javanese speaker (Ngoko/Krama East Java dialect), relaxed conversational storytelling tone, warm and expressive',
    edgeSuara: 'jv-ID-DimasNeural',
    laju: '+0%',
  },
}

const DAFTAR_KODE_PROFIL = Object.keys(PROFIL_SUARA)

/** Pilih profil suara: bila "otomatis"/kosong, rotasi berdasarkan isi teks agar tiap video bervariasi. */
export function pilihProfilSuara(kode, benih = '') {
  const k = String(kode || process.env.STUDIO_PROFIL_SUARA || '').trim().toLowerCase()
  if (k && PROFIL_SUARA[k]) return { kode: k, ...PROFIL_SUARA[k] }
  if (k === 'otomatis' || (!process.env.STUDIO_GEMINI_SUARA && !process.env.STUDIO_GEMINI_GAYA && benih)) {
    const teksBenih = Array.isArray(benih) ? benih.join(' ') : String(benih || '')
    // Deteksi kasar kata Jawa agar otomatis pakai profil Jawa Timur
    if (/\b(rek|cak|ning|ngopi rek|ojo|ora|piye|iso|ndang|wes|wis|lho|toh|sampeyan|panjenengan)\b/i.test(teksBenih)) {
      return { kode: 'jawa_timur', ...PROFIL_SUARA.jawa_timur }
    }
    let hash = 0
    for (let i = 0; i < teksBenih.length; i++) hash = (hash * 31 + teksBenih.charCodeAt(i)) >>> 0
    const rotasi = ['santai_indo', 'jawa_timur', 'storytelling_hangat', 'iklan_energik', 'narator_sinematik']
    const terpilih = rotasi[hash % rotasi.length]
    return { kode: terpilih, ...PROFIL_SUARA[terpilih] }
  }
  return {
    kode: 'bawaan',
    geminiSuara: GEMINI_SUARA(),
    geminiGaya: GEMINI_GAYA(),
    edgeSuara: SUARA(),
    laju: LAJU(),
  }
}

// Penanda batas adegan saat narasi dibacakan sekaligus (tag jeda resmi Gemini TTS).
const JEDA_ADEGAN = ' <long pause> '

export function jalurSuara() {
  const paksa = String(process.env.STUDIO_JALUR_SUARA ?? '').trim().toLowerCase()
  if (['gemini', 'azure', 'edge'].includes(paksa)) return paksa
  if (process.env.GEMINI_API_KEY) return 'gemini'
  return process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION ? 'azure' : 'edge'
}

const aman = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function azure(teks, keluar, profil) {
  const p = profil ?? pilihProfilSuara(null, teks)
  const r = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
      'User-Agent': 'lek-kopi-studio',
    },
    body: ssml(teks, p.edgeSuara, p.laju),
  })
  if (!r.ok) throw new Error(`Azure TTS ${r.status}: ${(await r.text()).slice(0, 200)}`)
  await writeFile(keluar, Buffer.from(await r.arrayBuffer()))
}

// edge-tts sering memutus sesaat — dicoba sampai 4 kali (ulangi) sebelum menyerah.
const edge = (teks, keluar, profil) => ulangi(() => edgeSekali(teks, keluar, profil))

async function edgeSekali(teks, keluar, profil) {
  const p = profil ?? pilihProfilSuara(null, teks)
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts')
  const tts = new MsEdgeTTS()
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lekkopi-suara-'))
  try {
    await tts.setMetadata(p.edgeSuara, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const { audioFilePath } = await tts.toFile(dir, aman(teks), { rate: p.laju })
    await copyFile(audioFilePath, keluar)
  } catch (e) {
    throw new Error(`Suara edge-tts (tidak resmi) gagal: ${e?.message ?? e}. Kalau terus gagal, isi GEMINI_API_KEY di .env Studio.`)
  } finally {
    try { tts.close() } catch { /* sudah tertutup */ }
    await rm(dir, { recursive: true, force: true })
  }
}

// ------------------------------------------------------------------ Gemini

/**
 * Badan permintaan Interactions API (aistudio.google.com/docs/speech-generation).
 * `teks` boleh array adegan: digabung dengan <long pause>. Kurung sudut di naskah dibuang
 * supaya tidak terbaca sebagai tag suara (<laugh>, <short pause>).
 */
export function permintaanGemini(teks, { model, suara, gaya }) {
  const bersih = (t) => String(t).replace(/[<>]/g, ' ').trim()
  const isi = Array.isArray(teks) ? teks.map(bersih).join(JEDA_ADEGAN) : bersih(teks)
  return {
    model,
    input: [{
      type: 'user_input',
      content: [{ type: 'text', text: isi, annotations: [{ type: 'speech_metadata', style: gaya }] }],
    }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice: suara }] },
  }
}

/** PCM 16-bit mono (audio/l16) diberi kepala WAV; yang sudah ber-RIFF dibiarkan. */
export function keWav(buf, laju = 24000) {
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF') return buf
  const h = Buffer.alloc(44)
  h.write('RIFF', 0, 'ascii'); h.writeUInt32LE(36 + buf.length, 4); h.write('WAVE', 8, 'ascii')
  h.write('fmt ', 12, 'ascii'); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(laju, 24); h.writeUInt32LE(laju * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36, 'ascii'); h.writeUInt32LE(buf.length, 40)
  return Buffer.concat([h, buf])
}

/** WAV PCM 16-bit mono → { laju, pcm } (isi potongan `data`). */
export function bacaWav(buf) {
  if (buf.subarray(0, 4).toString('ascii') !== 'RIFF') return { laju: 24000, pcm: buf }
  let laju = 24000
  for (let i = 12; i + 8 <= buf.length;) {
    const id = buf.subarray(i, i + 4).toString('ascii')
    const n = buf.readUInt32LE(i + 4)
    if (id === 'fmt ') {
      if (buf.readUInt16LE(i + 10) !== 1 || buf.readUInt16LE(i + 22) !== 16) throw new Error('Suara Gemini bukan PCM 16-bit mono')
      laju = buf.readUInt32LE(i + 12)
    }
    if (id === 'data') return { laju, pcm: buf.subarray(i + 8, Math.min(buf.length, i + 8 + n)) }
    i += 8 + n + (n % 2)
  }
  throw new Error('WAV Gemini tanpa potongan data')
}

/** Audio terakhir di jawaban: steps[model_output].content[audio].data (base64 WAV). */
export function audioGemini(jawaban) {
  const audio = (jawaban?.steps ?? []).filter((s) => s?.type === 'model_output')
    .flatMap((s) => s.content ?? []).filter((c) => c?.type === 'audio' && c.data)
  const data = audio.at(-1)?.data ?? jawaban?.output_audio?.data
  if (!data) throw new Error('jawaban Gemini tanpa audio')
  return keWav(Buffer.from(data, 'base64'))
}

/** Satu permintaan TTS → { wav, model }. 5xx dicoba ulang sekali; 429 (kuota) pindah ke model cadangan. */
async function mintaGemini(teks, profil) {
  const p = profil ?? pilihProfilSuara(null, teks)
  let galat
  for (const model of [GEMINI_MODEL(), GEMINI_MODEL_CADANGAN]) {
    const body = JSON.stringify(permintaanGemini(teks, { model, suara: p.geminiSuara, gaya: p.geminiGaya }))
    for (const jeda of [0, 4000]) {
      if (jeda) await tidur(jeda)
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(120_000),
      })
      if (r.ok) return { wav: audioGemini(await r.json()), model }
      galat = new Error(`Gemini TTS ${r.status} (${model}): ${(await r.text()).slice(0, 200)}`)
      if (r.status < 500) break // 4xx tidak tertolong dengan mengulang model yang sama
    }
    if (!/Gemini TTS 429/.test(galat.message)) throw galat // hanya kuota habis yang pindah model
  }
  throw galat
}

async function gemini(teks, keluar, profil) {
  await writeFile(keluar, (await mintaGemini(teks, profil)).wav)
}

/**
 * Batas adegan pada narasi yang dibacakan sekaligus. Bagian sunyi ≥ 0,2 detik di tengah ucapan
 * jadi calon; untuk tiap batas dipilih jeda yang PANJANG dan DEKAT perkiraan dari panjang teks
 * (jeda koma/titik di dalam satu adegan lebih pendek dari <long pause>). Memulangkan rentang
 * sampel per adegan, atau null bila jedanya tidak meyakinkan.
 */
export function potongNarasi(pcm, laju, teks) {
  // Disalin ke buffer baru: Int16Array butuh offset genap dan panjang kelipatan 2.
  const sampel = new Int16Array(Uint8Array.from(pcm.subarray(0, pcm.length - (pcm.length % 2))).buffer)
  const lebarJendela = Math.round(laju / 100) // 10 ms
  const rms = []
  for (let i = 0; i + lebarJendela <= sampel.length; i += lebarJendela) {
    let s = 0
    for (let j = i; j < i + lebarJendela; j++) s += sampel[j] * sampel[j]
    rms.push(Math.sqrt(s / lebarJendela))
  }
  const puncak = Math.max(0, ...rms)
  if (!puncak) return null
  const sunyi = rms.map((x) => x < Math.max(puncak * 0.03, 60))
  const awalUcap = sunyi.indexOf(false)
  const akhirUcap = sunyi.lastIndexOf(false)
  const detik = (w) => w / 100
  const jeda = []
  for (let w = awalUcap; w <= akhirUcap; w++) {
    if (!sunyi[w]) continue
    const a = w
    while (w <= akhirUcap && sunyi[w]) w++
    if (w - a >= 20) jeda.push({ awal: detik(a), akhir: detik(w), panjang: detik(w - a) })
  }
  const n = teks.length
  const mulai = detik(awalUcap)
  const selesai = detik(akhirUcap + 1)
  const panjangTeks = teks.map((t) => Math.max(1, String(t).length))
  const totalTeks = panjangTeks.reduce((s, x) => s + x, 0)
  const batas = []
  let kumulatif = 0
  let lewat = mulai
  for (let i = 0; i < n - 1; i++) {
    kumulatif += panjangTeks[i]
    const perkiraan = mulai + (selesai - mulai) * (kumulatif / totalTeks)
    const calon = jeda.filter((j) => j.awal > lewat + 0.3 && !batas.includes(j))
      .map((j) => ({ j, skor: j.panjang - 0.5 * Math.abs((j.awal + j.akhir) / 2 - perkiraan) }))
      .sort((x, y) => y.skor - x.skor)
    if (!calon.length || calon[0].j.panjang < 0.3) return null
    batas.push(calon[0].j)
    lewat = calon[0].j.akhir
  }
  // Tiap adegan menyisakan sedikit sunyi di tepinya, seperti suara per adegan dulu.
  const potong = []
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? mulai - 0.05 : batas[i - 1].akhir - 0.08
    const b = i === n - 1 ? selesai + 0.15 : batas[i].awal + 0.12
    potong.push({ mulai: Math.max(0, Math.round(a * laju)), akhir: Math.min(sampel.length, Math.round(b * laju)) })
  }
  return potong.every((p) => p.akhir - p.mulai > 0.3 * laju) ? potong : null
}

/** Seluruh narasi satu video dalam SATU permintaan Gemini, dipotong per adegan. Memulangkan model. */
async function narasiSekaligus(teks, berkas, minta) {
  const jawab = await minta(teks)
  const { laju, pcm } = bacaWav(jawab.wav)
  const potong = potongNarasi(pcm, laju, teks)
  if (!potong) throw Object.assign(new Error('jeda antar-adegan tidak terbaca'), { jeda: true })
  for (const [i, p] of potong.entries()) await writeFile(berkas[i], keWav(pcm.subarray(p.mulai * 2, p.akhir * 2), laju))
  return jawab.model
}

// --------------------------------------------------------------- pemakai

const PEMBUAT = { gemini, azure, edge }
const EKSTENSI = { gemini: 'wav', azure: 'mp3', edge: 'mp3' }

export async function buatSuara(teks, keluar, jalur = jalurSuara(), profil = null) {
  return PEMBUAT[jalur](teks, keluar, profil)
}

/**
 * Suara semua adegan satu video dengan SATU jalur & SATU profil suara (suara yang berganti di
 * tengah video terdengar janggal). Profil suara otomatis bervariasi per video bila tidak ditentukan.
 */
export async function suaraAdegan(teks, folder, opsi = {}) {
  const profil = pilihProfilSuara(opsi.profilSuara, teks)
  const buat = opsi.buat ?? ((t, k, j) => buatSuara(t, k, j, profil))
  const jalur = opsi.jalur ?? jalurSuara()
  const nama = (j) => teks.map((_, i) => path.join(folder, `suara_${i}.${EKSTENSI[j] ?? 'mp3'}`))
  const perAdegan = async (j) => {
    const berkas = nama(j)
    for (const [i, t] of teks.entries()) await buat(t, berkas[i], j)
    return berkas
  }
  try {
    if (jalur === 'gemini' && (opsi.minta || !opsi.buat)) {
      const berkas = nama('gemini')
      try {
        const minta = opsi.minta ?? ((arr) => mintaGemini(arr, profil))
        const model = await narasiSekaligus(teks, berkas, minta)
        const cadangan = model && model !== GEMINI_MODEL()
        return { berkas, jalur, profil: profil.kode, catatan: cadangan ? `suara Gemini model cadangan ${model} (kuota model utama habis)` : null }
      } catch (e) {
        if (!e.jeda) throw e // kuota/jaringan: per adegan pun akan gagal
      }
    }
    return { berkas: await perAdegan(jalur), jalur, profil: profil.kode, catatan: null }
  } catch (e) {
    if (jalur === 'edge') throw e
    return {
      berkas: await perAdegan('edge'),
      jalur: 'edge',
      profil: profil.kode,
      catatan: `suara cadangan edge-tts (${jalur} gagal: ${String(e?.message ?? e).slice(0, 120)})`,
    }
  }
}
