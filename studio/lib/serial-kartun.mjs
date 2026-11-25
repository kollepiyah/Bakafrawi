// Mesin pembuat & perender 1 episode Serial Kartun 2D Lek Kopi.
// Berjalan mandiri di folder `studio/` (tanpa impor dari `src/` agar cocok dengan sparse-checkout GitHub Actions).
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ffmpeg, jalankan, probe } from './bank/alat.mjs';
import { suaraDialogSerial } from './bank/suara.mjs';
import { buatMusikKafe, buatSfxOpening } from './opening-audio.mjs';
import { panggilRouterWorkerJson, urutanPenyediaWorker } from './router-worker.mjs';
import { pilihMusik } from './video.mjs';
import { hitungDurasiSerialKartun } from '../remotion/src/data/serial-waktu.ts';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const REMOTION = path.join(DIR, '..', 'remotion');
const CLI = path.join(REMOTION, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');

const TOKOH_SAH = ['mas_barista', 'mas_pelanggan', 'mbak_pelanggan', 'pak_tetangga', 'kucing_kedai'];
const EKSPRESI_SAH = ['senyum', 'ketawa', 'kaget', 'mikir', 'cemberut', 'ngantuk', 'bangga', 'malu'];
const PROPERTI_SAH = ['tanpa', 'es_kopi', 'kopi_panas', 'matcha_latte', 'hp', 'uang', 'jempol', 'tunjuk'];
const EFEK_SAH = ['tanpa', 'tanda_tanya', 'tanda_seru', 'keringat', 'hati', 'lampu_ide', 'tawa'];
const KAMERA_SAH = ['diam', 'zoom_masuk', 'zoom_keluar', 'geser_kiri', 'geser_kanan', 'goyang_kaget'];

const NAMA_TOKOH = {
  mas_barista: 'Mas Lek',
  mas_pelanggan: 'Mas Danu',
  mbak_pelanggan: 'Mbak Rara',
  pak_tetangga: 'Pak Budi',
  kucing_kedai: 'Cimol',
  narator: 'Cerita Lek Kopi',
};

const TokohPanggungSkema = z.object({
  id: z.enum(TOKOH_SAH),
  ekspresi: z.enum(EKSPRESI_SAH),
  properti: z.enum(PROPERTI_SAH),
  efek: z.enum(EFEK_SAH),
});

export const SkemaNaskahSerial = z.object({
  judulEpisode: z.string().describe('Judul episode singkat 3-6 kata yang lucu/hangat'),
  ringkasanEpisode: z.string().describe('Ringkasan alur episode ini dalam 1-2 kalimat untuk memori episode berikutnya'),
  tema: z.string().describe('Tema singkat 2-4 kata'),
  adegan: z
    .array(
      z.object({
        nomor: z.number().int(),
        latarKode: z.string().describe('Kode lokasi latar: pilih salah satu dari daftar latar yang tersedia, atau bar/outdoor/meja/depan'),
        kartuWaktu: z.string().describe('Kartu waktu/bab opsional sangat singkat, mis. "SORE DI PANJUNAN · 16.30" (kosongkan jika tidak perlu)'),
        kamera: z.enum(KAMERA_SAH),
        tokohKiri: TokohPanggungSkema.nullable().optional(),
        tokohKanan: TokohPanggungSkema.nullable().optional(),
        pembicara: z.enum(['kiri', 'kanan', 'narator', 'tanpa']),
        namaPembicara: z.string().describe('Nama tokoh yang bicara, mis. "Mas Lek", "Mas Danu", "Mbak Rara", "Pak Budi", atau "Cerita Lek Kopi"'),
        dialog: z.string().describe('Kalimat dialog/narasi lisan santai Indonesia/Jatim tipis (6-16 kata, pas 3-5 detik bicara)'),
        sfx: z.enum(['pop', 'whoosh', 'tanpa']),
      }),
    )
    .min(5)
    .max(8),
  pertanyaanPenutup: z.string().describe('1 pertanyaan seru pemicu komentar di penutup video (maks 12 kata)'),
  caption: z.string().describe('Caption Instagram hangat & ringan 2-3 kalimat tanpa hashtag & tanpa alamat/jam buka'),
  hashtag: z.array(z.string()).describe('3-5 hashtag relevan tanpa tanda #'),
});

const PETUNJUK_JSON_SERIAL = `\n\nJawab HANYA dengan JSON valid (tanpa markdown) berstruktur:\n{"judulEpisode":"...","ringkasanEpisode":"...","tema":"...","adegan":[{"nomor":1,"latarKode":"outdoor","kartuWaktu":"SORE DI PANJUNAN · 16.30","kamera":"zoom_masuk","tokohKiri":{"id":"mas_barista","ekspresi":"senyum","properti":"kopi_panas","efek":"tanpa"},"tokohKanan":{"id":"mas_pelanggan","ekspresi":"kaget","properti":"es_kopi","efek":"tanda_tanya"},"pembicara":"kanan","namaPembicara":"Mas Danu","dialog":"...","sfx":"pop"}],"pertanyaanPenutup":"...","caption":"...","hashtag":["komedikopi"]}`;

function naskahTemplatSerial({ judulSerial = 'Cerita di Lek Kopi', nomorEpisode = 1, mood = 'komedi_ceria', ide = '' }) {
  return {
    judulEpisode: ide ? ide.slice(0, 40) : `Salah Pesan di Jam Ramai`,
    ringkasanEpisode: `Mas Danu sok pesan espresso pahit di Lek Kopi, lalu diam-diam minta tambahan susu dan gula aren ke Mas Lek.`,
    tema: mood === 'cerita_kopi' ? 'Edukasi Kopi' : 'Komedi Kedai',
    adegan: [
      {
        nomor: 1,
        latarKode: 'bar',
        kartuWaktu: 'SORE DI PANJUNAN · 16.30',
        kamera: 'zoom_masuk',
        tokohKiri: { id: 'mas_barista', ekspresi: 'senyum', properti: 'kopi_panas', efek: 'tanpa' },
        tokohKanan: { id: 'mas_pelanggan', ekspresi: 'bangga', properti: 'tunjuk', efek: 'lampu_ide' },
        pembicara: 'kanan',
        namaPembicara: 'Mas Danu',
        dialog: 'Mas Lek, hari ini saya mau pesan espresso pahit, biar kelihatan dewasa!',
        sfx: 'pop',
      },
      {
        nomor: 2,
        latarKode: 'bar',
        kartuWaktu: '',
        kamera: 'diam',
        tokohKiri: { id: 'mas_barista', ekspresi: 'mikir', properti: 'tanpa', efek: 'tanda_tanya' },
        tokohKanan: { id: 'mas_pelanggan', ekspresi: 'senyum', properti: 'uang', efek: 'tanpa' },
        pembicara: 'kiri',
        namaPembicara: 'Mas Lek',
        dialog: 'Lho tumben Mas Danu, biasanya kan selalu es kopi susu gula aren?',
        sfx: 'whoosh',
      },
      {
        nomor: 3,
        latarKode: 'outdoor',
        kartuWaktu: '',
        kamera: 'zoom_masuk',
        tokohKiri: { id: 'mas_pelanggan', ekspresi: 'cemberut', properti: 'kopi_panas', efek: 'keringat' },
        tokohKanan: { id: 'mbak_pelanggan', ekspresi: 'ketawa', properti: 'matcha_latte', efek: 'tawa' },
        pembicara: 'kanan',
        namaPembicara: 'Mbak Rara',
        dialog: 'Eh muka Mas Danu kok langsung kerut gitu baru nyicip satu teguk?',
        sfx: 'pop',
      },
      {
        nomor: 4,
        latarKode: 'outdoor',
        kartuWaktu: '',
        kamera: 'goyang_kaget',
        tokohKiri: { id: 'mas_pelanggan', ekspresi: 'malu', properti: 'kopi_panas', efek: 'keringat' },
        tokohKanan: { id: 'kucing_kedai', ekspresi: 'kaget', properti: 'tanpa', efek: 'tanda_seru' },
        pembicara: 'kiri',
        namaPembicara: 'Mas Danu',
        dialog: 'Anu Mbak, ini bukan pahit... ini terlalu jantan buat lidah saya!',
        sfx: 'pop',
      },
      {
        nomor: 5,
        latarKode: 'bar',
        kartuWaktu: '',
        kamera: 'zoom_keluar',
        tokohKiri: { id: 'mas_barista', ekspresi: 'ketawa', properti: 'es_kopi', efek: 'tawa' },
        tokohKanan: { id: 'mas_pelanggan', ekspresi: 'senyum', properti: 'jempol', efek: 'hati' },
        pembicara: 'kiri',
        namaPembicara: 'Mas Lek',
        dialog: 'Sudah saya duga, ini susu sama es batunya udah siap dari tadi kok!',
        sfx: 'whoosh',
      },
      {
        nomor: 6,
        latarKode: 'meja',
        kartuWaktu: '',
        kamera: 'zoom_masuk',
        tokohKiri: { id: 'pak_tetangga', ekspresi: 'bangga', properti: 'es_kopi', efek: 'tawa' },
        tokohKanan: { id: 'mas_pelanggan', ekspresi: 'ketawa', properti: 'es_kopi', efek: 'tanpa' },
        pembicara: 'kiri',
        namaPembicara: 'Pak Budi',
        dialog: 'Nah gitu dong, ngopi itu cari enaknya, bukan cari gengsinya rek!',
        sfx: 'pop',
      },
    ],
    pertanyaanPenutup: 'Kamu tim kopi pahit atau tim es kopi susu nih? Komen ya!',
    caption: `Episode ${nomorEpisode} ${judulSerial}: niatnya tampil dewasa pesan espresso pahit, eh ujung-ujungnya balik ke es kopi susu juga 😂`,
    hashtag: ['ceritalekkopi', 'komedikopi', 'eskopisusu', 'ngopidisidoarjo'],
    sumber: 'templat-serial',
  };
}

/** Tulis naskah 1 episode Serial Kartun 2D Lek Kopi memakai router hemat + memori episode sebelumnya. */
export async function buatNaskahSerialKartun({
  judulSerial = 'Cerita di Lek Kopi',
  nomorEpisode = 1,
  mood = 'komedi_ceria',
  formatSuara = 'dialog',
  ide = '',
  riwayatEpisode = [],
  daftarLatar = [],
  daftarMenu = [],
}) {
  if (!urutanPenyediaWorker({ adaGambar: false }).length) {
    return naskahTemplatSerial({ judulSerial, nomorEpisode, mood, ide });
  }

  const arahanMood =
    mood === 'kehidupan_santai'
      ? 'Nuansa: cerita kehidupan sehari-hari yang hangat, santai, menenangkan hati, dekat dengan realita pekerja/mahasiswa/warga Sidoarjo.'
      : mood === 'cerita_kopi'
      ? 'Nuansa: cerita ringan tentang kopi, racikan, dan minuman resmi Lek Kopi (lihat daftar menu resmi), dikemas asyik dan tidak menggurui.'
      : 'Nuansa: komedi ceria slice-of-life! Ada setup lucu, salah paham kocak atau celetukan jujur, dan punchline hangat yang bikin penonton senyum.';

  const arahanFormat =
    formatSuara === 'narator'
      ? 'Format suara: Mode 1 Narator yang bercerita hangat (isi `pembicara: "narator"`, `namaPembicara: "Cerita Lek Kopi"`), sambil tetap menampilkan 1-2 tokoh berakting ekspresif di panggung.'
      : 'Format suara: Mode Dialog Antar Tokoh! Tektokan aktif antara tokoh kiri dan kanan (`pembicara: "kiri"` atau `"kanan"`), sesekali boleh 1 adegan narasi singkat atau reaksi kucing.';

  const teksLatar = daftarLatar.length
    ? daftarLatar.map((l) => `- "${l.kode}": ${l.nama}${l.deskripsi ? ` (${l.deskripsi})` : ''}`).join('\n')
    : '- "bar": Meja Bar / Kasir Lek Kopi\n- "outdoor": Area Duduk Outdoor Paving\n- "meja": Close-up Meja Kopi\n- "depan": Depan Kedai Lek Kopi';

  const menuSumber = (Array.isArray(daftarMenu) ? daftarMenu : []).filter((m) => m && String(m.nama ?? '').trim()).slice(0, 25);
  const teksMenu = menuSumber.length
    ? menuSumber.map((m) => `- ${String(m.nama).trim()}${Number(m.harga) > 0 ? ` (Rp${Number(m.harga).toLocaleString('id-ID')})` : ''}`).join('\n')
    : [
        '- Kopi Lek (Rp10.000)',
        '- Americano (Rp10.000)',
        '- Arum Dalu (Caramel) (Rp12.000)',
        '- Butterscoth Latte (Rp14.000)',
        '- Kencana (Vanilla) (Rp12.000)',
        '- Komandan (Rp12.000)',
        '- Kopasus (Rp12.000)',
        '- Koramil (Rp12.000)',
        '- Peach Americano (Rp12.000)',
        '- Tubruk (Rp5.000)',
        '- Matcha Latte (Rp14.000)',
        '- Es Cokelat (Rp12.000)',
      ].join('\n');

  const teksRiwayat = riwayatEpisode.length
    ? `MEMORI EPISODE SEBELUMNYA (lanjutkan nuansa dunia kedai ini secara natural, JANGAN mengulang punchline/konflik yang sama persis):\n${riwayatEpisode
        .slice(-6)
        .map((e) => `- Episode ${e.nomor} "${e.judul}": ${e.ringkasan}`)
        .join('\n')}`
    : 'Ini Episode 1: perkenalkan suasana akrab Lek Kopi secara langsung lewat cerita seru tanpa perkenalan kaku.';

  const system =
    'Kamu penulis naskah animasi kartun 2D pendek (Instagram Reels 9:16) untuk kedai kopi "Lek Kopi" (@lekkopi.id) di Panjunan, Waru, Sidoarjo (buka Senin–Sabtu 14.00–23.00 WIB). ' +
    'Gaya cerita WAJIB ceria, hangat, santai, atau komedi ringan (DILARANG keras cerita horor, seram, atau gelap). ' +
    'Gunakan Bahasa Indonesia sehari-hari yang luwes dengan sentuhan ramah Jawa Timur tipis ("lho", "rek", "cak", "sih", "nih") yang tetap dipahami seluruh Indonesia. ' +
    'Tokoh tetap: `mas_barista` (Mas Lek, barista ramah), `mas_pelanggan` (Mas Danu, pelanggan polos), `mbak_pelanggan` (Mbak Rara, suka Matcha Latte & Butterscoth Latte), `pak_tetangga` (Pak Budi, bapak berkopiah bijak & kocak), `kucing_kedai` (Cimol si kucing oren — kucing tidak berbicara panjang, cukup ekspresi/efek atau disapa tokoh lain).';

  const prompt = [
    `Buat naskah untuk "${judulSerial}" — EPISODE ${nomorEpisode} (6 sampai 7 adegan, total durasi ±30–42 detik).`,
    arahanMood,
    arahanFormat,
    `Latar yang tersedia (pilih kode di kolom \`latarKode\`):\n${teksLatar}`,
    `MENU RESMI LEK KOPI (lek-kopi.web.app):\n${teksMenu}\nBila menyebut menu atau harga, WAJIB pakai HANYA menu resmi Lek Kopi dari daftar ini / https://lek-kopi.web.app; DILARANG mengarang menu yang tidak ada.`,
    teksRiwayat,
    ide ? `Ide/topik spesifik dari Kyai: ${ide}` : 'Topik bebas — pilihkan konflik/cerita paling relatable dan lucu untuk pengunjung kedai kopi.',
    'Aturan wajib:',
    '- Adegan 1 langsung hook lucu/menarik dalam 2 detik pertama + boleh pakai `kartuWaktu` singkat.',
    '- Tiap dialog 6–16 kata saja agar pas 3–5 detik bicara dan enak dibaca subtitle.',
    '- Ganti-ganti ekspresi, properti (`es_kopi`, `matcha_latte`, `kopi_panas`, `hp`, `uang`, `jempol`, `tunjuk`), efek reaksi komik, dan sudut kamera (`zoom_masuk`, `goyang_kaget`, dll.) supaya visual terasa hidup.',
  ].join('\n\n');

  try {
    const r = await panggilRouterWorkerJson({
      system,
      prompt,
      maksToken: 4096,
      suhu: 0.78,
      skemaZod: SkemaNaskahSerial,
      petunjukJson: PETUNJUK_JSON_SERIAL,
      namaTahap: 'naskah serial kartun',
      effortClaude: 'low',
    });
    return {
      ...r.data,
      sumber: `serial:${r.sumber}`,
      pemakaian: r.pemakaian,
    };
  } catch (e) {
    console.error('Semua penyedia naskah serial gagal, memakai templat:', e.message);
    return {
      ...naskahTemplatSerial({ judulSerial, nomorEpisode, mood, ide }),
      sumber: `templat-serial (${String(e.message).slice(0, 100)})`,
    };
  }
}

function normalisasiTokohPanggung(t) {
  if (!t || typeof t !== 'object') return null;
  const id = TOKOH_SAH.includes(t.id) ? t.id : 'mas_barista';
  return {
    id,
    nama: NAMA_TOKOH[id] || 'Lek Kopi',
    ekspresi: EKSPRESI_SAH.includes(t.ekspresi) ? t.ekspresi : 'senyum',
    properti: PROPERTI_SAH.includes(t.properti) ? t.properti : 'tanpa',
    efek: EFEK_SAH.includes(t.efek) ? t.efek : 'tanpa',
  };
}

/**
 * Rapikan naskah serial & cocokkan kode latar dengan foto kartun yang ada
 * menjadi objek props siap render Remotion `SerialKartun`. Murni.
 */
export function siapkanPropsSerialKartun(naskah, konteks = {}) {
  const petaLatar = konteks.petaLatar ?? {};
  const fallbackBerkas = Object.values(petaLatar)[0] || undefined;
  const daftarSuara = Array.isArray(konteks.suaraHasil) ? konteks.suaraHasil : [];
  const durasiSuara = Array.isArray(konteks.durasiSuara) ? konteks.durasiSuara : [];

  const adegan = (naskah?.adegan ?? []).slice(0, 8).map((a, idx) => {
    const kodeMentah = String(a?.latarKode ?? 'outdoor').trim().toLowerCase();
    const kode = ['bar', 'outdoor', 'meja', 'depan'].includes(kodeMentah) || petaLatar[kodeMentah]
      ? kodeMentah
      : 'outdoor';
    const latarBerkas = petaLatar[kode] || fallbackBerkas;

    let tokohKiri = normalisasiTokohPanggung(a?.tokohKiri);
    const tokohKanan = normalisasiTokohPanggung(a?.tokohKanan);
    if (!tokohKiri && !tokohKanan) {
      tokohKiri = { id: 'mas_barista', nama: 'Mas Lek', ekspresi: 'senyum', properti: 'kopi_panas', efek: 'tanpa' };
    }

    let pembicara = ['kiri', 'kanan', 'narator', 'tanpa'].includes(a?.pembicara) ? a.pembicara : 'narator';
    if (pembicara === 'kiri' && !tokohKiri) pembicara = tokohKanan ? 'kanan' : 'narator';
    if (pembicara === 'kanan' && !tokohKanan) pembicara = tokohKiri ? 'kiri' : 'narator';

    const tokohPembicara = pembicara === 'kiri' ? tokohKiri?.id : pembicara === 'kanan' ? tokohKanan?.id : 'narator';
    const namaPembicara =
      String(a?.namaPembicara ?? '').trim() ||
      NAMA_TOKOH[tokohPembicara] ||
      'Cerita Lek Kopi';

    const itemSuara = daftarSuara[idx] ?? {};
    const detikAudio = Number(durasiSuara[idx]) || 0;
    const teksDialog = String(a?.dialog ?? '').trim();
    const perkiraanBaca = Math.max(2.6, Math.min(6.5, teksDialog.split(/\s+/).filter(Boolean).length * 0.42 + 0.9));
    const durasi = detikAudio > 0 ? Math.max(2.4, Math.min(9.5, detikAudio + 0.5)) : perkiraanBaca;

    return {
      nomor: Number(a?.nomor) || idx + 1,
      durasi,
      latarKode: kode,
      ...(latarBerkas ? { latarBerkas } : {}),
      ...(a?.kartuWaktu ? { kartuWaktu: String(a.kartuWaktu).trim().slice(0, 42) } : {}),
      kamera: KAMERA_SAH.includes(a?.kamera) ? a.kamera : 'zoom_masuk',
      tokohKiri,
      tokohKanan,
      pembicara,
      namaPembicara,
      dialog: teksDialog,
      ...(itemSuara.berkas ? { suaraBerkas: path.basename(itemSuara.berkas) } : {}),
      ...(Array.isArray(itemSuara.kata) && itemSuara.kata.length ? { kata: itemSuara.kata } : {}),
      sfx: ['pop', 'whoosh', 'tanpa'].includes(a?.sfx) ? a.sfx : 'tanpa',
    };
  });

  const latarIntroBerkas = adegan[0]?.latarBerkas || fallbackBerkas;
  const latarIntroKode = adegan[0]?.latarKode || 'outdoor';

  return {
    judulSerial: String(konteks.judulSerial || 'Cerita di Lek Kopi').slice(0, 60),
    nomorEpisode: Math.max(1, Math.round(Number(konteks.nomorEpisode) || 1)),
    judulEpisode: String(naskah?.judulEpisode || `Episode ${konteks.nomorEpisode || 1}`).slice(0, 72),
    akun: konteks.akun || '@lekkopi.id',
    mood: ['komedi_ceria', 'kehidupan_santai', 'cerita_kopi'].includes(konteks.mood) ? konteks.mood : 'komedi_ceria',
    pertanyaanPenutup: String(naskah?.pertanyaanPenutup || 'Menurutmu gimana cerita kali ini? Tulis di komentar!').slice(0, 120),
    infoKedai: konteks.infoKedai || 'Panjunan, Waru, Sidoarjo · Senin–Sabtu 14.00–23.00 WIB',
    ...(latarIntroBerkas ? { latarIntroBerkas } : {}),
    latarIntroKode,
    musik: konteks.musik || null,
    musikVolume: konteks.musikVolume ?? 0.16,
    sfxPop: konteks.sfx?.pop || null,
    sfxWhoosh: konteks.sfx?.whoosh || null,
    sfxChime: konteks.sfx?.chime || null,
    adegan,
  };
}

/**
 * Gabungkan ringkasan episode baru ke `profil.serial_kartun` secara idempoten (untuk memori Episode N+1). Murni.
 */
export function gabungRiwayatEpisode(serialKartunProfil, serialId, episodeBaru, metaSerial = {}) {
  const idTarget = serialId || 'cerita-lek-kopi';
  const dasar = serialKartunProfil && typeof serialKartunProfil === 'object'
    ? { ...serialKartunProfil }
    : { latar: [], serial: [], serialAktifId: idTarget };
  const daftarSerial = Array.isArray(dasar.serial) ? [...dasar.serial] : [];
  let idx = daftarSerial.findIndex((s) => s?.id === idTarget);
  if (idx < 0) {
    daftarSerial.push({
      id: idTarget,
      judul: String(metaSerial?.judulSerial || 'Cerita di Lek Kopi').slice(0, 60),
      tagline: '',
      moodBawaan: metaSerial?.mood || episodeBaru?.mood || 'komedi_ceria',
      formatSuara: metaSerial?.formatSuara === 'narator' ? 'narator' : 'dialog',
      suaraTokoh: {},
      episode: [],
      dibuat: episodeBaru?.dibuat || new Date().toISOString(),
    });
    idx = daftarSerial.length - 1;
  }

  const target = { ...daftarSerial[idx] };
  const epLama = Array.isArray(target.episode) ? target.episode : [];
  const nomor = Math.max(1, Math.round(Number(episodeBaru?.nomor) || 1));
  const tugasId = episodeBaru?.tugasId ? String(episodeBaru.tugasId).trim() : '';

  const bersih = epLama.filter((e) => e && e.nomor !== nomor && (!tugasId || e.tugasId !== tugasId));
  bersih.push({
    nomor,
    judul: String(episodeBaru?.judul || `Episode ${nomor}`).slice(0, 80),
    ringkasan: String(episodeBaru?.ringkasan || '').slice(0, 260),
    tema: String(episodeBaru?.tema || '').slice(0, 120),
    mood: episodeBaru?.mood || target.moodBawaan || 'komedi_ceria',
    ...(tugasId ? { tugasId } : {}),
    dibuat: episodeBaru?.dibuat || new Date().toISOString(),
  });
  bersih.sort((a, b) => a.nomor - b.nomor);
  target.episode = bersih.slice(-50);
  daftarSerial[idx] = target;

  return {
    ...dasar,
    serialAktifId: dasar.serialAktifId || idTarget,
    serial: daftarSerial,
  };
}

/**
 * Orkestrasi penuh 1 tugas Serial Kartun 2D:
 * Naskah → Suara ElevenLabs multi-tokoh → Unduh latar kartun → Musik/SFX → Remotion → Sampul & Caption.
 */
export async function renderSerialKartun({ tugas, merek, merekBakafrawi, folder, simpan, log = console.log }) {
  const metaTugas = tugas?.naskah?.serialKartun ?? {};
  const konfig = merek?.profil?.serial_kartun ?? {};
  const daftarSerial = Array.isArray(konfig.serial) ? konfig.serial : [];
  const serialId = metaTugas.serialId || konfig.serialAktifId || daftarSerial[0]?.id || 'cerita-lek-kopi';
  const serialObj = daftarSerial.find((s) => s?.id === serialId) ?? daftarSerial[0] ?? {};

  const judulSerial = metaTugas.judulSerial || serialObj.judul || 'Cerita di Lek Kopi';
  const riwayatEpisode = Array.isArray(serialObj.episode) ? serialObj.episode : [];
  const nomorEpisode = Number(metaTugas.nomorEpisode) || (riwayatEpisode.reduce((m, e) => Math.max(m, Number(e?.nomor) || 0), 0) + 1);
  const mood = metaTugas.mood || serialObj.moodBawaan || 'komedi_ceria';
  const formatSuara = metaTugas.formatSuara || serialObj.formatSuara || 'dialog';
  const suaraTokoh = metaTugas.suaraTokoh || serialObj.suaraTokoh || {};
  const daftarLatar = Array.isArray(konfig.latar) ? konfig.latar : [];

  const punyaDrafDisetujui =
    metaTugas?.naskahJadi &&
    Array.isArray(metaTugas.naskahJadi.adegan) &&
    metaTugas.naskahJadi.adegan.length > 0;

  const naskah = punyaDrafDisetujui
    ? {
        judulEpisode: String(metaTugas.naskahJadi.judulEpisode || `Episode ${nomorEpisode}`),
        ringkasanEpisode: String(metaTugas.naskahJadi.ringkasanEpisode || ''),
        tema: String(metaTugas.naskahJadi.tema || mood),
        adegan: metaTugas.naskahJadi.adegan,
        pertanyaanPenutup: String(metaTugas.naskahJadi.pertanyaanPenutup || ''),
        caption: String(metaTugas.naskahJadi.caption || ''),
        hashtag: Array.isArray(metaTugas.naskahJadi.hashtag) ? metaTugas.naskahJadi.hashtag : [],
        sumber: 'draf-disetujui',
      }
    : await buatNaskahSerialKartun({
        judulSerial,
        nomorEpisode,
        mood,
        formatSuara,
        ide: metaTugas.ide || tugas?.arahan || '',
        riwayatEpisode,
        daftarLatar,
        daftarMenu:
          Array.isArray(metaTugas.daftarMenu) && metaTugas.daftarMenu.length
            ? metaTugas.daftarMenu
            : Array.isArray(merek?.profil?.menu_asli)
            ? merek.profil.menu_asli
            : [],
      });

  const publik = path.join(folder, 'publik-serial');
  await mkdir(publik, { recursive: true });

  // 1. Unduh gambar latar kartun dari Supabase Storage ke folder publik Remotion
  const petaLatar = {};
  for (const [i, l] of daftarLatar.entries()) {
    const url = String(l?.urlKartun ?? '').trim();
    const kode = String(l?.kode ?? '').trim().toLowerCase();
    if (!kode || !/^https?:\/\//i.test(url) || petaLatar[kode]) continue;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!r.ok) continue;
      const ext = /\.png(\?|$)/i.test(url) ? '.png' : '.jpg';
      const namaBerkas = `latar-${i}-${kode}${ext}`;
      await writeFile(path.join(publik, namaBerkas), Buffer.from(await r.arrayBuffer()));
      petaLatar[kode] = namaBerkas;
    } catch (e) {
      log(`Latar kartun ${kode} gagal diunduh (pakai bawaan): ${String(e?.message ?? e).slice(0, 100)}`);
    }
  }

  // 2. Buat audio multi-tokoh (ElevenLabs dengan timestamps untuk lip-sync + fallback berjenjang)
  const daftarVoice = Array.isArray(merekBakafrawi?.profil?.suara_elevenlabs)
    ? merekBakafrawi.profil.suara_elevenlabs
    : [];
  const itemDialog = naskah.adegan.map((a) => {
    const p = a.pembicara;
    const tokohId =
      p === 'kiri' ? (a.tokohKiri?.id || 'mas_barista') :
      p === 'kanan' ? (a.tokohKanan?.id || 'mas_pelanggan') :
      'narator';
    return {
      teks: p === 'tanpa' ? '' : a.dialog,
      pembicara: tokohId,
      gender: tokohId === 'mbak_pelanggan' ? 'wanita' : 'pria',
    };
  });

  const suaraHasil = await suaraDialogSerial(itemDialog, publik, { suaraTokoh, daftarVoice });
  const durasiSuara = [];
  for (const s of suaraHasil.item) {
    if (!s?.berkas) {
      durasiSuara.push(0);
      continue;
    }
    const info = await probe(s.berkas).catch(() => ({ durasi: 3.4 }));
    durasiSuara.push(Number(info.durasi) || 3.4);
  }

  // 3. Siapkan SFX & musik latar
  const sfx = await buatSfxOpening(publik).catch(() => ({ pop: null, whoosh: null, chime: null }));
  const propsSementara = siapkanPropsSerialKartun(naskah, {
    judulSerial,
    nomorEpisode,
    mood,
    petaLatar,
    suaraHasil: suaraHasil.item,
    durasiSuara,
    sfx,
  });
  const totalDetikPerkiraan = hitungDurasiSerialKartun(propsSementara).totalDetik;

  let musikNama = null;
  const dirMusik = path.join(DIR, '..', 'aset', 'musik');
  const laguAda = pilihMusik(await readdir(dirMusik).catch(() => []));
  if (laguAda) {
    const namaSalin = `musik-serial${path.extname(laguAda) || '.mp3'}`;
    await copyFile(path.join(dirMusik, laguAda), path.join(publik, namaSalin)).catch(() => null);
    if (existsSync(path.join(publik, namaSalin))) musikNama = namaSalin;
  }
  if (!musikNama) {
    const gayaMusik = mood === 'komedi_ceria' ? 'terang-modern' : 'hangat-kafe';
    const hariEpoch = Math.floor(Date.now() / 86_400_000) + nomorEpisode;
    await buatMusikKafe({
      gaya: gayaMusik,
      hariEpoch,
      durasiDetik: totalDetikPerkiraan + 2,
      keluarMp3: path.join(publik, 'musik-serial.mp3'),
    }).catch(() => null);
    if (existsSync(path.join(publik, 'musik-serial.mp3'))) musikNama = 'musik-serial.mp3';
  }

  const propsFinal = { ...propsSementara, musik: musikNama };
  const propsPath = path.join(folder, 'props-serial.json');
  await writeFile(propsPath, JSON.stringify(propsFinal));

  const durasiInfo = hitungDurasiSerialKartun(propsFinal);
  const videoKeluar = path.join(folder, 'serial-kartun.mp4');
  log(`🎬 Remotion SerialKartun EP ${nomorEpisode}: ${propsFinal.adegan.length} adegan, ${durasiInfo.totalDetik.toFixed(1)} dtk`);

  await jalankan(
    process.execPath,
    [CLI, 'render', 'src/index.ts', 'SerialKartun', videoKeluar, `--props=${propsPath}`, `--public-dir=${publik}`, '--log=error'],
    { cwd: REMOTION },
  );

  const sampul = path.join(folder, 'sampul-serial.jpg');
  await ffmpeg(['-y', '-ss', '1.2', '-i', videoKeluar, '-frames:v', '1', '-q:v', '3', sampul]).catch(() => null);

  const hasil = [
    { jenis: 'video', rasio: 'story', durasi: Math.round(durasiInfo.totalDetik), url: await simpan(videoKeluar, 'video/mp4') },
  ];
  if (existsSync(sampul)) {
    hasil.push({ jenis: 'gambar', rasio: 'sampul', url: await simpan(sampul, 'image/jpeg') });
  }

  const tagInti = ['lekkopi', 'lekkopisidoarjo', 'kopiwaru', 'animasilucu', 'ceritalekkopi'];
  const tagGabung = [
    ...new Set(
      [...tagInti, ...(merek?.profil?.hashtag ?? []), ...(naskah.hashtag ?? [])]
        .map((h) => String(h).replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 10);

  const caption = [
    `🎬 ${judulSerial.toUpperCase()} · EPISODE ${nomorEpisode}: ${naskah.judulEpisode}`,
    '',
    naskah.caption,
    '',
    `💬 ${naskah.pertanyaanPenutup}`,
    '',
    '📍 Jl. Kolonel Sugiono No. 112, Panjunan, Waru, Sidoarjo',
    '⏰ Senin–Sabtu, 14.00–23.00 WIB (tersedia di GoFood, GrabFood, ShopeeFood & TikTok GO)',
    '',
    tagGabung.map((h) => `#${h}`).join(' '),
  ].join('\n');

  const catatan = [
    `serial: ${serialId} · episode ${nomorEpisode}`,
    `latar foto terpakai: ${Object.keys(petaLatar).length}`,
    ...suaraHasil.catatan,
  ];

  return {
    naskah: {
      sumber: naskah.sumber,
      judul: `Ep ${nomorEpisode}: ${naskah.judulEpisode}`,
      judulEpisode: naskah.judulEpisode,
      ringkasanEpisode: naskah.ringkasanEpisode,
      tema: naskah.tema,
      adegan: naskah.adegan,
      pertanyaanPenutup: naskah.pertanyaanPenutup,
      serialKartun: {
        ...metaTugas,
        serialId,
        judulSerial,
        nomorEpisode,
        mood,
        formatSuara,
      },
      catatan,
      ...(Array.isArray(naskah.pemakaian) ? { pemakaian: naskah.pemakaian } : {}),
    },
    caption,
    hasil,
    namaProduk: `${judulSerial} · Ep ${nomorEpisode}`,
    episodeSelesai: {
      serialId,
      judulSerial,
      mood,
      formatSuara,
      episode: {
        nomor: nomorEpisode,
        judul: naskah.judulEpisode,
        ringkasan: naskah.ringkasanEpisode,
        tema: naskah.tema,
        mood,
        tugasId: tugas?.id,
        dibuat: new Date().toISOString(),
      },
    },
  };
}
