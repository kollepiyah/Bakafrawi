import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
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
export async function potret(peramban, { html, keluar, w, h, transparan = false, skala = 1 }) {
  const hal = await peramban.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: skala });
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
 * Tangkapan layar aplikasi ukuran HP beresolusi tinggi (390×844, dpr 3 → 1170×2532) di tiap langkah
 * skenario yang mengubah layar. Gambar tajam ini yang dizoom di video iklan (rekaman video 540 px
 * dulu terlalu buram untuk dizoom). Layar kembar berurutan dibuang. → [{ berkas, lebar, tinggi }]
 */
export async function potretLayar(peramban, { url, langkah, folder, maks = 6, tunggu = Number(process.env.STUDIO_TUNGGU_LAYAR) || 6000 }) {
  const konteks = await peramban.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'id-ID' });
  const hasil = [];
  let terakhir = null;
  const jepret = async (hal) => {
    const buf = await hal.screenshot({ type: 'png' });
    const sidik = createHash('sha1').update(buf).digest('hex');
    if (sidik === terakhir) return;
    terakhir = sidik;
    const berkas = path.join(folder, `layar-${hasil.length}.png`);
    await writeFile(berkas, buf);
    hasil.push({ berkas, lebar: 1170, tinggi: 2532 });
  };
  const hal = await konteks.newPage();
  try {
    await hal.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    // Banyak aplikasi menampilkan logo pembuka beberapa detik (Maktaba ±5 dtk).
    await tidur(tunggu);
    await jepret(hal);
    for (const l of langkah) {
      if (hasil.length >= maks) break;
      try {
        await jalankan(hal, l);
        if (['buka', 'klik', 'gulir'].includes(l.aksi)) await jepret(hal);
      } catch (e) {
        console.error(`Langkah ${l.aksi} "${l.target ?? ''}" gagal: ${e.message.split('\n')[0]}`);
      }
    }
  } finally {
    await konteks.close();
  }
  return hasil;
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
