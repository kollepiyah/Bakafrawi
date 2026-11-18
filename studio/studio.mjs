// Mesin Studio AI bakafrawi.com — satu putaran: kerjakan tugas antre, kirim hasilnya ke Telegram
// untuk disetujui, lalu tayangkan ke Instagram yang sudah disetujui/jadwalnya tiba.
//   node studio.mjs                → mode awan (GitHub Actions), baca/tulis Supabase
//   node studio.mjs --lokal f.json → uji di laptop tanpa database; hasil di studio/keluaran/
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ambilTayang, ambilTugas, bacaKonten, bacaMerek, bacaPengaturan, daftarKredensial, perbaruiKredensial, perbaruiTugas, pulihkan, siapDb, unggah } from './lib/db.mjs';
import { adaGambarAi, buatGambarAi } from './lib/gambar-ai.mjs';
import { adaInstagram, postingFeed, postingReels, postingStory, segarkanToken } from './lib/instagram.mjs';
import { buatNaskah } from './lib/naskah.mjs';
import { bukaPeramban, potret, rekamAplikasi } from './lib/peramban.mjs';
import { rakitVideo } from './lib/rakit.mjs';
import { bacakan } from './lib/suara.mjs';
import { adaTelegram, kirimHasil, kirimTeks } from './lib/telegram.mjs';
import { htmlBingkai, htmlKartu, htmlPoster, temaMerek, UKURAN } from './lib/templat.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOGO = pathToFileURL(path.join(DIR, '..', 'public', 'logo.png')).href;
const MAKS_TUGAS = 5;
const RASIO_AI = { feed: '1:1', potret: '4:5', story: '9:16' };

const mutlak = (src, situs) => (/^https?:\/\//.test(src) ? src : `${situs.urlSitus.replace(/\/$/, '')}${src}`);
const berkasUrl = (b) => pathToFileURL(b).href;

/** Skenario rekaman: dari produk.demo bila ada; bila tidak, buka tautan utama lalu gulir pelan. */
function skenario(produk) {
  if (produk.demo?.url) return { url: produk.demo.url, langkah: produk.demo.langkah ?? [] };
  const url = produk.tautan.find((t) => t.utama)?.url ?? produk.tautan[0]?.url;
  if (!url) return null;
  return { url, langkah: [{ aksi: 'tunggu', detik: 2 }, ...Array.from({ length: 6 }, () => ({ aksi: 'gulir', teks: '520', detik: 2.2 }))] };
}

/** Foto suasana AI; gagal / tanpa kunci → null (latar polos) supaya tugas tetap jadi. */
async function fotoAi(adegan, rasio, keluar, catatan) {
  if (!adegan || catatan.aiBerhenti) return null;
  if (!adaGambarAi()) {
    catatan.push('Latar AI dilewati: rahasia CF_ACCOUNT_ID + CF_API_TOKEN (atau GEMINI_API_KEY) belum diisi.');
    catatan.aiBerhenti = true;
    return null;
  }
  try {
    return berkasUrl(await buatGambarAi(adegan, rasio, keluar));
  } catch (e) {
    // 429 = kuota semua penyedia habis (jatah harian Cloudflare / Gemini tanpa billing): berhenti mencoba.
    if (/\(429\)/.test(e.message)) {
      catatan.push(`Latar AI gagal: ${e.message.slice(0, 200)}`);
      catatan.aiBerhenti = true;
    } else catatan.push(`Latar AI gagal: ${e.message.slice(0, 160)}`);
    return null;
  }
}

/** merek: baris studio_merek tugas ini (identitas tampilan, gaya naskah, WA bila beda dari situs). */
async function kerjakan(tugas, situs, peramban, folder, simpan, merek) {
  const produk = situs.produk.find((p) => p.slug === tugas.produk_slug);
  if (!produk) throw new Error(`Produk "${tugas.produk_slug}" tidak ada di konten.`);
  const tema = temaMerek(merek);
  const kontak = { ...situs.kontak, ...(merek?.profil?.whatsapp ? { whatsappTampil: merek.profil.whatsapp } : {}) };
  const naskah = await buatNaskah(produk, situs, tugas.arahan, tugas.jenis, merek);
  const tujuan = [`WA ${kontak.whatsappTampil}`, tema.situs].filter(Boolean).join(' · ');
  const caption = `${naskah.caption}\n\n${naskah.ajakan} → ${tujuan}\n\n${naskah.hashtag.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}`;
  const layar = produk.layarHp?.[0]?.src ?? produk.layarDesktop?.[0]?.src;
  const gambar = layar ?? produk.logo?.src;
  const logo = merek?.profil?.logo ?? (merek?.slug === 'bakafrawi' || !merek ? LOGO : '');
  const umum = { naskah, produk, logo, kontak, tema };
  const pakaiAi = tugas.latar === 'ai';
  const catatan = [];
  const hasil = [];
  const berkas = (n) => path.join(folder, n);

  if (tugas.jenis === 'gambar') {
    for (const rasio of ['feed', 'potret', 'story']) {
      const foto = pakaiAi ? await fotoAi(naskah.adegan?.[0], RASIO_AI[rasio], berkas(`latar-${rasio}.png`), catatan) : null;
      const keluar = berkas(`poster-${rasio}.jpg`);
      await potret(peramban, { ...UKURAN[rasio], keluar, html: htmlPoster({ ...umum, rasio, foto, gambar: gambar && mutlak(gambar, situs), gambarIkon: !layar }) });
      hasil.push({ jenis: 'gambar', rasio, url: await simpan(keluar, 'image/jpeg') });
    }
  } else {
    const sk = skenario(produk);
    if (!sk) throw new Error('Produk ini belum punya tautan/skenario demo untuk direkam.');
    const rekaman = await rekamAplikasi(peramban, { ...sk, folder });
    const fotoBuka = pakaiAi ? await fotoAi(naskah.adegan?.[0], '9:16', berkas('latar-buka.png'), catatan) : null;
    const fotoTutup = pakaiAi ? await fotoAi(naskah.adegan?.[1] ?? naskah.adegan?.[0], '9:16', berkas('latar-tutup.png'), catatan) : null;
    await potret(peramban, { w: 1080, h: 1920, keluar: berkas('bingkai.png'), transparan: true, html: htmlBingkai(umum) });
    await potret(peramban, { w: 1080, h: 1920, keluar: berkas('pembuka.jpg'), html: htmlKartu({ ...umum, jenis: 'pembuka', foto: fotoBuka }) });
    await potret(peramban, { w: 1080, h: 1920, keluar: berkas('penutup.jpg'), html: htmlKartu({ ...umum, jenis: 'penutup', foto: fotoTutup }) });
    await bacakan(naskah.narasi.join(' '), berkas('narasi.mp3'));
    const keluar = berkas('video.mp4');
    const { total } = await rakitVideo({
      folder, rekaman: rekaman.berkas, mulaiRekaman: rekaman.mulai,
      bingkai: berkas('bingkai.png'), pembuka: berkas('pembuka.jpg'), penutup: berkas('penutup.jpg'),
      narasi: berkas('narasi.mp3'), kalimat: naskah.narasi, keluar,
    });
    hasil.push({ jenis: 'video', rasio: 'story', durasi: Math.round(total), url: await simpan(keluar, 'video/mp4') });
    hasil.push({ jenis: 'gambar', rasio: 'sampul', url: await simpan(berkas('pembuka.jpg'), 'image/jpeg') });
  }
  if (catatan.length) naskah.catatan = catatan;
  return { naskah, caption, hasil, namaProduk: produk.nama };
}

/** Tayangkan satu tugas yang disetujui ke Instagram → objek `tayang`. */
async function tayangkan(tugas, k) {
  const ambil = (rasio) => tugas.hasil.find((h) => h.rasio === rasio)?.url;
  if (tugas.jenis === 'video') {
    const reels = await postingReels(k, ambil('story'), tugas.caption ?? '');
    return { instagram: { reels, waktu: new Date().toISOString() } };
  }
  const feed = await postingFeed(k, ambil('potret') ?? ambil('feed'), tugas.caption ?? '');
  // Story pelengkap: gagal di sini tak membatalkan feed yang sudah tayang.
  const story = ambil('story') ? await postingStory(k, ambil('story')).catch((e) => ({ galat: e.message })) : null;
  return { instagram: { feed, story, waktu: new Date().toISOString() } };
}

/** Token Instagram tiap merek (diperpanjang bila hampir habis) → Map slug → kredensial. */
async function akunInstagram(kabar) {
  const peta = new Map();
  for (const { merek, data } of await daftarKredensial('instagram')) {
    let k = data;
    const baru = await segarkanToken(k).catch((e) => (kabar(`⚠️ Token Instagram ${merek} gagal diperpanjang: ${e.message}`), null));
    if (baru) k = { ...k, ...baru };
    // dicek: studio_ada_kerja() tak memicu mesin lagi untuk token ini sampai besok.
    await perbaruiKredensial(merek, 'instagram', { data: baru ? k : undefined, dicek: new Date().toISOString() }).catch((e) => console.error(e.message));
    peta.set(merek, k);
  }
  return peta;
}

async function putaranTayang(kabar) {
  const akun = await akunInstagram(kabar);
  for (let i = 0; i < MAKS_TUGAS; i++) {
    const tugas = await ambilTayang();
    if (!tugas) break;
    const k = akun.get(tugas.merek ?? 'bakafrawi');
    if (!adaInstagram(k)) {
      await perbaruiTugas(tugas.id, { status_tayang: 'gagal', galat: `Instagram merek ${tugas.merek} belum tersambung (Bakafrawi Studio → Konten → Sambungan).` });
      await kabar(`⚠️ Postingan ${tugas.merek} belum bisa tayang: Instagram merek itu belum tersambung. Tempel token di Konten → Sambungan.`);
      continue;
    }
    console.log(`📤 Tayang ${tugas.id}`);
    try {
      const tayang = await tayangkan(tugas, k);
      await perbaruiTugas(tugas.id, { status_tayang: 'tayang', tayang, galat: null });
      const tautan = tayang.instagram.reels?.permalink ?? tayang.instagram.feed?.permalink ?? '';
      await kabar(`✅ Sudah tayang di Instagram ${k.ig_akun ?? ''}${tautan ? `\n${tautan}` : ''}${tayang.instagram.story?.galat ? `\n(Story gagal: ${tayang.instagram.story.galat})` : ''}`);
    } catch (e) {
      console.error('✖ Tayang gagal:', e);
      await perbaruiTugas(tugas.id, { status_tayang: 'gagal', galat: `Tayang gagal: ${String(e.message ?? e).slice(0, 800)}` });
      await kabar(`❌ Gagal tayang ke Instagram: ${e.message}`);
    }
  }
}

async function modeAwan() {
  // Jadwal 30 menit tetap jalan walau rahasia belum dipasang — keluar dengan tenang, bukan gagal.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.log('Rahasia SUPABASE_URL / SUPABASE_SERVICE_KEY belum dipasang — putaran dilewati.');
    return;
  }
  siapDb();
  const pengaturan = await bacaPengaturan();
  const chat = pengaturan.telegram_chat_id;
  const kabar = async (teks, tombol) => {
    if (!chat || !adaTelegram()) return;
    await kirimTeks(chat, teks, tombol).catch((e) => console.error('Telegram:', e.message));
  };

  const pulih = await pulihkan().catch((e) => (console.error(e.message), {}));
  if (pulih.buat || pulih.tayang) {
    await kabar(`⚠️ Putaran Studio sebelumnya terhenti di tengah jalan: ${[pulih.buat && `${pulih.buat} konten gagal dibuat (tekan Buat ulang)`, pulih.tayang && `${pulih.tayang} konten terputus saat tayang — cek Instagram dulu sebelum menayangkan lagi`].filter(Boolean).join('; ')}.`);
  }

  const tugasPertama = await ambilTugas();
  if (tugasPertama) {
    const situs = await bacaKonten();
    if (!situs) throw new Error('Konten situs belum ada di database (simpan sekali dari /admin).');
    const peramban = await bukaPeramban();
    const merekCache = new Map();
    try {
      for (let i = 0; i < MAKS_TUGAS; i++) {
        const tugas = i === 0 ? tugasPertama : await ambilTugas();
        if (!tugas) break;
        console.log(`▶ Tugas ${tugas.id} (${tugas.jenis} · ${tugas.produk_slug} · latar ${tugas.latar})`);
        const folder = path.join(DIR, 'kerja', tugas.id);
        await mkdir(folder, { recursive: true });
        try {
          const slug = tugas.merek ?? 'bakafrawi';
          if (!merekCache.has(slug)) merekCache.set(slug, await bacaMerek(slug));
          const simpan = async (b, jenis) => unggah(`${tugas.id}/${path.basename(b)}`, await readFile(b), jenis);
          const { naskah, caption, hasil, namaProduk } = await kerjakan(tugas, situs, peramban, folder, simpan, merekCache.get(slug));
          await perbaruiTugas(tugas.id, { status: 'selesai', selesai: new Date().toISOString(), naskah, caption, hasil, galat: null });
          console.log(`✔ Selesai: ${hasil.length} berkas`);
          if (chat && adaTelegram()) {
            await kirimHasil(chat, { tugas, namaProduk, hasil, caption }).catch((e) => console.error('Telegram kirim hasil:', e.message));
          }
        } catch (e) {
          console.error('✖ Gagal:', e);
          await perbaruiTugas(tugas.id, { status: 'gagal', selesai: new Date().toISOString(), galat: String(e.message ?? e).slice(0, 1000) });
          await kabar(`❌ Studio gagal membuat ${tugas.jenis} ${tugas.produk_slug}: ${String(e.message ?? e).slice(0, 300)}`);
        } finally {
          await rm(folder, { recursive: true, force: true });
        }
      }
    } finally {
      await peramban.close();
    }
  }
  await putaranTayang(kabar);
}

async function modeLokal(berkasTugas) {
  // Berkas uji boleh membawa "merek" (bentuk baris studio_merek); bawaannya Bakafrawi.
  const { tugas, situs, merek = { slug: 'bakafrawi', nama: 'Bakafrawi', profil: { situs: 'bakafrawi.com' } } } = JSON.parse(await readFile(berkasTugas, 'utf8'));
  const folder = path.join(DIR, 'keluaran', `${tugas.jenis}-${Date.now()}`);
  await mkdir(folder, { recursive: true });
  const peramban = await bukaPeramban();
  try {
    const hasil = await kerjakan(tugas, situs, peramban, folder, async (b) => b, merek);
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
