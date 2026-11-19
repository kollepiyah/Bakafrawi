// Video iklan produk lewat Remotion (studio/remotion), dipilih Kyai 19 Nov 2026: naskah Claude
// (adegan datar) dirapikan jadi props `Naskah`, narasi edge-tts + waktu tiap kata dibuat per adegan,
// aset disalin ke folder publik tugas, lalu `remotion render` dijalankan dengan --public-dir.
import { spawn } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffmpeg, jalankan } from './bank/alat.mjs';
import { musikContoh, suaraKata } from './iklan.mjs';
import { FPS, hitungWaktu } from '../remotion/src/data/script.ts';

export const REMOTION = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'remotion');
const CLI = path.join(REMOTION, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');

// Aset video dikelola Kyai di Google Drive (bukan di laptop): maskot/ dan musik/ disalin ke
// studio/aset/ sekali per putaran lewat rclone (remote gdrive yang sama dengan bank media).
export const ASET_DRIVE = process.env.STUDIO_DRIVE_ASET || 'gdrive:Bakafrawi Studio/Aset';
export const ASET_LOKAL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'aset');
let asetDisalin = false;

/** Salin maskot/ & musik/ dari Drive (hanya yang baru/berubah). Gagal → pakai yang sudah ada saja. */
export async function salinAsetDrive({ jalan = (a) => jalankan(process.env.STUDIO_RCLONE || 'rclone', a), log = console.log } = {}) {
  if (asetDisalin) return;
  asetDisalin = true;
  for (const bagian of ['maskot', 'musik']) {
    try {
      await jalan(['copy', `${ASET_DRIVE}/${bagian}`, path.join(ASET_LOKAL, bagian), '--max-size', '60M', '--drive-skip-gdocs']);
    } catch (e) {
      log(`Aset ${bagian} dari Drive tak tersalin: ${String(e.message).slice(0, 160)}`);
    }
  }
}

/** Musik latar: satu lagu acak dari aset/musik supaya tiap video tak terdengar sama. Murni. */
export function pilihMusik(berkasAda, acak = Math.random) {
  const lagu = berkasAda.filter((b) => /\.(mp3|m4a|wav|aac|ogg)$/i.test(b)).sort();
  return lagu.length ? lagu[Math.floor(acak() * lagu.length) % lagu.length] : null;
}

/**
 * Berkas maskot merek: aset/maskot/<slug merek>.(webm|mov|mp4|png|webp|jpg|jpeg), cadangan
 * bakafrawi.*. Yang bergerak didahulukan, lalu yang sudah transparan, JPG terakhir. Huruf besar/kecil
 * nama berkas diabaikan (unggahan HP sering ".JPG"). Murni terhadap daftar berkas yang ada.
 */
export function pilihMaskot(berkasAda, slug) {
  const ext = ['webm', 'mov', 'mp4', 'png', 'webp', 'jpg', 'jpeg'];
  for (const nama of [slug, 'bakafrawi'].filter(Boolean)) {
    for (const e of ext) {
      const ada = berkasAda.find((b) => b.toLowerCase() === `${nama}.${e}`.toLowerCase());
      if (ada) return ada;
    }
  }
  return null;
}

/**
 * JPG tak punya latar transparan: latar polos (warna diambil dari piksel pojok kiri atas) dibuang
 * dengan colorkey ffmpeg → PNG transparan. Cocok untuk karakter di latar polos/putih.
 */
export async function jpgKePng(masuk, keluar) {
  const piksel = await new Promise((ok, gagal) => {
    const p = spawn(process.env.STUDIO_FFMPEG || 'ffmpeg', ['-v', 'error', '-i', masuk, '-vf', 'crop=4:4:0:0,scale=1:1', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    const buf = [];
    p.stdout.on('data', (d) => buf.push(d));
    p.on('error', gagal);
    p.on('close', (k) => (k === 0 ? ok(Buffer.concat(buf)) : gagal(new Error(`ffmpeg gagal membaca warna latar maskot (${k})`))));
  });
  const warna = `0x${[...piksel.subarray(0, 3)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  await ffmpeg(['-y', '-i', masuk, '-vf', `format=rgba,colorkey=${warna}:0.16:0.08`, keluar]);
  return keluar;
}

export const WARNA = { utama: '#0F2A5F', kedua: '#F5B800', latar: '#FAFAFA', kisi: '#EAEAEA', tinta: '#0B0B0F' };
const DURASI = { hook: 5, layar: 7, kasir: 9, alur: 9, daftar: 9, penutup: 6 };

const teks = (v, maks = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, maks);
const daftarTeks = (v, maks, panjang = 60) => (Array.isArray(v) ? v : []).map((x) => teks(x, panjang)).filter(Boolean).slice(0, maks);
const angka01 = (v, bawaan) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : bawaan);

/**
 * Keluaran Claude (adegan datar berisi semua kolom) → props `Naskah` Remotion yang aman dirender.
 * Adegan yang datanya kurang diganti `daftar` dari fitur produk; penutup selalu ada di akhir dengan
 * kontak dari situs (bukan dari Claude, supaya nomor/alamat tak pernah dikarang). Murni.
 */
export function keNaskah(k, { nama, logo, utama = WARNA.utama, kedua = WARNA.kedua, layar = [], info, fitur = [] }) {
  const daftarFitur = fitur.map((f) => teks(f, 48)).filter(Boolean).slice(0, 3);
  const keDaftar = (a, badge) => ({ jenis: 'daftar', narasi: a.narasi, kunci: a.kunci, durasi: DURASI.daftar, badge: teks(badge || a.badge, 26) || 'Fitur Utama', labelAngka: '', angka: nama, catatan: '', daftar: daftarFitur.length ? daftarFitur : [nama] });
  const adegan = (k.adegan ?? []).filter((a) => teks(a?.narasi)).slice(0, 7).map((a) => {
    const d = { narasi: teks(a.narasi, 220), kunci: daftarTeks(a.kunci, 4, 24) };
    switch (a.jenis) {
      case 'hook': {
        const judul = teks(a.judul, 60) || nama;
        const tekan = teks(a.tekan, 30);
        return { ...d, jenis: 'hook', durasi: DURASI.hook, label: teks(a.label, 34), judul, tekan: judul.toLowerCase().includes(tekan.toLowerCase()) ? tekan : '', sub: teks(a.sub, 70), coretan: teks(a.coretan, 32), dari: teks(a.dari, 18) || 'Cara lama', ke: teks(a.ke, 18) || nama };
      }
      case 'layar':
        if (!layar.length) return keDaftar(d, a.badge);
        return { ...d, jenis: 'layar', durasi: DURASI.layar, badge: teks(a.badge, 26), layar: Math.max(0, Math.trunc(Number(a.layar) || 0)) % layar.length, fokus_x: angka01(a.fokus_x, 0.5), fokus_y: angka01(a.fokus_y, 0.35), sorotan: teks(a.sorotan, 28) };
      case 'kasir': {
        const produk = (Array.isArray(a.produk) ? a.produk : []).map((p) => ({ nama: teks(p?.nama, 26), harga: teks(p?.harga, 14) })).filter((p) => p.nama).slice(0, 4);
        if (!produk.length) return keDaftar(d, a.badge);
        return { ...d, jenis: 'kasir', durasi: DURASI.kasir, badge: teks(a.badge, 26), produk, total: teks(a.total, 16), lencana: teks(a.lencana, 22) || 'Scan ✓', struk: teks(a.struk, 34) || 'Lunas' };
      }
      case 'alur': {
        const simpul = daftarTeks(a.simpul, 3, 24);
        if (simpul.length < 3) return keDaftar(d, a.badge);
        const dari = Number(a.hitung_dari), ke = Number(a.hitung_ke);
        const hitung = teks(a.hitung_label, 20) && Number.isFinite(dari) && Number.isFinite(ke) && dari !== ke ? { label: teks(a.hitung_label, 20), dari, ke } : null;
        return { ...d, jenis: 'alur', durasi: DURASI.alur, badge: teks(a.badge, 26), simpul, notifikasi: teks(a.notifikasi, 40), hitung };
      }
      case 'daftar': {
        const isi = daftarTeks(a.daftar, 3, 48);
        if (!isi.length) return keDaftar(d, a.badge);
        return { ...d, jenis: 'daftar', durasi: DURASI.daftar, badge: teks(a.badge, 26), labelAngka: teks(a.label_angka, 30), angka: teks(a.angka, 20) || nama, catatan: teks(a.catatan, 14), daftar: isi };
      }
      case 'penutup':
        return { ...d, jenis: 'penutup', durasi: DURASI.penutup, judul: teks(a.judul, 40) || `Coba ${nama} sekarang`, tombol: teks(a.tombol, 30) || `Coba ${nama}`, info: '' };
      default:
        return keDaftar(d, a.badge);
    }
  });
  // Penutup: tepat satu, di akhir, dengan kontak dari situs.
  const isi = adegan.filter((a) => a.jenis !== 'penutup');
  const tutup = adegan.find((a) => a.jenis === 'penutup') ?? { jenis: 'penutup', narasi: `Coba ${nama} sekarang. Hubungi kami lewat link di bio!`, kunci: [nama], durasi: DURASI.penutup, judul: `Coba ${nama} sekarang`, tombol: `Coba ${nama}` };
  return {
    merek: { nama, logo, utama, kedua, latar: WARNA.latar, kisi: WARNA.kisi, tinta: WARNA.tinta },
    layar,
    adegan: [...isi, { ...tutup, info }],
  };
}

/**
 * Render satu video iklan. aset: { logo (berkas lokal | null), layar: [{ berkas, lebar, tinggi }],
 * maskot (berkas lokal | null) }.
 * Semua bahan disalin ke `folder/publik` (jadi --public-dir); musik: berkas lokal atau buatan ffmpeg.
 * → { berkas, sampul, durasi }
 */
export async function renderIklan({ naskah, aset, folder, musik = null, keluar, log = console.log }) {
  const publik = path.join(folder, 'publik');
  await mkdir(publik, { recursive: true });
  const n = structuredClone(naskah);
  if (aset.logo) {
    await copyFile(aset.logo, path.join(publik, `logo${path.extname(aset.logo) || '.png'}`));
    n.merek.logo = `logo${path.extname(aset.logo) || '.png'}`;
  } else delete n.merek.logo;
  n.layar = [];
  for (const [i, l] of aset.layar.entries()) {
    const nama = `layar-${i}${path.extname(l.berkas) || '.png'}`;
    await copyFile(l.berkas, path.join(publik, nama));
    n.layar.push({ berkas: nama, lebar: l.lebar, tinggi: l.tinggi });
  }
  n.suara = [];
  for (const [i, a] of n.adegan.entries()) {
    const s = await suaraKata(a.narasi, path.join(publik, `narasi-${i}.mp3`));
    n.suara.push({ berkas: `narasi-${i}.mp3`, durasi: s.durasi, kata: s.kata });
    log(`🎙 ${i + 1}. ${a.jenis}: ${s.durasi.toFixed(2)} dtk`);
  }
  const detik = hitungWaktu(n).total / FPS;
  if (musik) await copyFile(musik, path.join(publik, `musik${path.extname(musik)}`));
  else await musikContoh(path.join(publik, 'musik.mp3'), detik + 1);
  n.musik = musik ? `musik${path.extname(musik)}` : 'musik.mp3';
  // Maskot (karakter 3D) di 40% bawah layar; tanpa berkas → tata letak tanpa maskot.
  if (aset.maskot) {
    if (/\.jpe?g$/i.test(aset.maskot)) {
      n.maskot = 'maskot.png';
      await jpgKePng(aset.maskot, path.join(publik, n.maskot));
    } else {
      n.maskot = `maskot${path.extname(aset.maskot).toLowerCase()}`;
      await copyFile(aset.maskot, path.join(publik, n.maskot));
    }
  }

  const props = path.join(folder, 'props.json');
  await writeFile(props, JSON.stringify(n));
  log(`🎬 Remotion: ${n.adegan.length} adegan, ${detik.toFixed(1)} dtk`);
  await jalankan(process.execPath, [CLI, 'render', 'src/index.ts', 'Iklan', keluar, `--props=${props}`, `--public-dir=${publik}`, '--log=error'], { cwd: REMOTION });
  // Sampul Reels: bingkai detik ke-1,5 (judul pembuka sudah utuh).
  const sampul = path.join(folder, 'sampul.jpg');
  await ffmpeg(['-y', '-ss', '1.5', '-i', keluar, '-frames:v', '1', '-q:v', '3', sampul]);
  return { berkas: keluar, sampul, durasi: detik };
}
