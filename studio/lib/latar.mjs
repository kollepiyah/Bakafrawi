// Hapus latar gambar & video karakter maskot dengan model segmentasi MODNet (Apache-2.0, jalan di mesin
// sendiri lewat transformers.js — gratis, AI matting). Menggantikan chromakey ffmpeg yang rentan menghapus
// pakaian/tubuh karakter jika warnanya mirip latar (mis. baju abu/krem atau latar bukan hijau pekat).
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
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
 * Video karakter dari Veo / MP4 → WebM VP9 transparan dengan segmentasi AI (MODNet).
 * Menggunakan MODNet per-bingkai untuk menghapus latar belakang secara akurat tanpa
 * menghapus bagian tubuh/pakaian karakter (Opsi B: segmentasi AI utuh).
 * → { berkas, durasi, hijau }
 */
export async function videoTransparan(masuk, keluar, { maks = 8, bolakBalik = true, fps = 15 } = {}) {
  const info = await probe(masuk);
  const durasi = Math.min(maks, info.durasi || maks);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'maskot-modnet-'));
  const frameDir = path.join(tempDir, 'in');
  const outDir = path.join(tempDir, 'out');
  await mkdir(frameDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  try {
    // 1. Ekstrak bingkai video pada fps terukur (15 fps cukup halus untuk maskot loop di sudut)
    await ffmpeg([
      '-y',
      '-t', durasi.toFixed(2),
      '-i', masuk,
      '-vf', `scale=-2:min(720\\,ih),fps=${fps}`,
      path.join(frameDir, 'f_%05d.png'),
    ]);

    const daftarBerkas = (await readdir(frameDir)).filter((f) => f.endsWith('.png')).sort();
    if (!daftarBerkas.length) throw new Error('Gagal mengekstrak bingkai video maskot');

    // 2. Deteksi warna latar pojok pertama untuk informasi metadata
    const bingkai0 = path.join(frameDir, daftarBerkas[0]);
    const { data: dataWarna } = await sharp(bingkai0).extract({ left: 0, top: 0, width: 4, height: 4 }).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
    const warna = [...dataWarna.subarray(0, 3)];
    const hijau = warna[1] > warna[0] + 40 && warna[1] > warna[2] + 40;

    // 3. Proses tiap bingkai lewat MODNet (AI background removal)
    // Batch 4 bingkai bersamaan untuk efisiensi CPU
    const batch = 4;
    for (let i = 0; i < daftarBerkas.length; i += batch) {
      const potongan = daftarBerkas.slice(i, i + batch);
      await Promise.all(
        potongan.map(async (berkas) => {
          const jalurMasuk = path.join(frameDir, berkas);
          const jalurKeluar = path.join(outDir, berkas);
          try {
            const buf = await topeng(jalurMasuk);
            await writeFile(jalurKeluar, buf);
          } catch (err) {
            // Jika satu bingkai gagal, salin bingkai asli agar tidak bolong
            await copyFile(jalurMasuk, jalurKeluar);
          }
        })
      );
    }

    // 4. Hitung batas potong (bounding box) karakter agar tidak ada ruang kosong berlebih di pinggir
    const sampel = [
      daftarBerkas[0],
      daftarBerkas[Math.floor(daftarBerkas.length / 2)],
      daftarBerkas[daftarBerkas.length - 1],
    ].filter(Boolean);

    const kotak = [];
    for (const b of sampel) {
      try {
        const { info: p } = await sharp(path.join(outDir, b)).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
        kotak.push({ x: -(p.trimOffsetLeft ?? 0), y: -(p.trimOffsetTop ?? 0), w: p.width, h: p.height });
      } catch {}
    }

    const { lebar: lBaru, tinggi: tBaru } = await probe(path.join(outDir, daftarBerkas[0]));
    const k = kotak.length ? kotakGabung(kotak, lBaru, tBaru) : { x: 0, y: 0, w: lBaru, h: tBaru };

    // 5. Rakit kembali ke WebM VP9 dengan kanal alfa (transparan)
    const dasar = `crop=${k.w}:${k.h}:${k.x}:${k.y},scale=-2:min(1100\\,ih),fps=30,format=yuva420p`;
    const filter = bolakBalik
      ? `[0:v]${dasar},split[maju][b];[b]reverse[mundur];[maju][mundur]concat=n=2:v=1:a=0[v]`
      : `[0:v]${dasar}[v]`;

    await ffmpeg([
      '-y',
      '-framerate', String(fps),
      '-i', path.join(outDir, 'f_%05d.png'),
      '-filter_complex', filter,
      '-map', '[v]',
      '-an',
      '-c:v', 'libvpx-vp9',
      '-pix_fmt', 'yuva420p',
      '-b:v', '0',
      '-crf', '32',
      '-auto-alt-ref', '0',
      '-deadline', 'good',
      '-cpu-used', '4',
      keluar,
    ]);

    return { berkas: keluar, durasi: bolakBalik ? durasi * 2 : durasi, hijau };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
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
