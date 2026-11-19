// Hapus latar gambar karakter maskot dengan model segmentasi MODNet (Apache-2.0, jalan di mesin
// sendiri lewat transformers.js — gratis, ±2 dtk/gambar). Pengganti colorkey ffmpeg: gambar Google
// Flow berlatar abu-abu muda membuat sweter krem ikut bolong (video 19 Nov 2026). Hasil dipangkas ke
// tepi tubuh supaya karakter tak mengecil oleh ruang kosong di sekelilingnya.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const MODEL = process.env.STUDIO_MODEL_LATAR || 'Xenova/modnet';
const CACHE = process.env.STUDIO_MODEL_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.model');
let hapus = null;

/** Sudah transparan bila punya kanal alfa dan ada piksel yang benar-benar tembus pandang. */
async function sudahTransparan(berkas) {
  const meta = await sharp(berkas).metadata();
  if (!meta.hasAlpha) return false;
  const { channels } = await sharp(berkas).stats();
  return channels[3].min < 10;
}

/**
 * Tepi hasil segmentasi masih membawa warna latar (pantulan hijau dari layar hijau Flow): di piksel
 * setengah tembus, kelebihan hijau dibuang dan alfa sedikit dirapatkan supaya tak ada lingkaran
 * cahaya. Mengubah `data` RGBA di tempat. Murni terhadap masukan.
 */
export function bersihkanTepi(data, kanal = 4) {
  if (kanal !== 4) return data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 255 || a === 0) continue;
    const batas = Math.max(data[i], data[i + 2]);
    if (data[i + 1] > batas) data[i + 1] = batas;
    data[i + 3] = Math.max(0, Math.min(255, Math.round(((a - 40) * 255) / 215)));
  }
  return data;
}

/** Gambar karakter → PNG transparan terpangkas. Gambar yang sudah transparan cukup dipangkas. */
export async function hapusLatar(masuk, keluar) {
  let png;
  if (await sudahTransparan(masuk)) {
    png = await sharp(masuk).png().toBuffer();
  } else {
    if (!hapus) {
      const { env, pipeline } = await import('@huggingface/transformers');
      env.cacheDir = CACHE;
      hapus = await pipeline('background-removal', MODEL, { dtype: 'fp32' });
    }
    const r = await hapus(masuk);
    const gambar = Array.isArray(r) ? r[0] : r;
    const data = bersihkanTepi(Buffer.from(gambar.data), gambar.channels);
    png = await sharp(data, { raw: { width: gambar.width, height: gambar.height, channels: gambar.channels } }).png().toBuffer();
  }
  // Pangkas ruang tembus pandang di keempat sisi (ambang 10 supaya sisa samar ikut terbuang).
  await sharp(png).trim({ threshold: 10 }).png().toFile(keluar);
  return keluar;
}
