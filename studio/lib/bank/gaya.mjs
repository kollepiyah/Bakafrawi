// =====================================================================
//  gaya.mjs — "gaya Lek Kopi" & kurasi bank sebagai angka render (KB §81).
//  MURNI: tanpa berkas/jaringan, diuji dari supabase/uji.
//
//  Keluaran AI selalu lewat sini sebelum dipakai: nilai di luar batas
//  dijepit, pilihan yang tidak dikenal kembali ke bawaan. Jadi video tidak
//  pernah rusak gara-gara AI menjawab ngawur.
// =====================================================================

const jepit = (v, min, maks, bawaan) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(maks, Math.max(min, n)) : bawaan
}
const salahSatu = (v, pilihan, bawaan) => (pilihan.includes(v) ? v : bawaan)

export const HURUF = ['Arial', 'Arial Black', 'Impact', 'Segoe UI', 'Segoe UI Black', 'Verdana', 'Tahoma']
// Huruf judul sinematik: semuanya bawaan Windows, jadi tidak perlu dipasang (judul serif + tulisan tangan
// seperti "Coffee time" di video referensi).
export const HURUF_JUDUL = ['Georgia', 'Palatino Linotype', 'Cambria', 'Times New Roman', ...HURUF]
export const HURUF_TANGAN = ['Segoe Script', 'Ink Free', 'Gabriola']
// potong/pudar = mode narasi lama; sisanya transisi xfade antar-klip (rakit.daftarTransisi).
export const TRANSISI = ['potong', 'pudar', 'larut', 'zoom', 'kilat', 'geser', 'campur']
export const FILTER = ['asli', 'hangat', 'kontras', 'sejuk', 'hitamputih', 'sinematik']

export const GAYA_BAWAAN = {
  maksShot: 3.5,           // detik; adegan lebih panjang dipecah jadi beberapa potongan
  transisi: 'potong',      // 'potong' | 'pudar'
  zoom: 0.08,              // besar zoom foto (1 → 1+zoom)
  filter: 'asli',
  musikVolume: 0.12,
  // potongan = 2–3 kata sekali tampil (gaya caption TikTok/Reels); kalimat = satu kalimat penuh.
  subtitle: { huruf: 'Arial Black', ukuran: 76, posisi: 'bawah', kotak: false, warna: '#FFFFFF', mode: 'potongan', aksen: '#FFD54A' },
  teksLayar: { huruf: 'Arial Black', ukuran: 104, durasi: 1.8, warna: '#FFFFFF' },
  // Video sinematik (tanpa narasi): transisi antar-klip, musik penuh, judul serif.
  sinematik: { transisi: 'campur', musikVolume: 0.9, maksShot: 2.8 },
  judul: { huruf: 'Georgia', tangan: 'Segoe Script', ukuran: 146, warna: '#FFFFFF', aksen: '#F5C77E' },
}

/**
 * Profil dari AI (atau kosong) → parameter render yang aman. `timpa` = pilihan Kyai di .env
 * (mis. STUDIO_FILTER) yang mengalahkan hasil belajar AI.
 */
export function parameterGaya(profil = {}, timpa = {}) {
  const p = profil?.render ?? profil ?? {}
  const sub = p.subtitle ?? {}
  const tl = p.teks_layar ?? p.teksLayar ?? {}
  const sin = p.sinematik ?? {}
  const jd = p.judul ?? {}
  const B = GAYA_BAWAAN
  return {
    maksShot: jepit(p.maks_shot ?? p.maksShot, 0.8, 6, B.maksShot),
    transisi: salahSatu(p.transisi, TRANSISI, B.transisi),
    zoom: jepit(p.zoom, 0, 0.2, B.zoom),
    filter: salahSatu(timpa.filter, FILTER, salahSatu(p.filter, FILTER, B.filter)),
    musikVolume: jepit(p.musik_volume ?? p.musikVolume, 0, 0.4, B.musikVolume),
    subtitle: {
      huruf: salahSatu(sub.huruf, HURUF, B.subtitle.huruf),
      // Minimal 64: profil hasil belajar sempat memilih 44 dan terlalu kecil di HP (keluhan Kyai 15 Nov).
      ukuran: Math.round(jepit(sub.ukuran, 64, 110, B.subtitle.ukuran)),
      posisi: salahSatu(sub.posisi, ['bawah', 'tengah'], B.subtitle.posisi),
      kotak: typeof sub.kotak === 'boolean' ? sub.kotak : B.subtitle.kotak,
      warna: /^#[0-9a-f]{6}$/i.test(sub.warna ?? '') ? sub.warna : B.subtitle.warna,
      mode: salahSatu(sub.mode, ['potongan', 'kalimat'], B.subtitle.mode),
      aksen: /^#[0-9a-f]{6}$/i.test(sub.aksen ?? '') ? sub.aksen : B.subtitle.aksen,
    },
    teksLayar: {
      huruf: salahSatu(tl.huruf, HURUF, B.teksLayar.huruf),
      ukuran: Math.round(jepit(tl.ukuran, 80, 140, B.teksLayar.ukuran)),
      durasi: jepit(tl.durasi, 0.8, 4, B.teksLayar.durasi),
      warna: /^#[0-9a-f]{6}$/i.test(tl.warna ?? '') ? tl.warna : B.teksLayar.warna,
    },
    sinematik: {
      // Transisi sinematik: 'potong'/'pudar' hasil belajar mode narasi tidak dipakai di sini.
      transisi: salahSatu(timpa.transisi, TRANSISI.slice(2), salahSatu(sin.transisi, TRANSISI.slice(2), B.sinematik.transisi)),
      musikVolume: jepit(sin.musik_volume ?? sin.musikVolume, 0.3, 1, B.sinematik.musikVolume),
      maksShot: jepit(sin.maks_shot ?? sin.maksShot, 1.2, 5, B.sinematik.maksShot),
    },
    judul: {
      huruf: salahSatu(jd.huruf, HURUF_JUDUL, B.judul.huruf),
      tangan: salahSatu(jd.tangan, HURUF_TANGAN, B.judul.tangan),
      ukuran: Math.round(jepit(jd.ukuran, 90, 160, B.judul.ukuran)),
      warna: /^#[0-9a-f]{6}$/i.test(jd.warna ?? '') ? jd.warna : B.judul.warna,
      aksen: /^#[0-9a-f]{6}$/i.test(jd.aksen ?? '') ? jd.aksen : B.judul.aksen,
    },
  }
}

/** '#RRGGBB' → warna ASS '&H00BBGGRR'. */
export function warnaAss(hex, alfa = '00') {
  const h = String(hex).replace('#', '')
  return `&H${alfa}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase()
}

/** Filter warna ffmpeg (tanpa koma di depan); '' untuk asli. */
export function filterWarna(nama) {
  return {
    hangat: 'eq=saturation=1.15:gamma_r=1.05:gamma_b=0.93',
    kontras: 'eq=contrast=1.12:saturation=1.12',
    sejuk: 'eq=saturation=1.05:gamma_b=1.06:gamma_r=0.96',
    hitamputih: 'hue=s=0,eq=contrast=1.1',
    // Teal-oranye ala video Grand Opening Lek Kopi: bayangan kebiruan, terang kejinggaan, tepi agak gelap.
    sinematik: 'colorbalance=rs=-0.06:gs=-0.01:bs=0.07:rh=0.07:gh=0.02:bh=-0.07,eq=contrast=1.06:saturation=1.12:brightness=0.03,vignette=angle=PI/7',
  }[nama] ?? ''
}

// --------------------------------------------------------------- kurasi

/** Rapikan jawaban kurasi AI untuk satu berkas. */
export function normalKurasi(k = {}, info = {}) {
  const durasi = Number(info.durasi) || 0
  let mulai = jepit(k.terbaik_mulai, 0, Math.max(0, durasi - 0.5), 0)
  let akhir = jepit(k.terbaik_akhir, 0, durasi || 0, durasi || 0)
  if (info.jenis !== 'video') { mulai = 0; akhir = 0 }
  if (akhir <= mulai) akhir = durasi
  return {
    deskripsi: String(k.deskripsi ?? '').slice(0, 300),
    kata_kunci: (Array.isArray(k.kata_kunci) ? k.kata_kunci : []).map((x) => String(x).toLowerCase().slice(0, 30)).slice(0, 12),
    kualitas: Math.round(jepit(k.kualitas, 1, 5, 3)),
    tegak: !!k.tegak,
    ada_teks: !!k.ada_teks,
    terbaik_mulai: Math.round(mulai * 10) / 10,
    terbaik_akhir: Math.round(akhir * 10) / 10,
  }
}

const kata = (s) => new Set(String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2))

/**
 * Skor kecocokan media untuk satu adegan: kualitas kurasi + kata yang sama
 * antara narasi/teks layar dan deskripsi/kata kunci, dikurangi kalau sudah
 * dipakai di video ini. Media tanpa kurasi bernilai netral (3).
 */
export function skorMedia(m, adegan, terpakai = 0) {
  const k = m.kurasi ?? {}
  const kualitas = Number(k.kualitas) || 3
  const sasaran = kata(`${adegan.suara ?? ''} ${adegan.bidikan ?? ''} ${adegan.teks_layar ?? ''}`)
  const isi = kata(`${k.deskripsi ?? ''} ${(k.kata_kunci ?? []).join(' ')}`)
  let cocok = 0
  for (const w of sasaran) if (isi.has(w)) cocok++
  const teksPenghalang = k.ada_teks ? 0.5 : 0
  // Klip video bergerak lebih diutamakan daripada foto diam (+2.5 skor) agar konten lebih hidup
  const bonusVideo = m.jenis === 'video' ? 2.5 : 0
  // Penalti pakai-ulang lebih besar dari selisih skor terbesar: klip lain yang belum
  // dipakai selalu didahulukan, walau kualitasnya lebih rendah.
  return kualitas * 2 + Math.min(cocok, 4) * 1.5 + bonusVideo - terpakai * 12 - teksPenghalang
}

// ------------------------------------------------------------ referensi

/** Waktu potongan dari keluaran `select='gt(scene,X)',showinfo` ffmpeg. */
export function waktuPotong(stderr) {
  const t = []
  for (const m of String(stderr).matchAll(/pts_time:([0-9.]+)/g)) t.push(Number(m[1]))
  return t.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
}

export function ringkasPotong(potong, durasi) {
  const batas = [0, ...potong.filter((x) => x > 0.2 && x < durasi - 0.2), durasi]
  const shot = []
  for (let i = 1; i < batas.length; i++) shot.push(batas[i] - batas[i - 1])
  const r = (x) => Math.round(x * 100) / 100
  return {
    jumlah: shot.length,
    rata_rata: r(shot.reduce((s, x) => s + x, 0) / (shot.length || 1)),
    terpendek: r(Math.min(...shot)),
    terpanjang: r(Math.max(...shot)),
  }
}

/** Bobot performa video referensi: lebih banyak penonton/interaksi → lebih berpengaruh. */
export function bobotReferensi(stat = {}) {
  const tayang = Number(stat.tayangan ?? stat.views ?? 0)
  const interaksi = Number(stat.suka ?? 0) + 2 * Number(stat.komentar ?? 0) + 3 * Number(stat.simpan ?? 0) + 3 * Number(stat.bagikan ?? 0)
  return 1 + Math.log10(1 + tayang / 100) + Math.log10(1 + interaksi)
}
