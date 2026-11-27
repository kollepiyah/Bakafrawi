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

/**
 * Potret website publik untuk komposisi `WebShowcase`:
 * - Desktop 1440×900 (full-page scroll + hero + tengah halaman)
 * - Mobile 390×844 (tall scroll + hero)
 * - Auto-scan metadata halaman (title, deskripsi, heading, navigasi, warna tema) agar AI menulis naskah dari isi ASLI web.
 */
export async function potretWebShowcase(
  peramban,
  { url, folder, maksTinggiDesktop = 5000, maksTinggiMobile = 3000, tunggu = 2600 },
) {
  const domain = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return String(url).replace(/^https?:\/\//i, '').split('/')[0] || 'website';
    }
  })();

  let info = { domain, url, title: '', deskripsi: '', heading: [], navigasi: [], warnaAksen: '' };
  let desktopFull = null;
  let desktopHero = null;
  let desktopMid = null;
  let mobileFull = null;
  let mobileHero = null;

  // 1. DESKTOP (1440×900, DPR 2 → tajam untuk scroll 3D & zoom)
  const ctxDesk = await peramban.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: 'id-ID',
  });
  const halDesk = await ctxDesk.newPage();
  try {
    await halDesk.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() =>
      halDesk.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    );
    await tidur(tunggu);

    // Gulir bertahap agar lazy-load gambar & animasi reveal muncul penuh, lalu kembali ke atas.
    const tinggiTotal = await halDesk.evaluate(async () => {
      const maks = Math.min(document.documentElement.scrollHeight || document.body.scrollHeight || 900, 5200);
      for (let y = 0; y <= maks; y += 520) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 180));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 350));
      return Math.max(900, document.documentElement.scrollHeight || document.body.scrollHeight || 900);
    }).catch(() => 900);

    // Pindai konten asli situs (judul, deskripsi, heading, menu navigasi, warna tema)
    info = await halDesk.evaluate((dom) => {
      const bersih = (s) => String(s || '').replace(/\s+/g, ' ').trim();
      const title = bersih(document.title).slice(0, 120);
      const deskMeta =
        document.querySelector('meta[name="description"]')?.getAttribute('content') ||
        document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
        '';
      const deskripsi = bersih(deskMeta).slice(0, 260);
      const heading = [...document.querySelectorAll('h1, h2, h3')]
        .map((el) => bersih(el.textContent))
        .filter((t) => t.length >= 4 && t.length <= 120)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 8);
      const navigasi = [...document.querySelectorAll('header a, nav a')]
        .map((el) => bersih(el.textContent))
        .filter((t) => t.length >= 2 && t.length <= 28)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 8);
      const themeColor = bersih(document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || '');
      const warnaAksen = /^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : '';
      return { domain: dom, url: location.href, title, deskripsi, heading, navigasi, warnaAksen };
    }, domain).catch(() => info);

    // Hero desktop (1440×900)
    const pHero = path.join(folder, 'web-desktop-hero.jpg');
    await halDesk.screenshot({ path: pHero, type: 'jpeg', quality: 90 });
    desktopHero = { berkas: pHero, lebar: 2880, tinggi: 1800 };

    // Full-page desktop (tinggi dibatasi agar ringan & mulus di Remotion)
    const tinggiClip = Math.min(Math.max(900, tinggiTotal), maksTinggiDesktop);
    const pFull = path.join(folder, 'web-desktop-full.jpg');
    await halDesk.screenshot({
      path: pFull,
      type: 'jpeg',
      quality: 88,
      clip: { x: 0, y: 0, width: 1440, height: tinggiClip },
    });
    desktopFull = { berkas: pFull, lebar: 2880, tinggi: tinggiClip * 2 };

    // Bagian tengah desktop (untuk adegan Spotlight)
    const yMid = Math.max(0, Math.min(tinggiTotal - 900, Math.round(tinggiClip * 0.36)));
    await halDesk.evaluate((y) => window.scrollTo(0, y), yMid).catch(() => {});
    await tidur(450);
    const pMid = path.join(folder, 'web-desktop-mid.jpg');
    await halDesk.screenshot({ path: pMid, type: 'jpeg', quality: 90 });
    desktopMid = { berkas: pMid, lebar: 2880, tinggi: 1800 };
  } finally {
    await ctxDesk.close();
  }

  // 2. MOBILE (390×844, DPR 2 → untuk adegan Responsive Desktop + HP)
  const ctxMob = await peramban.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'id-ID',
  });
  const halMob = await ctxMob.newPage();
  try {
    await halMob.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() =>
      halMob.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    );
    await tidur(Math.min(tunggu, 2200));

    const tinggiMob = await halMob.evaluate(async () => {
      const maks = Math.min(document.documentElement.scrollHeight || document.body.scrollHeight || 844, 3200);
      for (let y = 0; y <= maks; y += 450) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 140));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 300));
      return Math.max(844, document.documentElement.scrollHeight || document.body.scrollHeight || 844);
    }).catch(() => 844);

    const pMobHero = path.join(folder, 'web-mobile-hero.jpg');
    await halMob.screenshot({ path: pMobHero, type: 'jpeg', quality: 90 });
    mobileHero = { berkas: pMobHero, lebar: 780, tinggi: 1688 };

    const tinggiClipMob = Math.min(Math.max(844, tinggiMob), maksTinggiMobile);
    const pMobFull = path.join(folder, 'web-mobile-full.jpg');
    await halMob.screenshot({
      path: pMobFull,
      type: 'jpeg',
      quality: 86,
      clip: { x: 0, y: 0, width: 390, height: tinggiClipMob },
    });
    mobileFull = { berkas: pMobFull, lebar: 780, tinggi: tinggiClipMob * 2 };
  } finally {
    await ctxMob.close();
  }

  return { info, desktopFull, desktopHero, desktopMid, mobileFull, mobileHero };
}
