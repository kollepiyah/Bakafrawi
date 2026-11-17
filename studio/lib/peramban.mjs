import { existsSync } from 'node:fs';
import { readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CALON_CHROME = [
  process.env.STUDIO_CHROME,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

export async function bukaPeramban() {
  const exe = CALON_CHROME.find((x) => x && existsSync(x));
  if (!exe) throw new Error('Chrome/Edge tidak ditemukan (isi STUDIO_CHROME).');
  const { chromium } = await import('playwright-core');
  return chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--allow-file-access-from-files'] });
}

/** Potret HTML → PNG. `transparan` untuk lapisan bingkai video. */
export async function potret(peramban, { html, keluar, w, h, transparan = false }) {
  const hal = await peramban.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  try {
    const berkasHtml = keluar.replace(/\.(png|jpe?g)$/i, '.html');
    await writeFile(berkasHtml, html);
    await hal.goto(pathToFileURL(berkasHtml).href);
    await hal.waitForSelector('body[data-siap]', { timeout: 30000 });
    // Poster disimpan JPEG: Instagram hanya menerima JPEG untuk postingan gambar.
    const jpeg = /\.jpe?g$/i.test(keluar);
    await hal.screenshot({ path: keluar, type: jpeg ? 'jpeg' : 'png', ...(jpeg ? { quality: 92 } : { omitBackground: transparan }) });
  } finally {
    await hal.close();
  }
}

/** Ganti {{RAHASIA:NAMA}} dengan env DEMO_NAMA — kata sandi akun demo tak pernah tersimpan di konten publik. */
function isiRahasia(teks = '') {
  return teks.replace(/\{\{RAHASIA:([A-Z0-9_]+)\}\}/g, (_, n) => {
    const v = process.env[`DEMO_${n}`];
    if (v === undefined) throw new Error(`Rahasia DEMO_${n} belum diisi di GitHub dan didaftarkan di .github/workflows/studio.yml.`);
    return v;
  });
}

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Rekam aplikasi di layar HP mengikuti skenario. Mengembalikan { berkas, mulai } — `mulai` = detik
 * pertama yang layak tampil (sebelum itu layar masih putih memuat).
 */
export async function rekamAplikasi(peramban, { url, langkah, folder, maksDetik = 40 }) {
  // Perekam Playwright merekam piksel CSS apa adanya (deviceScaleFactor tidak ikut dibesarkan),
  // jadi layar dibuat selebar 540 — masih tata letak HP — dan direkam pada ukuran yang sama.
  const ukuran = { width: 540, height: 1168 };
  const konteks = await peramban.newContext({
    viewport: ukuran,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'id-ID',
    recordVideo: { dir: folder, size: ukuran },
  });
  const awal = Date.now();
  let mulai = 0;
  const hal = await konteks.newPage();
  try {
    await hal.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await tidur(800);
    mulai = (Date.now() - awal) / 1000;
    for (const l of langkah) {
      if ((Date.now() - awal) / 1000 - mulai > maksDetik) break;
      try {
        await jalankan(hal, l);
      } catch (e) {
        console.error(`Langkah ${l.aksi} "${l.target ?? ''}" gagal: ${e.message.split('\n')[0]}`);
      }
    }
    await tidur(1200);
  } finally {
    await hal.close();
    await konteks.close();
  }
  const webm = (await readdir(folder)).find((f) => f.endsWith('.webm'));
  if (!webm) throw new Error('Rekaman tidak terbentuk.');
  const berkas = path.join(folder, 'rekaman.webm');
  await rename(path.join(folder, webm), berkas);
  return { berkas, mulai };
}

async function jalankan(hal, l) {
  const target = l.target ? isiRahasia(l.target) : '';
  switch (l.aksi) {
    case 'buka':
      await hal.goto(target, { waitUntil: 'networkidle', timeout: 30000 });
      break;
    case 'klik': {
      // Target bisa teks yang terlihat ("Laporan") atau selektor CSS (diawali #, ., [).
      const el = /^[#.[]/.test(target) ? hal.locator(target).first() : hal.getByText(target, { exact: false }).first();
      await el.scrollIntoViewIfNeeded({ timeout: 5000 });
      await tidur(400);
      await el.click({ timeout: 8000 });
      await hal.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      break;
    }
    case 'ketik': {
      const el = hal.locator(target).first();
      await el.click({ timeout: 8000 });
      await el.pressSequentially(isiRahasia(l.teks ?? ''), { delay: 60 });
      break;
    }
    case 'gulir': {
      // Gulir halus, seperti jempol menggeser layar.
      const jarak = Number(l.teks) || 600;
      for (let i = 0; i < 12; i++) {
        await hal.mouse.wheel(0, jarak / 12);
        await tidur(60);
      }
      break;
    }
    case 'tunggu':
      break;
  }
  await tidur((Number(l.detik) || 1.5) * 1000);
}
