// huruf.mjs — stok huruf Studio (folder ../huruf, lisensi OFL/Apache, KB §103).
//
// Tiap video memakai satu PAKET (tebal / judul serif / tulisan tangan) yang dipilih dari
// benih konten, jadi video berganti wajah tanpa campur aduk dalam satu video. Huruf ikut
// dibundel di repo supaya hasilnya sama di PC Windows dan di server GitHub (Linux).
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FOLDER_HURUF = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'huruf')

export const PAKET_HURUF = [
  { tebal: 'Anton', judul: 'Abril Fatface', tangan: 'Pacifico' },
  { tebal: 'Archivo Black', judul: 'DM Serif Display', tangan: 'Satisfy' },
  { tebal: 'Bebas Neue', judul: 'Yeseva One', tangan: 'Great Vibes' },
  { tebal: 'Lilita One', judul: 'Rozha One', tangan: 'Kalam' },
  { tebal: 'Paytone One', judul: 'Prata', tangan: 'Sacramento' },
  { tebal: 'Bowlby One', judul: 'Alfa Slab One', tangan: 'Courgette' },
  { tebal: 'Titan One', judul: 'Abril Fatface', tangan: 'Yellowtail' },
  { tebal: 'Luckiest Guy', judul: 'DM Serif Display', tangan: 'Permanent Marker' },
]

/** Paket ke-(benih mod jumlah paket). */
export function pilihPaket(benih) {
  return PAKET_HURUF[Math.abs(Math.trunc(Number(benih) || 0)) % PAKET_HURUF.length]
}

/**
 * Gaya + paket → gaya baru dengan huruf dari stok. Ukuran, warna, dan posisi hasil belajar
 * tetap; hanya nama huruf yang diganti. `tebal` dipakai juga untuk teks Cerita & Penutup.
 */
export function terapkanHuruf(gaya, paket) {
  return {
    ...gaya,
    subtitle: { ...gaya.subtitle, huruf: paket.tebal },
    teksLayar: { ...gaya.teksLayar, huruf: paket.tebal },
    judul: { ...gaya.judul, huruf: paket.judul, tangan: paket.tangan },
    huruf: { ...paket, bundel: true },
  }
}
