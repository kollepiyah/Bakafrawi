// Video iklan produk lewat Remotion (studio/remotion), dipilih Kyai 19 Nov 2026: naskah Claude
// (adegan datar) dirapikan jadi props `Naskah`, narasi edge-tts + waktu tiap kata dibuat per adegan,
// aset disalin ke folder publik tugas, lalu `remotion render` dijalankan dengan --public-dir.
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffmpeg, jalankan, probe } from './bank/alat.mjs';
import { musikContoh, suaraKata } from './iklan.mjs';
import { hapusLatar, videoTransparan } from './latar.mjs';
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

// ------------------------------------------------------------ karakter & pose maskot
// Drive "Aset/maskot": satu subfolder per karakter (nama bebas, mis. "ibu-hijab"), isinya pose
// kaget/tunjuk/hp/jempol/lambai (.webm/.png/.jpg). Berkas di akar juga diterima: "<karakter>-<pose>.jpg"
// atau "<karakter>.jpg" (tanpa pose). Satu video memakai satu karakter dari awal sampai akhir.
export const POSE = ['kaget', 'tunjuk', 'hp', 'jempol', 'lambai'];
const POSE_BAWAAN = { hook: 'kaget', layar: 'tunjuk', kasir: 'hp', alur: 'jempol', daftar: 'jempol', penutup: 'lambai' };
const EXT_MASKOT = ['webm', 'mov', 'mp4', 'png', 'webp', 'jpg', 'jpeg']; // bergerak → transparan → JPG
const extDari = (b) => b.slice(b.lastIndexOf('.') + 1).toLowerCase();
const dasarDari = (b) => b.slice(b.lastIndexOf('/') + 1, b.lastIndexOf('.')).toLowerCase();
const poseDari = (b) => POSE.find((p) => dasarDari(b) === p || dasarDari(b).endsWith(`-${p}`)) ?? null;

/** Berkas maskot (path relatif, pemisah "/") → Map nama karakter → [berkas]. Murni. */
export function kelompokKarakter(berkas) {
  const peta = new Map();
  for (const b of berkas.map((x) => x.replace(/\\/g, '/'))) {
    if (!EXT_MASKOT.includes(extDari(b))) continue;
    const nama = b.includes('/') ? b.split('/')[0] : (() => {
      const d = b.slice(0, b.lastIndexOf('.'));
      const p = poseDari(b);
      return p && d.toLowerCase().endsWith(`-${p}`) ? d.slice(0, -(p.length + 1)) : d;
    })();
    if (!nama) continue;
    const kunci = [...peta.keys()].find((k) => k.toLowerCase() === nama.toLowerCase()) ?? nama;
    peta.set(kunci, [...(peta.get(kunci) ?? []), b]);
  }
  return peta;
}

/** Karakter video: pilihan Claude → karakter bernama slug merek → acak (supaya bervariasi). Murni. */
export function pilihKarakter(nama, { pilihan = '', slug = '', acak = Math.random } = {}) {
  const sama = (x) => nama.find((n) => n.toLowerCase() === String(x).toLowerCase().trim());
  return sama(pilihan) ?? sama(slug) ?? (nama.length ? [...nama].sort()[Math.floor(acak() * nama.length) % nama.length] : null);
}

/**
 * Berkas pose tiap adegan dari berkas satu karakter: pose pilihan Claude → pose bawaan jenis adegan
 * → tunjuk → pose lain yang ada → gambar tanpa pose. Antar-ekstensi: yang bergerak didahulukan. Murni.
 */
export function maskotAdegan(adegan, berkasKarakter) {
  const urutExt = (a, b) => EXT_MASKOT.indexOf(extDari(a)) - EXT_MASKOT.indexOf(extDari(b));
  const video = (b) => ['webm', 'mov', 'mp4'].includes(extDari(b));
  // Video didahulukan di SEMUA adegan bila karakter punya video: campuran video bergerak & gambar diam
  // terasa tak konsisten (Kyai baru sanggup membuat 1 video 8 dtk per karakter, 19 Nov 2026).
  const kelompok = berkasKarakter.some(video) ? [berkasKarakter.filter(video), berkasKarakter] : [berkasKarakter];
  return adegan.map((a) => {
    for (const isi of kelompok) {
      for (const p of new Set([a.pose, POSE_BAWAAN[a.jenis], 'tunjuk', ...POSE])) {
        const ada = POSE.includes(p) && isi.filter((b) => poseDari(b) === p).sort(urutExt)[0];
        if (ada) return ada;
      }
      const polos = [...isi.filter((b) => !poseDari(b))].sort(urutExt)[0];
      if (polos) return polos;
    }
    return null;
  });
}

// Suara narasi mengikuti karakter: nama folder berisi kata perempuan → suara wanita (Gadis), selain
// itu pria (Ardi). Kyai: "pakai karakter ibu hijab tapi kok suaranya pria" (19 Nov 2026).
const KATA_WANITA = /(^|[-_\s])(ibu|bu|mbak|mba|kak|wanita|perempuan|cewek|hijab|jilbab|akhwat|putri|nyonya|bunda|umi|ning)([-_\s]|$)/i;
export const SUARA = { wanita: 'id-ID-GadisNeural', pria: 'id-ID-ArdiNeural' };

/** Suara edge-tts untuk karakter; tanpa karakter → STUDIO_SUARA atau pria. Murni. */
export function suaraKarakter(nama, bawaan = process.env.STUDIO_SUARA || SUARA.pria) {
  if (!nama) return bawaan;
  return KATA_WANITA.test(String(nama)) ? SUARA.wanita : SUARA.pria;
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
export function keNaskah(k, { nama, logo, utama = WARNA.utama, kedua = WARNA.kedua, layar = [], info, fitur = [], gaya = 'clean-ui' }) {
  const daftarFitur = fitur.map((f) => teks(f, 48)).filter(Boolean).slice(0, 3);
  const keDaftar = (a, badge) => ({ jenis: 'daftar', narasi: a.narasi, kunci: a.kunci, durasi: DURASI.daftar, badge: teks(badge || a.badge, 26) || 'Fitur Utama', labelAngka: '', angka: nama, catatan: '', daftar: daftarFitur.length ? daftarFitur : [nama] });
  const adegan = (k.adegan ?? []).filter((a) => teks(a?.narasi)).slice(0, 7).map((a) => {
    const d = { narasi: teks(a.narasi, 220), kunci: daftarTeks(a.kunci, 4, 24), ...(POSE.includes(a.pose) ? { pose: a.pose } : {}) };
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
  const palet = gaya === 'dark-keynote'
    ? { latar: '#07090F', kisi: 'rgba(255,255,255,0.05)', tinta: '#F8FAFC' }
    : gaya === 'pov-chat'
    ? { latar: '#F7F4EE', kisi: '#E7E1D6', tinta: '#141210' }
    : { latar: WARNA.latar, kisi: WARNA.kisi, tinta: WARNA.tinta };
  return {
    merek: { nama, logo, utama, kedua, ...palet },
    gaya,
    layar,
    adegan: [...isi, { ...tutup, info }],
  };
}

/**
 * Render satu video iklan. aset: { logo (berkas lokal | null), layar: [{ berkas, lebar, tinggi }],
 * maskot (berkas lokal | daftar per adegan | null) }.
 * Semua bahan disalin ke `folder/publik` (jadi --public-dir); musik: berkas lokal atau buatan ffmpeg.
 * → { berkas, sampul, durasi }
 */
export async function renderIklan({ naskah, aset, folder, musik = null, suara = undefined, keluar, log = console.log }) {
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
    const s = await suaraKata(a.narasi, path.join(publik, `narasi-${i}.mp3`), suara ? { suara } : {});
    n.suara.push({ berkas: `narasi-${i}.mp3`, durasi: s.durasi, kata: s.kata });
    log(`🎙 ${i + 1}. ${a.jenis}: ${s.durasi.toFixed(2)} dtk`);
  }
  const detik = hitungWaktu(n).total / FPS;
  if (musik) await copyFile(musik, path.join(publik, `musik${path.extname(musik)}`));
  else await musikContoh(path.join(publik, 'musik.mp3'), detik + 1);
  n.musik = musik ? `musik${path.extname(musik)}` : 'musik.mp3';
  // Maskot (karakter 3D) di 40% bawah layar, boleh berganti pose per adegan. aset.maskot: satu
  // berkas atau daftar berkas per adegan (null = tanpa maskot di adegan itu).
  const daftarMaskot = Array.isArray(aset.maskot) ? aset.maskot : n.adegan.map(() => aset.maskot ?? null);
  const siap = new Map(); // berkas sumber → nama di publik (tiap pose disalin/dikonversi sekali)
  for (const [i, sumber] of daftarMaskot.entries()) {
    if (!sumber || !n.adegan[i]) continue;
    if (!siap.has(sumber)) {
      // Gambar → latar dihapus AI + dipangkas ke tubuh. Video Veo (mp4/mov, latar hijau) → WebM
      // transparan terpangkas. WebM dianggap sudah transparan, disalin apa adanya.
      const nama = `maskot-${siap.size}`;
      if (/\.(jpe?g|png|webp)$/i.test(sumber)) {
        siap.set(sumber, { berkas: await hapusLatar(sumber, path.join(publik, `${nama}.png`)).then(() => `${nama}.png`) });
      } else if (/\.webm$/i.test(sumber)) {
        await copyFile(sumber, path.join(publik, `${nama}.webm`));
        siap.set(sumber, { berkas: `${nama}.webm`, durasi: (await probe(sumber)).durasi });
      } else {
        const v = await videoTransparan(sumber, path.join(publik, `${nama}.webm`));
        siap.set(sumber, { berkas: `${nama}.webm`, durasi: v.durasi });
        if (!v.hijau) log(`⚠️ Video maskot ${path.basename(sumber)} tidak berlatar hijau — tepi bisa kurang bersih.`);
      }
    }
    const m = siap.get(sumber);
    n.adegan[i].maskot = m.berkas;
    if (m.durasi) n.adegan[i].maskotDurasi = m.durasi;
  }
  const pertama = n.adegan.find((a) => a.maskot)?.maskot;
  if (pertama) n.maskot = pertama; // menandai tata letak bermaskot

  const props = path.join(folder, 'props.json');
  await writeFile(props, JSON.stringify(n));
  log(`🎬 Remotion: ${n.adegan.length} adegan, ${detik.toFixed(1)} dtk`);
  await jalankan(process.execPath, [CLI, 'render', 'src/index.ts', 'Iklan', keluar, `--props=${props}`, `--public-dir=${publik}`, '--log=error'], { cwd: REMOTION });
  // Sampul Reels: bingkai detik ke-1,5 (judul pembuka sudah utuh).
  const sampul = path.join(folder, 'sampul.jpg');
  await ffmpeg(['-y', '-ss', '1.5', '-i', keluar, '-frames:v', '1', '-q:v', '3', sampul]);
  return { berkas: keluar, sampul, durasi: detik };
}

/** Apakah mesin Remotion siap dipakai (dependensi studio/remotion sudah terpasang)? */
export function remotionSiap() {
  return existsSync(CLI);
}

/**
 * Render video bank media (Lek Kopi / merek sinematik) lewat Remotion komposisi `Sinematik`.
 * Menggabungkan klip video asli + foto bank + gambar AI (Ken Burns) + tipografi editorial + musik.
 * → { berkas, sampul, durasi }
 */
export async function renderSinematikRemotion({
  rencana: r,
  merek = {},
  logo = null,
  musik = null,
  musikVolume = 0.72,
  suara = [],
  gaya = 'sinematik-kafe',
  folder,
  keluar,
  log = console.log,
}) {
  const publik = path.join(folder, 'publik-sinematik');
  await mkdir(publik, { recursive: true });

  // Salin tiap berkas sumber sekali saja ke folder publik Remotion.
  const petaBerkas = new Map();
  let nomor = 0;
  const salin = async (sumber, prefiks) => {
    if (!sumber) return null;
    if (petaBerkas.has(sumber)) return petaBerkas.get(sumber);
    const ext = path.extname(sumber) || '.mp4';
    const nama = `${prefiks}-${nomor++}${ext}`;
    await copyFile(sumber, path.join(publik, nama));
    petaBerkas.set(sumber, nama);
    return nama;
  };

  const logoNama = logo ? await salin(logo, 'logo') : undefined;
  const segmen = [];
  for (let i = 0; i < r.segmen.length; i++) {
    const s = r.segmen[i];
    const adegan = r.adegan[s.adegan] ?? {};
    const berkasNama = await salin(s.sumber, s.jenis === 'video' ? 'klip' : 'foto');
    // Tampilkan teks layar & suara di potongan pertama tiap adegan.
    const pertamaDiAdegan = i === 0 || r.segmen[i - 1].adegan !== s.adegan;
    const suaraNama = pertamaDiAdegan && suara[s.adegan] ? await salin(suara[s.adegan], 'suara') : null;
    segmen.push({
      berkas: berkasNama,
      jenis: s.jenis === 'video' ? 'video' : 'foto',
      durasi: Number(s.durasi) || 2.5,
      mulaiKlip: Number(s.mulaiKlip) || 0,
      teksLayar: pertamaDiAdegan ? (adegan.teksLayar ?? '') : '',
      gayaTeks: pertamaDiAdegan ? (adegan.gayaTeks ?? null) : 'tanpa',
      adeganKe: s.adegan,
      suaraBerkas: suaraNama,
      narasi: adegan.suara ?? '',
    });
  }

  // editorial-scroll (1 scene laptop 4 blok) & dial-menu (keypad + potongan menu): 1 media unik per adegan.
  const satuMediaPerAdegan = gaya === 'editorial-scroll' || gaya === 'dial-menu';
  const segmenFinal = gaya === 'dial-menu'
    ? segmen.filter((s, i) => (i === 0 || segmen[i - 1].adeganKe !== s.adeganKe) && String(s.teksLayar ?? '').trim()).slice(0, 6)
    : satuMediaPerAdegan
    ? segmen.filter((s, i) => i === 0 || segmen[i - 1].adeganKe !== s.adeganKe).slice(0, 4)
    : segmen;

  const totalDetik = gaya === 'editorial-scroll'
    ? Math.max(7, segmenFinal.length * 2.4)
    : gaya === 'dial-menu'
    ? 3 + segmenFinal.length * 1.9 + 1.6
    : (Number(r.total) || segmenFinal.reduce((a, b) => a + b.durasi, 0) + 2.2);
  let musikNama = null;
  if (musik) {
    musikNama = await salin(musik, 'musik');
  } else {
    // Bila bank belum punya musik, buatkan lo-fi hangat bebas hak cipta agar video tidak bisu.
    const musikLokal = path.join(publik, 'musik-lofi.mp3');
    await musikContoh(musikLokal, totalDetik + 1.5, 92);
    musikNama = 'musik-lofi.mp3';
  }

  const ajakanAkhir = gaya === 'dial-menu'
    ? `Mampir ngopi di ${merek.nama || 'Lek Kopi'}`
    : (r.adegan.at(-1)?.teksLayar || `Mampir ke ${merek.nama || 'Lek Kopi'}`);
  const propsData = {
    merek: {
      nama: merek.nama || 'Lek Kopi',
      sub: merek.sub || '',
      aksen: merek.aksen || '#D9A441',
      ...(logoNama ? { logo: logoNama } : {}),
      info: merek.info || '',
    },
    gaya,
    musik: musikNama,
    musikVolume: suara.length ? 0.22 : musikVolume,
    segmen: segmenFinal,
    penutup: {
      durasi: Number(r.penutup?.durasi) || 2.2,
      ajakan: ajakanAkhir,
      info: merek.info || merek.sub || '',
    },
  };

  const propsPath = path.join(folder, 'props-sinematik.json');
  await writeFile(propsPath, JSON.stringify(propsData));
  log(`🎬 Remotion Sinematik (${gaya}): ${segmen.length} potongan, ${totalDetik.toFixed(1)} dtk`);
  await jalankan(
    process.execPath,
    [CLI, 'render', 'src/index.ts', 'Sinematik', keluar, `--props=${propsPath}`, `--public-dir=${publik}`, '--log=error'],
    { cwd: REMOTION },
  );

  // Ekstrak sampul JPG untuk thumbnail di Studio & Deck Dashboard.
  const sampul = path.join(folder, 'sampul-sinematik.jpg');
  const detikSampul = Math.min(1.2, Math.max(0.3, totalDetik * 0.15));
  await ffmpeg(['-y', '-ss', detikSampul.toFixed(2), '-i', keluar, '-frames:v', '1', '-q:v', '3', sampul]).catch(() => null);
  return { berkas: keluar, sampul: existsSync(sampul) ? sampul : null, durasi: totalDetik };
}
