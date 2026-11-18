// =====================================================================
//  rakit.mjs — rencana video dari naskah + bank media (KB §77, §81).
//  MURNI: tanpa berkas, tanpa ffmpeg — diuji dari supabase/uji.
//
//  Adegan = satu kalimat narasi. Adegan yang lebih panjang dari
//  gaya.maksShot dipecah jadi beberapa potongan (shot), masing-masing klip
//  berbeda dari tag yang sama — tempo mengikuti "gaya Lek Kopi". Klip dipilih
//  dari skor kurasi AI (kualitas + kecocokan dengan narasi); video diambil
//  dari "detik terbaik" hasil kurasi. Subtitle & teks layar ditulis ASS.
// =====================================================================

import { filterWarna, GAYA_BAWAAN, parameterGaya, skorMedia, warnaAss } from './gaya.mjs'

export const LEBAR = 1080
export const TINGGI = 1920
export const FPS = 30
export const JEDA = 0.25          // detik sesudah tiap kalimat
export const MIN_ADEGAN = 1.6     // adegan sesingkat apa pun tetap terbaca
export const DURASI_PENUTUP = 2.2
const PUDAR = 0.15

/** Angka acak deterministik dari teks (id konten) — pilihan klip bisa diulang. */
export function benih(teks) {
  let h = 2166136261
  for (const c of String(teks)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function kelompokkan(bank) {
  const perTag = new Map()
  for (const m of bank) {
    if (m.jenis !== 'foto' && m.jenis !== 'video') continue
    if (!perTag.has(m.tag)) perTag.set(m.tag, [])
    perTag.get(m.tag).push(m)
  }
  for (const xs of perTag.values()) xs.sort((a, b) => a.path.localeCompare(b.path))
  return perTag
}

/**
 * Pilih media per potongan. `jumlah[i]` = banyak potongan adegan i (bawaan
 * 1). Memulangkan array per adegan berisi array media. Media yang sudah
 * dipakai di video ini dihindari selama masih ada pilihan lain.
 */
export function pilihShot(adegan, bank, seed = 0, jumlah = [], hindari = new Set(), saran = []) {
  const perTag = kelompokkan(bank)
  // Gambar AI (tag ai/<n>) dibuat untuk satu adegan saja — tak ikut jadi calon adegan lain.
  const semua = [...perTag.values()].flat().filter((m) => !m.ai)
  const pakai = new Map()
  return adegan.map((a, i) => {
    const s = saran[i] ?? []
    // Saran sutradara AI boleh lintas tag: bank Kyai sering belum dipilah per folder.
    const calon = s.length ? semua : (perTag.get(a.tag) ?? semua)
    if (!calon.length) throw new Error(`Bank media kosong untuk tag "${a.tag}"`)
    const hasil = []
    for (let k = 0; k < Math.max(1, jumlah[i] ?? 1); k++) {
      // Skor sama → urutan diputar benih, supaya video berbeda tidak selalu memakai klip yang sama.
      const geser = (seed + i * 7919 + k * 104729) % calon.length
      const urut = calon.map((m, j) => ({ m, j: (j - geser + calon.length) % calon.length }))
        // Klip yang ditolak pemeriksa AI dihindari, tapi tetap boleh kalau tag-nya tidak punya pilihan lain.
        .map((x) => ({ ...x, s: skorMedia(x.m, a, pakai.get(x.m.path) ?? 0) + bonusSaran(s, x.m.path) - (hindari.has(x.m.path) ? 20 : 0) }))
        .sort((x, y) => y.s - x.s || x.j - y.j)
      const pilih = urut[0].m
      pakai.set(pilih.path, (pakai.get(pilih.path) ?? 0) + 1)
      hasil.push(pilih)
    }
    return hasil
  })
}

// Bonus urutan saran AI (≥ 16) mengalahkan skor kata-cocok (≤ 16), tetapi tetap kalah oleh
// penalti pakai-ulang (12) bila saran berikutnya belum dipakai, dan oleh penolakan pemeriksa (20).
function bonusSaran(s, p) {
  const r = s.indexOf(p)
  return r < 0 ? 0 : 14 + (s.length - r) * 2
}

/** Bank yang boleh dipilih sutradara AI, diberi kode pendek (k1, k2, …) supaya hemat token. */
export function daftarKlip(bank) {
  return bank.filter((m) => m.jenis === 'foto' || m.jenis === 'video')
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((m, i) => ({ kode: `k${i + 1}`, path: m.path, jenis: m.jenis, durasi: m.durasi, kurasi: m.kurasi }))
}

/** Jawaban sutradara AI → array path per adegan; kode yang tidak dikenal dibuang. */
export function petakanSaran(jawaban, daftar, jumlahAdegan) {
  const peta = new Map(daftar.map((d) => [d.kode, d.path]))
  const hasil = Array.from({ length: jumlahAdegan }, () => [])
  for (const a of jawaban?.adegan ?? []) {
    const i = Number(a.nomor) - 1
    if (!(i >= 0 && i < jumlahAdegan)) continue
    hasil[i] = [...new Set((a.klip ?? []).map((k) => peta.get(String(k).trim())).filter(Boolean))]
  }
  return hasil
}

/** Satu media per adegan (bentuk lama, dipakai uji). */
export function pilihMedia(adegan, bank, seed = 0) {
  return pilihShot(adegan, bank, seed).map((xs) => xs[0])
}

/** Potongan sesingkat apa pun minimal sekian detik — di bawahnya mata belum sempat menangkap gambar. */
export const MIN_SHOT = 1.0

/** Banyak potongan per adegan menurut tempo gaya. */
export function jumlahShot(durasiSuara, gaya = GAYA_BAWAAN, opsi = {}) {
  // Sinematik: durasi adegan dari naskah/ketukan (bukan suara), tempo dari gaya.sinematik.
  const maks = opsi.tetap ? gaya.sinematik?.maksShot ?? gaya.maksShot : gaya.maksShot
  return durasiSuara.map((d) => {
    const durasi = opsi.tetap ? Math.max(MIN_SHOT, Number(d) || 0) : Math.max(MIN_ADEGAN, (Number(d) || 0) + JEDA)
    return Math.max(1, Math.min(Math.ceil(durasi / maks - 1e-9), Math.floor(durasi / MIN_SHOT)))
  })
}

/**
 * Detik mulai klip video. `ke` = berapa kali klip ini SUDAH dipakai di video
 * ini: pemakaian berikutnya maju sepanjang potongan, supaya dua potongan dari
 * klip yang sama tidak menampilkan gambar yang persis sama (render uji 14 Nov).
 */
function mulaiVideo(m, durasi, ke = 0) {
  const panjang = Number(m.durasi) || 0
  if (panjang < durasi) return { mulaiKlip: 0, ulang: true }
  const k = m.kurasi
  let dasar
  if (k && Number(k.terbaik_akhir) > Number(k.terbaik_mulai)) dasar = Number(k.terbaik_mulai)
  else if (panjang > durasi + 0.5) dasar = (panjang - durasi) / 2
  else dasar = 0
  const ruang = panjang - durasi
  // Maju lalu memutar di dalam ruang yang tersedia.
  const mulai = ruang > 0 ? (dasar + ke * durasi) % (ruang + 1e-9) : 0
  return { mulaiKlip: Math.max(0, Math.round(Math.min(mulai, ruang) * 100) / 100), ulang: false }
}

/**
 * Lini masa. `media[i]` = satu media atau array media (potongan adegan i).
 * Memulangkan { segmen (potongan gambar), adegan (waktu narasi), penutup, total }.
 * opsi.tetap = sinematik: `durasiSuara` adalah durasi adegan itu sendiri (tanpa jeda kalimat).
 */
export function rencana(adegan, durasiSuara, media, opsi = {}) {
  let t = 0
  const segmen = []
  const waktuAdegan = []
  const dipakai = new Map()
  adegan.forEach((a, i) => {
    const durasi = opsi.tetap
      ? Math.round(Math.max(MIN_SHOT, Number(durasiSuara[i]) || 0) * 100) / 100
      : Math.round(Math.max(MIN_ADEGAN, (Number(durasiSuara[i]) || 0) + JEDA) * 100) / 100
    waktuAdegan.push({
      mulai: t, durasi, bicara: opsi.tetap ? 0 : Number(durasiSuara[i]) || 0, suara: a.suara ?? '',
      teksLayar: a.teks_layar ?? '', gayaTeks: a.gaya_teks ?? null,
    })
    const shot = Array.isArray(media[i]) ? media[i] : [media[i]]
    let sisa = durasi
    shot.forEach((m, k) => {
      const d = k === shot.length - 1 ? Math.round(sisa * 100) / 100 : Math.round((durasi / shot.length) * 100) / 100
      sisa -= d
      const ke = dipakai.get(m.path) ?? 0
      dipakai.set(m.path, ke + 1)
      const v = m.jenis === 'video' ? mulaiVideo(m, d, ke) : { mulaiKlip: 0, ulang: false }
      segmen.push({ indeks: segmen.length, adegan: i, sumber: m.path, jenis: m.jenis, mulai: Math.round(t * 100) / 100, durasi: d, ...v })
      t += d
    })
  })
  let penutup = null
  if (opsi.logo) {
    penutup = { mulai: Math.round(t * 100) / 100, durasi: DURASI_PENUTUP }
    segmen.push({
      indeks: segmen.length, adegan: -1, sumber: opsi.logo, jenis: 'foto', mulai: penutup.mulai, durasi: DURASI_PENUTUP,
      mulaiKlip: 0, ulang: false, penutup: true, latar: opsi.latarPenutup ?? 'black',
    })
    t += DURASI_PENUTUP
  }
  return { segmen, adegan: waktuAdegan, penutup, total: Math.round(t * 100) / 100 }
}

// ------------------------------------------------------------------ ASS

function waktuAss(detik) {
  const cs = Math.max(0, Math.round(detik * 100))
  const j = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return `${j}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}

const bersihAss = (t) => String(t ?? '').replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim()

/** Teks aman untuk ASS: kurung kurawal & backslash dibuang, baris dibungkus. */
export function teksAss(teks, lebar = 26) {
  const bersih = bersihAss(teks)
  const kata = bersih.split(' ')
  const bungkus = (l) => {
    const baris = []
    let kini = ''
    for (const k of kata) {
      if ((kini + ' ' + k).trim().length > l && kini) { baris.push(kini); kini = k }
      else kini = (kini + ' ' + k).trim()
    }
    if (kini) baris.push(kini)
    return baris
  }
  let baris = bungkus(lebar)
  // Diseimbangkan: lebar terkecil yang tetap menghasilkan jumlah baris yang sama, supaya
  // tidak ada satu kata yatim di baris akhir ("1 pesan baru: Kopi / Lek", render 15 Nov).
  for (let l = Math.ceil(bersih.length / baris.length); l < lebar; l++) {
    const coba = bungkus(l)
    if (coba.length === baris.length) { baris = coba; break }
  }
  return baris.join('\\N')
}

/**
 * Kalimat → potongan caption (≤ maksKata kata, ≤ maksHuruf huruf). Satu kata pendek yang
 * tersisa di ujung digabung ke potongan sebelumnya supaya tidak berkedip sendirian.
 */
export function potongKata(teks, maksKata = 3, maksHuruf = 18) {
  const hasil = []
  let kini = []
  for (const k of bersihAss(teks).split(' ').filter(Boolean)) {
    if (kini.length && (kini.length >= maksKata || [...kini, k].join(' ').length > maksHuruf)) {
      hasil.push(kini.join(' '))
      kini = [k]
    } else kini.push(k)
  }
  if (kini.length) hasil.push(kini.join(' '))
  const ujung = hasil.at(-1)
  const gabung = `${hasil.at(-2)} ${ujung}`
  if (hasil.length > 1 && !ujung.includes(' ') && ujung.length <= 6 && gabung.length <= maksHuruf) hasil.splice(-2, 2, gabung)
  return hasil
}

/**
 * Waktu tiap potongan: masa bicara adegan dibagi menurut panjang teks (narasi tidak punya
 * penanda waktu per kata). Potongan terakhir bertahan sampai adegan selesai.
 */
export function waktuPotongan(a, potongan) {
  const bicara = a.bicara > 0 ? Math.min(a.bicara, a.durasi) : Math.max(0.5, a.durasi - JEDA)
  const bobot = potongan.map((p) => p.length + 4)
  const total = bobot.reduce((s, x) => s + x, 0)
  let t = a.mulai
  return potongan.map((p, i) => {
    const mulai = t
    t += (bicara * bobot[i]) / total
    return { mulai, akhir: i === potongan.length - 1 ? a.mulai + a.durasi - 0.05 : t, teks: p }
  })
}

const warnaTag = (hex) => {
  const h = String(hex).replace('#', '')
  return `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase()
}

/** Kata berangka (harga, jam, jumlah) diberi warna aksen — mata langsung menangkapnya. */
export function beriAksen(teks, aksen, utama) {
  return teks.split(' ').map((k) => (/\d/.test(k) ? `{\\1c${warnaTag(aksen)}}${k}{\\1c${warnaTag(utama)}}` : k)).join(' ')
}

/**
 * Subtitle (per potongan kata atau per kalimat), teks layar di awal adegannya, dan kartu
 * penutup — huruf, ukuran, warna, kotak, dan posisi dari gaya.
 */
export function buatAss(r, opsi = {}) {
  const g = opsi.gaya ?? GAYA_BAWAAN
  const penutup = opsi.penutup ?? 'Lek Kopi Waru\\NGoFood · ShopeeFood · GrabFood'
  // Caption per potongan hanya 2–3 kata, jadi boleh jauh lebih besar dari subtitle sekalimat.
  const sub = g.subtitle.mode === 'potongan' ? { ...g.subtitle, ukuran: Math.max(g.subtitle.ukuran, 92) } : g.subtitle
  // BorderStyle 3 = kotak di belakang teks: warnanya dari OutlineColour dan
  // tebal Outline = jarak tepi kotak (render uji 14 Nov: Outline 0 → kotak tak terlihat).
  // BorderStyle 1 = garis tepi hitam biasa.
  const gayaSub = sub.kotak ? `3,16,0` : `1,6,3`
  const tepiSub = sub.kotak ? '&H50000000' : '&H00000000'
  // Bawah dinaikkan ke 480 px: ±350 px terbawah tertutup caption & tombol TikTok/Reels.
  const posisi = sub.posisi === 'tengah' ? `5,70,70,0` : `2,70,70,480`
  const tl = g.teksLayar
  const lebarSub = Math.max(16, Math.round(26 * 64 / sub.ukuran))
  const lebarTl = Math.max(8, Math.round(14 * 104 / tl.ukuran))
  const jd = g.judul ?? GAYA_BAWAAN.judul
  // Huruf stok (lib/huruf.mjs) sudah tebal dari sananya: tebal tiruan libass malah membuatnya berlepotan.
  const b = g.huruf?.bundel ? 0 : -1
  const tebal = g.huruf?.tebal ?? 'Arial Black'
  const baris = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${LEBAR}`, `PlayResY: ${TINGGI}`, 'WrapStyle: 2', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Sub,${sub.huruf},${sub.ukuran},${warnaAss(sub.warna)},&H00FFFFFF,${tepiSub},&H8C000000,${b},0,0,0,100,100,0,0,${gayaSub},${posisi},1`,
    // Judul di atas kotak gelap (seperti pita "Grand Opening" di video referensi).
    `Style: Layar,${tl.huruf},${tl.ukuran},${warnaAss(tl.warna)},&H00FFFFFF,&H33000000,&H64000000,${b},0,0,0,100,100,0,0,3,20,0,8,60,60,300,1`,
    `Style: Penutup,${tebal},78,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,${b},0,0,0,100,100,0,0,1,6,2,2,60,60,420,1`,
    // Sinematik: judul serif besar sedikit di atas tengah (bayangan lembut, tanpa kotak);
    // cerita = teks tebal di tengah; kutipan = serif miring kecil di bawah.
    `Style: Judul,${jd.huruf},${jd.ukuran},${warnaAss(jd.warna)},&H00FFFFFF,&H00000000,&H78000000,${b},0,0,0,100,100,2,0,1,2,4,5,70,70,0,1`,
    `Style: Cerita,${tebal},84,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,${b},0,0,0,100,100,0,0,1,5,3,5,80,80,0,1`,
    `Style: Kutipan,${jd.huruf},58,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,-1,0,0,100,100,1,0,1,2,3,2,90,90,520,1`,
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ]
  for (const a of r.adegan ?? []) {
    const akhir = a.mulai + a.durasi
    if (a.suara && sub.mode === 'potongan') {
      // Muncul dengan sedikit membesar (88% → 100% dalam 0,1 dtk) — gaya caption Reels.
      // WrapStyle 2 tidak membungkus sendiri: batas huruf mengikuti ukuran supaya muat di layar.
      for (const p of waktuPotongan(a, potongKata(a.suara, 3, Math.max(8, Math.floor(16 * 92 / sub.ukuran))))) {
        baris.push(`Dialogue: 0,${waktuAss(p.mulai)},${waktuAss(p.akhir)},Sub,,0,0,0,,{\\fscx88\\fscy88\\t(0,100,\\fscx100\\fscy100)}${beriAksen(p.teks, sub.aksen, sub.warna)}`)
      }
    } else if (a.suara) {
      baris.push(`Dialogue: 0,${waktuAss(a.mulai)},${waktuAss(akhir - 0.05)},Sub,,0,0,0,,${teksAss(a.suara, lebarSub)}`)
    }
    if (a.teksLayar && ['judul', 'cerita', 'kutipan'].includes(a.gayaTeks)) baris.push(teksSinematik(a, jd))
    else if (a.teksLayar) baris.push(`Dialogue: 1,${waktuAss(a.mulai)},${waktuAss(Math.min(akhir, a.mulai + tl.durasi))},Layar,,0,0,0,,{\\fad(80,180)\\fscx70\\fscy70\\t(0,160,\\fscx100\\fscy100)}${teksAss(a.teksLayar, lebarTl)}`)
  }
  if (r.penutup) baris.push(`Dialogue: 0,${waktuAss(r.penutup.mulai)},${waktuAss(r.penutup.mulai + r.penutup.durasi)},Penutup,,0,0,0,,${penutup}`)
  return baris.join('\n') + '\n'
}

/**
 * Teks layar sinematik, tampil sepanjang adegannya. Judul "Coffee | time": bagian
 * sesudah "|" ditulis tangan berwarna aksen (seperti judul video referensi).
 */
function teksSinematik(a, jd) {
  const mulai = waktuAss(a.mulai + 0.15)
  const akhir = waktuAss(a.mulai + a.durasi - 0.1)
  if (a.gayaTeks === 'judul') {
    const [utama, tangan] = String(a.teksLayar).split('|').map((x) => bersihAss(x))
    const isi = tangan
      ? `${utama}\\N{\\fn${jd.tangan}\\b0\\fs${Math.round(jd.ukuran * 0.8)}\\1c${warnaAss(jd.aksen)}}${tangan}`
      : teksAss(utama, Math.max(8, Math.round(12 * 124 / jd.ukuran)))
    // Muncul perlahan sambil sedikit membesar, seperti judul film.
    return `Dialogue: 2,${mulai},${akhir},Judul,,0,0,0,,{\\fad(500,400)\\fscx94\\fscy94\\t(0,1200,\\fscx100\\fscy100)}${isi}`
  }
  if (a.gayaTeks === 'cerita') return `Dialogue: 2,${mulai},${akhir},Cerita,,0,0,0,,{\\fad(200,200)}${teksAss(a.teksLayar, 16)}`
  return `Dialogue: 2,${mulai},${akhir},Kutipan,,0,0,0,,{\\fad(400,300)}${teksAss(a.teksLayar, 30)}`
}

// --------------------------------------------------------- transisi (sinematik)

/** Nama transisi → filter xfade ffmpeg + lama (detik). 'potong' = satu bingkai saja. */
export const XFADE = {
  potong: { nama: 'fade', durasi: 1 / FPS },
  larut: { nama: 'fade', durasi: 0.5 },
  zoom: { nama: 'zoomin', durasi: 0.45 },
  kilat: { nama: 'fadewhite', durasi: 0.3 },
  geser: { nama: 'smoothleft', durasi: 0.4 },
}
const CAMPUR = ['larut', 'zoom', 'larut', 'kilat', 'geser']

/**
 * Transisi sesudah tiap segmen (yang terakhir tidak punya). 'campur': potongan di
 * dalam satu adegan dipotong biasa, antar-adegan bergiliran larut/zoom/kilat/geser,
 * masuk kartu penutup selalu larut. Lama transisi tidak melebihi 40% segmen terpendek.
 */
export function daftarTransisi(r, jenis = 'campur') {
  let ke = 0
  return r.segmen.slice(0, -1).map((s, i) => {
    const lanjut = r.segmen[i + 1]
    let nama
    if (lanjut.penutup) nama = 'larut'
    else if (jenis !== 'campur') nama = XFADE[jenis] ? jenis : 'larut'
    else if (lanjut.adegan === s.adegan) nama = 'potong'
    else nama = CAMPUR[ke++ % CAMPUR.length]
    const x = XFADE[nama]
    const durasi = Math.round(Math.min(x.durasi, 0.4 * Math.min(s.durasi, lanjut.durasi)) * 1000) / 1000
    return { jenis: nama, xfade: x.nama, durasi: Math.max(1 / FPS, durasi) }
  })
}

/**
 * Sambung segmen dengan xfade. Tiap segmen (kecuali terakhir) dirender lebih panjang
 * sebesar transisi sesudahnya, jadi transisi ke-k mulai tepat di akhir rencana segmen k:
 * offset_k = jumlah durasi segmen 0..k — lini masa & subtitle tidak bergeser.
 */
export function argSambung(berkas, durasi, transisi, keluar) {
  const masukan = ['-y']
  berkas.forEach((b) => masukan.push('-i', b))
  if (berkas.length === 1) return [...masukan, '-c', 'copy', keluar]
  const f = berkas.map((_, i) => `[${i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p[v${i}]`)
  let kiri = '[v0]'
  let t = 0
  transisi.forEach((x, k) => {
    t += durasi[k]
    const hasil = k === transisi.length - 1 ? '[v]' : `[x${k}]`
    f.push(`${kiri}[v${k + 1}]xfade=transition=${x.xfade}:duration=${x.durasi}:offset=${Math.round(t * 1000) / 1000}${hasil}`)
    kiri = hasil
  })
  return [...masukan, '-filter_complex', f.join(';'), '-map', '[v]', ...KODE, keluar]
}

/** Audio sinematik: musik saja (penuh, pudar masuk & keluar); tanpa musik = senyap. */
export function argMusik({ musik, total, keluar, volume = 0.9 }) {
  if (!musik) {
    return ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', String(total), '-c:a', 'pcm_s16le', keluar]
  }
  const keluarPudar = Math.max(0, Math.round((total - 2) * 100) / 100)
  return [
    '-y', '-stream_loop', '-1', '-i', musik,
    '-af', `aresample=44100,aformat=channel_layouts=stereo,atrim=0:${total},asetpts=PTS-STARTPTS,volume=${volume},afade=t=in:st=0:d=0.3,afade=t=out:st=${keluarPudar}:d=2`,
    '-t', String(total), '-c:a', 'pcm_s16le', keluar,
  ]
}

/** Musik → PCM mono 11025 Hz (s16le) untuk irama.cariKetukan; maks 90 detik. */
export function argPcm(musik, keluar) {
  return ['-y', '-i', musik, '-t', '90', '-ac', '1', '-ar', '11025', '-f', 's16le', keluar]
}

// ------------------------------------------------------------- ffmpeg

// Hasil selalu ditandai SDR BT.709: tanpa ini tanda HDR video iPhone terbawa ke MP4 8-bit
// dan HP/Telegram menampilkannya keliru (render 15 Nov 2026).
const KODE = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709']

// iPhone merekam HDR (HEVC 10-bit HLG, BT.2020); tanpa dipetakan warnanya pucat. hable +
// npl 203 (putih acuan HLG) dipilih dari perbandingan bingkai: alami, langit tidak pecah.
export const KE_SDR = 'zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p'

function ekor(s, g) {
  const f = []
  const w = filterWarna(g.filter)
  if (w) f.push(w)
  if (g.transisi === 'pudar' && s.durasi > PUDAR * 3) {
    f.push(`fade=t=in:st=0:d=${PUDAR}`, `fade=t=out:st=${Math.round((s.durasi - PUDAR) * 100) / 100}:d=${PUDAR}`)
  }
  return f.length ? ',' + f.join(',') : ''
}

/** Argumen ffmpeg untuk satu potongan gambar (tanpa suara). */
export function argSegmen(s, keluar, gaya = GAYA_BAWAAN) {
  const isi = `scale=${LEBAR}:${TINGGI}:force_original_aspect_ratio=increase,crop=${LEBAR}:${TINGGI},setsar=1`
  const n = Math.max(1, Math.round(s.durasi * FPS))
  if (s.penutup) {
    // Kartu penutup: logo utuh di tengah latar polos (bawaan hitam, menyatu
    // dengan logo Lek Kopi putih-di-hitam) — logo tidak boleh terpotong.
    return [
      '-y', '-loop', '1', '-t', String(s.durasi), '-i', s.sumber,
      '-vf', `scale=720:-2:force_original_aspect_ratio=decrease,pad=${LEBAR}:${TINGGI}:(ow-iw)/2:(oh-ih)/2-200:${s.latar ?? 'black'},setsar=1,fps=${FPS}`,
      '-frames:v', String(n), '-an', ...KODE, keluar,
    ]
  }
  if (s.jenis === 'video') {
    return [
      '-y', ...(s.ulang ? ['-stream_loop', '-1'] : []), '-ss', String(s.mulaiKlip), '-t', String(s.durasi), '-i', s.sumber,
      '-vf', `${s.hdr ? KE_SDR + ',' : ''}${isi},fps=${FPS}${s.tambal ? `,tpad=stop_mode=clone:stop_duration=${s.durasi}` : ''}${ekor(s, gaya)}`,
      '-an', ...KODE, '-t', String(s.durasi), keluar,
    ]
  }
  // Foto: satu bingkai diperbesar dulu supaya zoom tidak bergetar, lalu
  // zoompan membuat N bingkai dengan zoom 1 → 1+gaya.zoom.
  return [
    '-y', '-i', s.sumber,
    '-vf', `scale=${LEBAR * 2}:${TINGGI * 2}:force_original_aspect_ratio=increase,crop=${LEBAR * 2}:${TINGGI * 2},`
      + `zoompan=z='1+${gaya.zoom}*on/${n}':d=${n}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${LEBAR}x${TINGGI}:fps=${FPS},setsar=1${ekor(s, gaya)}`,
    '-frames:v', String(n), '-an', ...KODE, keluar,
  ]
}

/**
 * Tahap suara: suara per adegan (dipadatkan ke durasi adegannya; penutup
 * senyap) + musik pelan opsional → satu WAV sepanjang video.
 *
 * Dipisah dari tahap gambar dengan sengaja: di ffmpeg 9 (uji 14 Nov 2026)
 * rantai suara + subtitle + logo dalam SATU filter_complex gagal "Invalid data
 * found when processing input", padahal tiap rantai berjalan bila sendiri.
 */
export function argSuara({ suara, r, musik, keluar, gaya = GAYA_BAWAAN }) {
  const masukan = ['-y']
  suara.forEach((f) => masukan.push('-i', f))
  if (musik) masukan.push('-stream_loop', '-1', '-i', musik)

  const potong = [...r.adegan.map((a) => a.durasi), ...(r.penutup ? [r.penutup.durasi] : [])]
  const f = []
  const label = []
  potong.forEach((d, i) => {
    if (i < suara.length) {
      f.push(`[${i}:a]aresample=44100,aformat=channel_layouts=mono,apad,atrim=0:${d},asetpts=PTS-STARTPTS[a${i}]`)
    } else {
      f.push(`anullsrc=r=44100:cl=mono,atrim=0:${d},asetpts=PTS-STARTPTS[a${i}]`)
    }
    label.push(`[a${i}]`)
  })
  f.push(`${label.join('')}concat=n=${label.length}:v=0:a=1[suara]`)
  if (musik && gaya.musikVolume > 0) {
    f.push(`[${suara.length}:a]aresample=44100,aformat=channel_layouts=mono,volume=${gaya.musikVolume},atrim=0:${r.total},asetpts=PTS-STARTPTS[musik]`)
    f.push(`[suara][musik]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[audio]`)
  } else {
    f.push(`[suara]anull[audio]`)
  }
  return [...masukan, '-filter_complex', f.join(';'), '-map', '[audio]', '-t', String(r.total), '-c:a', 'pcm_s16le', keluar]
}

/** Detik pembuka saat logo besar tampil (intro); logo pojok baru muncul sesudahnya. */
export const DURASI_INTRO = 2.2

/**
 * Tahap gambar: video tersambung + subtitle ASS (+ logo) + WAV dari argSuara.
 * `huruf` = folder huruf relatif ke folder kerja (fontsdir libass).
 * `intro`: logo besar di atas tengah pada detik-detik pertama (pudar masuk & keluar),
 * lalu logo kecil di pojok sampai kartu penutup (`penutup` = detik mulainya; kartu sudah berlogo).
 */
export function argAkhir({ video, audio, total, ass, logo, keluar, huruf, intro = true, penutup = null }) {
  const masukan = ['-y', '-i', video, '-i', audio]
  // -loop 1: gambar logo jadi aliran terus-menerus. Tanpa itu logo hanya
  // tampil di bingkai awal (terbukti di render uji 14 Nov 2026).
  if (logo) masukan.push('-loop', '1', '-i', logo)
  const f = [`[0:v]subtitles=${ass}${huruf ? `:fontsdir=${huruf}` : ''}[vs]`]
  // Logo Lek Kopi putih di atas hitam: hitamnya dibuat tembus supaya tidak jadi kotak.
  const bening = 'colorkey=0x000000:0.3:0.15'
  const akhirPojok = penutup != null ? `*lt(t,${penutup})` : ''
  if (logo && intro) {
    const t = DURASI_INTRO
    f.push(`[2:v]format=rgba,${bening},split=2[la][lb]`)
    f.push(`[la]scale=170:-1,colorchannelmixer=aa=0.85[lg]`)
    // Bayangan lembut di belakang logo besar: logo putih tetap terbaca di atas dinding terang.
    f.push(`[lb]scale=430:-1,fade=t=in:st=0:d=0.45:alpha=1,fade=t=out:st=${t - 0.45}:d=0.45:alpha=1,split=2[it][ib]`)
    f.push(`[ib]colorchannelmixer=rr=0:gg=0:bb=0:aa=0.75,boxblur=14:2[ibb]`)
    f.push(`[vs][ibb]overlay=(W-w)/2+5:236:shortest=1:enable='lte(t,${t})'[v1]`)
    f.push(`[v1][it]overlay=(W-w)/2:230:shortest=1:enable='lte(t,${t})'[v0]`)
    f.push(`[v0][lg]overlay=W-w-48:72:shortest=1:enable='gte(t,${t})${akhirPojok}'[v]`)
  } else if (logo) {
    f.push(`[2:v]format=rgba,${bening},scale=170:-1,colorchannelmixer=aa=0.85[lg]`)
    f.push(`[vs][lg]overlay=W-w-48:72:shortest=1${akhirPojok ? `:enable='1${akhirPojok}'` : ''}[v]`)
  } else {
    f.push(`[vs]null[v]`)
  }
  return [
    ...masukan, '-filter_complex', f.join(';'), '-map', '[v]', '-map', '1:a',
    ...KODE, '-c:a', 'aac', '-b:a', '160k', '-t', String(total), '-movflags', '+faststart', keluar,
  ]
}

/**
 * Lembar kontak: `n` bingkai merata dari sebuah video (atau satu foto),
 * disusun `kolom` per baris — bahan "mata" AI (kurasi, referensi, pemeriksa).
 */
export function argLembar(sumber, { durasi = 0, n = 4, kolom = 2, lebar = 360, keluar }) {
  const baris = Math.ceil(n / kolom)
  if (!durasi) {
    return ['-y', '-i', sumber, '-vf', `scale=${lebar * 2}:-2`, '-frames:v', '1', '-q:v', '4', keluar]
  }
  const laju = Math.round((n / durasi) * 1000) / 1000
  return ['-y', '-i', sumber, '-vf', `fps=${laju},scale=${lebar}:-2,tile=${kolom}x${baris}`, '-frames:v', '1', '-q:v', '4', keluar]
}

/** Isi berkas daftar untuk concat demuxer (path relatif ke folder kerja). */
export function daftarConcat(berkas) {
  return berkas.map((b) => `file '${b.replace(/'/g, "'\\''")}'`).join('\n') + '\n'
}

/** SSML Azure untuk satu kalimat. */
export function ssml(teks, suara = 'id-ID-GadisNeural', laju = '+5%') {
  const aman = String(teks).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<speak version='1.0' xml:lang='id-ID'><voice name='${suara}'><prosody rate='${laju}'>${aman}</prosody></voice></speak>`
}

export { parameterGaya }
