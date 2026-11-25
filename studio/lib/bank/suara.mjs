// suara.mjs — suara Indonesia tiap adegan (KB §77, §91, §93).
//
// Empat jalur, dipilih otomatis (STUDIO_JALUR_SUARA=elevenlabs|gemini|azure|edge memaksa salah satunya):
//   • elevenlabs — ElevenLabs TTS lewat ELEVENLABS_API_KEY (suara manusia paling natural +
//     timestamps kata-per-kata resmi untuk Remotion; akun gratis 10.000 karakter/bulan).
//   • gemini     — Gemini TTS lewat kunci GEMINI_API_KEY (AI Studio, free tier tanpa kartu).
//   • azure      — Azure AI Speech, kalau AZURE_SPEECH_KEY & REGION diisi.
//   • edge       — edge-tts (paket msedge-tts, TIDAK resmi, tanpa akun). Cadangan terakhir bila jalur lain gagal.
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { tidur, ulangi } from './alat.mjs'
import { ssml } from './rakit.mjs'

const SUARA = () => process.env.STUDIO_SUARA || 'id-ID-GadisNeural'
const LAJU = () => process.env.STUDIO_LAJU || '+5%'
const ELEVENLABS_MODEL = () => process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'
const ELEVENLABS_VOICE_ID = () => String(process.env.ELEVENLABS_VOICE_ID ?? '').trim()
const GEMINI_MODEL = () => process.env.STUDIO_GEMINI_MODEL || 'gemini-3.8-flash-tts'
const GEMINI_MODEL_CADANGAN = 'gemini-3.8-flash-lite-tts'
const GEMINI_SUARA = () => process.env.STUDIO_GEMINI_SUARA || 'Sulafat'
const GEMINI_GAYA = () => process.env.STUDIO_GEMINI_GAYA
  || 'natural everyday Indonesian with a standard, neutral Indonesian accent; casual, warm and friendly, like chatting with a friend; relaxed natural rhythm and intonation, not like reading a script'

/** Katalog profil suara & gaya bicara agar video tidak monoton (dipilih otomatis bergilir atau manual). */
export const PROFIL_SUARA = {
  santai_indo: {
    elevenVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    geminiSuara: 'Sulafat',
    geminiGaya: 'natural everyday Indonesian, warm, friendly, conversational like talking to a close friend, relaxed pacing with natural breath pauses',
    edgeSuara: 'id-ID-GadisNeural',
    laju: '+4%',
  },
  jawa_timur: {
    elevenVoiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    geminiSuara: 'Puck',
    geminiGaya: 'casual friendly East Javanese / Sidoarjo Indonesian speaker, warm down-to-earth neighborhood vibe, natural subtle East Java intonation, expressive and authentic like chatting at a local coffee shop',
    edgeSuara: 'id-ID-ArdiNeural',
    laju: '+5%',
  },
  storytelling_hangat: {
    elevenVoiceId: 'XB0fDUnXU5powFXDhCwa',
    geminiSuara: 'Aoede',
    geminiGaya: 'warm expressive Indonesian storyteller, gentle emotional delivery, clear pauses for dramatic effect, engaging and heartfelt like a viral Instagram Reels narrator',
    edgeSuara: 'id-ID-GadisNeural',
    laju: '+0%',
  },
  iklan_energik: {
    elevenVoiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    geminiSuara: 'Fenrir',
    geminiGaya: 'upbeat energetic Indonesian content creator, crisp and confident hook delivery, lively modern rhythm for short-form Reels and TikTok ads',
    edgeSuara: 'id-ID-ArdiNeural',
    laju: '+8%',
  },
  narator_sinematik: {
    elevenVoiceId: 'pNInz6obpgDQGcFmaJgB',
    geminiSuara: 'Charon',
    geminiGaya: 'deep calm authoritative Indonesian documentary narrator, steady thoughtful cadence, rich cinematic tone',
    edgeSuara: 'id-ID-ArdiNeural',
    laju: '-2%',
  },
  jawa_krama_ngoko: {
    elevenVoiceId: 'JBFqnCBsd6RMkjVDRZzb',
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
    elevenVoiceId: 'EXAVITQu4vr4xnSDxMaL',
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
  if (['elevenlabs', 'gemini', 'azure', 'edge'].includes(paksa)) return paksa
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs'
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

// ------------------------------------------------------------------ ElevenLabs

const POLA_VOICE_ID = /^[A-Za-z0-9_-]{8,64}$/
const NAMA_SUARA_WANITA = /(^|[\s\-_])(ibu|bu|mbak|mba|wanita|perempuan|cewek|hijab|bunda|umi|ning|siti|indah|putri|ayu|dewi|rina|sari|nisa|aisyah)(?=[\s\-_]|$)/i
const NAMA_SUARA_PRIA = /(^|[\s\-_])(bapak|pak|mas|pria|laki|cowok|kang|cak|gus|abang|bang|bro|jowo|budi|andi|rizky|ahmad|dimas|ardi)(?=[\s\-_]|$)/i

/**
 * Kumpulkan daftar Voice ID ElevenLabs valid dari daftar favorit DB (`tambahan`) dan env
 * `ELEVENLABS_VOICE_ID` (mendukung banyak ID dipisah koma / spasi / baris baru). Case-sensitive.
 */
export function daftarVoiceElevenLabs(tambahan = [], envNilai = ELEVENLABS_VOICE_ID()) {
  const calon = []
  if (Array.isArray(tambahan)) {
    for (const item of tambahan) {
      const id = typeof item === 'string' ? item : item?.id
      if (id) calon.push(String(id).trim())
    }
  }
  const dariEnv = String(envNilai ?? '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
  calon.push(...dariEnv)

  const hasil = []
  const sudah = new Set()
  for (const id of calon) {
    if (!POLA_VOICE_ID.test(id) || sudah.has(id)) continue
    sudah.add(id)
    hasil.push(id)
  }
  return hasil
}

/**
 * Pilih 1 Voice ID ElevenLabs:
 * 1) `voiceId` pilihan manual dari Studio jika valid,
 * 2) Jika `gender` ('wanita'/'pria') diketahui & `daftarVoice` punya item ber-nama, saring dulu sesuai gender,
 * 3) Rotasi deterministik per video dari daftar favorit + `ELEVENLABS_VOICE_ID` multi-ID,
 * 4) Fallback ke suara bawaan sesuai gender / `profil.elevenVoiceId`.
 */
export function pilihVoiceElevenLabs({
  voiceId = null,
  daftarVoice = [],
  profil = null,
  benih = '',
  gender = null,
  envNilai = ELEVENLABS_VOICE_ID(),
} = {}) {
  const eksplisit = String(voiceId ?? '').trim()
  if (POLA_VOICE_ID.test(eksplisit)) return eksplisit

  const pilihHash = (kolam) => {
    if (kolam.length === 1) return kolam[0]
    const teksBenih = Array.isArray(benih) ? benih.join(' ') : String(benih || '')
    let hash = 0
    for (let i = 0; i < teksBenih.length; i++) hash = (hash * 31 + teksBenih.charCodeAt(i)) >>> 0
    return kolam[hash % kolam.length]
  }

  if ((gender === 'wanita' || gender === 'pria') && Array.isArray(daftarVoice)) {
    const cocokGender = daftarVoice
      .filter((item) => item && typeof item === 'object' && item.id && item.nama)
      .filter((item) => {
        const nama = String(item.nama)
        return gender === 'wanita'
          ? NAMA_SUARA_WANITA.test(nama)
          : NAMA_SUARA_PRIA.test(nama)
      })
    const kolamGender = daftarVoiceElevenLabs(cocokGender, '')
    if (kolamGender.length) return pilihHash(kolamGender)

    if (gender === 'pria') {
      const bukanWanita = daftarVoice
        .filter((item) => item && typeof item === 'object' && item.id && item.nama && !NAMA_SUARA_WANITA.test(String(item.nama)))
      const kolamNonWanita = daftarVoiceElevenLabs(bukanWanita, '')
      if (kolamNonWanita.length) return pilihHash(kolamNonWanita)
    }
  }

  const kolam = daftarVoiceElevenLabs(daftarVoice, envNilai)
  if (kolam.length) return pilihHash(kolam)
  if (gender === 'wanita') return 'EXAVITQu4vr4xnSDxMaL'
  if (gender === 'pria') return 'TX3LPaxmHKxFdv7VOQHJ'
  return profil?.elevenVoiceId || 'EXAVITQu4vr4xnSDxMaL'
}

/** Baca tag `[Suara: ...]` dari arahan Studio → profil bawaan ATAU Voice ID ElevenLabs (case-sensitive). */
export function uraiPilihanSuara(arahan) {
  const cocok = String(arahan ?? '').match(/\[Suara:\s*([A-Za-z0-9_-]+)\]/i)
  if (!cocok) return { profilSuara: null, voiceId: null }
  const nilaiAsli = cocok[1].trim()
  const kode = nilaiAsli.toLowerCase()
  if (PROFIL_SUARA[kode]) return { profilSuara: kode, voiceId: null }
  if (POLA_VOICE_ID.test(nilaiAsli)) return { profilSuara: null, voiceId: nilaiAsli }
  return { profilSuara: null, voiceId: null }
}

/**
 * Ubah `alignment` karakter-per-karakter dari ElevenLabs `/with-timestamps` menjadi
 * daftar kata `[{ teks, mulai, selesai }]` (dalam detik) untuk subtitle Remotion. Murni.
 */
export function kataDariAlignmentElevenLabs(alignment) {
  const chars = alignment?.characters
  const starts = alignment?.character_start_times_seconds
  const ends = alignment?.character_end_times_seconds
  if (!Array.isArray(chars) || !Array.isArray(starts) || !Array.isArray(ends) || !chars.length) return []

  const hasil = []
  let teksKata = ''
  let mulaiKata = null
  let selesaiKata = null

  const dorong = () => {
    if (teksKata && mulaiKata !== null && selesaiKata !== null) {
      hasil.push({ teks: teksKata, mulai: mulaiKata, selesai: Math.max(mulaiKata, selesaiKata) })
    }
    teksKata = ''
    mulaiKata = null
    selesaiKata = null
  }

  for (let i = 0; i < chars.length; i++) {
    const ch = String(chars[i] ?? '')
    const s = Number(starts[i])
    const e = Number(ends[i])
    if (!ch || /^\s+$/.test(ch)) {
      dorong()
      continue
    }
    if (!teksKata) mulaiKata = Number.isFinite(s) ? s : 0
    teksKata += ch
    selesaiKata = Number.isFinite(e) ? e : (Number.isFinite(s) ? s : (selesaiKata ?? 0))
  }
  dorong()
  return hasil
}

async function mintaElevenLabs(teks, keluar, profil, opsi = {}) {
  const kunci = process.env.ELEVENLABS_API_KEY
  if (!kunci) throw new Error('ELEVENLABS_API_KEY belum diisi.')
  const voiceId = pilihVoiceElevenLabs({
    voiceId: opsi?.voiceId,
    daftarVoice: opsi?.daftarVoice,
    profil,
    benih: teks,
  })
  const badan = JSON.stringify({
    text: String(teks ?? '').trim(),
    model_id: ELEVENLABS_MODEL(),
    voice_settings: { stability: 0.45, similarity_boost: 0.78, style: 0.25, use_speaker_boost: true },
  })
  const headers = { 'xi-api-key': kunci, 'Content-Type': 'application/json' }

  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
    { method: 'POST', headers, body: badan, signal: AbortSignal.timeout(60_000) },
  )
  if (r.ok) {
    const j = await r.json()
    if (!j?.audio_base64) throw new Error('ElevenLabs mengembalikan respons tanpa audio_base64.')
    await writeFile(keluar, Buffer.from(j.audio_base64, 'base64'))
    return { kata: kataDariAlignmentElevenLabs(j.normalized_alignment ?? j.alignment), voiceId }
  }
  if (r.status === 404) {
    const rPolos = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      { method: 'POST', headers, body: badan, signal: AbortSignal.timeout(60_000) },
    )
    if (!rPolos.ok) throw new Error(`ElevenLabs TTS ${rPolos.status}: ${(await rPolos.text().catch(() => '')).slice(0, 200)}`)
    await writeFile(keluar, Buffer.from(await rPolos.arrayBuffer()))
    return { kata: [], voiceId }
  }
  throw new Error(`ElevenLabs TTS ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
}

async function elevenlabs(teks, keluar, profil, opsi = {}) {
  return mintaElevenLabs(teks, keluar, profil, opsi)
}

// --------------------------------------------------------------- pemakai

const PEMBUAT = { elevenlabs, gemini, azure, edge }
const EKSTENSI = { elevenlabs: 'mp3', gemini: 'wav', azure: 'mp3', edge: 'mp3' }

export async function buatSuara(teks, keluar, jalur = jalurSuara(), profil = null, opsi = {}) {
  return PEMBUAT[jalur](teks, keluar, profil, opsi)
}

/**
 * Suara semua adegan satu video dengan SATU jalur & SATU profil/Voice ID (suara yang berganti di
 * tengah video terdengar janggal). Profil/Voice ID otomatis bervariasi per video bila tidak ditentukan.
 * Bila jalur utama gagal, otomatis beralih berjenjang: ElevenLabs → Gemini → Edge TTS.
 */
export async function suaraAdegan(teks, folder, opsi = {}) {
  const profilKode = opsi.profilSuara || (opsi.gender === 'wanita' ? 'santai_indo' : opsi.gender === 'pria' ? 'jawa_timur' : null)
  const profil = pilihProfilSuara(profilKode, teks)
  const voiceId = pilihVoiceElevenLabs({
    voiceId: opsi.voiceId,
    daftarVoice: opsi.daftarVoice,
    profil,
    benih: teks,
    gender: opsi.gender ?? null,
  })
  const buat = opsi.buat ?? ((t, k, j, info) => buatSuara(t, k, j, info?.profil ?? profil, { voiceId: info?.voiceId ?? voiceId }))
  const jalurAwal = opsi.jalur ?? jalurSuara()
  const nama = (j) => teks.map((_, i) => path.join(folder, `suara_${i}.${EKSTENSI[j] ?? 'mp3'}`))
  const perAdegan = async (j) => {
    const berkas = nama(j)
    const kata = []
    for (const [i, t] of teks.entries()) {
      const r = await buat(t, berkas[i], j, { profil, voiceId })
      if (j === 'elevenlabs' && Array.isArray(r?.kata)) kata[i] = r.kata
    }
    return { berkas, ...(kata.length ? { kata } : {}) }
  }

  const urutan =
    jalurAwal === 'elevenlabs'
      ? ['elevenlabs', ...(process.env.GEMINI_API_KEY ? ['gemini'] : []), 'edge']
      : jalurAwal === 'gemini'
      ? ['gemini', 'edge']
      : jalurAwal === 'azure'
      ? ['azure', 'edge']
      : ['edge']

  let galatUtama = null
  for (const j of urutan) {
    try {
      if (j === 'gemini' && (opsi.minta || !opsi.buat)) {
        const berkas = nama('gemini')
        try {
          const minta = opsi.minta ?? ((arr) => mintaGemini(arr, profil))
          const model = await narasiSekaligus(teks, berkas, minta)
          const cadangan = model && model !== GEMINI_MODEL()
          const cat = galatUtama
            ? `suara cadangan gemini (${jalurAwal} gagal: ${galatUtama})`
            : cadangan
            ? `suara Gemini model cadangan ${model} (kuota model utama habis)`
            : null
          return { berkas, jalur: j, profil: profil.kode, catatan: cat }
        } catch (e) {
          if (!e.jeda) throw e // kuota/jaringan: per adegan pun akan gagal
        }
      }
      const res = await perAdegan(j)
      return {
        ...res,
        jalur: j,
        profil: profil.kode,
        ...(j === 'elevenlabs' ? { voiceId } : {}),
        catatan: galatUtama ? `suara cadangan ${j} (${jalurAwal} gagal: ${galatUtama})` : null,
      }
    } catch (e) {
      if (j === urutan.at(-1)) throw e
      if (!galatUtama) galatUtama = String(e?.message ?? e).slice(0, 120)
    }
  }
}
