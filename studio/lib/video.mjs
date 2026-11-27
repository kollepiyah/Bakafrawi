// Video iklan produk lewat Remotion (studio/remotion), dipilih Kyai 19 Nov 2026: naskah Claude
// (adegan datar) dirapikan jadi props `Naskah`, narasi edge-tts + waktu tiap kata dibuat per adegan,
// aset disalin ke folder publik tugas, lalu `remotion render` dijalankan dengan --public-dir.
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffmpeg, jalankan, probe } from './bank/alat.mjs';
import { adaGambarAi, buatGambarAi, rapikanHasil } from './bank/gambar-ai.mjs';
import { suaraAdegan } from './bank/suara.mjs';
import { musikContoh, suaraKata } from './iklan.mjs';
import { hapusLatar, hapusLatarProduk, videoTransparan } from './latar.mjs';
import { buatSfxOpening } from './opening-audio.mjs';
import { FPS, hitungWaktu } from '../remotion/src/data/script.ts';
import { FPS_SHOWCASE, hitungDurasiWebShowcase } from '../remotion/src/data/web-showcase.ts';

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

/** Nama berkas maskot yang disalin dari Supabase agar pose (`kaget.png`) atau polos (`<id>.png`) terbaca. Murni. */
export function namaBerkasAsetMaskot(item) {
  const ekstMentah = String(item?.ekstensi || path.extname(String(item?.url || '')) || '.png').toLowerCase();
  const ekst = ekstMentah.startsWith('.') ? ekstMentah : `.${ekstMentah}`;
  const pose = String(item?.pose ?? '').trim().toLowerCase();
  if (POSE.includes(pose)) return `${pose}${ekst}`;
  const dasar = String(item?.id ?? 'aset').toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'aset';
  const aman = POSE.some((p) => dasar === p || dasar.endsWith(`-${p}`)) ? `${dasar}-utama` : dasar;
  return `${aman}${ekst}`;
}

/** Unduh aset maskot & musik yang diunggah lewat `/admin` (Supabase) melengkapi aset Google Drive. */
export async function salinAsetSupabase(daftarAset = [], { dasar = ASET_LOKAL, ambil = fetch, log = console.log } = {}) {
  if (!Array.isArray(daftarAset) || !daftarAset.length) return 0;
  let tersalin = 0;
  for (const item of daftarAset) {
    const url = String(item?.url ?? '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const adalahMusik = item?.kategori === 'musik';
    const ekstMentah = String(item?.ekstensi || path.extname(url) || (adalahMusik ? '.mp3' : '.png')).toLowerCase();
    const ekst = ekstMentah.startsWith('.') ? ekstMentah : `.${ekstMentah}`;

    let tujuan;
    if (adalahMusik) {
      const slugId = String(item?.id ?? 'musik').toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'musik';
      tujuan = path.join(dasar, 'musik', `${slugId}${ekst}`);
    } else {
      const slugKarakter = String(item?.karakter ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
      if (!slugKarakter) continue;
      tujuan = path.join(dasar, 'maskot', slugKarakter, namaBerkasAsetMaskot(item));
    }
    if (existsSync(tujuan)) continue;
    try {
      const res = await ambil(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await mkdir(path.dirname(tujuan), { recursive: true });
      await writeFile(tujuan, Buffer.from(await res.arrayBuffer()));
      tersalin++;
    } catch (e) {
      log(`Aset Supabase ${item?.nama ?? url} dilewati: ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }
  return tersalin;
}

/** Saring kolam gaya berdasarkan evaluasi mingguan (prioritas gaya menang, atau sisihkan gaya lemah). Murni. */
export function pilihKolamGayaDenganEvaluasi(kolamDasar, evaluasi = null) {
  if (!Array.isArray(kolamDasar) || !kolamDasar.length || !evaluasi) return kolamDasar;
  const prioritas = (Array.isArray(evaluasi.gayaPrioritas) ? evaluasi.gayaPrioritas : [])
    .map((g) => String(g).trim().toLowerCase())
    .filter((g) => kolamDasar.includes(g));
  if (prioritas.length) return [...new Set(prioritas)];

  const kurangi = new Set(
    (Array.isArray(evaluasi.gayaKurangi) ? evaluasi.gayaKurangi : []).map((g) => String(g).trim().toLowerCase()),
  );
  const sisa = kolamDasar.filter((g) => !kurangi.has(g));
  return sisa.length ? sisa : kolamDasar;
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

/** Baca tag `[Karakter: ...]` dari arahan Studio → `{ karakter, bersih }`. */
export function uraiPilihanKarakter(arahan) {
  const teksAsli = String(arahan ?? '');
  const cocok = teksAsli.match(/\[Karakter:\s*([A-Za-z0-9_-]+)\]/i);
  const bersih = teksAsli.replace(/\[Karakter:\s*[A-Za-z0-9_-]+\]\s*/gi, '').trim();
  return {
    karakter: cocok ? cocok[1].trim().toLowerCase() : null,
    bersih,
  };
}

/** Karakter video: pilihan eksplisit/AI → karakter bernama slug merek → acak (supaya bervariasi). Murni. */
export function pilihKarakter(nama, { pilihan = '', slug = '', gender = null, acak = Math.random } = {}) {
  if (gender === 'tanpa') return null;
  let kolam = nama;
  if (gender === 'wanita') {
    const k = nama.filter((n) => KATA_WANITA.test(n));
    if (k.length) kolam = k;
  } else if (gender === 'pria') {
    const k = nama.filter((n) => !KATA_WANITA.test(n));
    if (k.length) kolam = k;
  }
  const sama = (x) => kolam.find((n) => n.toLowerCase() === String(x).toLowerCase().trim());
  return sama(pilihan) ?? sama(slug) ?? (kolam.length ? [...kolam].sort()[Math.floor(acak() * kolam.length) % kolam.length] : null);
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
const KATA_WANITA = /(^|[\s\-_,.;:!?()[\]])(ibu|bu|mbak|mba|kak|wanita|perempuan|cewek|hijab|jilbab|akhwat|putri|nyonya|bunda|umi|ning)(?=[\s\-_,.;:!?()[\]]|$)/i;
const KATA_PRIA = /(^|[\s\-_,.;:!?()[\]])(bapak|pak|mas|pria|laki|cowok|kopiah|peci|ikhwan|ustadz|kang|cak|gus)(?=[\s\-_,.;:!?()[\]]|$)/i;
const NAMA_WANITA_SUARA = /(^|[\s\-_,.;:!?()[\]])(ibu|bu|mbak|mba|wanita|perempuan|cewek|hijab|bunda|umi|ning|siti|indah|putri|ayu|dewi|rina|sari|nisa|aisyah)(?=[\s\-_,.;:!?()[\]]|$)/i;
const NAMA_PRIA_SUARA = /(^|[\s\-_,.;:!?()[\]])(bapak|pak|mas|pria|laki|cowok|kang|cak|gus|abang|bang|bro|jowo|budi|andi|rizky|ahmad|dimas|ardi)(?=[\s\-_,.;:!?()[\]]|$)/i;
export const SUARA = { wanita: 'id-ID-GadisNeural', pria: 'id-ID-ArdiNeural' };

/** Deteksi permintaan gender karakter ('wanita' | 'pria' | 'tanpa' | null) dari arahan/suara. Murni. */
export function deteksiGenderKarakter(arahan, { namaSuara = '' } = {}) {
  const { karakter, bersih } = uraiPilihanKarakter(arahan);
  if (karakter) {
    if (karakter === 'tanpa' || karakter === 'none' || karakter === 'off') return 'tanpa';
    if (karakter === 'wanita' || KATA_WANITA.test(karakter)) return 'wanita';
    if (karakter === 'pria' || KATA_PRIA.test(karakter)) return 'pria';
  }
  const teksBersih = bersih.replace(/\[(?:Gaya|Suara):\s*[^\]]+\]\s*/gi, '').trim();
  if (/\b(tanpa|jangan pakai|gak usah|tidak pakai)\s+(karakter|maskot|orang|tokoh)\b/i.test(teksBersih)) {
    return 'tanpa';
  }
  if (
    /(karakter|maskot|tokoh|host|presenter|pembawa|avatar|pakai|gunakan|figur)\s+(?:yang\s+)?(?:seorang\s+)?(wanita|perempuan|cewek|ibu|mbak|hijab|berhijab)/i.test(teksBersih)
    || /\b(karakter\s+wanita|ibu[\s-]hijab|wanita\s+berhijab|perempuan\s+berhijab|cewek\s+hijab)\b/i.test(teksBersih)
    || (/\b(karakter|maskot|host|tokoh|orang|pakai)\b/i.test(teksBersih) && /\b(wanita|perempuan|cewek|mbak)\b/i.test(teksBersih))
  ) {
    return 'wanita';
  }
  if (
    /(karakter|maskot|tokoh|host|presenter|pembawa|avatar|pakai|gunakan|figur)\s+(?:yang\s+)?(?:seorang\s+)?(pria|laki(?:[\s-]laki)?|cowok|bapak|mas|kopiah|berkopiah)/i.test(teksBersih)
    || /\b(karakter\s+pria|bapak[\s-]kopiah|laki[\s-]laki)\b/i.test(teksBersih)
    || (/\b(karakter|maskot|host|tokoh|orang|pakai)\b/i.test(teksBersih) && /\b(pria|laki[\s-]laki|cowok|bapak|mas)\b/i.test(teksBersih))
  ) {
    return 'pria';
  }
  const suaraTeks = String(namaSuara ?? '').trim();
  if (suaraTeks) {
    if (NAMA_WANITA_SUARA.test(suaraTeks)) return 'wanita';
    if (NAMA_PRIA_SUARA.test(suaraTeks)) return 'pria';
  }
  return null;
}

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
    ? { latar: '#0A0C10', kisi: 'rgba(24,180,168,0.08)', tinta: '#F8FAFC' }
    : gaya === 'split-hook'
    ? { latar: '#0D1017', kisi: 'rgba(245,184,0,0.07)', tinta: '#F8FAFC' }
    : gaya === 'pov-chat'
    ? { latar: '#0F1419', kisi: 'rgba(255,255,255,0.045)', tinta: '#F1F5F9' }
    : { latar: WARNA.latar, kisi: WARNA.kisi, tinta: WARNA.tinta };
  const warnaUtama = gaya === 'dark-keynote' && (!utama || utama === WARNA.utama) ? '#18B4A8' : utama;
  const warnaKedua = gaya === 'dark-keynote' && (!utama || utama === WARNA.utama) ? '#34E0CD' : kedua;
  return {
    merek: { nama, logo, utama: warnaUtama, kedua: warnaKedua, ...palet },
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
export async function renderIklan({ naskah, aset, folder, musik = null, suara = undefined, opsiSuara = {}, keluar, log = console.log }) {
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
  if (aset.latarGambar) {
    const namaLatar = `latar-ai${path.extname(aset.latarGambar) || '.jpg'}`;
    await copyFile(aset.latarGambar, path.join(publik, namaLatar));
    n.latarGambar = namaLatar;
  }
  n.suara = [];
  // Utamakan ElevenLabs / Gemini TTS + 6 profil suara kreatif (suara.mjs); bila gagal, jatuh ke edge-tts (suaraKata).
  const perkirakanKata = (kalimat, durasi) => {
    const k = String(kalimat ?? '').split(/\s+/).filter(Boolean);
    const total = k.reduce((acc, w) => acc + w.length + 2, 0) || 1;
    let t = 0;
    return k.map((teks) => {
      const d = ((teks.length + 2) / total) * durasi;
      const item = { teks, mulai: t, selesai: t + d };
      t += d;
      return item;
    });
  };
  let pakaiSuaraBaru = false;
  try {
    const hasilSuara = await suaraAdegan(n.adegan.map((a) => a.narasi), folder, opsiSuara);
    if (hasilSuara.berkas?.length === n.adegan.length) {
      for (const [i, a] of n.adegan.entries()) {
        const sumber = hasilSuara.berkas[i];
        const ext = path.extname(sumber) || '.wav';
        const nama = `narasi-${i}${ext}`;
        await copyFile(sumber, path.join(publik, nama));
        const info = await probe(sumber).catch(() => ({ durasi: 4.5 }));
        const durasi = Number(info.durasi) || 4.5;
        const kataAdegan = hasilSuara.kata?.[i]?.length ? hasilSuara.kata[i] : perkirakanKata(a.narasi, durasi);
        n.suara.push({ berkas: nama, durasi, kata: kataAdegan });
        const infoSuara = hasilSuara.voiceId
          ? `${hasilSuara.jalur}:${hasilSuara.voiceId.slice(0, 8)}`
          : `${hasilSuara.jalur}/${hasilSuara.profil ?? 'auto'}`;
        log(`🎙 ${i + 1}. ${a.jenis} (${infoSuara}): ${durasi.toFixed(2)} dtk`);
      }
      pakaiSuaraBaru = true;
    }
  } catch (e) {
    log(`Suara kreatif gagal, pakai cadangan edge-tts: ${String(e?.message ?? e).slice(0, 120)}`);
    n.suara = [];
  }
  if (!pakaiSuaraBaru) {
    for (const [i, a] of n.adegan.entries()) {
      const s = await suaraKata(a.narasi, path.join(publik, `narasi-${i}.mp3`), suara ? { suara } : {});
      n.suara.push({ berkas: `narasi-${i}.mp3`, durasi: s.durasi, kata: s.kata });
      log(`🎙 ${i + 1}. ${a.jenis}: ${s.durasi.toFixed(2)} dtk`);
    }
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

  // editorial-scroll (1 scene laptop 4 blok), dial-menu (keypad), & story-drop (IG Story ke meja): 1 media unik per adegan.
  const satuMediaPerAdegan = gaya === 'editorial-scroll' || gaya === 'dial-menu' || gaya === 'story-drop';
  const segmenFinal = gaya === 'dial-menu'
    ? segmen.filter((s, i) => (i === 0 || segmen[i - 1].adeganKe !== s.adeganKe) && String(s.teksLayar ?? '').trim()).slice(0, 10)
    : gaya === 'story-drop'
    ? segmen.filter((s, i) => (i === 0 || segmen[i - 1].adeganKe !== s.adeganKe) && s.berkas).slice(0, 5)
    : satuMediaPerAdegan
    ? segmen.filter((s, i) => i === 0 || segmen[i - 1].adeganKe !== s.adeganKe).slice(0, 4)
    : segmen;

  // Khusus story-drop: siapkan latar meja kafe kosong (AI gratis) + potong latar belakang foto produk lewat RMBG-1.4.
  let latarMejaNama;
  if (gaya === 'story-drop') {
    if (adaGambarAi()) {
      try {
        // buatGambarAi mengharapkan path TANPA ekstensi dan mengembalikan { berkas } dengan ekstensi asli (.jpg/.png).
        const hasilMeja = rapikanHasil(
          await buatGambarAi(
            'Empty warm marble round cafe table in foreground occupying bottom half of frame, cozy sunlit coffee shop interior bokeh background with warm pendant lights and wooden chairs, golden hour aesthetic, vertical 9:16 photo, no cups, no food, no text, no people',
            '9:16',
            path.join(publik, 'meja-kafe'),
          ),
        );
        if (hasilMeja?.berkas && existsSync(hasilMeja.berkas)) {
          latarMejaNama = path.basename(hasilMeja.berkas);
        }
      } catch (e) {
        log(`Latar meja AI story-drop gagal (pakai fallback meja CSS): ${String(e.message ?? e).slice(0, 120)}`);
      }
    }
    const labelDariBerkas = (jalur) => {
      if (!jalur) return '';
      const dasar = path.basename(String(jalur), path.extname(String(jalur))).replace(/[_-]+/g, ' ').trim();
      if (!dasar || /^(ai|foto|img|dsc|vid|klip|media|menu|screenshot|wa|pxl)\s*\d*$/i.test(dasar)) return '';
      return dasar.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 24);
    };
    for (let i = 0; i < segmenFinal.length; i++) {
      const s = segmenFinal[i];
      if (!String(s.teksLayar ?? '').trim()) {
        const sumberAsli = r.segmen.find((x) => x.adegan === s.adeganKe)?.sumber;
        const namaBerkas = labelDariBerkas(sumberAsli);
        if (namaBerkas) s.teksLayar = namaBerkas;
      }
      if (!s.berkas || s.jenis !== 'foto') continue;
      try {
        const sumberPublik = path.join(publik, s.berkas);
        const namaCutout = `cutout-${i}.png`;
        await hapusLatarProduk(sumberPublik, path.join(publik, namaCutout));
        s.berkasTransparan = namaCutout;
      } catch (e) {
        log(`Potong latar produk #${i + 1} gagal (pakai bingkai foto): ${String(e.message ?? e).slice(0, 120)}`);
      }
    }
  }

  const totalDetik = gaya === 'editorial-scroll'
    ? Math.max(7, segmenFinal.length * 2.4)
    : gaya === 'dial-menu'
    ? 3.4 + segmenFinal.length * (26 / 30)
    : gaya === 'story-drop'
    ? (20 + Math.max(1, segmenFinal.length) * 40 + 48) / 30
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

  const ajakanAkhir = gaya === 'dial-menu' || gaya === 'story-drop'
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
    ...(latarMejaNama ? { latarMeja: latarMejaNama } : {}),
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

/**
 * Render video showcase website & aplikasi custom kelas agency lewat Remotion komposisi `WebShowcase`.
 * Menggabungkan tangkapan layar asli Desktop Full-Page + Mobile, animasi ketik URL, kursor klik,
 * narasi ElevenLabs/Gemini/Edge + timestamp kata, SFX transisi, dan musik latar ducking otomatis.
 * → { berkas, sampul, durasi, catatanSuara }
 */
export async function renderWebShowcase({
  naskah,
  merekInfo,
  media = null,
  logo = null,
  musik = null,
  suara = undefined,
  opsiSuara = {},
  folder,
  keluar,
  log = console.log,
}) {
  const publik = path.join(folder, 'publik-showcase');
  await mkdir(publik, { recursive: true });

  const salin = async (sumber, namaDasar) => {
    if (!sumber || !existsSync(sumber)) return undefined;
    const ext = path.extname(sumber) || '.jpg';
    const nama = `${namaDasar}${ext}`;
    await copyFile(sumber, path.join(publik, nama));
    return nama;
  };

  const logoNama = await salin(logo, 'logo');
  const desktopFullNama = await salin(media?.desktopFull?.berkas, 'desktop-full');
  const desktopHeroNama = await salin(media?.desktopHero?.berkas, 'desktop-hero');
  const desktopMidNama = await salin(media?.desktopMid?.berkas, 'desktop-mid');
  const mobileFullNama = await salin(media?.mobileFull?.berkas, 'mobile-full');
  const mobileHeroNama = await salin(media?.mobileHero?.berkas, 'mobile-hero');

  const teksBabak = [
    naskah.hook?.narasi || '',
    naskah.browser?.narasi || '',
    naskah.responsive?.narasi || '',
    naskah.spotlight?.narasi || '',
    naskah.penutup?.narasi || '',
  ];

  const perkirakanKata = (kalimat, durasi) => {
    const k = String(kalimat ?? '').split(/\s+/).filter(Boolean);
    const total = k.reduce((acc, w) => acc + w.length + 2, 0) || 1;
    let t = 0;
    return k.map((teks) => {
      const d = ((teks.length + 2) / total) * Math.max(1.5, durasi);
      const item = { teks, mulai: t, selesai: t + d };
      t += d;
      return item;
    });
  };

  const suaraBabak = [];
  let catatanSuara = '';
  let pakaiSuaraBaru = false;
  try {
    const hasilSuara = await suaraAdegan(teksBabak, folder, opsiSuara);
    if (hasilSuara.berkas?.length === teksBabak.length) {
      for (let i = 0; i < teksBabak.length; i++) {
        const sumber = hasilSuara.berkas[i];
        const ext = path.extname(sumber) || '.mp3';
        const nama = `vo-${i}${ext}`;
        await copyFile(sumber, path.join(publik, nama));
        const info = await probe(sumber).catch(() => ({ durasi: 4.5 }));
        const durasi = Number(info.durasi) || 4.5;
        const kata = hasilSuara.kata?.[i]?.length ? hasilSuara.kata[i] : perkirakanKata(teksBabak[i], durasi);
        suaraBabak.push({ berkas: nama, durasi, kata });
      }
      catatanSuara = `suara: ${hasilSuara.jalur}${hasilSuara.voiceId ? ` (${hasilSuara.voiceId.slice(0, 8)})` : ''}`;
      pakaiSuaraBaru = true;
    }
  } catch (e) {
    log(`Suara WebShowcase fallback ke edge-tts: ${String(e?.message ?? e).slice(0, 120)}`);
  }

  if (!pakaiSuaraBaru) {
    for (let i = 0; i < teksBabak.length; i++) {
      try {
        const s = await suaraKata(teksBabak[i], path.join(publik, `vo-${i}.mp3`), suara ? { suara } : {});
        suaraBabak.push({ berkas: `vo-${i}.mp3`, durasi: s.durasi, kata: s.kata });
      } catch {
        suaraBabak.push({ berkas: null, durasi: 4.5, kata: perkirakanKata(teksBabak[i], 4.5) });
      }
    }
    catatanSuara = 'suara: edge-tts';
  }

  const sfx = await buatSfxOpening(publik).catch(() => ({ whoosh: null, pop: null, chime: null }));

  const propsData = {
    merek: {
      nama: merekInfo.nama || 'Bakafrawi Project',
      domain: merekInfo.domain || 'bakafrawi.com',
      url: merekInfo.url || `https://${merekInfo.domain || 'bakafrawi.com'}`,
      aksen: merekInfo.aksen || '#18B4A8',
      aksenKedua: merekInfo.aksenKedua || '#34E0CD',
      ...(logoNama ? { logo: logoNama } : {}),
      info: merekInfo.info || 'bakafrawi.com',
      situsBakafrawi: merekInfo.situsBakafrawi || 'bakafrawi.com',
    },
    media: {
      ...(desktopFullNama
        ? {
            desktopFull: desktopFullNama,
            desktopFullLebar: media?.desktopFull?.lebar || 2880,
            desktopFullTinggi: media?.desktopFull?.tinggi || 7200,
          }
        : {}),
      ...(desktopHeroNama ? { desktopHero: desktopHeroNama } : {}),
      ...(desktopMidNama ? { desktopMid: desktopMidNama } : {}),
      ...(mobileFullNama
        ? {
            mobileFull: mobileFullNama,
            mobileFullLebar: media?.mobileFull?.lebar || 780,
            mobileFullTinggi: media?.mobileFull?.tinggi || 2600,
          }
        : {}),
      ...(mobileHeroNama ? { mobileHero: mobileHeroNama } : {}),
    },
    hook: naskah.hook,
    browser: naskah.browser,
    responsive: naskah.responsive,
    spotlight: naskah.spotlight,
    penutup: naskah.penutup,
    suara: suaraBabak,
    musik: null,
    sfx,
  };

  const totalDetik = hitungDurasiWebShowcase(propsData).total / FPS_SHOWCASE;
  if (musik && existsSync(musik)) {
    propsData.musik = await salin(musik, 'musik');
  } else {
    await musikContoh(path.join(publik, 'musik.mp3'), totalDetik + 1.5, 98);
    propsData.musik = 'musik.mp3';
  }

  const propsPath = path.join(folder, 'props-showcase.json');
  await writeFile(propsPath, JSON.stringify(propsData));
  log(`🎬 Remotion WebShowcase (${propsData.merek.domain}): 5 babak, ${totalDetik.toFixed(1)} dtk`);
  await jalankan(
    process.execPath,
    [CLI, 'render', 'src/index.ts', 'WebShowcase', keluar, `--props=${propsPath}`, `--public-dir=${publik}`, '--log=error'],
    { cwd: REMOTION },
  );

  const sampul = path.join(folder, 'sampul-showcase.jpg');
  const detikSampul = Math.min(2.0, Math.max(0.8, totalDetik * 0.08));
  await ffmpeg(['-y', '-ss', detikSampul.toFixed(2), '-i', keluar, '-frames:v', '1', '-q:v', '3', sampul]).catch(() => null);
  return { berkas: keluar, sampul: existsSync(sampul) ? sampul : null, durasi: totalDetik, catatanSuara };
}
