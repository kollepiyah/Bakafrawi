// =====================================================================
//  konten_murni.ts — prompt, skema, dan perakit teks konten (KB §76).
//  Modul murni tanpa impor supaya bisa diuji dari Node (supabase/uji).
//
//  Disalin utuh dari Lek Kopi App/supabase/functions/kantor-bot/konten_murni.ts (18 Nov 2026,
//  penyatuan Studio): Bakafrawi Studio kini menulis naskah Lek Kopi. Bagian alur bot lama
//  (status_chat, OAuth, pilihBaris) belum dipakai; salinan Lek Kopi dipensiunkan setelah
//  merek lekkopi aktif di sini — sampai itu, perbaikan aturan naskah lakukan di kedua tempat.
// =====================================================================

type Obj = Record<string, unknown>

export const SISTEM_KONTEN = `Kamu adalah Lek AI, bagian konten untuk kedai Lek Kopi. Lek Kopi adalah kedai kopi di Waru, Sidoarjo, buka sore sampai malam, harga ramah kantong, logo hitam-putih. Kamu menulis untuk Instagram @lekkopi.id dan TikTok Lek Kopi: video pendek 15–30 detik, bahasa Indonesia santai sehari-hari yang umum dipahami — tanpa logat atau sisipan bahasa daerah (jangan pakai "rek", "cak", "lur", meski gaya Lek Kopi di bawah menyebut sisipan Jawa), tidak lebay, tidak menjanjikan hal yang tidak ada.

Aturan:
- Pakai hanya fakta dari data yang diberikan (nama menu, harga, promo). Jangan mengarang menu, harga, atau promo.
- Hook kuat di 3 detik pertama.
- Video dirakit dari bank foto/video yang SUDAH ADA; setiap adegan wajib memakai salah satu tag bank yang diberikan, persis tulisannya.
- Video Lek Kopi bawaannya SINEMATIK: tanpa narasi suara, hanya musik latar, potongan gambar yang indah, transisi, dan sedikit teks di layar — seperti video Lek Kopi yang sudah tayang.`

/**
 * Bentuk video. 'sinematik' (bawaan, keputusan Kyai 15 Nov 2026: video referensi Lek Kopi
 * semuanya tanpa narasi) = musik + gambar + teks layar. 'narasi' = suara dibacakan + subtitle.
 */
export type ModeVideo = 'sinematik' | 'narasi'
export const MODE_BAWAAN: ModeVideo = 'sinematik'
export const GAYA_TEKS = ['judul', 'cerita', 'kutipan', 'tanpa'] as const

export const SKEMA_IDE = {
  type: 'object',
  additionalProperties: false,
  required: ['ide'],
  properties: {
    ide: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['judul', 'alasan', 'sudut', 'rekaman'],
        properties: {
          judul: { type: 'string', description: 'Judul ide singkat, maks 60 karakter' },
          alasan: { type: 'string', description: 'Kenapa ide ini, merujuk data penjualan, 1 kalimat' },
          sudut: { type: 'string', description: 'Gaya/sudut video, 1 kalimat' },
          rekaman: { type: 'string', description: 'Bidikan yang sebaiknya direkam barista kalau bank belum punya, 1 kalimat; kosong kalau bank sudah cukup' },
        },
      },
    },
  },
}

export const SKEMA_NASKAH = {
  type: 'object',
  additionalProperties: false,
  required: ['judul', 'hook', 'adegan', 'caption', 'hashtag', 'judul_tiktok'],
  properties: {
    judul: { type: 'string' },
    hook: { type: 'string', description: 'Kalimat pembuka 3 detik pertama (sama dengan suara adegan 1)' },
    adegan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['suara', 'tag', 'teks_layar'],
        properties: {
          suara: { type: 'string', description: 'Narasi adegan ini, 1–2 kalimat pendek' },
          tag: { type: 'string', description: 'Tag bank media, persis dari daftar' },
          teks_layar: { type: 'string', description: 'Teks besar di layar, maks 5 kata, boleh kosong' },
        },
      },
    },
    caption: { type: 'string', description: 'Caption IG/TikTok, 1–3 kalimat + ajakan' },
    hashtag: { type: 'array', items: { type: 'string' } },
    judul_tiktok: { type: 'string', description: 'Maks 90 karakter' },
  },
}

/** Naskah sinematik: urutan bidikan + teks layar, TANPA narasi suara. */
export const SKEMA_SINEMATIK = {
  type: 'object',
  additionalProperties: false,
  required: ['judul', 'hook', 'adegan', 'caption', 'hashtag', 'judul_tiktok'],
  properties: {
    judul: { type: 'string' },
    hook: { type: 'string', description: 'Apa yang membuat orang berhenti menggulir di 2 detik pertama' },
    adegan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['bidikan', 'tag', 'durasi', 'teks_layar', 'gaya_teks'],
        properties: {
          bidikan: { type: 'string', description: 'Gambar yang diinginkan, mis. "fasad kedai malam, jendela menyala"' },
          tag: { type: 'string', description: 'Tag bank media, persis dari daftar' },
          durasi: { type: 'number', description: 'Detik, 1.5–4' },
          teks_layar: { type: 'string', description: 'Teks di layar, maks 6 kata, boleh kosong' },
          gaya_teks: { type: 'string', enum: [...GAYA_TEKS], description: 'judul = serif besar; cerita = teks tebal di tengah; kutipan = kecil miring di bawah; tanpa = tidak ada teks' },
        },
      },
    },
    caption: { type: 'string', description: 'Caption IG/TikTok: kalimat reflektif/lucu singkat + alamat & jam buka' },
    hashtag: { type: 'array', items: { type: 'string' } },
    judul_tiktok: { type: 'string', description: 'Maks 90 karakter' },
  },
}

export const skemaNaskah = (mode: ModeVideo) => (mode === 'narasi' ? SKEMA_NASKAH : SKEMA_SINEMATIK)

export interface DataKonten {
  periode: string
  terlaris: { nama: string; qty: number }[]
  turun: { nama: string; dulu: number; kini: number }[]
  jamSepi: string[]
  menu: { nama: string; harga: number; harga_online: number }[]
  promo: string[]
  tagBank: string[]
  /** Batas gambar AI per konten dari Pengaturan; 0 = sakelar Gambar AI mati. */
  gambarAi?: number
  kontenTerakhir: string[]
  /** Isi bank hasil kurasi AI, mis. 'racik: barista menuang susu (kualitas 4)'. */
  isiBank?: string[]
  /** Gaya Lek Kopi dari video yang sudah tayang (agent.gaya.profil.naskah). */
  gaya?: Record<string, unknown> | null
  /** Alamat & jam buka dari pengaturan kasir, untuk teks penutup video sinematik. */
  toko?: string
  /** Ingatan Lek AI (catatan Kyai), wajib dihormati saat menulis ide & naskah. */
  ingatan?: string
}

const teksIngatanKonten = (s?: string) => (s ? `\n\nCatatan pemilik (WAJIB dihormati):\n${s}` : '')

function teksGaya(g?: Record<string, unknown> | null): string {
  if (!g || !Object.keys(g).length) return ''
  const b = ['', 'Gaya Lek Kopi dari video yang sudah tayang (ikuti):']
  if (g.durasi_ideal) b.push(`- Durasi ideal: ±${g.durasi_ideal} detik`)
  if (g.pola_hook) b.push(`- Pola hook: ${g.pola_hook}`)
  if (g.gaya_bahasa) b.push(`- Gaya bahasa: ${g.gaya_bahasa}`)
  if (g.pola_caption) b.push(`- Pola caption: ${g.pola_caption}`)
  if (Array.isArray(g.hashtag_khas) && g.hashtag_khas.length) b.push(`- Hashtag khas: ${g.hashtag_khas.join(' ')}`)
  if (g.hindari) b.push(`- Hindari: ${g.hindari}`)
  return b.join('\n')
}

const daftar = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '- (kosong)')

export function promptIde(d: DataKonten, jumlah = 4): string {
  return `Usulkan ${jumlah} ide video pendek untuk minggu ini.

Data penjualan ${d.periode}:
Menu terlaris:
${daftar(d.terlaris.map((m) => `${m.nama} (${m.qty})`))}
Menu yang turun:
${daftar(d.turun.map((m) => `${m.nama} (${m.dulu} → ${m.kini})`))}
Jam paling sepi: ${d.jamSepi.join(', ') || '-'}

Promo/iklan aktif:
${daftar(d.promo)}

Tag bank foto/video yang tersedia:
${daftar(d.tagBank)}

Isi bank (hasil kurasi):
${daftar((d.isiBank ?? []).slice(0, 40))}

Judul konten 10 terakhir (jangan diulang):
${daftar(d.kontenTerakhir)}
${teksGaya(d.gaya)}${teksIngatanKonten(d.ingatan)}

Campurkan: mendorong menu laris, mengangkat menu yang turun, dan mengisi jam sepi. Ide harus bisa dibuat dari tag bank yang tersedia. Video bawaannya sinematik tanpa narasi: pilih ide yang kuat secara gambar dan konsep, bukan yang bergantung pada omongan. Kalau idenya butuh bidikan yang belum ada di bank, tulis di "rekaman" apa yang perlu direkam barista.`
}

const ATURAN_NARASI = `Bentuk: NARASI — suara dibacakan + subtitle. Narasi total 35–70 kata (±15–30 detik dibacakan). Buat 3–7 adegan.`

function aturanSinematik(d: DataKonten): string {
  return `Bentuk: SINEMATIK — TANPA narasi suara. Hanya musik latar, bidikan berurutan dengan transisi, dan sedikit teks di layar.
- 6–10 adegan, durasi tiap adegan 1.5–4 detik, total 15–25 detik.
- Alur harus fleksibel MENGIKUTI TEMA / PERMINTAAN KYAI:
  * Jika permintaan Kyai menekankan "suasana" / kedai / nongkrong: fokuskan sebagian besar adegan (≥60%) pada tag [suasana] dan pelanggan di kedai (misal meja, lampu temaram, tawa nongkrong, fasad malam). Jangan batasi suasana hanya 1 adegan!
  * Jika permintaan menekankan racikan / menu kopi tertentu: fokuskan ke tag menu terkait dan racik barista.
  * Tetap buka dengan bidikan paling menarik (mis. fasad menyala atau suasana kedai) + judul singkat, lalu masuki inti tema, dan tutup dengan ajakan mampir / jam buka.
- Utamakan memilih klip VIDEO (.mp4) bergerak daripada foto diam jika tag tersebut memiliki rekaman video di bank, agar video dinamis dan sinematik.
- "bidikan" = deskripsi gambar yang diinginkan, sespesifik mungkin, sesuai isi bank.
- Teks hemat: kebanyakan adegan "tanpa" teks. Adegan pertama "judul" (2–3 kata; judul bahasa Inggris pendek boleh, mis. "Coffee | time" — bagian sesudah "|" ditulis tangan). Teks lain berbahasa Indonesia. Adegan terakhir "cerita" berisi ajakan + jam buka.
- Boleh juga teks bercerita (mis. notifikasi chat lucu lalu jawabannya) dengan gaya_teks "cerita" di beberapa adegan berurutan.
- Caption: satu kalimat reflektif atau lucu, lalu alamat & jam buka, lalu hashtag.${d.toko ? `\n- Info toko: ${d.toko}` : ''}${aturanAi(d)}`
}

/** Tag khusus: adegan yang gambarnya DIBUAT AI (Gemini) dari "bidikan", lalu dihidupkan zoom oleh Studio. */
export const TAG_AI = 'ai'

function aturanAi(d: DataKonten): string {
  if (!d.gambarAi) return ''
  if (d.gambarAi >= 3) {
    return `
- Tag "${TAG_AI}" (maks ${d.gambarAi} adegan): gambarnya DIBUAT AI (Cloudflare FLUX.2 / Gemini) dari "bidikan". Cocok untuk visual studio editorial kopi mewah (tuangan espresso, percikan latte creamy, biji kopi panggang melayang di atas latar krem hangat minimalis, suasana kafe estetik). JANGAN gambar logo atau teks tulisan di dalam gambar — "bidikan" harus satu kalimat deskriptif visual berbahasa Inggris/Indonesia yang tajam (subjek, pencahayaan, latar krem/hangat, sudut kamera, tanpa tulisan).`
  }
  return `
- Tag "${TAG_AI}" (boleh selain tag bank, maks ${d.gambarAi} adegan): gambarnya DIBUAT AI dari "bidikan", lalu dihidupkan dengan zoom pelan. Pakai hanya untuk suasana/konsep yang tak ada di bank (mis. hujan di jalan malam, orang lembur di kantor, senja di jalan raya Waru). JANGAN untuk minuman, menu, logo, atau barista Lek Kopi — produk wajib foto asli dari bank. "bidikan" untuk tag ini: satu kalimat rinci (siapa, di mana, cahaya, sudut kamera), tanpa tulisan.`
}

export function promptNaskah(d: DataKonten, ide: Obj, catatan?: string, naskahLama?: Obj, mode: ModeVideo = MODE_BAWAAN): string {
  const menu = d.menu.map((m) => `${m.nama}: Rp${m.harga.toLocaleString('id-ID')}`).join('\n')
  let p = `Tulis naskah video untuk ide ini:
Judul: ${ide.judul}
Alasan: ${ide.alasan}
Sudut: ${ide.sudut}

Menu & harga di kedai:
${menu || '-'}

Promo aktif:
${daftar(d.promo)}

Tag bank yang BOLEH dipakai (persis):
${daftar(d.tagBank)}${mode === 'sinematik' && d.gambarAi ? `\n- ${TAG_AI} (gambar dibuat AI — lihat aturan di bawah)` : ''}

Isi bank (pilih tag yang gambarnya cocok dengan adegan; [VIDEO] = rekaman bergerak, utamakan):
${daftar((d.isiBank ?? []).slice(0, 60))}
${teksGaya(d.gaya)}${teksIngatanKonten(d.ingatan)}

${mode === 'narasi' ? ATURAN_NARASI : aturanSinematik(d)}
Hashtag 5–8, campur lokal (#waru #sidoarjo #ngopisidoarjo) dan umum. Akhiri dengan ajakan datang ke Lek Kopi Waru atau pesan lewat GoFood/ShopeeFood/GrabFood.`
  if (catatan && naskahLama) {
    p += `\n\nIni naskah sebelumnya:\n${JSON.stringify(naskahLama)}\n\nCatatan revisi dari pemilik (WAJIB dituruti):\n${catatan}`
  }
  return p
}

export interface Adegan {
  /** Narasi dibacakan; selalu '' untuk sinematik. */
  suara: string
  tag: string
  teks_layar: string
  /** Sinematik saja. */
  bidikan?: string
  durasi?: number
  gaya_teks?: typeof GAYA_TEKS[number]
}

export interface Naskah {
  /** Naskah sebelum 15 Nov 2026 tidak punya mode = narasi. */
  mode?: ModeVideo
  judul: string
  hook: string
  adegan: Adegan[]
  caption: string
  hashtag: string[]
  judul_tiktok: string
}

/**
 * Merapikan naskah dari model: tag yang tidak ada di bank diganti tag
 * terdekat (awalan sama) atau tag pertama; hashtag diberi '#'; judul TikTok
 * dipotong 90. Memulangkan juga daftar perbaikan supaya bisa dicatat.
 */
export function rapikanNaskah(n: Naskah, tagBank: string[], mode: ModeVideo = 'narasi', maksAi = 0): { naskah: Naskah; perbaikan: string[] } {
  const perbaikan: string[] = []
  const sinematik = mode === 'sinematik'
  let jumlahAi = 0
  const adegan = (n.adegan ?? []).slice(0, sinematik ? 12 : 8).map((a, i) => {
    let tag = String(a.tag ?? '').trim()
    // Tag ai sah hanya di sinematik, saat sakelar nyala, ada bidikan, dan belum melewati batas.
    const ai = tag === TAG_AI && sinematik && jumlahAi < maksAi && String(a.bidikan ?? '').trim() !== ''
    if (ai) jumlahAi++
    else if (tagBank.length && !tagBank.includes(tag)) {
      const awal = tag.split('/')[0]
      const ganti = tagBank.find((t) => t.split('/')[0] === awal) ?? tagBank[0]
      perbaikan.push(`adegan ${i + 1}: tag "${tag}" → "${ganti}"`)
      tag = ganti
    }
    const teks_layar = String(a.teks_layar ?? '').trim().slice(0, 40)
    if (!sinematik) return { suara: String(a.suara ?? '').trim(), tag, teks_layar }
    // Jawaban AI dijepit: durasi 1,2–5 detik, gaya teks dari daftar.
    const d = Number(a.durasi)
    const durasi = Math.round(Math.min(5, Math.max(1.2, Number.isFinite(d) ? d : 2.5)) * 10) / 10
    let gaya_teks = (GAYA_TEKS as readonly string[]).includes(String(a.gaya_teks)) ? a.gaya_teks! : (i === 0 ? 'judul' : 'cerita')
    if (!teks_layar) gaya_teks = 'tanpa'
    return { suara: '', tag, teks_layar: gaya_teks === 'tanpa' ? '' : teks_layar, bidikan: String(a.bidikan ?? '').trim().slice(0, 160), durasi, gaya_teks }
  }).filter((a) => (sinematik ? a.tag : a.suara))
  const hashtag = [...new Set((n.hashtag ?? []).map((h) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '').toLowerCase()).filter((h) => h.length > 1))].slice(0, 10)
  return {
    naskah: {
      mode,
      judul: String(n.judul ?? '').trim(),
      hook: String(n.hook ?? '').trim(),
      adegan,
      caption: String(n.caption ?? '').trim(),
      hashtag,
      judul_tiktok: String(n.judul_tiktok ?? n.judul ?? '').trim().slice(0, 90),
    },
    perbaikan,
  }
}

// ------------------------------------------------------------------ gambar (KB §105)
// Postingan feed (1 slide), carousel (2–5 slide), dan story. Desainnya dari cetakan di
// kantor-studio/lib/poster.mjs — daftar gaya & palet di bawah HARUS sama dengan di sana.

export const GAYA_GAMBAR = ['editorial', 'pop', 'minimal', 'retro', 'gelap', 'kolase'] as const
export const PALET_GAMBAR = ['kopi', 'krem', 'matcha', 'stroberi', 'mangga', 'cokelat', 'hitam-emas'] as const
export type IgTujuan = 'utama' | 'story' | 'keduanya'

export interface SlideGambar {
  judul: string
  sub: string
  stiker: string
  /** Nama menu persis dari daftar kasir, '' bila slide tidak menjual satu menu. */
  menu: string
  /** Diisi rapikanGambar() dari harga kasir — tidak pernah dari AI. */
  harga: number | null
  tag: string
  /** Latar: kata kunci Unsplash, atau deskripsi foto untuk Gemini bila naskah.latar = 'ai'. '' = tanpa latar. */
  kata_unsplash: string
}

export interface NaskahGambar {
  jenis: 'gambar'
  judul: string
  gaya: typeof GAYA_GAMBAR[number]
  palet: typeof PALET_GAMBAR[number]
  slide: SlideGambar[]
  caption: string
  hashtag: string[]
  /** 'ai' = latar dibuat Gemini (Studio), selain itu Unsplash. Naskah lama tak punya kunci ini. */
  latar?: 'ai' | 'unsplash'
}

export const SKEMA_GAMBAR = {
  type: 'object',
  additionalProperties: false,
  required: ['judul', 'gaya', 'palet', 'slide', 'caption', 'hashtag'],
  properties: {
    judul: { type: 'string', description: 'Judul konten untuk antrean, maks 60 karakter' },
    gaya: {
      type: 'string', enum: [...GAYA_GAMBAR],
      description: 'editorial = foto penuh + judul serif elegan; pop = latar warna cerah, foto polaroid, judul tebal & stiker (ceria, promo); minimal = latar krem, foto melengkung, kalem; retro = sinar matahari & lingkaran, poster jadul; gelap = foto gelap dramatis + tulisan tangan (malam, santai); kolase = latar foto suasana + kartu foto menu (butuh kata_unsplash)',
    },
    palet: { type: 'string', enum: [...PALET_GAMBAR], description: 'Warna, sesuaikan dengan menu: matcha untuk matcha, stroberi untuk menu stroberi, mangga untuk mangga/pisang, cokelat untuk cokelat/milo, kopi/krem/hitam-emas untuk kopi' },
    slide: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['judul', 'sub', 'stiker', 'menu', 'tag', 'kata_unsplash'],
        properties: {
          judul: { type: 'string', description: 'Judul besar, maks 5 kata, menarik & tidak kaku' },
          sub: { type: 'string', description: 'Kalimat pendukung maks 12 kata, boleh kosong' },
          stiker: { type: 'string', description: 'Label kecil maks 3 kata (mis. "Menu baru", "Khusus guru"), boleh kosong' },
          menu: { type: 'string', description: 'Nama menu PERSIS dari daftar bila slide ini menampilkan satu menu (harga diisi sistem), selain itu kosong' },
          tag: { type: 'string', description: 'Tag bank foto, persis dari daftar' },
          kata_unsplash: { type: 'string', description: 'Hanya untuk gaya kolase atau bila bank tidak punya foto yang cocok: 2–4 kata bahasa Inggris untuk foto latar suasana (mis. "warm cafe evening"). Selain itu kosong.' },
        },
      },
    },
    caption: { type: 'string', description: 'Caption Instagram 1–3 kalimat + ajakan' },
    hashtag: { type: 'array', items: { type: 'string' } },
  },
}

/** Skema gambar; saat Gambar AI nyala, kata_unsplash menjadi deskripsi foto latar untuk Gemini. */
export function skemaGambar(ai: boolean) {
  if (!ai) return SKEMA_GAMBAR
  const s = structuredClone(SKEMA_GAMBAR)
  s.properties.slide.items.properties.kata_unsplash.description =
    'Hanya untuk gaya kolase atau bila bank tidak punya foto yang cocok: SATU kalimat bahasa Inggris yang merinci foto latar suasana untuk dibuat AI (siapa/apa, tempat, cahaya), tanpa tulisan dan bukan minuman/menu Lek Kopi. Selain itu kosong.'
  return s
}

export function promptGambar(d: DataKonten, ide: Obj, jumlahSlide: number, catatan?: string, naskahLama?: Obj): string {
  const menu = d.menu.map((m) => `${m.nama}: Rp${m.harga.toLocaleString('id-ID')}`).join('\n')
  let p = `Buat konten GAMBAR Instagram untuk ide ini:
Judul: ${ide.judul}
Alasan: ${ide.alasan}
Sudut: ${ide.sudut}

Bentuk: ${jumlahSlide > 1 ? `CAROUSEL ${jumlahSlide} slide (slide 1 sampul yang memancing geser, slide terakhir ajakan mampir)` : 'SATU gambar (postingan/iklan)'}. Desain disusun sistem dari gaya & palet yang kamu pilih; tugasmu teks yang singkat, segar, dan tidak kaku — seperti poster kafe kekinian, bukan pengumuman resmi. Hindari judul generik seperti "Promo Spesial".

Menu & harga di kedai (harga ditulis sistem, jangan tulis angka harga di judul/sub):
${menu || '-'}

Promo aktif:
${daftar(d.promo)}

Tag bank foto yang BOLEH dipakai (persis):
${daftar(d.tagBank)}

Isi bank (pilih tag yang fotonya cocok):
${daftar((d.isiBank ?? []).slice(0, 40))}
${teksGaya(d.gaya)}${teksIngatanKonten(d.ingatan)}

Caption: 1–3 kalimat santai + ajakan${d.toko ? ` + info toko (${d.toko})` : ''}. Hashtag 5–8, campur lokal (#waru #sidoarjo #ngopisidoarjo) dan umum.${d.gambarAi ? `
Latar foto (kata_unsplash) akan DIBUAT AI, maks ${d.gambarAi} slide: tulis satu kalimat rinci suasana (mis. "Rainy night street in Sidoarjo with warm cafe lights reflecting on wet asphalt"). Menu/minuman tetap foto asli dari bank.` : ''}`
  if (catatan && naskahLama) {
    p += `\n\nIni naskah sebelumnya:\n${JSON.stringify(naskahLama)}\n\nCatatan revisi dari pemilik (WAJIB dituruti):\n${catatan}`
  }
  return p
}

const potong = (s: unknown, n: number) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, n)

/**
 * Merapikan naskah gambar: tag bank & gaya/palet yang sah, jumlah slide, panjang teks,
 * dan HARGA dari daftar menu kasir (bukan dari AI).
 */
export function rapikanGambar(n: Partial<NaskahGambar>, tagBank: string[], menu: DataKonten['menu'], jumlahSlide: number, maksAi = 0): { naskah: NaskahGambar; perbaikan: string[] } {
  const perbaikan: string[] = []
  const hargaMenu = new Map(menu.map((m) => [m.nama.trim().toLowerCase(), m]))
  // Gambar AI: deskripsi boleh lebih panjang, dan slide di atas batas tak diberi latar (biaya terjaga).
  let jumlahAi = 0
  const latarSlide = (teks: unknown, i: number) => {
    const t = potong(teks, maksAi ? 240 : 60)
    if (!t || !maksAi) return t
    if (jumlahAi >= maksAi) { perbaikan.push(`slide ${i + 1}: latar AI melewati batas ${maksAi} — dibuang`); return '' }
    jumlahAi++
    return t
  }
  const slide = (n.slide ?? []).slice(0, Math.max(1, Math.min(5, jumlahSlide))).map((s, i) => {
    let tag = potong(s.tag, 80)
    if (tagBank.length && !tagBank.includes(tag)) {
      const ganti = tagBank.find((t) => t.split('/')[0] === tag.split('/')[0]) ?? tagBank[0]
      perbaikan.push(`slide ${i + 1}: tag "${tag}" → "${ganti}"`)
      tag = ganti
    }
    const m = hargaMenu.get(potong(s.menu, 80).toLowerCase())
    if (potong(s.menu, 80) && !m) perbaikan.push(`slide ${i + 1}: menu "${potong(s.menu, 80)}" tidak ada di kasir — tanpa harga`)
    return {
      judul: potong(s.judul, 60), sub: potong(s.sub, 110), stiker: potong(s.stiker, 24),
      menu: m ? m.nama : '', harga: m && m.harga > 0 ? m.harga : null,
      tag, kata_unsplash: latarSlide(s.kata_unsplash, i),
    }
  }).filter((s) => s.judul)
  const gaya = (GAYA_GAMBAR as readonly string[]).includes(String(n.gaya)) ? n.gaya! : 'editorial'
  const palet = (PALET_GAMBAR as readonly string[]).includes(String(n.palet)) ? n.palet! : 'kopi'
  const hashtag = [...new Set((n.hashtag ?? []).map((h) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '').toLowerCase()).filter((h) => h.length > 1))].slice(0, 10)
  return { naskah: { jenis: 'gambar', judul: potong(n.judul, 120), gaya, palet, slide, caption: String(n.caption ?? '').trim(), hashtag, latar: maksAi ? 'ai' : 'unsplash' }, perbaikan }
}

export function teksNaskahGambar(n: NaskahGambar): string {
  const b = [`🖼 Naskah ${n.slide.length > 1 ? `carousel ${n.slide.length} slide` : 'gambar'}: ${n.judul}`, `Gaya ${n.gaya} · warna ${n.palet}`, '']
  n.slide.forEach((s, i) => {
    b.push(`${i + 1}. «${s.judul}»${s.stiker ? ` [${s.stiker}]` : ''}`)
    if (s.sub) b.push(`   ${s.sub}`)
    b.push(`   foto: ${s.tag}${s.menu ? ` · ${s.menu}${s.harga ? ` Rp${s.harga.toLocaleString('id-ID')}` : ''}` : ''}${s.kata_unsplash ? ` · latar ${n.latar === 'ai' ? '🎨 AI' : 'Unsplash'} "${s.kata_unsplash}"` : ''}`)
  })
  b.push('', 'Caption:', n.caption, '', n.hashtag.join(' '))
  return b.join('\n')
}

/** Caption akhir untuk gambar: caption + hashtag. */
export function captionGambar(n: NaskahGambar): string {
  return `${n.caption}\n\n${n.hashtag.join(' ')}`.trim()
}

/** Label tujuan Instagram untuk pesan bot. */
export function teksTujuan(jenis: string, tujuan: string): string {
  const utama = jenis === 'gambar' ? 'postingan' : 'Reels'
  return tujuan === 'story' ? 'Story' : tujuan === 'keduanya' ? `${utama} + Story` : utama
}

// --------------------------------------------- konten dari obrolan Lek AI (KB §106)

export const JENIS_PERMINTAAN = ['video_sinematik', 'video_narasi', 'gambar', 'carousel'] as const

export interface PermintaanKonten {
  jenis: typeof JENIS_PERMINTAAN[number]
  /** Isi kolom `ide` (sama bentuknya dengan ide dari /ide). */
  ide: { judul: string; alasan: string; sudut: string; rekaman: string }
  /** Uji coba: naskah langsung dirender tanpa menunggu persetujuan naskah, hasilnya untuk dicek. */
  coba: boolean
}

/**
 * Masukan alat buat_konten dari Lek AI → permintaan yang sah. Konsep yang dibahas di
 * obrolan (alur, adegan, teks) masuk ke `sudut` supaya ikut prompt naskah.
 */
export function rapikanPermintaan(m: Obj): PermintaanKonten {
  const jenis = String(m.jenis ?? '')
  if (!(JENIS_PERMINTAAN as readonly string[]).includes(jenis)) {
    throw new Error(`Jenis konten harus salah satu dari: ${JENIS_PERMINTAAN.join(', ')}`)
  }
  const judul = potong(m.judul, 60)
  const konsep = String(m.konsep ?? '').trim().slice(0, 1500)
  if (!judul || !konsep) throw new Error('Judul dan konsep wajib diisi')
  return {
    jenis: jenis as PermintaanKonten['jenis'],
    ide: { judul, alasan: potong(m.alasan, 200) || 'Permintaan Kyai lewat obrolan', sudut: `Konsep dari Kyai (WAJIB diikuti):\n${konsep}`, rekaman: '' },
    coba: m.uji_coba === true,
  }
}

export function jumlahKata(n: Naskah): number {
  return n.adegan.reduce((s, a) => s + a.suara.split(/\s+/).filter(Boolean).length, 0)
}

/** Total detik naskah sinematik (sebelum disesuaikan ke ketukan musik). */
export function durasiSinematik(n: Naskah): number {
  return Math.round(n.adegan.reduce((s, a) => s + (Number(a.durasi) || 0), 0) * 10) / 10
}

export function teksNaskah(n: Naskah, nomor?: string): string {
  if (n.mode === 'sinematik') {
    const b = [`🎬 Naskah sinematik${nomor ? ' ' + nomor : ''}: ${n.judul}`, '(tanpa suara — musik latar, transisi, teks layar)', '']
    n.adegan.forEach((a, i) => {
      b.push(`${i + 1}. [${a.tag === TAG_AI ? '🎨 gambar AI' : a.tag}] ${a.durasi} dtk — ${a.bidikan || '(bebas)'}`)
      if (a.teks_layar) b.push(`   «${a.teks_layar.replace(/\s*\|\s*/g, ' ')}» (${a.gaya_teks})`)
    })
    b.push('', `±${Math.round(durasiSinematik(n))} detik + kartu penutup`)
    b.push('', 'Caption:', n.caption, '', n.hashtag.join(' '))
    return b.join('\n')
  }
  const b = [`🎙 Naskah narasi${nomor ? ' ' + nomor : ''}: ${n.judul}`, '']
  n.adegan.forEach((a, i) => {
    b.push(`${i + 1}. [${a.tag}]${a.teks_layar ? ` «${a.teks_layar}»` : ''}`)
    b.push(`   ${a.suara}`)
  })
  b.push('', `±${jumlahKata(n)} kata (±${Math.round(jumlahKata(n) / 2.4)} detik)`)
  b.push('', 'Caption:', n.caption, '', n.hashtag.join(' '))
  return b.join('\n')
}

export function teksIde(ide: Obj[]): string {
  const b = ['💡 Ide konten:', '']
  ide.forEach((x, i) => {
    b.push(`${i + 1}. ${x.judul}`)
    b.push(`   ${x.alasan}`)
    if (String(x.rekaman ?? '').trim()) b.push(`   📹 Perlu direkam: ${String(x.rekaman).trim()}`)
  })
  b.push('', 'Pilih salah satu untuk dibuatkan naskah.')
  return b.join('\n')
}

/** Caption akhir untuk IG/TikTok: caption + hashtag. */
export function captionAkhir(n: Naskah): string {
  return `${n.caption}\n\n${n.hashtag.join(' ')}`.trim()
}

// Bot menunggu catatan Kyai (revisi, tempel ulasan, ubah balasan) paling lama
// sekian menit. Tanpa batas, pesan biasa keesokan harinya ikut ditelan sebagai
// catatan. Satu query untuk konten.ts & ulasan.ts supaya batasnya tidak berpisah.
export const MENIT_TUNGGU = 10
export const SQL_MENUNGGU = `select menunggu, content_id, ulasan_id from agent.status_chat
  where chat_id = $1 and updated_at > now() - make_interval(mins => $2::int)`

/** Alamat halaman balik OAuth — harus sama persis dengan yang didaftarkan di Meta/TikTok. */
export function alamatBalik(supabaseUrl: string, layanan: 'instagram' | 'tiktok' | 'google'): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/kantor-bot/oauth/${layanan}`
}

/** Tautan izin Instagram (Instagram Login) / TikTok (Login Kit) untuk akun Lek Kopi. */
export function tautanOauth(layanan: 'instagram' | 'tiktok', o: { clientId: string; state: string; balik: string }): string {
  if (layanan === 'instagram') {
    const q = new URLSearchParams({
      client_id: o.clientId, redirect_uri: o.balik, response_type: 'code',
      // manage_insights: tayangan/simpan per Reels untuk belajar video mana yang berhasil.
      scope: 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights', state: o.state,
    })
    return `https://www.instagram.com/oauth/authorize?${q}`
  }
  const q = new URLSearchParams({
    client_key: o.clientId, redirect_uri: o.balik, response_type: 'code',
    scope: 'user.info.basic,video.upload', state: o.state,
  })
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`
}

/**
 * Jadwal tayang berikutnya pada jam `jam` WIB (UTC+7). Kalau sekarang sudah
 * lewat (jam − 30 menit), pindah ke besok. Memulangkan ISO UTC.
 */
export function jadwalBerikut(sekarangIso: string, jam = 19, offsetJam = 7): string {
  const now = new Date(sekarangIso)
  const lokal = new Date(now.getTime() + offsetJam * 3600_000)
  const target = new Date(Date.UTC(lokal.getUTCFullYear(), lokal.getUTCMonth(), lokal.getUTCDate(), jam - offsetJam, 0, 0))
  if (target.getTime() - now.getTime() < 30 * 60_000) target.setUTCDate(target.getUTCDate() + 1)
  return target.toISOString()
}

// ---------------------------------------------------------------------
//  Alat kelola_konten Lek AI: memilih ide/bentuk dan menyetujui naskah lewat ketikan.
//  Nomor yang Kyai sebut harus sama dengan nomor di pesan yang ia lihat.
// ---------------------------------------------------------------------

/** Ide dari daftar terbaru saja (satu /ide menyisipkan kelimanya dalam hitungan detik), urut seperti di pesan. */
export const SQL_IDE_TERBARU = `select id, judul, status, jenis from agent.content_items
  where status = 'ide' and created_at >= (select max(created_at) from agent.content_items where status = 'ide') - interval '2 minutes'
  order by created_at, id`

/** Naskah/video yang menunggu keputusan Kyai, tiga hari terakhir, urut dibuat. */
export const SQL_KONTEN_MENUNGGU = `select id, judul, status, jenis from agent.content_items
  where status in ('naskah', 'review') and created_at > now() - interval '3 days'
  order by created_at, id`

export type BarisPilih = { id: unknown; judul: unknown; status?: unknown }

/**
 * Menentukan baris yang dimaksud Kyai. Tanpa nomor hanya sah bila tepat satu baris —
 * menebak di antara beberapa naskah berarti menyetujui yang salah.
 */
export function pilihBaris(baris: BarisPilih[], nomor?: number): { id: string } | { alasan: string } {
  const daftar = baris.map((b, i) => `${i + 1}. ${String(b.judul ?? '(tanpa judul)')}`).join(' | ')
  if (!baris.length) return { alasan: 'Tidak ada yang sedang menunggu.' }
  if (nomor !== undefined) {
    const b = baris[nomor - 1]
    return Number.isInteger(nomor) && b ? { id: String(b.id) } : { alasan: `Nomor ${nomor} tidak ada. Yang menunggu: ${daftar}` }
  }
  if (baris.length === 1) return { id: String(baris[0].id) }
  return { alasan: `Ada ${baris.length} yang menunggu, tanyakan Kyai nomor berapa. ${daftar}` }
}
