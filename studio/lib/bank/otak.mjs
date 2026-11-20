// =====================================================================
//  otak.mjs — "mata" Studio: Claude melihat lembar kontak (KB §81).
//  SATU-SATUNYA berkas Studio yang tahu penyedia AI-nya.
//
//  Haiku 5.5 untuk kurasi & pemeriksa (murah, sering), Sonnet 5.5 untuk
//  analisis referensi, rangkuman gaya, dan pemilih klip (butuh penilaian). Semua
//  jawaban berbentuk JSON berskema (structured outputs) lalu dirapikan
//  gaya.mjs sebelum dipakai.
// =====================================================================
import Anthropic from '@anthropic-ai/sdk'
import { readFile } from 'node:fs/promises'

const HAIKU = 'claude-haiku-5-5'
const SONNET = 'claude-sonnet-5-5'

// Harga per 1 juta token (USD) — sama dengan HARGA_* di kantor-bot/pesan.ts. Dicatat di setiap
// panggilan supaya biaya Studio ikut terhitung di layar Kantor AI (dulu tidak tercatat, KB §102).
const HARGA = {
  [HAIKU]: { input: 0.10, output: 0.50, cacheTulis: 0.125, cacheBaca: 0.01 },
  [SONNET]: { input: 2, output: 10, cacheTulis: 2.5, cacheBaca: 0.1 },
}

/** usage API → { model, input, output, cacheTulis, cacheBaca, biayaUsd } (bentuk yang sama dengan bot). */
export function pemakaian(model, u = {}) {
  const h = HARGA[model] ?? HARGA[SONNET]
  const p = {
    model, input: u.input_tokens ?? 0, output: u.output_tokens ?? 0,
    cacheTulis: u.cache_creation_input_tokens ?? 0, cacheBaca: u.cache_read_input_tokens ?? 0,
  }
  p.biayaUsd = Math.round(((p.input * h.input + p.output * h.output + p.cacheTulis * h.cacheTulis + p.cacheBaca * h.cacheBaca) / 1e6) * 1e6) / 1e6
  return p
}

/** Jumlahkan beberapa pemakaian (mis. pemilih klip + pemeriksa satu video). */
export function jumlahPemakaian(daftar) {
  const t = { input: 0, output: 0, cacheTulis: 0, cacheBaca: 0, biayaUsd: 0 }
  for (const p of daftar.filter(Boolean)) for (const k of Object.keys(t)) t[k] += Number(p[k]) || 0
  t.biayaUsd = Math.round(t.biayaUsd * 1e6) / 1e6
  return t
}

let klien = null
export function aiSiap() { return !!process.env.ANTHROPIC_API_KEY }
function ai() {
  if (!aiSiap()) throw new Error('ANTHROPIC_API_KEY belum diisi di .env Studio')
  klien ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 })
  return klien
}

async function gambar(berkas) {
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: (await readFile(berkas)).toString('base64') } }
}

async function tanyaJson({ model, effort = 'low', system, isi, skema, maks = 4000 }) {
  const opsi = {
    model, max_tokens: maks, system,
    output_config: { effort, format: { type: 'json_schema', schema: skema } },
    messages: [{ role: 'user', content: isi }],
  }
  // Sonnet 5.5: fallback server bila menolak. Haiku 5.5 tidak punya fallback server.
  const res = model === SONNET
    ? await ai().beta.messages.create({ ...opsi, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
    : await ai().messages.create(opsi)
  if (res.stop_reason === 'refusal') throw new Error('AI menolak permintaan ini')
  if (res.stop_reason === 'max_tokens') throw new Error('Jawaban AI terpotong')
  const teks = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  return { data: JSON.parse(teks), pakai: pemakaian(model, res.usage) }
}

/** Satu baris per adegan untuk AI: narasinya, atau bidikan yang diminta (video sinematik). */
const barisAdegan = (naskah) => naskah.adegan.map((a, i) => `${i + 1}. ${a.suara || `[bidikan] ${a.bidikan ?? a.tag}`}${a.teks_layar ? ` [teks layar: ${a.teks_layar}]` : ''}`).join('\n')

const obj = (props, wajib = Object.keys(props)) => ({ type: 'object', additionalProperties: false, required: wajib, properties: props })

// --------------------------------------------------------------- kurasi

const SKEMA_KURASI = obj({
  deskripsi: { type: 'string', description: 'Isi gambar dalam 1 kalimat bahasa Indonesia, sebut menu/aktivitas/suasana' },
  kata_kunci: { type: 'array', items: { type: 'string' }, description: '3–8 kata kunci, mis. nama menu, "latte art", "barista", "malam"' },
  kualitas: { type: 'integer', description: '1 (buruk/buram/gelap) – 5 (tajam, menarik, layak iklan)' },
  tegak: { type: 'boolean' },
  ada_teks: { type: 'boolean', description: 'Ada tulisan/watermark besar yang mengganggu' },
  bingkai_terbaik: { type: 'integer', description: 'Untuk video: nomor bingkai paling menarik (1–4). Foto: 1' },
})

/** Lihat satu foto / lembar 4 bingkai video. */
export async function kurasiMedia(lembar, info) {
  const video = info.jenis === 'video'
  const { data, pakai } = await tanyaJson({
    model: HAIKU,
    system: 'Kamu kurator bank foto/video kedai kopi Lek Kopi (Waru, Sidoarjo). Nilai jujur dan singkat untuk dipakai editor video pendek IG/TikTok.',
    isi: [
      await gambar(lembar),
      { type: 'text', text: video
        ? `Ini 4 bingkai merata (kiri-atas → kanan-bawah) dari video ${Number(info.durasi).toFixed(1)} detik di folder "${info.tag}".`
        : `Ini foto di folder "${info.tag}".` },
    ],
    skema: SKEMA_KURASI, maks: 1500,
  })
  // Bingkai ke-n dari 4 bingkai merata → detik; ambil 1 detik sebelum s.d. 2 detik sesudahnya.
  if (video) {
    const n = Math.min(4, Math.max(1, Number(data.bingkai_terbaik) || 1))
    const t = ((n - 0.5) / 4) * Number(info.durasi)
    data.terbaik_mulai = Math.max(0, t - 1)
    data.terbaik_akhir = Math.min(Number(info.durasi), t + 2)
  }
  return { data, pakai }
}

// ------------------------------------------------------------ referensi

const SKEMA_REFERENSI = obj({
  ringkas: { type: 'string', description: 'Gaya video ini dalam 1–2 kalimat' },
  hook: { type: 'string', description: 'Cara membuka 3 detik pertama' },
  subtitle: obj({
    ada: { type: 'boolean' }, posisi: { type: 'string', enum: ['bawah', 'tengah', 'atas', 'tidak_ada'] },
    kotak: { type: 'boolean', description: 'Teks di atas kotak/latar' }, warna: { type: 'string', description: '#RRGGBB' },
    tebal: { type: 'boolean' },
  }),
  teks_layar: { type: 'string', description: 'Pola teks besar di layar, kalau ada' },
  cetakan: { type: 'string', enum: ['sinematik', 'teks_cerita', 'dokumenter', 'satu_bidikan', 'bicara_kamera'], description: 'Bentuk video: sinematik = bidikan estetik + musik; teks_cerita = teks lucu/notifikasi yang bercerita; dokumenter = potongan cepat suatu momen; satu_bidikan = tanpa potongan; bicara_kamera = orang berbicara' },
  warna: { type: 'string', enum: ['asli', 'hangat', 'kontras', 'sejuk', 'hitamputih'] },
  suasana: { type: 'string', description: 'Mis. santai malam, ramai, estetik, lucu' },
  penutup: { type: 'string', description: 'Cara menutup video' },
})

/** Analisis satu video referensi dari lembar 9 bingkai + data ritme & caption. */
export async function analisisReferensi(lembar, info) {
  return tanyaJson({
    model: SONNET, effort: 'medium',
    system: 'Kamu editor video pendek. Analisis gaya video milik kedai kopi Lek Kopi supaya video berikutnya bisa meniru yang berhasil. Menurut pemilik, video Lek Kopi tidak memakai narasi suara — hanya musik, gambar, dan teks.',
    isi: [
      await gambar(lembar),
      { type: 'text', text: `9 bingkai merata dari video ${Number(info.durasi).toFixed(1)} detik.\nRitme potongan: ${JSON.stringify(info.potong)}\nCaption: ${info.caption || '-'}\nStatistik: ${JSON.stringify(info.statistik ?? {})}` },
    ],
    skema: SKEMA_REFERENSI, maks: 3000,
  })
}

const SKEMA_GAYA = obj({
  ringkasan: { type: 'string', description: 'Gaya Lek Kopi untuk pemilik, 2–3 kalimat bahasa awam' },
  render: obj({
    maks_shot: { type: 'number', description: 'Panjang maksimal satu potongan (detik), dari rata-rata potongan video yang performanya bagus' },
    transisi: { type: 'string', enum: ['potong', 'pudar'], description: 'Untuk video narasi' },
    zoom: { type: 'number', description: '0–0.2' },
    filter: { type: 'string', enum: ['asli', 'hangat', 'kontras', 'sejuk', 'hitamputih', 'sinematik'] },
    musik_volume: { type: 'number', description: '0–0.4' },
    subtitle: obj({
      huruf: { type: 'string', enum: ['Arial', 'Arial Black', 'Impact', 'Segoe UI', 'Segoe UI Black', 'Verdana', 'Tahoma'] },
      ukuran: { type: 'integer' }, posisi: { type: 'string', enum: ['bawah', 'tengah'] },
      kotak: { type: 'boolean' }, warna: { type: 'string' },
    }),
    teks_layar: obj({
      huruf: { type: 'string', enum: ['Arial', 'Arial Black', 'Impact', 'Segoe UI', 'Segoe UI Black', 'Verdana', 'Tahoma'] },
      ukuran: { type: 'integer' }, durasi: { type: 'number' }, warna: { type: 'string' },
    }),
    sinematik: obj({
      transisi: { type: 'string', enum: ['larut', 'zoom', 'kilat', 'geser', 'campur'], description: 'Transisi antar-adegan video sinematik; campur = bergiliran' },
      musik_volume: { type: 'number', description: '0.3–1' },
      maks_shot: { type: 'number', description: 'Panjang maksimal satu potongan video sinematik (detik)' },
    }),
    judul: obj({
      huruf: { type: 'string', enum: ['Georgia', 'Palatino Linotype', 'Cambria', 'Times New Roman', 'Arial Black', 'Impact'] },
      tangan: { type: 'string', enum: ['Segoe Script', 'Ink Free', 'Gabriola'] },
      warna: { type: 'string' }, aksen: { type: 'string', description: '#RRGGBB untuk bagian tulisan tangan' },
    }),
  }),
  naskah: obj({
    durasi_ideal: { type: 'integer', description: 'Detik' },
    pola_hook: { type: 'string' },
    gaya_bahasa: { type: 'string', description: 'Cara menyapa & kosakata khas' },
    pola_caption: { type: 'string' },
    hashtag_khas: { type: 'array', items: { type: 'string' } },
    hindari: { type: 'string' },
    cetakan_utama: { type: 'string', enum: ['sinematik', 'teks_cerita', 'dokumenter'], description: 'Bentuk video yang paling berhasil' },
  }),
})

/** Rangkum banyak analisis (berbobot performa) → satu profil gaya. */
export async function rangkumGaya(daftar) {
  return tanyaJson({
    model: SONNET, effort: 'medium',
    system: 'Kamu editor kepala konten Lek Kopi. Dari analisis video-video yang sudah tayang (bobot lebih besar = performa lebih baik), tetapkan satu gaya yang akan dipakai editor otomatis dan penulis naskah. Video Lek Kopi bawaannya sinematik tanpa narasi suara (musik + gambar + teks); bagian "sinematik" dan "judul" dipakai untuk bentuk itu.',
    isi: [{ type: 'text', text: JSON.stringify(daftar) }],
    skema: SKEMA_GAYA, maks: 4000,
  })
}

// ---------------------------------------------------- sutradara: pilih klip

const SKEMA_PILIH = obj({
  adegan: {
    type: 'array',
    items: obj({
      nomor: { type: 'integer', description: 'Nomor adegan, mulai 1' },
      klip: { type: 'array', items: { type: 'string' }, description: '3–6 kode klip paling cocok, urut dari yang terbaik' },
    }),
  },
})

/**
 * Urutan klip terbaik per adegan, dari deskripsi kurasi (tanpa gambar: kurasi sudah
 * "melihat"). Sonnet: sekali per video dan butuh penilaian, bukan sekadar cocok kata.
 * `daftar` = [{ kode, jenis, durasi, kurasi }] dari rakit.daftarKlip().
 */
export async function pilihKlip(naskah, daftar) {
  const baris = daftar.map((d) => {
    const k = d.kurasi ?? {}
    return `${d.kode} | ${d.jenis}${d.durasi ? ` ${Number(d.durasi).toFixed(1)} dtk` : ''} | kualitas ${k.kualitas ?? '?'}`
      + `${k.tegak === false ? ' | mendatar' : ''}${k.ada_teks ? ' | ada tulisan' : ''} | ${k.deskripsi ?? '(belum dikurasi)'}`
      + `${k.kata_kunci?.length ? ` | ${k.kata_kunci.join(', ')}` : ''}`
  })
  return tanyaJson({
    model: SONNET, effort: 'low',
    system: 'Kamu sutradara video pendek kedai kopi Lek Kopi. Untuk tiap adegan, pilih rekaman bank yang gambarnya MENDUKUNG kalimat yang diucapkan atau [bidikan] yang diminta. Video sinematik (tanpa narasi) hidup dari gambar bergerak: UTAMAKAN rekaman VIDEO (.mp4) daripada foto diam jika tersedia di bank rekaman. Jika arahan pengguna berfokus pada suasana/kedai/nongkrong/malam, berikan porsi terbanyak (≥60%) pada adegan tag suasana & pelanggan. Patokan: menu/minuman → minumannya atau barista membuatnya; harga → minuman/produk yang disebut; ajakan datang/lokasi/jam buka → tampak kedai; suasana/nongkrong → rekaman suasana, pelanggan, meja, atau suasana malam. Dahulukan kualitas tinggi, video bergerak, dan rekaman tegak. Jangan pilih rekaman yang tidak nyambung (layar TV, orang atau merek lain, buram, gelap, ada tulisan besar). Usahakan tiap adegan memakai rekaman berbeda, dan adegan pertama memakai gambar paling menarik.',
    isi: [{
      type: 'text',
      text: `Naskah per adegan:\n${barisAdegan(naskah)}\n\nBank rekaman (kode | jenis | kualitas 1–5 | deskripsi | kata kunci):\n${baris.join('\n')}`,
    }],
    skema: SKEMA_PILIH, maks: 2000,
  })
}

// ------------------------------------------------------------ pemeriksa

const SKEMA_PERIKSA = obj({
  lolos: { type: 'boolean' },
  bermasalah: { type: 'array', items: { type: 'integer' }, description: 'Nomor adegan (mulai 1) yang gambarnya perlu diganti' },
  alasan: { type: 'string' },
})

/** Periksa lembar bingkai hasil render terhadap naskahnya. */
export async function periksaHasil(lembar, naskah, peta) {
  return tanyaJson({
    model: HAIKU,
    system: 'Kamu pemeriksa mutu video pendek kedai kopi sebelum dikirim ke pemilik. Tolak hanya untuk masalah nyata: gambar tidak nyambung dengan narasi atau bidikan yang diminta, buram parah, gelap, teks menutupi produk, atau ada orang/merek lain yang tidak pantas. Jangan rewel soal selera.',
    isi: [
      await gambar(lembar),
      { type: 'text', text: `Bingkai (kiri-atas → kanan-bawah) diambil dari adegan: ${JSON.stringify(peta)}\nNaskah per adegan:\n${barisAdegan(naskah)}` },
    ],
    skema: SKEMA_PERIKSA, maks: 1500,
  })
}
