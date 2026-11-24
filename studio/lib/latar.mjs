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
const MODEL_PRODUK = process.env.STUDIO_MODEL_PRODUK || 'briaai/RMBG-1.4';
const CACHE = process.env.STUDIO_MODEL_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.model');
let hapus = null;
let modelProduk = null;
let prosesorProduk = null;

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

/**
 * Pembersih tepi khusus produk (minuman/gelas/kemasan): TANPA green-despill agar warna hijau
 * (mis. Matcha / Pandan) tidak kusam, serta ambang alfa halus supaya tepi kaca tetap bersih.
 */
export function bersihkanTepiProduk(data, kanal = 4) {
  if (kanal !== 4) return data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a <= 18) data[i + 3] = 0;
    else if (a >= 242) data[i + 3] = 255;
    else data[i + 3] = Math.round(((a - 18) * 255) / 224);
  }
  return data;
}

/**
 * Buang serpihan kecil terpisah (noda meja, remah, bayangan liar) di luar objek produk utama.
 * Mempertahankan komponen terbesar dan komponen lain yang luasnya >= `rasioMin` dari objek utama.
 */
export function buangSerpihanKecil(data, lebar, tinggi, rasioMin = 0.06) {
  const total = lebar * tinggi;
  const label = new Int32Array(total);
  const antre = new Int32Array(total);
  const luas = [0];
  let idSekarang = 0;
  let maksLuas = 0;

  for (let idx = 0; idx < total; idx++) {
    if (label[idx] !== 0 || data[idx * 4 + 3] < 32) continue;
    idSekarang++;
    let kepala = 0;
    let ekor = 0;
    label[idx] = idSekarang;
    antre[ekor++] = idx;
    let hitung = 0;
    while (kepala < ekor) {
      const p = antre[kepala++];
      hitung++;
      const x = p % lebar;
      const y = (p - x) / lebar;
      if (x > 0) {
        const n = p - 1;
        if (label[n] === 0 && data[n * 4 + 3] >= 32) { label[n] = idSekarang; antre[ekor++] = n; }
      }
      if (x + 1 < lebar) {
        const n = p + 1;
        if (label[n] === 0 && data[n * 4 + 3] >= 32) { label[n] = idSekarang; antre[ekor++] = n; }
      }
      if (y > 0) {
        const n = p - lebar;
        if (label[n] === 0 && data[n * 4 + 3] >= 32) { label[n] = idSekarang; antre[ekor++] = n; }
      }
      if (y + 1 < tinggi) {
        const n = p + lebar;
        if (label[n] === 0 && data[n * 4 + 3] >= 32) { label[n] = idSekarang; antre[ekor++] = n; }
      }
    }
    luas.push(hitung);
    if (hitung > maksLuas) maksLuas = hitung;
  }

  if (maksLuas === 0) return { data, rasioTerisi: 0 };

  const ambang = Math.max(1, Math.floor(maksLuas * rasioMin));
  let terisi = 0;
  for (let idx = 0; idx < total; idx++) {
    const id = label[idx];
    if (id === 0) continue;
    if (luas[id] < ambang) {
      data[idx * 4 + 3] = 0;
    } else {
      terisi++;
    }
  }
  return { data, rasioTerisi: terisi / total };
}

/** Gambar produk (minuman/objek) → PNG transparan (Buffer) lewat briaai/RMBG-1.4. */
async function topengProduk(masuk) {
  const { AutoModel, AutoProcessor, RawImage, env } = await import('@huggingface/transformers');
  if (!modelProduk || !prosesorProduk) {
    env.cacheDir = CACHE;
    modelProduk = await AutoModel.from_pretrained(MODEL_PRODUK, {
      config: { model_type: 'custom' },
    });
    prosesorProduk = await AutoProcessor.from_pretrained(MODEL_PRODUK, {
      config: {
        do_normalize: true,
        do_pad: false,
        do_rescale: true,
        do_resize: true,
        image_mean: [0.5, 0.5, 0.5],
        feature_extractor_type: 'ImageFeatureExtractor',
        image_std: [1, 1, 1],
        resample: 2,
        rescale_factor: 0.00392156862745098,
        size: { width: 1024, height: 1024 },
      },
    });
  }

  // Normalkan orientasi EXIF & baca RGB mentah lewat sharp agar semua format (JPEG/PNG/WebP) aman.
  const { data: rgb, info } = await sharp(masuk).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const gambarRaw = new RawImage(new Uint8ClampedArray(rgb), info.width, info.height, 3);
  const { pixel_values } = await prosesorProduk(gambarRaw);
  const { output } = await modelProduk({ input: pixel_values });

  // Ekstrak peta alfa dari tensor keluaran [1, 1, H, W] atau [1, H, W] → Uint8 0..255.
  const tensorMask = output[0];
  const dims = tensorMask.dims;
  const maskH = dims[dims.length - 2];
  const maskW = dims[dims.length - 1];
  const maskFloat = tensorMask.data;
  const maskU8 = Buffer.allocUnsafe(maskW * maskH);
  for (let i = 0; i < maskU8.length; i++) {
    const v = maskFloat[i];
    maskU8[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
  }

  // Skala balik masker ke dimensi gambar asli (extractChannel(0) wajib agar sharp tetap 1-channel, bukan 3-channel sRGB).
  const alfaAsli = await sharp(maskU8, { raw: { width: maskW, height: maskH, channels: 1 } })
    .resize(info.width, info.height, { fit: 'fill', kernel: 'lanczos3' })
    .extractChannel(0)
    .raw()
    .toBuffer();

  const rgba = Buffer.allocUnsafe(info.width * info.height * 4);
  for (let i = 0, j = 0; i < alfaAsli.length; i++, j += 4) {
    const rIdx = i * 3;
    rgba[j] = rgb[rIdx];
    rgba[j + 1] = rgb[rIdx + 1];
    rgba[j + 2] = rgb[rIdx + 2];
    rgba[j + 3] = alfaAsli[i];
  }

  bersihkanTepiProduk(rgba, 4);
  const { rasioTerisi } = buangSerpihanKecil(rgba, info.width, info.height, 0.06);
  if (rasioTerisi < 0.025) {
    throw new Error(`Cutout produk terlalu tipis (${(rasioTerisi * 100).toFixed(1)}% piksel)`);
  }

  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** Gambar karakter → PNG transparan terpangkas. Gambar yang sudah transparan cukup dipangkas. */
export async function hapusLatar(masuk, keluar) {
  const png = (await sudahTransparan(masuk)) ? await sharp(masuk).png().toBuffer() : await topeng(masuk);
  // Pangkas ruang tembus pandang di keempat sisi (ambang 10 supaya sisa samar ikut terbuang).
  await sharp(png).trim({ threshold: 10 }).png().toFile(keluar);
  return keluar;
}

/**
 * Gambar produk (gelas minuman / kemasan) → PNG transparan terpangkas dengan RMBG-1.4.
 * Berbeda dari `hapusLatar` (MODNet khusus manusia), fungsi ini dirancang untuk objek produk utuh.
 */
export async function hapusLatarProduk(masuk, keluar) {
  const png = (await sudahTransparan(masuk)) ? await sharp(masuk).png().toBuffer() : await topengProduk(masuk);
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
