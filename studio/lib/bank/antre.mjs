// antre.mjs — aturan coba-ulang posting (murni; diuji dari supabase/uji).
//
// Posting yang gagal dulu diulang tiap 10 menit TANPA batas, dengan kabar
// Telegram setiap kali, dan selama menunggu seluruh Studio berhenti. Sekarang:
// paling banyak MAKS_COBA kali, jedanya dicatat per konten (konten lain dan
// render tetap jalan), lalu jatuh ke jalur unggah manual.
// Hitungannya di memori: Studio dinyalakan ulang = hitungan mulai lagi.

export const MAKS_COBA = 3
export const JEDA_COBA_MS = 10 * 60_000

/** Konten jatuh tempo pertama yang tidak sedang menunggu jeda coba-ulang. */
export function pilihJatuhTempo(daftar, tunda, kini = Date.now()) {
  return daftar.find((k) => (tunda.get(k.id)?.lagi ?? 0) <= kini) ?? null
}

/** Catat satu kegagalan. `habis` = jatah percobaan sudah terpakai semua. */
export function catatGagal(tunda, id, kini = Date.now()) {
  const ke = (tunda.get(id)?.ke ?? 0) + 1
  tunda.set(id, { ke, lagi: kini + JEDA_COBA_MS })
  return { ke, habis: ke >= MAKS_COBA }
}
