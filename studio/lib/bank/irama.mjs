// =====================================================================
//  irama.mjs — ketukan musik untuk video sinematik (KB §97).
//  MURNI: menerima sampel PCM (Int16, mono), tanpa ffmpeg — diuji dari supabase/uji.
//
//  Cara kerja: amplop energi per ±23 ms → lonjakan energi (onset) → tempo dari
//  autokorelasi lonjakan pada 70–160 BPM → fase terbaik → deret ketukan. Musik
//  yang ketukannya tidak jelas (yakin rendah) TIDAK dipaksa: potongan tetap
//  dibagi rata menurut naskah.
// =====================================================================

export const LAJU = 11025
export const YAKIN_MINIMAL = 0.2
const LOMPAT = 256

/** Lonjakan energi per bingkai (nilai ≥ 0). */
export function lonjakan(sampel, laju = LAJU) {
  const n = Math.floor(sampel.length / LOMPAT)
  const log = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let e = 0
    for (let j = i * LOMPAT; j < (i + 1) * LOMPAT; j++) e += sampel[j] * sampel[j]
    log[i] = Math.log(1e-9 + e / LOMPAT)
  }
  const o = new Float64Array(n)
  for (let i = 1; i < n; i++) o[i] = Math.max(0, log[i] - log[i - 1])
  return { o, detikPerBingkai: LOMPAT / laju }
}

/**
 * Ketukan musik. Memulangkan { bpm, ketukan: detik[], yakin } — `yakin` = seberapa
 * menonjol puncak tempo dibanding rata-rata (autokorelasi ternormal: derau ±0,05; di atas YAKIN_MINIMAL dipakai).
 */
export function cariKetukan(sampel, laju = LAJU) {
  const { o, detikPerBingkai } = lonjakan(sampel, laju)
  const n = o.length
  const kosong = { bpm: 0, ketukan: [], yakin: 0 }
  if (n < 200) return kosong
  const lagMin = Math.round(60 / 160 / detikPerBingkai)
  const lagMaks = Math.round(60 / 70 / detikPerBingkai)
  const rata = o.reduce((s, x) => s + x, 0) / n
  if (rata <= 0) return kosong
  let ragam = 0
  for (let i = 0; i < n; i++) ragam += (o[i] - rata) ** 2
  ragam /= n
  if (ragam <= 0) return kosong
  const skor = []
  for (let lag = lagMin; lag <= lagMaks; lag++) {
    let s = 0
    for (let i = lag; i < n; i++) s += (o[i] - rata) * (o[i - lag] - rata)
    skor.push({ lag, s: s / (n - lag) })
  }
  const terbaik = skor.reduce((a, b) => (b.s > a.s ? b : a))
  // Autokorelasi ternormal: derau ±0,05, ketukan jelas ≥ 0,3.
  const yakin = terbaik.s / ragam
  // Lag pecahan dari tiga titik di sekitar puncak (parabola), supaya deret ketukan tidak bergeser.
  const k = skor.indexOf(terbaik)
  let lag = terbaik.lag
  if (k > 0 && k < skor.length - 1) {
    const [a, b, c] = [skor[k - 1].s, skor[k].s, skor[k + 1].s]
    const bagi = a - 2 * b + c
    if (bagi < 0) lag += (0.5 * (a - c)) / bagi
  }
  // Fase: geser yang paling banyak jatuh di lonjakan.
  let fase = 0
  let maks = -1
  for (let f = 0; f < Math.ceil(lag); f++) {
    let s = 0
    for (let t = f; t < n; t += lag) s += o[Math.round(t)] ?? 0
    if (s > maks) { maks = s; fase = f }
  }
  // Tiap ketukan digeser ke lonjakan terbesar di dekatnya (±15% periode): tempo
  // yang meleset sedikit tidak menumpuk jadi geseran di akhir lagu.
  const ketukan = []
  const jangkau = Math.max(1, Math.round(lag * 0.15))
  for (let t = fase; t < n; t += lag) {
    const pusat = Math.round(t)
    let pilih = pusat
    for (let i = Math.max(0, pusat - jangkau); i <= Math.min(n - 1, pusat + jangkau); i++) if (o[i] > o[pilih]) pilih = i
    if (o[pilih] > rata) t += pilih - pusat
    ketukan.push(Math.round(t * detikPerBingkai * 1000) / 1000)
  }
  return { bpm: Math.round((60 / (lag * detikPerBingkai)) * 10) / 10, ketukan, yakin: Math.round(yakin * 100) / 100 }
}

/**
 * Durasi adegan → batas adegan jatuh tepat di ketukan terdekat. Tiap adegan
 * minimal `minimal` detik. Tanpa ketukan → durasi apa adanya.
 */
export function sesuaikanKeKetukan(durasi, ketukan, { minimal = 1.2 } = {}) {
  if (!ketukan?.length || !durasi.length) return durasi.slice()
  const hasil = []
  let awal = 0
  let rencana = 0
  for (const d of durasi) {
    rencana += d
    const calon = ketukan.filter((t) => t - awal >= minimal - 1e-9)
    if (!calon.length) { hasil.push(Math.round(d * 100) / 100); awal += d; continue }
    const pilih = calon.reduce((a, b) => (Math.abs(b - rencana) < Math.abs(a - rencana) ? b : a))
    hasil.push(Math.round((pilih - awal) * 100) / 100)
    awal = pilih
  }
  return hasil
}
