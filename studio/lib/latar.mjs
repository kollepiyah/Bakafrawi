// Hapus latar gambar karakter maskot dengan model segmentasi MODNet (Apache-2.0, jalan di mesin
// sendiri lewat transformers.js — gratis, ±2 dtk/gambar). Pengganti colorkey ffmpeg: gambar Google
// Flow berlatar abu-abu muda membuat sweter krem ikut bolong (video 19 Nov 2026). Hasil dipangkas ke
// tepi tubuh supaya karakter tak mengecil oleh ruang kosong di sekelilingnya.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ffmpeg, probe } from './bank/alat.mjs';

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

/** Gambar (berkas/Buffer) → PNG transparan (Buffer) lewat MODNet + pembersih tepi. */
async function topeng(masuk) {
  const { env, pipeline, RawImage } = await import('@huggingface/transformers');
  if (!hapus) {
    env.cacheDir = CACHE;
    hapus = await pipeline('background-removal', MODEL, { dtype: 'fp32' });
  }
  // Pipeline hanya menerima path/URL/RawImage: Buffer (bingkai video) diurai sharp jadi RGB mentah.
  let isi = masuk;
  if (Buffer.isBuffer(masuk)) {
    const { data, info } = await sharp(masuk).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    isi = new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3);
  }
  const r = await hapus(isi);
  const gambar = Array.isArray(r) ? r[0] : r;
  const data = bersihkanTepi(Buffer.from(gambar.data), gambar.channels);
  return sharp(data, { raw: { width: gambar.width, height: gambar.height, channels: gambar.channels } }).png().toBuffer();
}

/** Gambar karakter → PNG transparan terpangkas. Gambar yang sudah transparan cukup dipangkas. */
export async function hapusLatar(masuk, keluar) {
  const png = (await sudahTransparan(masuk)) ? await sharp(masuk).png().toBuffer() : await topeng(masuk);
  // Pangkas ruang tembus pandang di keempat sisi (ambang 10 supaya sisa samar ikut terbuang).
  await sharp(png).trim({ threshold: 10 }).png().toFile(keluar);
  return keluar;
}

/** Gabungan dua kotak {x,y,w,h} lalu diperlebar `tepi` (pecahan) & dijepit ke ukuran bingkai. Murni. */
export function kotakGabung(kotak, lebar, tinggi, tepi = 0.06) {
  const x0 = Math.min(...kotak.map((k) => k.x)), y0 = Math.min(...kotak.map((k) => k.y));
  const x1 = Math.max(...kotak.map((k) => k.x + k.w)), y1 = Math.max(...kotak.map((k) => k.y + k.h));
  const mx = (x1 - x0) * tepi, my = (y1 - y0) * tepi;
  const x = Math.max(0, Math.floor(x0 - mx)), y = Math.max(0, Math.floor(y0 - my));
  // Lebar & tinggi genap (syarat yuv420).
  const w = Math.min(lebar - x, Math.ceil(x1 + mx) - x) & ~1, h = Math.min(tinggi - y, Math.ceil(y1 + my) - y) & ~1;
  return { x, y, w, h };
}

/**
 * Video karakter dari Veo (latar hijau/polos) → WebM VP9 transparan, dipangkas ke kotak karakter.
 * Kotak dicari MODNet di 3 bingkai (awal/tengah/akhir) supaya tangan yang bergerak tak terpotong;
 * latar dibuang chromakey memakai warna pojok bingkai pertama (hijau terang paling bersih).
 * → { berkas, durasi }
 */
export async function videoTransparan(masuk, keluar, { maks = 10, bolakBalik = true } = {}) {
  const info = await probe(masuk);
  const durasi = Math.min(maks, info.durasi || maks);
  const kotak = [];
  let warna = null;
  for (const t of [0, durasi / 2, Math.max(0, durasi - 0.2)]) {
    const bingkai = await ffmpegKeluar(['-ss', t.toFixed(2), '-i', masuk, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-']);
    if (!warna) {
      const { data } = await sharp(bingkai).extract({ left: 0, top: 0, width: 4, height: 4 }).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
      warna = [...data.subarray(0, 3)];
    }
    const { info: p } = await sharp(await topeng(bingkai)).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
    kotak.push({ x: -(p.trimOffsetLeft ?? 0), y: -(p.trimOffsetTop ?? 0), w: p.width, h: p.height });
  }
  const k = kotakGabung(kotak, info.lebar, info.tinggi);
  const hex = `0x${warna.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  const hijau = warna[1] > warna[0] + 40 && warna[1] > warna[2] + 40;
  const dasar = [`crop=${k.w}:${k.h}:${k.x}:${k.y}`, `chromakey=${hex}:0.13:0.06`, ...(hijau ? ['despill=type=green'] : []), 'scale=-2:min(1100\\,ih)', 'fps=30', 'format=yuva420p'].join(',');
  // Bolak-balik (maju lalu mundur): video Veo 8 dtk diulang tanpa lompatan dari bingkai akhir ke awal.
  const filter = bolakBalik ? `[0:v]${dasar},split[maju][b];[b]reverse[mundur];[maju][mundur]concat=n=2:v=1:a=0[v]` : `[0:v]${dasar}[v]`;
  await ffmpeg(['-y', '-t', durasi.toFixed(2), '-i', masuk, '-filter_complex', filter, '-map', '[v]', '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '32', '-auto-alt-ref', '0', '-deadline', 'good', '-cpu-used', '4', keluar]);
  return { berkas: keluar, durasi: bolakBalik ? durasi * 2 : durasi, hijau };
}

/** ffmpeg yang keluarannya (stdout) dibutuhkan sebagai Buffer, mis. satu bingkai PNG. */
function ffmpegKeluar(args) {
  return new Promise((ok, gagal) => {
    const p = spawn(process.env.STUDIO_FFMPEG || 'ffmpeg', ['-v', 'error', ...args]);
    const buf = [];
    p.stdout.on('data', (d) => buf.push(d));
    p.on('error', gagal);
    p.on('close', (kode) => (kode === 0 ? ok(Buffer.concat(buf)) : gagal(new Error(`ffmpeg gagal mengambil bingkai video maskot (${kode})`))));
  });
}
