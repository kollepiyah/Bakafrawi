// Mesin Studio AI bakafrawi.com — satu putaran: kerjakan tugas antre, kirim hasilnya ke Telegram
// untuk disetujui, lalu tayangkan ke Instagram yang sudah disetujui/jadwalnya tiba.
//   node studio.mjs                → mode awan (GitHub Actions), baca/tulis Supabase
//   node studio.mjs --lokal f.json → uji di laptop tanpa database; hasil di studio/keluaran/
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { drafTiktok, segarkanTiktok } from './lib/bank/sosmed.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ambilTayang, ambilTugas, bacaKonten, bacaMerek, bacaPengaturan, buatTugasRutin, cariTugasRutinTerjadwal, daftarKredensial, merekBankBasi, perbaruiKredensial, perbaruiProfilMerek, perbaruiTugas, pulihkan, semuaMerek, semuaReferensi, siapDb, tandaiBankDiindeks, unggah } from './lib/db.mjs';
import { indeksBankMerek, lihatBankMerek, renderBankMerek, siapkanMerekBank } from './lib/merek-bank.mjs';
// Satu modul gambar AI untuk semua merek (versi pindahan Lek Kopi: penyedia berurutan + catatan biaya).
import { adaGambarAi, buatGambarAi, galatKuota } from './lib/bank/gambar-ai.mjs';
import { adaInstagram, postingFeed, postingReels, postingStory, segarkanToken } from './lib/instagram.mjs';
import { ffmpeg, probe } from './lib/bank/alat.mjs';
import { ASET_LOKAL, deteksiGenderKarakter, kelompokKarakter, keNaskah, maskotAdegan, pilihKarakter, pilihKolamGayaDenganEvaluasi, pilihMusik, renderIklan, renderSinematikRemotion, renderWebShowcase, salinAsetDrive, salinAsetSupabase, SUARA, suaraKarakter, uraiPilihanKarakter, WARNA } from './lib/video.mjs';
import { buatNaskah, buatNaskahVideo, buatNaskahVideoFullAi, buatNaskahWebShowcase } from './lib/naskah.mjs';
import { suaraAdegan, uraiPilihanSuara } from './lib/bank/suara.mjs';
import { renderOpeningAI } from './lib/opening-ai.mjs';
import { gabungRiwayatEpisode, renderSerialKartun } from './lib/serial-kartun.mjs';
import { bukaPeramban, potret, potretLayar, potretWebShowcase } from './lib/peramban.mjs';
import { adaTelegram, kirimHasil, kirimMediaTayang, kirimTeks } from './lib/telegram.mjs';
import { htmlPoster, temaMerek, UKURAN } from './lib/templat.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOGO = pathToFileURL(path.join(DIR, '..', 'public', 'logo.png')).href;
const MAKS_TUGAS = 5;
const RASIO_AI = { feed: '1:1', potret: '4:5', story: '9:16' };

const mutlak = (src, situs) => (/^https?:\/\//.test(src) ? src : `${situs.urlSitus.replace(/\/$/, '')}${src}`);
const berkasUrl = (b) => pathToFileURL(b).href;

/** Gambar (URL file:// atau http) → berkas lokal; gagal → null (video tetap jadi tanpa logo). */
async function ambilLokal(src, dasar) {
  if (!src) return null;
  try {
    if (src.startsWith('file:')) return fileURLToPath(src);
    const r = await fetch(src);
    if (!r.ok) return null;
    const b = `${dasar}${path.extname(new URL(src).pathname) || '.png'}`;
    await writeFile(b, Buffer.from(await r.arrayBuffer()));
    return b;
  } catch {
    return null;
  }
}

/** Skenario layar: dari produk.demo bila ada; bila tidak, buka tautan utama lalu gulir. */
function skenario(produk) {
  if (produk.demo?.url) return { url: produk.demo.url, langkah: produk.demo.langkah ?? [] };
  const url = produk.tautan.find((t) => t.utama)?.url ?? produk.tautan[0]?.url;
  if (!url) return null;
  return { url, langkah: [{ aksi: 'tunggu', detik: 2 }, ...Array.from({ length: 4 }, () => ({ aksi: 'gulir', teks: '700', detik: 1.5 }))] };
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
    return berkasUrl((await buatGambarAi(adegan, rasio, keluar.replace(/\.\w+$/, ''))).berkas);
  } catch (e) {
    // Kuota semua penyedia habis (jatah harian Cloudflare / Gemini tanpa billing): berhenti mencoba.
    if (galatKuota(e)) {
      catatan.push(`Latar AI gagal: ${e.message.slice(0, 200)}`);
      catatan.aiBerhenti = true;
    } else catatan.push(`Latar AI gagal: ${e.message.slice(0, 160)}`);
    return null;
  }
}

/**
 * Layar aplikasi untuk video: tangkapan tajam dari skenario demo/tautan, ditambah gambar layar HP di
 * konten situs (cadangan bila demo perlu masuk akun atau gagal dibuka). Maks 8.
 */
async function kumpulkanLayar(produk, situs, peramban, folder, catatan) {
  const layar = [];
  const sk = skenario(produk);
  if (sk) {
    try {
      layar.push(...(await potretLayar(peramban, { ...sk, folder })));
    } catch (e) {
      catatan.push(`Layar demo gagal dipotret: ${e.message.slice(0, 160)}`);
    }
  }
  for (const [i, g] of (produk.layarHp ?? []).entries()) {
    try {
      const r = await fetch(mutlak(g.src, situs));
      if (!r.ok) throw new Error(`unduh ${r.status}`);
      const berkas = path.join(folder, `hp-${i}${path.extname(g.src) || '.jpg'}`);
      await writeFile(berkas, Buffer.from(await r.arrayBuffer()));
      const { lebar, tinggi } = await probe(berkas);
      layar.push({ berkas, lebar, tinggi, keterangan: g.keterangan ?? g.alt });
    } catch (e) {
      catatan.push(`Gambar layar ${g.src} gagal diambil: ${e.message.slice(0, 120)}`);
    }
  }
  return layar.slice(0, 8);
}

/** Tangkapan layar → JPEG lebar 540 dalam base64, untuk dilihat Claude (hemat token). */
async function kecilkan(berkas) {
  const keluar = `${berkas}.kecil.jpg`;
  await ffmpeg(['-y', '-i', berkas, '-vf', 'scale=540:-2', '-q:v', '5', keluar]);
  return (await readFile(keluar)).toString('base64');
}

const pakaiBank = (merek) => Array.isArray(merek?.profil?.bahan) && merek.profil.bahan.includes('bank');

// Folder kerja + Drive tiap merek bank, dibuat & diindeks sekali per putaran.
const konteksBank = new Map();
async function bankMerek(merek, kabar) {
  if (!konteksBank.has(merek.slug)) {
    const ctx = await siapkanMerekBank(merek);
    const r = await indeksBankMerek(merek, ctx);
    if (r.kosong) await kabar(`⚠️ Bank ${merek.nama} terbaca kosong di Drive (${merek.profil.drive}) — indeks lama dipertahankan. Cek folder/izin rclone.`);
    else console.log(`🗂 Bank ${merek.slug}: ${r.total} berkas (${r.baru} baru, ${r.hilang} hilang)`);
    await tandaiBankDiindeks(merek.slug);
    konteksBank.set(merek.slug, ctx);
    // Mata Claude (kurasi bank + belajar gaya) — gagal di sini tak boleh menahan video.
    try {
      const ig = (await daftarKredensial('instagram')).find((k) => k.merek === merek.slug)?.data ?? null;
      const g = await lihatBankMerek(merek, ctx, ig);
      if (g) await kabar(`🎨 Gaya ${merek.nama} diperbarui dari ${g.jumlah} video (${g.baru} baru):\n${g.ringkasan}`);
    } catch (e) {
      console.error(`Mata ${merek.slug}:`, e.message);
    }
  }
  return konteksBank.get(merek.slug);
}

/** Video bahan bank media dari naskah yang sudah disetujui Kyai (merek seperti Lek Kopi). */
async function kerjakanBank(tugas, merek, simpan, kabar) {
  const ctx = await bankMerek(merek, kabar);
  const r = await renderBankMerek(tugas, merek, ctx);
  const url = await simpan(r.berkas, 'video/mp4');
  const hasil = [{ jenis: 'video', rasio: 'story', durasi: Math.round(r.durasi), url }];
  if (r.sampul) {
    hasil.push({ jenis: 'gambar', rasio: 'sampul', url: await simpan(r.sampul, 'image/jpeg') });
  }
  // Biaya AI mesin (pemilih klip, pemeriksa, gambar AI) ditambahkan ke catatan biaya naskah → tampil di Deck.
  const pakai = r.pemakaian && r.pemakaian.biayaUsd > 0 ? [{ tahap: 'render video', penyedia: 'claude', model: 'studio', input: r.pemakaian.input, output: r.pemakaian.output, biayaUsd: r.pemakaian.biayaUsd }] : [];
  return {
    naskah: { ...tugas.naskah, catatan: r.catatan, pemakaian: [...(tugas.naskah?.pemakaian ?? []), ...pakai] },
    caption: tugas.caption ?? '',
    hasil,
    namaProduk: merek.nama,
  };
}

const LABEL_FOKUS_LEKKOPI = {
  'lekkopi-promo': 'Promo & Hari Spesial',
  'lekkopi-menu': 'Menu Andalan',
  'lekkopi-suasana': 'Suasana Kedai',
  'lekkopi-story': 'Cerita Kopi',
};

const SEKTOR_WEB_LABEL = {
  pesantren: 'Pesantren & Lembaga Islam',
  pendidikan: 'Pendidikan & Yayasan',
  umkm: 'UMKM & Bisnis Lokal',
  perusahaan: 'Company Profile & Usaha',
  custom: 'Website Custom',
};

function bangunProdukMerek(tugas, situs, merek, merekBakafrawi = null) {
  // 1. Cek apakah tugas ini untuk Web Custom (mis. almansur.id) dari naskah.webCustom atau profil.web_custom
  const daftarWeb = Array.isArray(merekBakafrawi?.profil?.web_custom) ? merekBakafrawi.profil.web_custom : [];
  const webCustom =
    tugas.naskah?.webCustom?.url
      ? tugas.naskah.webCustom
      : daftarWeb.find((w) => w && w.slug === tugas.produk_slug && w.url);
  if (webCustom && merek?.slug !== 'lekkopi') {
    const url = /^https?:\/\//i.test(String(webCustom.url)) ? String(webCustom.url) : `https://${webCustom.url}`;
    const domain = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return String(webCustom.domain || webCustom.url).replace(/^https?:\/\//i, '').split('/')[0];
      }
    })();
    const sektor = SEKTOR_WEB_LABEL[webCustom.kategori] || 'Website Custom';
    const nama = String(webCustom.nama || domain).trim();
    const fiturBawaan =
      webCustom.kategori === 'pesantren'
        ? [
            { judul: 'Profil Lembaga Terpercaya', isi: 'Menampilkan sejarah, visi misi, dan unit pendidikan pesantren secara rapi.' },
            { judul: 'Info Pendaftaran Santri', isi: 'Memudahkan calon wali santri mencari syarat dan mendaftar dari HP.' },
            { judul: 'Berita & Galeri Kegiatan', isi: 'Update kegiatan pondok dan pengumuman resmi mudah dikelola admin.' },
            { judul: 'Responsif HP & Laptop', isi: 'Ringan dibuka di semua perangkat dan siap muncul di Google.' },
          ]
        : [
            { judul: 'Desain Custom Eksklusif', isi: 'Dirancang khusus mengikuti identitas lembaga atau bisnis Anda.' },
            { judul: 'Cepat & Responsif di HP', isi: 'Tampilan otomatis rapi di layar laptop maupun HP pengunjung.' },
            { judul: 'Mudah Dikelola Admin', isi: 'Pembaruan konten, berita, dan layanan praktis tanpa ribet.' },
            { judul: 'Siap Tampil di Google', isi: 'Struktur rapi untuk meningkatkan kepercayaan calon klien.' },
          ];
    return {
      adalahSoftware: true,
      adalahWebCustom: true,
      produk: {
        slug: tugas.produk_slug || `web-${domain.replace(/[^a-z0-9]+/gi, '-')}`,
        nama,
        klien: nama,
        kategori: 'pesanan',
        label: sektor,
        sektorLabel: sektor,
        urlWeb: url,
        domainWeb: domain,
        aksenWeb: webCustom.aksen || '',
        judul: `Website Custom ${nama} (${domain})`,
        deskripsi:
          String(webCustom.deskripsi || '').trim() ||
          `Website custom profesional (${domain}) untuk sektor ${sektor.toLowerCase()}, dibangun khusus oleh Bakafrawi Project.`,
        platform: ['Website Desktop', 'Mobile Responsive', 'SEO Ready'],
        fitur: fiturBawaan,
        tautan: [{ url, label: `Kunjungi ${domain}`, utama: true }],
        layarHp: [],
        layarDesktop: [],
      },
    };
  }

  const temu = situs.produk.find((p) => p.slug === tugas.produk_slug);
  if (temu && merek?.slug !== 'lekkopi') {
    return { produk: temu, adalahSoftware: true, adalahWebCustom: false };
  }
  const namaMerek = merek?.nama || 'Lek Kopi';
  const labelFokus = LABEL_FOKUS_LEKKOPI[tugas.produk_slug] || 'Kedai Kopi Waru';
  return {
    adalahSoftware: false,
    adalahWebCustom: false,
    produk: {
      slug: tugas.produk_slug || (merek?.slug ?? 'lekkopi'),
      nama: namaMerek,
      kategori: 'kedai',
      label: labelFokus,
      judul: `${namaMerek} — ${labelFokus}`,
      deskripsi:
        'Kedai kopi santai di Panjunan, Waru, Sidoarjo dengan seduhan espresso, es kopi susu gula aren, matcha, dan aneka minuman segar yang juga tersedia di GoFood, GrabFood, ShopeeFood, dan TikTok GO.',
      platform: ['Kedai Outdoor', 'GoFood', 'GrabFood', 'ShopeeFood', 'TikTok GO'],
      fitur: [
        { judul: 'Racikan Kopi Segar', isi: 'Espresso, es kopi susu, & matcha dibuat segar per gelas.' },
        { judul: 'Area Nongkrong Nyaman', isi: 'Suasana outdoor santai di Jl. Kolonel Sugiono No. 112, Panjunan, Waru.' },
        { judul: 'Buka Sore–Malam', isi: 'Melayani Senin–Sabtu pukul 14.00–23.00 WIB.' },
        { judul: 'Order Online Mudah', isi: 'Tersedia di GoFood, GrabFood, ShopeeFood, dan TikTok GO.' },
      ],
      tautan: [],
      layarHp: [],
      layarDesktop: [],
    },
  };
}

/** merek: baris studio_merek tugas ini (identitas tampilan, gaya naskah, WA bila beda dari situs). */
async function kerjakan(tugas, situs, peramban, folder, simpan, merek) {
  const dbAktif = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
  const merekBakafrawi =
    merek?.slug === 'bakafrawi'
      ? merek
      : dbAktif
      ? await bacaMerek('bakafrawi').catch(() => null)
      : null;
  const { produk, adalahSoftware, adalahWebCustom } = bangunProdukMerek(tugas, situs, merek, merekBakafrawi);
  const adalahLekKopi = !adalahSoftware && merek?.slug === 'lekkopi';
  const tema = temaMerek(merek);
  const kontak = {
    ...situs.kontak,
    ...(merek?.profil?.whatsapp
      ? { whatsappTampil: merek.profil.whatsapp }
      : adalahLekKopi
      ? { whatsappTampil: '085710477372' }
      : {}),
  };
  const catatan = [];
  const cocokGaya = String(tugas.arahan ?? '').match(/\[Gaya:\s*([a-z0-9-]+)\]/i);
  const gayaRaw = cocokGaya ? cocokGaya[1].toLowerCase() : '';
  const gayaPilihan = adalahSoftware && gayaRaw === 'sinematik-kafe' ? 'sinematik-ai' : gayaRaw;
  const pilihanSuara = uraiPilihanSuara(tugas.arahan);
  const pilihanKarakter = uraiPilihanKarakter(tugas.arahan);
  const arahanNaskah = pilihanKarakter.bersih.replace(/\[(?:Gaya|Suara):\s*[A-Za-z0-9_-]+\]\s*/gi, '').trim();
  const pakaiAi = tugas.latar === 'ai' || gayaPilihan === 'photo-floating';

  const dirMaskot = path.join(ASET_LOKAL, 'maskot'), dirMusik = path.join(ASET_LOKAL, 'musik');
  if (tugas.jenis === 'video') {
    await salinAsetDrive().catch(() => {});
    await salinAsetSupabase(merekBakafrawi?.profil?.aset_studio ?? []).catch(() => {});
  }
  const daftarSuaraFavorit = tugas.jenis === 'video' ? merekBakafrawi?.profil?.suara_elevenlabs : [];
  const daftarVoiceFavorit = Array.isArray(daftarSuaraFavorit) ? daftarSuaraFavorit : [];
  const suaraTerpilihObj = pilihanSuara.voiceId
    ? daftarVoiceFavorit.find((v) => String(v?.id ?? '').trim() === pilihanSuara.voiceId)
    : null;
  const namaSuaraTerpilih = String(suaraTerpilihObj?.nama ?? '');
  const kebutuhanKarakter = deteksiGenderKarakter(tugas.arahan, { namaSuara: namaSuaraTerpilih });
  const mintaKarakter =
    kebutuhanKarakter === 'wanita' ||
    kebutuhanKarakter === 'pria' ||
    (kebutuhanKarakter !== 'tanpa' &&
      (/\b(karakter|maskot)\b/i.test(arahanNaskah) ||
        Boolean(pilihanKarakter.karakter && pilihanKarakter.karakter !== 'otomatis')));
  const opsiSuara = {
    profilSuara: pilihanSuara.profilSuara ?? undefined,
    voiceId: pilihanSuara.voiceId ?? undefined,
    daftarVoice: daftarVoiceFavorit,
    ...(kebutuhanKarakter === 'wanita' || kebutuhanKarakter === 'pria' ? { gender: kebutuhanKarakter } : {}),
  };

  const referensiMerek = tugas.jenis === 'video' && dbAktif
    ? await semuaReferensi(merek?.slug || 'bakafrawi').catch(() => [])
    : [];

  const evalMerek = merek?.profil?.evaluasi_mingguan ?? null;

  // Gaya video Bakafrawi: Web Custom otomatis memakai `web-showcase` 3D Agency; produk lain mendukung `web-showcase` manual maupun rotasi.
  const GAYA_SOFTWARE_KARAKTER = ['dark-keynote', 'split-hook', 'pov-chat'];
  const GAYA_SOFTWARE_AUTO = ['dark-keynote', 'split-hook', 'pov-chat', 'sinematik-ai'];
  const GAYA_SOFTWARE_MANUAL = [...GAYA_SOFTWARE_AUTO, 'web-showcase', 'editorial-scroll', 'clean-ui'];
  let gayaVideo = '';
  if (tugas.jenis === 'video' && adalahSoftware) {
    if (GAYA_SOFTWARE_MANUAL.includes(gayaPilihan)) {
      gayaVideo = gayaPilihan;
    } else if (adalahWebCustom) {
      gayaVideo = 'web-showcase';
    } else {
      const kolamDasar = mintaKarakter ? GAYA_SOFTWARE_KARAKTER : GAYA_SOFTWARE_AUTO;
      const kolamGaya = pilihKolamGayaDenganEvaluasi(kolamDasar, evalMerek);
      if (evalMerek?.minggu && kolamGaya.length < kolamDasar.length) {
        catatan.push(`evaluasi ${evalMerek.minggu}: prioritas ${kolamGaya.join(',')}`);
      }
      const refTerbaru = referensiMerek.find((r) => kolamGaya.includes(String(r?.analisis?.presetCocok ?? '').toLowerCase()));
      const inginTiru = /tiru|referensi|pola/i.test(arahanNaskah);
      if (refTerbaru && inginTiru) {
        gayaVideo = String(refTerbaru.analisis.presetCocok).toLowerCase();
      } else {
        const hashGaya = String(tugas.id || Date.now()).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
        gayaVideo = kolamGaya[hashGaya % kolamGaya.length];
      }
    }
    catatan.push(`gaya video: ${gayaVideo}`);
    if (referensiMerek.length) catatan.push(`referensi aktif: ${referensiMerek.length}`);
  }

  const adalahWebShowcase = tugas.jenis === 'video' && adalahSoftware && gayaVideo === 'web-showcase';
  const adalahSinematikSoftware = tugas.jenis === 'video' && adalahSoftware && gayaVideo === 'sinematik-ai';
  const adalahEditorialSoftware = tugas.jenis === 'video' && adalahSoftware && gayaVideo === 'editorial-scroll';
  const butuhLayarSoftware = tugas.jenis === 'video' && adalahSoftware && !adalahSinematikSoftware && !adalahWebShowcase;

  // JALUR BARU: Komposisi `WebShowcase` 3D Agency (Desktop Full-Page Scroll + Mobile Responsive + Kursor + Auto-Scan Web)
  if (adalahWebShowcase) {
    const urlShowcase =
      produk.urlWeb ||
      produk.demo?.url ||
      produk.tautan?.find((t) => t.utama)?.url ||
      produk.tautan?.[0]?.url ||
      situs.urlSitus;
    let potretWeb = null;
    if (urlShowcase) {
      try {
        console.log(`🌐 Memindai & memotret Desktop + HP: ${urlShowcase}`);
        potretWeb = await potretWebShowcase(peramban, { url: urlShowcase, folder });
        if (potretWeb?.info?.title) catatan.push(`scan web: ${potretWeb.info.title.slice(0, 60)}`);
      } catch (e) {
        catatan.push(`potret web gagal (${String(e?.message ?? e).slice(0, 120)})`);
      }
    }
    const arahanShowcase = evalMerek?.saranHook
      ? `${arahanNaskah}${arahanNaskah ? '\n' : ''}(Saran hook minggu ini: ${String(evalMerek.saranHook).slice(0, 140)})`
      : arahanNaskah;
    const naskahShowcase = await buatNaskahWebShowcase(produk, situs, arahanShowcase, merek, potretWeb?.info ?? null, referensiMerek);
    if (tugas.naskah?.webCustom) naskahShowcase.webCustom = tugas.naskah.webCustom;

    const tagIntiBakafrawi = ['bakafrawi', 'bakafrawiproject', 'jasapembuatanwebsite', 'websitecustom', 'softwarehouseindonesia', 'websitessidoarjo'];
    const tagGabung = [...new Set([...tagIntiBakafrawi, ...(naskahShowcase.hashtag ?? [])].map((h) => String(h).replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()).filter(Boolean))].slice(0, 10);
    const tujuan = [`WA ${kontak.whatsappTampil}`, tema.situs].filter(Boolean).join(' · ');
    const captionShowcase = `${naskahShowcase.caption}\n\n💬 ${naskahShowcase.ajakan || 'Konsultasi gratis'} → ${tujuan}\n\n${tagGabung.map((h) => `#${h}`).join(' ')}`;

    const berkas = (n) => path.join(folder, n);
    const logo = merek?.profil?.logo ?? LOGO;
    const logoVideo = await ambilLokal(logo.startsWith('file:') ? logo : mutlak(logo, situs), berkas('logo-sumber'));
    const lagu = pilihMusik(await readdir(dirMusik).catch(() => []));
    const musik = process.env.STUDIO_MUSIK || (lagu && path.join(dirMusik, lagu));
    const domainWeb = potretWeb?.info?.domain || produk.domainWeb || urlShowcase.replace(/^https?:\/\//i, '').split('/')[0];
    const aksenUtama = produk.aksenWeb || potretWeb?.info?.warnaAksen || '#18B4A8';

    const r = await renderWebShowcase({
      naskah: naskahShowcase,
      merekInfo: {
        nama: produk.nama,
        domain: domainWeb,
        url: urlShowcase,
        aksen: aksenUtama,
        aksenKedua: '#34E0CD',
        info: tujuan,
        situsBakafrawi: tema.situs || 'bakafrawi.com',
      },
      media: potretWeb,
      logo: logoVideo,
      musik,
      opsiSuara,
      folder,
      keluar: berkas('video.mp4'),
    });
    if (r.catatanSuara) catatan.push(r.catatanSuara);
    if (catatan.length) naskahShowcase.catatan = catatan;
    const hasilShowcase = [{ jenis: 'video', rasio: 'story', durasi: Math.round(r.durasi), url: await simpan(r.berkas, 'video/mp4') }];
    if (r.sampul) hasilShowcase.push({ jenis: 'gambar', rasio: 'sampul', url: await simpan(r.sampul, 'image/jpeg') });
    return { naskah: naskahShowcase, caption: captionShowcase, hasil: hasilShowcase, namaProduk: produk.nama };
  }

  const layarApp = butuhLayarSoftware ? await kumpulkanLayar(produk, situs, peramban, folder, catatan) : [];
  if (butuhLayarSoftware && !adalahEditorialSoftware && !layarApp.length) {
    throw new Error('Produk ini belum punya layar aplikasi (tautan/skenario demo atau gambar layar HP) untuk video.');
  }
  const karakter =
    tugas.jenis === 'video' && adalahSoftware && !adalahSinematikSoftware && !adalahEditorialSoftware && kebutuhanKarakter !== 'tanpa'
      ? kelompokKarakter(await readdir(dirMaskot, { recursive: true }).catch(() => []))
      : new Map();

  const arahanDenganHook = evalMerek?.saranHook
    ? `${arahanNaskah}${arahanNaskah ? '\n' : ''}(Saran hook minggu ini: ${String(evalMerek.saranHook).slice(0, 140)})`
    : arahanNaskah;

  const arahanUntukAi =
    kebutuhanKarakter === 'wanita'
      ? `${arahanDenganHook}${arahanDenganHook ? '\n' : ''}(Gunakan karakter pembawa acara wanita dari daftar karakter)`
      : kebutuhanKarakter === 'pria'
      ? `${arahanDenganHook}${arahanDenganHook ? '\n' : ''}(Gunakan karakter pembawa acara pria dari daftar karakter)`
      : arahanDenganHook;

  const naskah = tugas.jenis === 'video'
    ? (adalahSoftware && !adalahSinematikSoftware && !adalahEditorialSoftware
        ? await buatNaskahVideo(produk, situs, arahanUntukAi, merek, layarApp, kecilkan, [...karakter.keys()], referensiMerek)
        : await buatNaskahVideoFullAi(produk, situs, arahanDenganHook, merek, referensiMerek))
    : await buatNaskah(produk, situs, arahanNaskah, tugas.jenis, merek);

  // Standar caption & hashtag konsisten per merek (anti-duplikat, maks 10 hashtag)
  let caption;
  if (adalahLekKopi) {
    const tagIntiLek = ['lekkopi', 'lekkopisidoarjo', 'kopiwaru', 'kopisidoarjo', 'ngopidisidoarjo', 'kedaikopisidoarjo'];
    const tagGabung = [...new Set([...tagIntiLek, ...(merek?.profil?.hashtag ?? []), ...(naskah.hashtag ?? [])].map((h) => String(h).replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()).filter(Boolean))].slice(0, 10);
    const ctaLek = '📍 Jl. Kolonel Sugiono No. 112, Panjunan, Waru, Sidoarjo\n⏰ Senin–Sabtu, 14.00–23.00 WIB (tersedia di GoFood, GrabFood, ShopeeFood & TikTok GO)';
    caption = `${naskah.caption}\n\n${naskah.ajakan ? `✨ ${naskah.ajakan}\n` : ''}${ctaLek}\n\n${tagGabung.map((h) => `#${h}`).join(' ')}`;
  } else {
    const tagIntiBakafrawi = ['bakafrawi', 'bakafrawiproject', 'jasapembuatanaplikasi', 'aplikasiumkm', 'softwarehouseindonesia', 'websitessidoarjo'];
    const tagGabung = [...new Set([...tagIntiBakafrawi, ...(naskah.hashtag ?? [])].map((h) => String(h).replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()).filter(Boolean))].slice(0, 10);
    const tujuan = [`WA ${kontak.whatsappTampil}`, tema.situs].filter(Boolean).join(' · ');
    caption = `${naskah.caption}\n\n💬 ${naskah.ajakan || 'Konsultasi gratis'} → ${tujuan}\n\n${tagGabung.map((h) => `#${h}`).join(' ')}`;
  }

  let layar = adalahSoftware ? (produk.layarHp?.[0]?.src ?? produk.layarDesktop?.[0]?.src) : null;
  // Khusus poster Web Custom: potret langsung tampilan situs asli sebagai visual utama poster.
  if (tugas.jenis === 'gambar' && adalahWebCustom && produk.urlWeb && !layar) {
    try {
      const potretPoster = await potretWebShowcase(peramban, { url: produk.urlWeb, folder, tunggu: 2200 });
      const sumberPoster = potretPoster?.mobileHero?.berkas || potretPoster?.desktopHero?.berkas;
      if (sumberPoster) layar = berkasUrl(sumberPoster);
    } catch (e) {
      catatan.push(`screenshot poster web custom dilewati: ${String(e?.message ?? e).slice(0, 100)}`);
    }
  }
  const gambar = adalahSoftware ? (layar ?? produk.logo?.src) : null;
  const logo = merek?.profil?.logo ?? (merek?.slug === 'bakafrawi' || !merek ? LOGO : '');
  if (tugas.naskah?.webCustom && naskah && typeof naskah === 'object') {
    naskah.webCustom = tugas.naskah.webCustom;
  }
  const umum = { naskah, produk, logo, kontak, tema };
  const hasil = [];
  const berkas = (n) => path.join(folder, n);

  if (tugas.jenis === 'gambar') {
    const gayaBawaan = !adalahSoftware && pakaiAi ? 'photo-floating' : 'modern-clean';
    const gayaPoster = ['modern-clean', 'before-after', 'bold-typo', 'photo-floating'].includes(gayaPilihan) ? gayaPilihan : gayaBawaan;
    if (gayaPoster !== 'modern-clean') catatan.push(`gaya poster: ${gayaPoster}`);
    const gambarHref = gambar ? (gambar.startsWith('file:') ? gambar : mutlak(gambar, situs)) : null;
    for (const rasio of ['feed', 'potret', 'story']) {
      const foto = pakaiAi ? await fotoAi(naskah.adegan?.[0], RASIO_AI[rasio], berkas(`latar-${rasio}.png`), catatan) : null;
      const keluar = berkas(`poster-${rasio}.jpg`);
      await potret(peramban, { ...UKURAN[rasio], keluar, html: htmlPoster({ ...umum, rasio, foto, gaya: gayaPoster, gambar: gambarHref, gambarIkon: !layar }) });
      hasil.push({ jenis: 'gambar', rasio, url: await simpan(keluar, 'image/jpeg') });
    }
  } else if (!adalahSoftware || adalahSinematikSoftware || adalahEditorialSoftware) {
    // Video Full AI (Sinematik 5 adegan untuk Lek Kopi & Bakafrawi) atau Editorial Laptop Scroll (Bakafrawi).
    const logoVideo = adalahSoftware
      ? await ambilLokal(produk.logo?.src ? mutlak(produk.logo.src, situs) : logo, berkas('logo-sumber'))
      : logo
      ? await ambilLokal(logo.startsWith('file:') ? logo : mutlak(logo, situs), berkas('logo-sumber'))
      : null;
    const adeganPakai = adalahEditorialSoftware ? naskah.adegan.slice(0, 4) : naskah.adegan;
    const teksNarasi = adeganPakai.map((a) => a.narasi);
    const hasilSuara = await suaraAdegan(teksNarasi, folder, opsiSuara);
    if (hasilSuara.catatan) catatan.push(hasilSuara.catatan);
    catatan.push(
      `mode: ${adalahEditorialSoftware ? 'editorial-scroll' : 'video Full AI'} · suara: ${hasilSuara.jalur}${
        hasilSuara.voiceId ? ` (${hasilSuara.voiceId.slice(0, 8)})` : `/${hasilSuara.profil ?? 'otomatis'}`
      }`,
    );

    const segmen = [];
    let gambarTerakhir = null;
    let totalDetik = 0;
    for (const [i, a] of adeganPakai.entries()) {
      const infoSuara = hasilSuara.berkas[i] ? await probe(hasilSuara.berkas[i]).catch(() => ({ durasi: 3.8 })) : { durasi: 3.8 };
      const durasi = adalahEditorialSoftware
        ? Math.max(2.8, Math.min(7.5, (Number(infoSuara.durasi) || 3.4) + 0.4))
        : Math.max(3.2, Math.min(9, (Number(infoSuara.durasi) || 4.5) + 0.55));
      totalDetik += durasi;
      let pathGambar = adalahEditorialSoftware && layarApp[i]?.berkas ? layarApp[i].berkas : null;
      if (!pathGambar) {
        try {
          const g = await buatGambarAi(a.bidikan, adalahEditorialSoftware ? '4:3' : '9:16', berkas(`ai-adegan-${i + 1}`));
          pathGambar = g.berkas;
        } catch (e) {
          catatan.push(`gambar AI adegan ${i + 1} gagal: ${String(e.message ?? e).slice(0, 120)}`);
          pathGambar = (adalahEditorialSoftware && layarApp.length ? layarApp[i % layarApp.length].berkas : null) || gambarTerakhir;
        }
      }
      if (pathGambar) gambarTerakhir = pathGambar;
      if (!pathGambar) throw new Error('Semua penyedia gambar AI gagal untuk video Full AI.');
      segmen.push({ adegan: i, sumber: pathGambar, jenis: 'foto', durasi, mulaiKlip: 0 });
    }
    const rencana = {
      adegan: adeganPakai.map((a) => ({ teksLayar: a.teksLayar || '', gayaTeks: 'editorial', suara: a.narasi })),
      segmen,
      total: totalDetik + (adalahEditorialSoftware ? 0.5 : 2.2),
    };
    const lagu = pilihMusik(await readdir(dirMusik).catch(() => []));
    const musik = process.env.STUDIO_MUSIK || (lagu && path.join(dirMusik, lagu));
    const r = await renderSinematikRemotion({
      rencana,
      merek: {
        nama: adalahSoftware ? produk.nama : (merek?.nama || 'Lek Kopi'),
        sub: tema.situs || (adalahSoftware ? 'bakafrawi.com' : 'Panjunan, Waru, Sidoarjo'),
        aksen: adalahSoftware ? '#18B4A8' : tema.aksen,
        info: kontak.whatsappTampil ? `WA ${kontak.whatsappTampil}` : '',
      },
      logo: logoVideo,
      musik,
      musikVolume: 0.22,
      suara: hasilSuara.berkas,
      gaya: adalahEditorialSoftware ? 'editorial-scroll' : 'sinematik-kafe',
      folder,
      keluar: berkas('video.mp4'),
    });
    hasil.push({ jenis: 'video', rasio: 'story', durasi: Math.round(r.durasi), url: await simpan(r.berkas, 'video/mp4') });
    if (r.sampul) hasil.push({ jenis: 'gambar', rasio: 'sampul', url: await simpan(r.sampul, 'image/jpeg') });
  } else {
    // Bila latar AI aktif, buat 1 foto suasana cerita manusia (TANPA layar HP/komputer palsu) sebagai latar Ken Burns di balik animasi UI.
    let latarGambarAi = null;
    if (pakaiAi && adaGambarAi()) {
      const konteksSuasana = /ammu|pesantren|santri|tpq|madrasah/i.test(`${produk.slug} ${produk.nama}`)
        ? 'Warm cinematic Indonesian Islamic boarding school (pesantren) courtyard and tidy office atmosphere at golden hour, peaceful architecture, lush tropical greenery, soft bokeh, NO smartphone screens, NO laptops, NO computer monitors, NO text'
        : 'Modern tidy Indonesian small business shop and warm workspace atmosphere at golden hour, warm architectural lighting, clean minimal interior bokeh, NO smartphone screens, NO laptops, NO computer monitors, NO text';
      try {
        latarGambarAi = (await buatGambarAi(konteksSuasana, '9:16', berkas('latar-ui-ai'))).berkas;
      } catch (e) {
        catatan.push(`latar AI video dilewati: ${String(e?.message ?? e).slice(0, 120)}`);
      }
    }

    const logoVideo = await ambilLokal(produk.logo?.src ? mutlak(produk.logo.src, situs) : logo, berkas('logo-sumber'));
    const props = keNaskah(naskah, {
      nama: produk.nama,
      logo: 'logo',
      utama: merek?.profil?.warna_utama || WARNA.utama,
      kedua: tema.aksen,
      layar: layarApp,
      gaya: gayaVideo,
      info: [tema.situs, kontak.whatsappTampil && `WA ${kontak.whatsappTampil}`].filter(Boolean).join(' · '),
      fitur: produk.fitur.map((f) => f.judul),
    });
    // Satu karakter per video (pilihan eksplisit → AI → slug merek → acak), selaraskan gender karakter & suara.
    const pilihanKarakterSlug =
      pilihanKarakter.karakter && !['otomatis', 'wanita', 'pria', 'tanpa'].includes(pilihanKarakter.karakter)
        ? pilihanKarakter.karakter
        : naskah.karakter;
    const tokoh =
      kebutuhanKarakter === 'tanpa'
        ? null
        : pilihKarakter([...karakter.keys()], {
            pilihan: pilihanKarakterSlug,
            slug: merek?.slug,
            gender: kebutuhanKarakter,
          });
    const maskot = tokoh ? maskotAdegan(props.adegan, karakter.get(tokoh)).map((b) => b && path.join(dirMaskot, b)) : null;
    if (tokoh) naskah.karakter = tokoh;
    else if (kebutuhanKarakter === 'tanpa') naskah.karakter = '';
    const genderFinal =
      kebutuhanKarakter === 'wanita' || kebutuhanKarakter === 'pria'
        ? kebutuhanKarakter
        : tokoh
        ? suaraKarakter(tokoh) === SUARA.wanita
          ? 'wanita'
          : 'pria'
        : null;
    const opsiSuaraVideo = genderFinal ? { ...opsiSuara, gender: genderFinal } : opsiSuara;
    catatan.push(`karakter: ${tokoh || 'tanpa'}`);
    const lagu = pilihMusik(await readdir(dirMusik).catch(() => []));
    const musik = process.env.STUDIO_MUSIK || (lagu && path.join(dirMusik, lagu));
    const r = await renderIklan({ naskah: props, aset: { logo: logoVideo, layar: layarApp, maskot, latarGambar: latarGambarAi }, folder, musik, suara: suaraKarakter(tokoh), opsiSuara: opsiSuaraVideo, keluar: berkas('video.mp4') });
    hasil.push({ jenis: 'video', rasio: 'story', durasi: Math.round(r.durasi), url: await simpan(r.berkas, 'video/mp4') });
    hasil.push({ jenis: 'gambar', rasio: 'sampul', url: await simpan(r.sampul, 'image/jpeg') });
  }
  if (catatan.length) naskah.catatan = catatan;
  return { naskah, caption, hasil, namaProduk: adalahSoftware ? produk.nama : (merek?.nama || produk.nama) };
}

/** Pastikan URL media dapat diunduh langsung oleh server Instagram (unggah berkas lokal public/ ke bucket studio bila perlu). */
async function pastikanUrlPublik(urlAsal, jenis = 'video') {
  const u = String(urlAsal ?? '').trim();
  if (!u) return u;
  const namaBerkas = u.startsWith('/') ? u.replace(/^\//, '') : u.endsWith('/lekkopi-opening-story.mp4') ? 'lekkopi-opening-story.mp4' : '';
  if (namaBerkas) {
    try {
      const lokal = path.join(DIR, '..', 'public', namaBerkas);
      const isi = await readFile(lokal);
      const mime = jenis === 'gambar' || /\.(jpg|jpeg|png)$/i.test(namaBerkas) ? 'image/jpeg' : 'video/mp4';
      return await unggah(`rutin/${path.basename(namaBerkas)}`, isi, mime);
    } catch {
      // Bila berkas lokal tak ada, lanjutkan dengan URL situs publik
    }
  }
  return /^https?:\/\//.test(u) ? u : `https://bakafrawi.com/${u.replace(/^\//, '')}`;
}

/** Tayangkan satu tugas yang disetujui ke Instagram → objek `tayang`. */
async function tayangkan(tugas, k) {
  const sasaran = tugas.tayang?.sasaran || tugas.naskah?.sasaran || 'otomatis';
  const adalahRutin = tugas.produk_slug === 'rutin-buka' || Boolean(tugas.naskah?.rutin);

  // Jadwal rutin jam buka (bisa berisi video statis, konten generated AI baru tiap hari, atau keduanya)
  if (adalahRutin) {
    const daftarMedia = [...(tugas.hasil ?? []).filter((h) => h.rasio !== 'sampul' && h.url)];
    const aiRutin = tugas.naskah?.aiRutin;
    const sudahAdaAi = daftarMedia.some((h) => h.sumber === 'opening-ai' || String(h.judul ?? '').startsWith('Opening AI:'));
    let hasilBaru = null;

    if (aiRutin?.aktif && !sudahAdaAi) {
      const folderAi = path.join(DIR, 'kerja', `opening-ai-${tugas.id}`);
      try {
        const merekInfo = await bacaMerek(tugas.merek ?? 'lekkopi');
        console.log(`✨ Membuat Story Opening AI (${aiRutin.format ?? 'video-animasi'}) untuk ${merekInfo?.nama ?? tugas.merek}…`);
        const r = await renderOpeningAI({
          merek: merekInfo,
          format: aiRutin.format === 'poster' ? 'poster' : 'video-animasi',
          gaya: aiRutin.gaya || 'otomatis',
          arahan: aiRutin.arahan || '',
          jamBuka: aiRutin.jamBuka || '09:00',
          daftarMenu: Array.isArray(aiRutin.daftarMenu) ? aiRutin.daftarMenu : [],
          folder: folderAi,
        });
        const urlAi = await unggah(`rutin/${tugas.id}-${path.basename(r.berkas)}`, await readFile(r.berkas), r.mime);
        const itemAi = {
          jenis: r.jenis,
          rasio: 'story',
          sumber: 'opening-ai',
          url: urlAi,
          ...(r.durasi ? { durasi: r.durasi } : {}),
          judul: `Opening AI: ${r.konsep.menuNama}`,
          sasaran: 'story',
          caption: `${r.konsep.judul.replace(/\n/g, ' ')} — ${r.konsep.menuNama} ${r.konsep.menuHarga}`.trim(),
        };
        daftarMedia.push(itemAi);
        hasilBaru = [...(tugas.hasil ?? []), itemAi];
      } finally {
        await rm(folderAi, { recursive: true, force: true }).catch(() => {});
      }
    }

    if (!daftarMedia.length) throw new Error('Daftar video jadwal buka kosong.');
    const stories = [];
    const daftarReels = [];
    for (const item of daftarMedia) {
      const jenisItem = item.jenis === 'gambar' ? 'gambar' : 'video';
      const urlPublik = await pastikanUrlPublik(item.url, jenisItem);
      const sasaranItem = item.sasaran || sasaran || 'story';
      if ((sasaranItem === 'reels' || sasaranItem === 'reels+story') && jenisItem === 'video') {
        daftarReels.push(await postingReels(k, urlPublik, item.caption ?? tugas.caption ?? ''));
      }
      if (sasaranItem === 'story' || sasaranItem === 'reels+story' || sasaranItem === 'otomatis') {
        stories.push(await postingStory(k, urlPublik, jenisItem));
      }
    }
    return {
      sasaran: 'story',
      rutin: true,
      ...(hasilBaru ? { _hasilBaru: hasilBaru } : {}),
      instagram: {
        story: stories[0] ?? null,
        stories,
        reels: daftarReels[0] ?? null,
        daftarReels,
        waktu: new Date().toISOString(),
      },
    };
  }

  const ambil = (rasio) => tugas.hasil.find((h) => h.rasio === rasio)?.url;
  if (tugas.jenis === 'video') {
    const videoAsal = ambil('story') ?? tugas.hasil.find((h) => h.jenis === 'video')?.url;
    const videoUrl = await pastikanUrlPublik(videoAsal, 'video');
    if (sasaran === 'story') {
      const story = await postingStory(k, videoUrl, 'video');
      return { sasaran, instagram: { story, waktu: new Date().toISOString() } };
    }
    if (sasaran === 'reels+story') {
      const reels = await postingReels(k, videoUrl, tugas.caption ?? '');
      const story = await postingStory(k, videoUrl, 'video').catch((e) => ({ galat: e.message }));
      return { sasaran, instagram: { reels, story, waktu: new Date().toISOString() } };
    }
    const reels = await postingReels(k, videoUrl, tugas.caption ?? '');
    return { sasaran, instagram: { reels, waktu: new Date().toISOString() } };
  }

  if (sasaran === 'story') {
    const gambarUrl = await pastikanUrlPublik(ambil('story') ?? ambil('potret') ?? ambil('feed'), 'gambar');
    const story = await postingStory(k, gambarUrl, 'gambar');
    return { sasaran, instagram: { story, waktu: new Date().toISOString() } };
  }
  const feedUrl = await pastikanUrlPublik(ambil('potret') ?? ambil('feed'), 'gambar');
  const feed = await postingFeed(k, feedUrl, tugas.caption ?? '');
  if (sasaran === 'feed') {
    return { sasaran, instagram: { feed, waktu: new Date().toISOString() } };
  }
  // Story pelengkap: gagal di sini tak membatalkan feed yang sudah tayang.
  const storyAsal = ambil('story');
  const story = storyAsal
    ? await postingStory(k, await pastikanUrlPublik(storyAsal, 'gambar'), 'gambar').catch((e) => ({ galat: e.message }))
    : null;
  return { sasaran, instagram: { feed, story, waktu: new Date().toISOString() } };
}

const ZONA_WIB_MS = 7 * 3600_000;
function tanggalWib(d = new Date()) {
  const wib = new Date(d.getTime() + ZONA_WIB_MS);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}-${String(wib.getUTCDate()).padStart(2, '0')}`;
}

/** Hitung waktu jam buka berikutnya (WIB) untuk jadwal rutin merek. */
function hitungJamBukaBerikutnya(jadwal, sekarang = new Date()) {
  if (!jadwal?.aktif) return null;
  const hariAktif = Array.isArray(jadwal.hari) ? jadwal.hari.map(Number) : [1, 2, 3, 4, 5, 6];
  const videoAktif = (jadwal.video ?? []).filter((v) => v && v.aktif && v.url);
  if (!hariAktif.length || (!jadwal.aiAktif && !videoAktif.length)) return null;
  const cocok = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(jadwal.jam ?? '09:00').trim());
  const [jamNum, menitNum] = cocok ? [Number(cocok[1]), Number(cocok[2])] : [9, 0];
  const wib = new Date(sekarang.getTime() + ZONA_WIB_MS);
  const hariIni = tanggalWib(sekarang);

  for (let offset = 0; offset <= 7; offset++) {
    const kandidatWib = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + offset, jamNum, menitNum, 0));
    if (!hariAktif.includes(kandidatWib.getUTCDay())) continue;
    const targetUtc = new Date(kandidatWib.getTime() - ZONA_WIB_MS);
    const tgl = tanggalWib(targetUtc);
    if (jadwal.terakhirTayang && tgl === jadwal.terakhirTayang) continue;
    if (offset === 0 && targetUtc.getTime() <= sekarang.getTime() + 2 * 60_000 && tgl === hariIni) continue;
    return targetUtc;
  }
  return null;
}

function pilihVideoBukaMurni(jadwal, untukTanggal = new Date()) {
  const aktif = (jadwal?.video ?? []).filter((v) => v && v.aktif && v.url);
  if (!aktif.length) return [];
  if (jadwal?.mode === 'acak') {
    if (aktif.length === 1) return [aktif[0]];
    const riwayat = Array.isArray(jadwal.riwayatVideo) ? jadwal.riwayatVideo : [];
    const sudah = new Set(riwayat);
    const terakhir = jadwal.terakhirVideoId || (riwayat.length ? riwayat[riwayat.length - 1] : null);
    let kandidat = aktif.filter((v) => !sudah.has(v.id) && v.id !== terakhir);
    if (!kandidat.length) kandidat = aktif.filter((v) => v.id !== terakhir);
    if (!kandidat.length) kandidat = aktif;
    const idx = Math.floor(Math.random() * kandidat.length);
    return [kandidat[idx] ?? kandidat[0]];
  }
  const wajib = aktif.filter((v) => v.wajib !== false);
  const pendamping = aktif.filter((v) => v.wajib === false);
  if (jadwal?.mode !== 'wajib+bergilir') return [...wajib, ...pendamping];
  const hariEpoch = Math.floor((untukTanggal.getTime() + ZONA_WIB_MS) / 86_400_000);
  if (pendamping.length > 0) return [...wajib, pendamping[Math.abs(hariEpoch) % pendamping.length]];
  return wajib.length ? wajib : [aktif[Math.abs(hariEpoch) % aktif.length]];
}

function catatRiwayatVideoMurni(jadwal, videoId) {
  const id = String(videoId ?? '').trim();
  if (!id) return { riwayatVideo: Array.isArray(jadwal?.riwayatVideo) ? jadwal.riwayatVideo : [], terakhirVideoId: jadwal?.terakhirVideoId ?? null };
  const aktifIds = new Set((jadwal?.video ?? []).filter((v) => v && v.aktif && v.id).map((v) => v.id));
  const lama = (Array.isArray(jadwal?.riwayatVideo) ? jadwal.riwayatVideo : []).filter((x) => aktifIds.has(x) && x !== id);
  const baru = [...lama, id];
  const riwayatFinal = aktifIds.size > 1 && baru.length >= aktifIds.size ? [id] : baru;
  return { riwayatVideo: riwayatFinal, terakhirVideoId: id };
}

/**
 * Pastikan merek yang mengaktifkan `profil.jadwal_rutin` selalu punya tugas terjadwal berikutnya
 * di `studio_tugas` supaya pg_cron `studio_picu` menyalakan mesin tepat saat jam buka tiba.
 */
async function pastikanJadwalRutin(merekBaruTayang = new Map()) {
  try {
    const daftar = await semuaMerek();
    const hariIni = tanggalWib(new Date());
    for (const m of daftar) {
      const jr = m.profil?.jadwal_rutin;
      if (!jr?.aktif) continue;
      let jadwal = { ...jr };
      if (merekBaruTayang.has(m.slug)) {
        const videoIdTayang = merekBaruTayang.get(m.slug);
        const riwayatUpdate = videoIdTayang ? catatRiwayatVideoMurni(jadwal, videoIdTayang) : {};
        jadwal = { ...jadwal, terakhirTayang: hariIni, ...riwayatUpdate };
        await perbaruiProfilMerek(m.slug, { ...m.profil, jadwal_rutin: jadwal }).catch((e) => console.error(e.message));
      }
      const sudahAda = await cariTugasRutinTerjadwal(m.slug);
      if (sudahAda) continue;
      const berikutnya = hitungJamBukaBerikutnya(jadwal, new Date());
      if (!berikutnya) continue;
      const dipilih = pilihVideoBukaMurni(jadwal, berikutnya);
      if (!jadwal.aiAktif && !dipilih.length) continue;
      const aiRutin = jadwal.aiAktif
        ? {
            aktif: true,
            format: jadwal.aiFormat === 'poster' ? 'poster' : 'video-animasi',
            gaya: jadwal.aiGaya || 'otomatis',
            arahan: jadwal.aiArahan || '',
            jamBuka: jadwal.jam || '09:00',
            daftarMenu: Array.isArray(m.profil?.menu_asli) ? m.profil.menu_asli : [],
          }
        : null;
      const labelMode = jadwal.mode === 'acak' ? 'acak' : jadwal.mode === 'wajib+bergilir' ? 'bergilir' : 'semua';
      await buatTugasRutin({
        merek: m.slug,
        jenis: aiRutin?.format === 'poster' && !dipilih.length ? 'gambar' : 'video',
        produk_slug: 'rutin-buka',
        arahan: `Jadwal otomatis jam buka (${jadwal.jam} WIB · mode ${labelMode} · ${dipilih[0]?.judul ?? 'konten'}${aiRutin ? ' + AI' : ''})`,
        latar: 'polos',
        status: 'selesai',
        selesai: new Date().toISOString(),
        status_tayang: 'dijadwalkan',
        jadwal_tayang: berikutnya.toISOString(),
        caption: dipilih[0]?.caption || `We are OPEN! ${m.nama} ☕`,
        naskah: {
          sumber: aiRutin ? 'jadwal-rutin-ai' : 'jadwal-rutin',
          judul: `Story Jam Buka (${jadwal.jam} WIB)${dipilih[0]?.judul ? ` · ${dipilih[0].judul}` : ''}`,
          sasaran: 'story',
          rutin: true,
          mode: jadwal.mode ?? 'acak',
          videoDipilihId: dipilih[0]?.id ?? null,
          videoDipilihJudul: dipilih[0]?.judul ?? null,
          ...(aiRutin ? { aiRutin } : {}),
        },
        tayang: { sasaran: 'story', rutin: true },
        hasil: dipilih.map((v) => ({
          id: v.id,
          jenis: v.jenis === 'gambar' ? 'gambar' : 'video',
          rasio: 'story',
          url: v.url,
          durasi: v.durasi ?? 9,
          judul: v.judul,
          sasaran: v.sasaran ?? 'story',
          caption: v.caption ?? '',
        })),
      });
      console.log(`⏰ Jadwal rutin ${m.slug} berikutnya: ${berikutnya.toISOString()} (${dipilih[0]?.judul ?? `${dipilih.length} video`})`);
    }
  } catch (e) {
    console.error('Jadwal rutin:', e.message);
  }
}

/**
 * Draf TikTok untuk video yang baru tayang di IG (bila merek menyambungkan TikTok): masuk kotak
 * masuk TikTok, Kyai menekan Posting di aplikasi. Refresh token TikTok berganti tiap dipakai →
 * selalu disimpan ulang. null = merek tak punya TikTok / bukan video.
 */
async function drafTiktokTugas(tugas, tayang) {
  if (tugas.jenis !== 'video') return null;
  if (tayang?.sasaran === 'story' && !tayang?.instagram?.reels) return null;
  const kred = (await daftarKredensial('tiktok')).find((k) => k.merek === (tugas.merek ?? 'bakafrawi'));
  if (!kred) return null;
  let k = { data: kred.data };
  const baru = await segarkanTiktok(k);
  if (baru) {
    k = { data: { ...baru.data, kedaluwarsa: baru.kedaluwarsa } };
    await perbaruiKredensial(kred.merek, 'tiktok', { data: k.data });
  }
  const urlAsal = tugas.hasil.find((h) => h.jenis === 'video')?.url;
  if (!urlAsal) throw new Error('video tidak ditemukan');
  const url = await pastikanUrlPublik(urlAsal, 'video');
  const berkas = path.join(os.tmpdir(), `tiktok-${tugas.id}.mp4`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`unduh video ${r.status}`);
  await writeFile(berkas, Buffer.from(await r.arrayBuffer()));
  try {
    return { publish_id: await drafTiktok(k, berkas), akun: k.data.akun };
  } finally {
    await rm(berkas, { force: true });
  }
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

async function putaranTayang(kabar, chat = null) {
  const akun = await akunInstagram(kabar);
  const merekRutinTayang = new Map();
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
      const hasilBaru = tayang._hasilBaru;
      if (hasilBaru) delete tayang._hasilBaru;
      // TikTok pelengkap: gagal di sini tak membatalkan Instagram yang sudah tayang.
      const tt = await drafTiktokTugas(tugas, tayang).catch((e) => ({ galat: String(e.message ?? e).slice(0, 300) }));
      if (tt) tayang.tiktok = tt;
      const hasilAkhir = hasilBaru ?? tugas.hasil ?? [];
      await perbaruiTugas(tugas.id, { status_tayang: 'tayang', tayang, ...(hasilBaru ? { hasil: hasilBaru } : {}), galat: null });
      if (tugas.produk_slug === 'rutin-buka' || tugas.naskah?.rutin) {
        const videoIdTayang = tugas.naskah?.videoDipilihId ?? hasilAkhir[0]?.id ?? null;
        merekRutinTayang.set(tugas.merek ?? 'lekkopi', videoIdTayang);
      }
      const tautan = tayang.instagram.reels?.permalink ?? tayang.instagram.feed?.permalink ?? '';
      const jmlStory = tayang.instagram.stories?.length ?? (tayang.instagram.story?.id ? 1 : 0);
      const labelTayang = tayang.rutin
        ? `Story Jam Buka (${jmlStory} konten${hasilBaru ? ' · termasuk Generated AI' : ''})`
        : tayang.sasaran === 'story'
        ? 'Story Instagram'
        : tayang.sasaran === 'reels+story'
        ? 'Reels + Story Instagram'
        : 'Instagram';
      const teksTt = !tt ? '' : tt.galat ? `\nTikTok: gagal (${tt.galat})` : `\nTikTok ${tt.akun ?? ''}: draf masuk — buka TikTok → Kotak masuk → ketuk Posting, lalu tempel caption.`;
      const pesanAkhir = `✅ ${labelTayang} sudah tayang di ${k.ig_akun ?? 'Instagram'}${tautan ? `\n${tautan}` : ''}${tayang.instagram.story?.galat ? `\n(Story gagal: ${tayang.instagram.story.galat})` : ''}${teksTt}`;
      // Kirim beserta video/foto aslinya ke Telegram supaya Kyai bisa melihat hasil yang baru tayang.
      if (tayang.rutin && chat && adaTelegram() && hasilAkhir.length) {
        await kirimMediaTayang(chat, { teks: pesanAkhir, hasil: hasilAkhir }).catch(() => kabar(pesanAkhir));
      } else {
        await kabar(pesanAkhir);
      }
    } catch (e) {
      console.error('✖ Tayang gagal:', e);
      await perbaruiTugas(tugas.id, { status_tayang: 'gagal', galat: `Tayang gagal: ${String(e.message ?? e).slice(0, 800)}` });
      await kabar(`❌ Gagal tayang ke Instagram: ${e.message}`);
    }
  }
  await pastikanJadwalRutin(merekRutinTayang);
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

  // Bank media merek yang indeksnya basi (> 6 jam): Lek Kopi sudah Full AI sehingga tidak perlu indeks bank Drive.
  for (const merek of (await merekBankBasi().catch((e) => (console.error(e.message), []))).filter((m) => m.slug !== 'lekkopi')) {
    await bankMerek(merek, kabar).catch((e) => kabar(`⚠️ Gagal membaca bank ${merek.nama}: ${e.message.slice(0, 300)}`));
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
          const merek = merekCache.get(slug);
          let hasilKerja;
          if (tugas.produk_slug === 'rutin-buka') {
            // Mode Pratinjau Story Buka (cek dulu di Studio & Telegram sebelum ditayangkan)
            const aiRutin = tugas.naskah?.aiRutin ?? {};
            const r = await renderOpeningAI({
              merek,
              format: aiRutin.format === 'poster' ? 'poster' : 'video-animasi',
              gaya: aiRutin.gaya || 'otomatis',
              arahan: aiRutin.arahan || '',
              jamBuka: aiRutin.jamBuka || '09:00',
              daftarMenu: Array.isArray(aiRutin.daftarMenu) ? aiRutin.daftarMenu : (Array.isArray(merek?.profil?.menu_asli) ? merek.profil.menu_asli : []),
              folder,
            });
            const urlAi = await simpan(r.berkas, r.mime);
            const itemAi = {
              jenis: r.jenis,
              rasio: 'story',
              sumber: 'opening-ai',
              url: urlAi,
              ...(r.durasi ? { durasi: r.durasi } : {}),
              judul: `Opening AI: ${r.konsep.menuNama}`,
              sasaran: 'story',
              caption: `${r.konsep.judul.replace(/\n/g, ' ')} — ${r.konsep.menuNama} ${r.konsep.menuHarga}`.trim(),
            };
            const hasilGabung = [...(tugas.hasil ?? []), itemAi];
            if (r.sampul) {
              hasilGabung.push({ jenis: 'gambar', rasio: 'sampul', url: await simpan(r.sampul, 'image/jpeg') });
            }
              hasilKerja = {
              naskah: { ...tugas.naskah, sumber: r.konsep.sumber, judul: `Story Jam Buka (${merek?.nama ?? slug})` },
              caption: itemAi.caption || `We are OPEN! ${merek?.nama ?? 'Lek Kopi'} ☕`,
              hasil: hasilGabung,
              namaProduk: `${merek?.nama ?? slug} · Story Jam Buka`,
            };
          } else if (tugas.produk_slug === 'lekkopi-serial' || Boolean(tugas.naskah?.serialKartun)) {
            if (!merekCache.has('bakafrawi')) merekCache.set('bakafrawi', await bacaMerek('bakafrawi').catch(() => null));
            hasilKerja = await renderSerialKartun({
              tugas,
              merek,
              merekBakafrawi: merekCache.get('bakafrawi'),
              folder,
              simpan,
            });
          } else {
            const adalahTugasBankLama =
              pakaiBank(merek) &&
              tugas.jenis === 'video' &&
              Array.isArray(tugas.naskah?.adegan) &&
              tugas.naskah.adegan.some((a) => a.tag);
            hasilKerja = adalahTugasBankLama
              ? await kerjakanBank(tugas, merek, simpan, kabar)
              : await kerjakan(tugas, situs, peramban, folder, simpan, merek);
          }
          const { naskah, caption, hasil, namaProduk, episodeSelesai } = hasilKerja;
          await perbaruiTugas(tugas.id, { status: 'selesai', selesai: new Date().toISOString(), naskah, caption, hasil, galat: null });
          if (episodeSelesai && merek) {
            const serialKartunBaru = gabungRiwayatEpisode(
              merek.profil?.serial_kartun,
              episodeSelesai.serialId,
              episodeSelesai.episode,
              episodeSelesai,
            );
            const profilBaru = { ...(merek.profil ?? {}), serial_kartun: serialKartunBaru };
            await perbaruiProfilMerek(slug, profilBaru).catch((err) => console.error('Simpan memori episode:', err.message));
            merekCache.set(slug, { ...merek, profil: profilBaru });
          }
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
  await putaranTayang(kabar, chat);
}

async function modeLokal(berkasTugas) {
  // Berkas uji boleh membawa "merek" (bentuk baris studio_merek); bawaannya Bakafrawi.
  const { tugas, situs, merek = { slug: 'bakafrawi', nama: 'Bakafrawi', profil: { situs: 'bakafrawi.com' } } } = JSON.parse(await readFile(berkasTugas, 'utf8'));
  const folder = path.join(DIR, 'keluaran', `${tugas.jenis}-${Date.now()}`);
  await mkdir(folder, { recursive: true });
  const peramban = await bukaPeramban();
  try {
    const hasil =
      tugas.produk_slug === 'lekkopi-serial' || Boolean(tugas.naskah?.serialKartun)
        ? await renderSerialKartun({ tugas, merek, merekBakafrawi: merek, folder, simpan: async (b) => b })
        : await kerjakan(tugas, situs, peramban, folder, async (b) => b, merek);
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
