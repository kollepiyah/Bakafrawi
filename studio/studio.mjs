// Mesin Studio AI bakafrawi.com — satu putaran: kerjakan semua tugas antre lalu selesai.
//   node studio.mjs                → mode awan (GitHub Actions), baca/tulis Supabase
//   node studio.mjs --lokal f.json → uji di laptop tanpa database; hasil di studio/keluaran/
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ambilTugas, bacaKonten, perbaruiTugas, siapDb, unggah } from './lib/db.mjs';
import { buatNaskah } from './lib/naskah.mjs';
import { bukaPeramban, potret, rekamAplikasi } from './lib/peramban.mjs';
import { rakitVideo } from './lib/rakit.mjs';
import { bacakan } from './lib/suara.mjs';
import { htmlBingkai, htmlKartu, htmlPoster, UKURAN } from './lib/templat.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOGO = pathToFileURL(path.join(DIR, '..', 'public', 'logo.png')).href;
const MAKS_TUGAS = 5;

const mutlak = (src, situs) => (/^https?:\/\//.test(src) ? src : `${situs.urlSitus.replace(/\/$/, '')}${src}`);

/** Skenario rekaman: dari produk.demo bila ada; bila tidak, buka tautan utama lalu gulir pelan. */
function skenario(produk) {
  if (produk.demo?.url) return { url: produk.demo.url, langkah: produk.demo.langkah ?? [] };
  const url = produk.tautan.find((t) => t.utama)?.url ?? produk.tautan[0]?.url;
  if (!url) return null;
  return { url, langkah: [{ aksi: 'tunggu', detik: 2 }, ...Array.from({ length: 6 }, () => ({ aksi: 'gulir', teks: '520', detik: 2.2 }))] };
}

async function kerjakan(tugas, situs, peramban, folder, simpan) {
  const produk = situs.produk.find((p) => p.slug === tugas.produk_slug);
  if (!produk) throw new Error(`Produk "${tugas.produk_slug}" tidak ada di konten.`);
  const naskah = await buatNaskah(produk, situs, tugas.arahan, tugas.jenis);
  const caption = `${naskah.caption}\n\n${naskah.ajakan} → WA ${situs.kontak.whatsappTampil} · bakafrawi.com\n\n${naskah.hashtag.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}`;
  const layar = produk.layarHp?.[0]?.src ?? produk.layarDesktop?.[0]?.src;
  const gambar = layar ?? produk.logo?.src;
  const umum = { naskah, produk, logo: LOGO, kontak: situs.kontak };
  const hasil = [];

  if (tugas.jenis === 'gambar') {
    for (const rasio of ['feed', 'potret', 'story']) {
      const keluar = path.join(folder, `poster-${rasio}.png`);
      await potret(peramban, { ...UKURAN[rasio], keluar, html: htmlPoster({ ...umum, rasio, gambar: gambar && mutlak(gambar, situs), gambarIkon: !layar }) });
      hasil.push({ jenis: 'gambar', rasio, url: await simpan(keluar, 'image/png') });
    }
  } else {
    const sk = skenario(produk);
    if (!sk) throw new Error('Produk ini belum punya tautan/skenario demo untuk direkam.');
    const rekaman = await rekamAplikasi(peramban, { ...sk, folder });
    const berkas = (n) => path.join(folder, n);
    await potret(peramban, { w: 1080, h: 1920, keluar: berkas('bingkai.png'), transparan: true, html: htmlBingkai(umum) });
    await potret(peramban, { w: 1080, h: 1920, keluar: berkas('pembuka.png'), html: htmlKartu({ ...umum, jenis: 'pembuka' }) });
    await potret(peramban, { w: 1080, h: 1920, keluar: berkas('penutup.png'), html: htmlKartu({ ...umum, jenis: 'penutup' }) });
    await bacakan(naskah.narasi.join(' '), berkas('narasi.mp3'));
    const keluar = berkas('video.mp4');
    const { total } = await rakitVideo({
      folder, rekaman: rekaman.berkas, mulaiRekaman: rekaman.mulai,
      bingkai: berkas('bingkai.png'), pembuka: berkas('pembuka.png'), penutup: berkas('penutup.png'),
      narasi: berkas('narasi.mp3'), kalimat: naskah.narasi, keluar,
    });
    hasil.push({ jenis: 'video', rasio: 'story', durasi: Math.round(total), url: await simpan(keluar, 'video/mp4') });
    hasil.push({ jenis: 'gambar', rasio: 'sampul', url: await simpan(berkas('pembuka.png'), 'image/png') });
  }
  return { naskah, caption, hasil };
}

async function modeAwan() {
  // Jadwal 30 menit tetap jalan walau rahasia belum dipasang — keluar dengan tenang, bukan gagal.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.log('Rahasia SUPABASE_URL / SUPABASE_SERVICE_KEY belum dipasang — putaran dilewati.');
    return;
  }
  siapDb();
  const situs = await bacaKonten();
  if (!situs) throw new Error('Konten situs belum ada di database (simpan sekali dari /admin).');
  const peramban = await bukaPeramban();
  try {
    for (let i = 0; i < MAKS_TUGAS; i++) {
      const tugas = await ambilTugas();
      if (!tugas) break;
      console.log(`▶ Tugas ${tugas.id} (${tugas.jenis} · ${tugas.produk_slug})`);
      const folder = path.join(DIR, 'kerja', tugas.id);
      await mkdir(folder, { recursive: true });
      try {
        const simpan = async (berkas, jenis) => unggah(`${tugas.id}/${path.basename(berkas)}`, await readFile(berkas), jenis);
        const { naskah, caption, hasil } = await kerjakan(tugas, situs, peramban, folder, simpan);
        await perbaruiTugas(tugas.id, { status: 'selesai', selesai: new Date().toISOString(), naskah, caption, hasil, galat: null });
        console.log(`✔ Selesai: ${hasil.length} berkas`);
      } catch (e) {
        console.error(`✖ Gagal:`, e);
        await perbaruiTugas(tugas.id, { status: 'gagal', selesai: new Date().toISOString(), galat: String(e.message ?? e).slice(0, 1000) });
      } finally {
        await rm(folder, { recursive: true, force: true });
      }
    }
  } finally {
    await peramban.close();
  }
}

async function modeLokal(berkasTugas) {
  const { tugas, situs } = JSON.parse(await readFile(berkasTugas, 'utf8'));
  const folder = path.join(DIR, 'keluaran', `${tugas.jenis}-${Date.now()}`);
  await mkdir(folder, { recursive: true });
  const peramban = await bukaPeramban();
  try {
    const hasil = await kerjakan(tugas, situs, peramban, folder, async (b) => b);
    console.log(JSON.stringify(hasil, null, 2));
  } finally {
    await peramban.close();
  }
}

const iLokal = process.argv.indexOf('--lokal');
(iLokal > -1 ? modeLokal(process.argv[iLokal + 1]) : modeAwan()).catch((e) => {
  console.error(e);
  process.exit(1);
});
