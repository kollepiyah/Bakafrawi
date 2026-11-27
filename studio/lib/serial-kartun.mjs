// Mesin pembuat & perender 1 episode Serial Kartun 2D Lek Kopi.
// Berjalan mandiri di folder `studio/` (tanpa impor dari `src/` agar cocok dengan sparse-checkout GitHub Actions).
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ffmpeg, jalankan, probe } from './bank/alat.mjs';
import { adaGambarAi, buatGambarAi, galatKuota } from './bank/gambar-ai.mjs';
import { suaraDialogSerial } from './bank/suara.mjs';
import { buatMusikKafe, buatSfxOpening } from './opening-audio.mjs';
import { panggilRouterWorkerJson, urutanPenyediaWorker } from './router-worker.mjs';
import { pilihMusik } from './video.mjs';
import { hitungDurasiSerialKartun } from '../remotion/src/data/serial-waktu.ts';
import { FPS_MOTION, hitungDurasiCeritaMotion } from '../remotion/src/data/cerita-motion.ts';

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
  judulEpisode: z.string().describe('Judul episode menarik & hangat/lucu'),
  ringkasanEpisode: z.string().describe('Ringkasan alur & titik akhir episode ini dalam 1-2 kalimat untuk memori episode berikutnya'),
  tema: z.string().describe('Tema singkat 2-4 kata'),
  adegan: z
    .array(
      z.object({
        nomor: z.number().int(),
        latarKode: z.string().describe('Kode lokasi latar: pilih salah satu dari daftar latar yang tersedia, atau bar/outdoor/meja/depan'),
        kartuWaktu: z.string().describe('Kartu waktu/bab opsional singkat, mis. "ADEGAN 1 · LEMBAH SUNYI" (kosongkan jika tidak perlu)'),
        kamera: z.enum(KAMERA_SAH),
        tokohKiri: TokohPanggungSkema.nullable().optional(),
        tokohKanan: TokohPanggungSkema.nullable().optional(),
        pembicara: z.enum(['kiri', 'kanan', 'narator', 'tanpa']),
        namaPembicara: z.string().describe('Nama tokoh/narator yang bicara, mis. "Narator", "Mas Lek", "Mas Danu", "Mbak Rara", "Pak Budi", atau "Cerita Lek Kopi"'),
        dialog: z.string().describe('Kalimat dialog/narasi lisan natural Indonesia (12–48 kata sesuai target panjang episode, boleh 2–3 kalimat utuh)'),
        promptVisual: z.string().optional().describe('Prompt visual Inggris untuk ilustrasi sinematik 9:16 khusus mode dokumenter'),
        jenisMotion: z.enum(['pembuka', 'perkamen', 'peta', 'ilustrasi', 'penutup']).optional(),
        judulKartu: z.string().optional(),
        kataSorot: z.array(z.string()).optional(),
        sfx: z.enum(['pop', 'whoosh', 'tanpa']),
      }),
    )
    .min(3)
    .max(16),
  pertanyaanPenutup: z.string().describe('1 pertanyaan seru pemicu komentar atau ajakan tunggu episode berikutnya di penutup video (maks 20 kata)'),
  caption: z.string().describe('Caption Instagram hangat & ringan 2-4 kalimat tanpa hashtag & tanpa alamat/jam buka'),
  hashtag: z.array(z.string()).describe('3-5 hashtag relevan tanpa tanda #'),
});

const JENIS_MOTION_SAH = ['pembuka', 'perkamen', 'peta', 'ilustrasi', 'penutup'];

/** Rapikan JSON mentah dari AI gratis (Cloudflare/OpenRouter/Groq) agar tidak gagal Zod hanya karena enum/field opsional. */
export function normalisasiNaskahSerialWorker(mentah, { nomorEpisode = 1, gayaCerita = 'kedai' } = {}) {
  const akar = mentah && typeof mentah === 'object' && !Array.isArray(mentah) ? mentah : {};
  const isiBungkus = [akar.naskah, akar.episode, akar.data, akar.hasil].find(
    (v) => v && typeof v === 'object' && !Array.isArray(v),
  );
  const obj = Array.isArray(akar.adegan) || Array.isArray(akar.scenes) ? akar : (isiBungkus ?? akar);
  const daftar = Array.isArray(obj.adegan) ? obj.adegan : Array.isArray(obj.scenes) ? obj.scenes : [];
  const dok = gayaCerita === 'dokumenter';

  const normTokoh = (t) => {
    if (!t || typeof t !== 'object' || dok) return null;
    const id = TOKOH_SAH.includes(String(t.id ?? '').trim()) ? String(t.id).trim() : 'mas_barista';
    const ekspresi = EKSPRESI_SAH.includes(String(t.ekspresi ?? '').trim()) ? String(t.ekspresi).trim() : 'senyum';
    const properti = PROPERTI_SAH.includes(String(t.properti ?? '').trim()) ? String(t.properti).trim() : 'tanpa';
    const efek = EFEK_SAH.includes(String(t.efek ?? '').trim()) ? String(t.efek).trim() : 'tanpa';
    return { id, ekspresi, properti, efek };
  };

  const adegan = daftar
    .slice(0, 16)
    .map((a, idx) => {
      const x = a && typeof a === 'object' ? a : {};
      const dialog = String(x.dialog ?? x.narasi ?? x.teks ?? x.text ?? '').trim();
      const kam = String(x.kamera ?? 'zoom_masuk').trim();
      const sfxRaw = String(x.sfx ?? 'tanpa').trim().toLowerCase();
      const pemRaw = String(x.pembicara ?? (dok ? 'narator' : 'kiri')).trim().toLowerCase();
      const pembicara = dok
        ? (pemRaw === 'tanpa' ? 'tanpa' : 'narator')
        : (['kiri', 'kanan', 'narator', 'tanpa'].includes(pemRaw) ? pemRaw : 'narator');
      const jmRaw = String(x.jenisMotion ?? x.jenis_motion ?? '').trim().toLowerCase();
      const kataSorot = Array.isArray(x.kataSorot)
        ? x.kataSorot.map((k) => String(k ?? '').trim()).filter(Boolean).slice(0, 8)
        : typeof x.kataSorot === 'string'
        ? x.kataSorot.split(/[,;]+/).map((k) => k.trim()).filter(Boolean).slice(0, 8)
        : undefined;
      return {
        nomor: Math.max(1, Math.round(Number(x.nomor) || idx + 1)),
        latarKode: String(x.latarKode ?? x.latar_kode ?? x.latar ?? (dok ? 'sejarah' : 'outdoor')).trim() || (dok ? 'sejarah' : 'outdoor'),
        kartuWaktu: String(x.kartuWaktu ?? x.kartu_waktu ?? '').trim(),
        kamera: KAMERA_SAH.includes(kam) ? kam : 'zoom_masuk',
        tokohKiri: normTokoh(x.tokohKiri ?? x.tokoh_kiri),
        tokohKanan: normTokoh(x.tokohKanan ?? x.tokoh_kanan),
        pembicara,
        namaPembicara: String(x.namaPembicara ?? x.nama_pembicara ?? (dok ? 'Narator' : 'Mas Lek')).trim() || (dok ? 'Narator' : 'Mas Lek'),
        dialog,
        ...(x.promptVisual || x.prompt_visual || x.visual ? { promptVisual: String(x.promptVisual ?? x.prompt_visual ?? x.visual).trim() } : {}),
        ...(JENIS_MOTION_SAH.includes(jmRaw) ? { jenisMotion: jmRaw } : {}),
        ...(x.judulKartu || x.judul_kartu ? { judulKartu: String(x.judulKartu ?? x.judul_kartu).trim() } : {}),
        ...(kataSorot?.length ? { kataSorot } : {}),
        sfx: sfxRaw === 'pop' || sfxRaw === 'whoosh' ? sfxRaw : 'tanpa',
      };
    })
    .filter((a) => a.dialog.length > 0);

  const hashtag = Array.isArray(obj.hashtag)
    ? obj.hashtag.map((h) => String(h ?? '').replace(/^#+/, '').trim()).filter(Boolean).slice(0, 8)
    : ['lekkopi', 'ceritakopi'];

  return {
    judulEpisode: String(obj.judulEpisode ?? obj.judul_episode ?? obj.judul ?? obj.title ?? '').trim() || `Episode ${nomorEpisode}`,
    ringkasanEpisode: String(obj.ringkasanEpisode ?? obj.ringkasan_episode ?? obj.ringkasan ?? '').trim() || `Episode ${nomorEpisode}`,
    tema: String(obj.tema ?? obj.theme ?? '').trim() || (dok ? 'Dokumenter Sejarah' : 'Cerita Kedai'),
    adegan,
    pertanyaanPenutup: String(obj.pertanyaanPenutup ?? obj.pertanyaan_penutup ?? '').trim() || 'Menurutmu gimana kisah ini? Komen ya!',
    caption: String(obj.caption ?? '').trim() || String(obj.ringkasanEpisode ?? obj.judulEpisode ?? '').trim(),
    hashtag: hashtag.length ? hashtag : ['lekkopi'],
  };
}

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

const PANJANG_WORKER = {
  ringkas: {
    durasiLabel: '45–60 detik',
    rentangAdegan: '6 sampai 8 adegan',
    kataPerAdegan: '12–22 kata per adegan (1–2 kalimat utuh)',
    durasiAdegan: '4–8 detik per adegan',
  },
  sedang: {
    durasiLabel: '1–1,5 menit',
    rentangAdegan: '7 sampai 10 adegan',
    kataPerAdegan: '18–34 kata per adegan (2–3 kalimat utuh yang mengalir natural)',
    durasiAdegan: '6–12 detik per adegan',
  },
  panjang: {
    durasiLabel: '1,5–2,5 menit',
    rentangAdegan: '9 sampai 14 adegan',
    kataPerAdegan: '22–48 kata per adegan (2–4 kalimat naratif kaya, tidak terburu-buru)',
    durasiAdegan: '8–18 detik per adegan',
  },
};

/** Tulis naskah 1 episode Serial Kartun 2D Lek Kopi memakai router hemat + memori episode sebelumnya. */
export async function buatNaskahSerialKartun({
  judulSerial = 'Cerita di Lek Kopi',
  nomorEpisode = 1,
  mood = 'komedi_ceria',
  formatSuara = 'dialog',
  panjangNaskah = 'sedang',
  bersambung = false,
  gayaCerita = 'kedai',
  temaVisual = 'malam',
  hasilRiset = '',
  ide = '',
  riwayatEpisode = [],
  daftarLatar = [],
  daftarMenu = [],
}) {
  if (!urutanPenyediaWorker({ adaGambar: false }).length) {
    if (gayaCerita === 'dokumenter') {
      throw new Error(
        'Belum ada penyedia AI teks yang aktif di mesin Studio untuk menyusun naskah dokumenter. Gunakan tombol Tulis Manual atau buat Draf Naskah dulu sebelum render.',
      );
    }
    return naskahTemplatSerial({ judulSerial, nomorEpisode, mood, ide });
  }

  const spek = PANJANG_WORKER[panjangNaskah] ?? PANJANG_WORKER.sedang;
  const teksRiwayat = riwayatEpisode.length
    ? `MEMORI EPISODE SEBELUMNYA (lanjutkan nuansa/alur cerita dari titik akhir ini, JANGAN mengulang punchline/konflik yang sama persis):\n${riwayatEpisode
        .slice(-6)
        .map((e) => `- Episode ${e.nomor} "${e.judul}": ${e.ringkasan}`)
        .join('\n')}`
    : 'Ini Episode 1: bangun cerita dengan hook kuat sejak detik pertama.';

  const arahanBersambung = bersambung
    ? `\nMODE BERSAMBUNG: Materi cerita dari pemilik boleh dipecah menjadi beberapa episode. Untuk Episode ${nomorEpisode} ini, garap porsinya secara mendalam dan utuh, tutup adegan terakhir atau pertanyaanPenutup dengan jembatan "Bersambung ke Episode ${nomorEpisode + 1}", serta tuliskan ringkasanEpisode mencatat titik akhir cerita agar Episode berikutnya langsung menyambung.`
    : '';

  const ideBersih = String(ide ?? '').trim().slice(0, 4000);
  const risetBersih = String(hasilRiset ?? '').trim().slice(0, 2800);

  let system;
  let prompt;

  if (gayaCerita === 'dokumenter') {
    const gayaGambar =
      temaVisual === 'perkamen'
        ? 'flat vintage historical storybook illustration with warm parchment paper grain, muted cream ochre terracotta umber palette, soft empty upper sky, vertical 9:16 composition, strictly no text, no letters, no banners, no signage, no watermark, no floating coffee cups'
        : 'atmospheric dark 2D painterly gouache illustration with subtle paper grain, deep indigo-charcoal shadows and warm glowing amber light, darkened lower third, vertical 9:16 composition, strictly no text, no letters, no signage, no watermark, no floating coffee cups';
    system =
      'Kamu penulis naskah film dokumenter & kisah naratif sinematik (Instagram Reels 9:16) yang setia pada alur cerita pemilik, akurasi fakta, dan adab keilmuan. ' +
      'Bahasa Indonesia baku-hangat yang mengalir hidup, puitis, berwibawa, dan enak didengar sebagai voice-over dokumenter. ' +
      `ATURAN KETAT DOKUMENTER / CERITA MOTION (tema ${temaVisual}): ` +
      '(1) Set `tokohKiri: null` dan `tokohKanan: null` di SELURUH adegan (dilarang memunculkan tokoh barista/pelanggan komedi kedai). ' +
      '(2) DILARANG kata gaul/logat receh ("lho", "rek", "cak", "nih", "sih"), DILARANG menyebut kasir, mesin espresso modern, atau daftar harga menu kafe. ' +
      '(3) WAJIB IKUTI TOKOH & ALUR CERITA PEMILIK dari Adegan 1 sampai penutup (2-3 kalimat mengalir per adegan); DILARANG mengubah cerita pemilik menjadi daftar tahun kering ala Wikipedia. ' +
      '(4) Gunakan `pembicara: "narator"`. ' +
      '(5) Isi `jenisMotion` ("pembuka", "perkamen" atau "ilustrasi", boleh "peta" maksimal 1x jika membahas sebaran wilayah, dan "penutup"), WAJIB isi `judulKartu` singkat 2-4 kata pada `pembuka`, `perkamen`, dan `peta`, serta `kataSorot` (2-4 kata kunci penting). ' +
      `(6) WAJIB isi \`promptVisual\` berbahasa Inggris yang benar-benar sesuai peristiwa dialog (jangan menyebut tempat yang tidak ada di cerita) dan akhiri dengan: "${gayaGambar}".`;

    prompt = [
      `Buat naskah DOKUMENTER / CERITA MOTION (tema ${temaVisual}) untuk "${judulSerial}" — EPISODE ${nomorEpisode} (${spek.rentangAdegan}, total durasi ${spek.durasiLabel}).`,
      'Isi `latarKode` dengan 1 kata singkat sesuai lokasi adegan (mis. "pelabuhan", "kebun", "perjalanan", "desa", "peta").',
      ideBersih ? `BAHAN CERITA & ALUR UTAMA DARI PEMILIK (WAJIB DIIKUTI):\n${ideBersih}` : 'Topik bebas: kisah inspiratif perjalanan kopi dan ketekunan.',
      risetBersih
        ? `REFERENSI FAKTA SEJARAH PENDUKUNG (gunakan untuk menjaga akurasi tanpa membuang alur pemilik):\n${risetBersih}`
        : 'Pastikan fakta era/abad dan lokasi akurat; jangan mengarang tahun yang tidak pasti.',
      teksRiwayat,
      arahanBersambung,
      'Aturan wajib:',
      '- Adegan 1 (`jenisMotion: "pembuka"`) langsung hook sinematik yang kuat + `judulKartu` 2-4 kata.',
      `- Panjang narasi per adegan: ${spek.kataPerAdegan} (${spek.durasiAdegan}) — tulis 2–3 kalimat bercerita mengalir, bukan 1 kalimat kering.`,
      '- Pada setiap adegan `perkamen`, WAJIB isi `judulKartu` singkat (2–4 kata) + `kartuWaktu` singkat.',
      '- Isi `kataSorot` (2–4 kata kunci penting dari `dialog`) agar teks kinetik menyorot kata kunci.',
      `- Isi \`promptVisual\` (Bahasa Inggris, 15–35 kata) pada SETIAP adegan non-peta dengan visual konkret sesuai cerita + "${gayaGambar}".`,
    ]
      .filter(Boolean)
      .join('\n\n');
  } else {
    const arahanMood =
      mood === 'kehidupan_santai'
        ? 'Nuansa: cerita kehidupan sehari-hari yang hangat, santai, reflektif, dan menenangkan hati, dekat dengan realita pekerja/mahasiswa/warga Sidoarjo.'
        : mood === 'cerita_kopi'
        ? 'Nuansa: cerita naratif yang kaya — bisa berupa kisah sejarah/inspirasi kopi dunia maupun kisah racikan & minuman resmi Lek Kopi; bila menyebut menu kedai, tetap wajib pakai menu resmi Lek Kopi dari daftar.'
        : 'Nuansa: komedi ceria slice-of-life! Ada setup cerita yang kuat, tektokan hidup, dan punchline hangat yang bikin penonton senyum.';

    const arahanFormat =
      formatSuara === 'narator'
        ? 'Format suara: Mode 1 Narator yang bercerita hangat (isi `pembicara: "narator"`, `namaPembicara: "Cerita Lek Kopi"` atau `"Narator"`), sambil tetap menampilkan 1-2 tokoh berakting ekspresif di panggung.'
        : formatSuara === 'campuran'
        ? 'Format suara: Mode Narator + Dialog Tokoh! Padukan Narator VO (`pembicara: "narator"`, `namaPembicara: "Narator"`) yang bercerita mengalir 2–3 kalimat sinematik hangat DENGAN Dialog Karakter (`pembicara: "kiri"` atau `"kanan"`) pada momen kunci, emosional, atau celetukan lucu.'
        : 'Format suara: Mode Dialog Antar Tokoh! Tektokan hidup dan berisi antara tokoh kiri dan kanan (`pembicara: "kiri"` atau `"kanan"`), sesekali boleh 1 adegan narasi atau reaksi kucing.';

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

    system =
      'Kamu penulis naskah animasi kartun 2D & storytelling sinematik (Instagram Reels 9:16) untuk kedai kopi "Lek Kopi" (@lekkopi.id) di Panjunan, Waru, Sidoarjo (buka Senin–Sabtu 14.00–23.00 WIB). ' +
      'Gaya cerita WAJIB ceria, hangat, inspiratif, santai, atau komedi ringan (DILARANG keras cerita horor, seram, atau gelap). ' +
      'Gunakan Bahasa Indonesia lisan yang hidup dan mengalir enak didengar, dengan sentuhan ramah Jawa Timur tipis jika pas suasana kedai. ' +
      'Tokoh visual tetap: `mas_barista` (Mas Lek, barista ramah), `mas_pelanggan` (Mas Danu, pelanggan polos), `mbak_pelanggan` (Mbak Rara, suka Matcha Latte & Butterscoth Latte), `pak_tetangga` (Pak Budi, bapak berkopiah bijak & kocak), `kucing_kedai` (Cimol si kucing oren — kucing tidak berbicara panjang, cukup ekspresi/efek atau disapa tokoh lain).';

    prompt = [
      `Buat naskah untuk "${judulSerial}" — EPISODE ${nomorEpisode} (${spek.rentangAdegan}, total durasi ${spek.durasiLabel}).`,
      arahanMood,
      arahanFormat,
      `Latar yang tersedia (pilih kode di kolom \`latarKode\`):\n${teksLatar}`,
      `MENU RESMI LEK KOPI (lek-kopi.web.app):\n${teksMenu}\nBila menyebut menu atau harga kedai, WAJIB pakai HANYA menu resmi Lek Kopi dari daftar ini / https://lek-kopi.web.app; DILARANG mengarang menu yang tidak ada.`,
      teksRiwayat,
      ideBersih ? `Bahan cerita / ide / contoh naskah dari Kyai:\n${ideBersih}` : 'Topik bebas — pilihkan cerita paling relatable, mendalam, dan hangat.',
      arahanBersambung,
      'Aturan wajib:',
      '- Adegan 1 langsung hook kuat yang memancing rasa ingin tahu + boleh pakai `kartuWaktu` singkat.',
      `- Panjang tiap dialog/narasi: ${spek.kataPerAdegan} (${spek.durasiAdegan})! Jangan tulis dialog terlalu pendek (<12 kata) kecuali sahutan cepat; berikan kalimat utuh dan bernyawa.`,
      '- Ganti-ganti ekspresi, properti (`es_kopi`, `matcha_latte`, `kopi_panas`, `hp`, `uang`, `jempol`, `tunjuk`), efek reaksi komik, dan sudut kamera (`zoom_masuk`, `goyang_kaget`, dll.) supaya visual terasa hidup.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  try {
    const r = await panggilRouterWorkerJson({
      system,
      prompt,
      maksToken: 6000,
      suhu: 0.78,
      skemaZod: SkemaNaskahSerial,
      normalisasi: (d) => normalisasiNaskahSerialWorker(d, { nomorEpisode, gayaCerita }),
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
    if (gayaCerita === 'dokumenter') {
      throw new Error(
        `Semua penyedia AI gagal menyusun naskah dokumenter (${String(e.message).slice(0, 220)}). Silakan pakai tombol Tulis Manual atau buat Draf Naskah dulu sebelum render.`,
      );
    }
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
  const adalahDokumenter = konteks.gayaCerita === 'dokumenter';
  const petaLatar = konteks.petaLatar ?? {};
  const petaVisualAi = konteks.petaVisualAi ?? {};
  const fallbackBerkas = Object.values(petaLatar)[0] || undefined;
  const daftarSuara = Array.isArray(konteks.suaraHasil) ? konteks.suaraHasil : [];
  const durasiSuara = Array.isArray(konteks.durasiSuara) ? konteks.durasiSuara : [];

  const adegan = (naskah?.adegan ?? []).slice(0, 16).map((a, idx) => {
    const kodeMentah = String(a?.latarKode ?? (adalahDokumenter ? 'sejarah' : 'outdoor')).trim().toLowerCase();
    const kode = adalahDokumenter
      ? kodeMentah || 'sejarah'
      : ['bar', 'outdoor', 'meja', 'depan'].includes(kodeMentah) || petaLatar[kodeMentah]
      ? kodeMentah
      : 'outdoor';
    const latarBerkas = petaVisualAi[idx] || petaLatar[kode] || fallbackBerkas;

    let tokohKiri = adalahDokumenter ? null : normalisasiTokohPanggung(a?.tokohKiri);
    const tokohKanan = adalahDokumenter ? null : normalisasiTokohPanggung(a?.tokohKanan);
    if (!adalahDokumenter && !tokohKiri && !tokohKanan) {
      tokohKiri = { id: 'mas_barista', nama: 'Mas Lek', ekspresi: 'senyum', properti: 'kopi_panas', efek: 'tanpa' };
    }

    let pembicara = adalahDokumenter
      ? a?.pembicara === 'tanpa'
        ? 'tanpa'
        : 'narator'
      : ['kiri', 'kanan', 'narator', 'tanpa'].includes(a?.pembicara)
      ? a.pembicara
      : 'narator';
    if (!adalahDokumenter) {
      if (pembicara === 'kiri' && !tokohKiri) pembicara = tokohKanan ? 'kanan' : 'narator';
      if (pembicara === 'kanan' && !tokohKanan) pembicara = tokohKiri ? 'kiri' : 'narator';
    }

    const tokohPembicara = pembicara === 'kiri' ? tokohKiri?.id : pembicara === 'kanan' ? tokohKanan?.id : 'narator';
    const namaPembicara =
      String(a?.namaPembicara ?? '').trim() ||
      (adalahDokumenter ? 'Narator' : NAMA_TOKOH[tokohPembicara] || 'Cerita Lek Kopi');

    const itemSuara = daftarSuara[idx] ?? {};
    const detikAudio = Number(durasiSuara[idx]) || 0;
    const teksDialog = String(a?.dialog ?? '').trim();
    const jumlahKata = teksDialog.split(/\s+/).filter(Boolean).length;
    const perkiraanBaca = Math.max(2.8, Math.min(22.0, jumlahKata * 0.44 + 1.0));
    const durasi = detikAudio > 0 ? Math.max(2.4, Math.min(28.0, detikAudio + 0.5)) : perkiraanBaca;

    return {
      nomor: Number(a?.nomor) || idx + 1,
      durasi,
      latarKode: kode,
      ...(latarBerkas ? { latarBerkas } : {}),
      ...(a?.kartuWaktu ? { kartuWaktu: String(a.kartuWaktu).trim().slice(0, 48) } : {}),
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
    judulEpisode: String(naskah?.judulEpisode || `Episode ${konteks.nomorEpisode || 1}`).slice(0, 88),
    akun: konteks.akun || '@lekkopi.id',
    mood: ['komedi_ceria', 'kehidupan_santai', 'cerita_kopi'].includes(konteks.mood) ? konteks.mood : 'komedi_ceria',
    gayaCerita: adalahDokumenter ? 'dokumenter' : 'kedai',
    pertanyaanPenutup: String(naskah?.pertanyaanPenutup || 'Menurutmu gimana cerita kali ini? Tulis di komentar!').slice(0, 180),
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

const KAMERA_MOTION_SAH = ['zoom_masuk', 'zoom_keluar', 'geser_kanan', 'geser_kiri'];
const STOPWORD_SOROT = new Set([
  'yang', 'dengan', 'untuk', 'dalam', 'adalah', 'sebagai', 'seperti', 'ketika', 'karena',
  'namun', 'tetapi', 'hingga', 'sampai', 'setiap', 'bahwa', 'mereka', 'beliau', 'semua',
  'telah', 'sudah', 'akan', 'bisa', 'dapat', 'tidak', 'bukan', 'hanya', 'sangat', 'lebih',
  'paling', 'saat', 'dari', 'pada', 'oleh', 'atau', 'juga', 'para', 'akan', 'hari', 'ini',
]);

function pilihKataSorotOtomatis(teks) {
  const kata = String(teks ?? '')
    .split(/\s+/)
    .map((k) => k.replace(/^[^a-zA-Z0-9\u00c0-\u024f]+|[^a-zA-Z0-9\u00c0-\u024f]+$/g, ''))
    .filter((k) => k.length >= 5 && !STOPWORD_SOROT.has(k.toLowerCase()));
  const unik = [];
  for (const k of kata) {
    if (!unik.some((u) => u.toLowerCase() === k.toLowerCase())) unik.push(k);
    if (unik.length >= 3) break;
  }
  return unik;
}

function pecahJudulPerkamen(judul) {
  const kata = String(judul ?? '').trim().split(/\s+/).filter(Boolean);
  if (kata.length <= 2) return { barisSatu: kata.join(' '), barisDua: undefined };
  const tengah = Math.ceil(kata.length / 2);
  return {
    barisSatu: kata.slice(0, tengah).join(' '),
    barisDua: kata.slice(tengah).join(' '),
  };
}

/**
 * Konversi naskah dokumenter / manual + ilustrasi AI + audio ElevenLabs/Gemini
 * menjadi props komposisi Remotion `CeritaMotion`. Murni.
 */
export function siapkanPropsCeritaMotion(naskah, konteks = {}) {
  const temaBawaan = konteks.temaVisual === 'perkamen' ? 'perkamen' : 'malam';
  const petaLatar = konteks.petaLatar ?? {};
  const petaVisualAi = konteks.petaVisualAi ?? {};
  const fallbackBerkas = Object.values(petaLatar)[0] || undefined;
  const daftarSuara = Array.isArray(konteks.suaraHasil) ? konteks.suaraHasil : [];
  const durasiSuara = Array.isArray(konteks.durasiSuara) ? konteks.durasiSuara : [];
  const nomorEpisode = Math.max(1, Math.round(Number(konteks.nomorEpisode) || 1));
  const judulEpisode = String(naskah?.judulEpisode || `Episode ${nomorEpisode}`).trim().slice(0, 88);
  const judulSerial = String(konteks.judulSerial || 'Jejak Cerita').trim().slice(0, 60);

  const sumberAdegan = (naskah?.adegan ?? []).slice(0, 16);
  const adegan = sumberAdegan.map((a, idx) => {
    const jenisEksplisit = String(a?.jenisMotion ?? '').trim().toLowerCase();
    const jenis = JENIS_MOTION_SAH.includes(jenisEksplisit)
      ? jenisEksplisit
      : idx === 0
      ? 'pembuka'
      : idx === sumberAdegan.length - 1 && sumberAdegan.length >= 2
      ? 'penutup'
      : temaBawaan === 'perkamen'
      ? 'perkamen'
      : 'ilustrasi';

    const kodeMentah = String(a?.latarKode ?? 'sejarah').trim().toLowerCase();
    const gambarBerkas = jenis === 'peta' ? undefined : petaVisualAi[idx] || petaLatar[kodeMentah] || fallbackBerkas;

    const narasi = String(a?.dialog ?? a?.narasi ?? '').trim();
    const itemSuara = daftarSuara[idx] ?? {};
    const detikAudio = Number(durasiSuara[idx]) || 0;
    const jumlahKata = narasi.split(/\s+/).filter(Boolean).length;
    const perkiraanBaca = Math.max(3.4, Math.min(24.0, jumlahKata * 0.46 + 1.2));
    const durasi = detikAudio > 0 ? Math.max(3.0, Math.min(28.0, Number((detikAudio + 0.55).toFixed(2)))) : perkiraanBaca;

    const kataTimeline = Array.isArray(itemSuara.kata) && itemSuara.kata.length
      ? itemSuara.kata
          .map((k) => ({
            kata: String(k?.kata ?? k?.teks ?? '').trim(),
            mulai: Number(k?.mulai) || 0,
            selesai: Number(k?.selesai) || Number(k?.mulai) || 0,
          }))
          .filter((k) => k.kata)
      : undefined;

    const sorotManual = Array.isArray(a?.kataSorot)
      ? a.kataSorot.map((k) => String(k ?? '').trim()).filter(Boolean).slice(0, 8)
      : [];
    const kataSorot = sorotManual.length ? sorotManual : pilihKataSorotOtomatis(narasi);

    const kartuWaktu = String(a?.kartuWaktu ?? '').trim().slice(0, 48);
    const judulKartuAsli = String(a?.judulKartu ?? '').trim().slice(0, 80);
    let judulKartu = judulKartuAsli || undefined;
    let judulBarisKedua;
    let subjudulKartu;
    let lencanaBagian;
    let pitaEra;
    let plakatTahun;
    let plakatTempat;
    let wilayahPeta;

    if (jenis === 'pembuka') {
      lencanaBagian = kartuWaktu || `Bagian ${nomorEpisode}`;
      judulKartu = judulKartuAsli || judulEpisode;
      subjudulKartu = judulSerial && judulSerial.toLowerCase() !== judulKartu.toLowerCase() ? judulSerial : undefined;
    } else if (jenis === 'perkamen') {
      const judulSumber =
        judulKartuAsli ||
        (kartuWaktu
          ? kartuWaktu
              .split('·')[0]
              .trim()
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : '') ||
        judulEpisode;
      if (judulSumber) {
        const pecah = pecahJudulPerkamen(judulSumber);
        judulKartu = pecah.barisSatu;
        judulBarisKedua = pecah.barisDua;
      }
      pitaEra = kartuWaktu || undefined;
    } else if (jenis === 'peta') {
      const teksKonteksPeta = [judulSerial, judulEpisode, judulKartuAsli, kartuWaktu, narasi, naskah?.tema]
        .filter(Boolean)
        .join(' ');
      const adalahNusantara =
        /\b(indonesia|nusantara|jawa|batavia|sumatera|sumatra|aceh|gayo|bener meriah|sulawesi|toraja|bali|parakan|priangan|voc|belanda|maluku|kalimantan|papua|majapahit|sriwijaya)\b/i.test(
          teksKonteksPeta,
        ) && !/\b(mokha|yaman|yemen|syadzili|qahwah|arab|kairo|istanbul)\b/i.test(kartuWaktu + ' ' + judulKartuAsli);
      wilayahPeta = adalahNusantara ? 'nusantara' : 'mokha';
      judulKartu = judulKartuAsli || (adalahNusantara ? 'NUSANTARA' : 'MOKHA');
      subjudulKartu = adalahNusantara ? 'Jejak Kopi Kepulauan Nusantara' : 'Jejak Perjalanan Sejarah';
      if (kartuWaktu.includes('·')) {
        const [bag1, ...sisa] = kartuWaktu.split('·').map((s) => s.trim());
        plakatTahun = bag1 || (adalahNusantara ? 'Kepulauan Nusantara' : 'Abad ke-15');
        plakatTempat = sisa.join(' · ') || (adalahNusantara ? 'Sumatera · Jawa · Bali · Sulawesi' : 'Pelabuhan Mokha, Yaman');
      } else {
        plakatTahun = kartuWaktu || (adalahNusantara ? 'Sejarah Kopi Nusantara' : 'Abad ke-15');
        plakatTempat = adalahNusantara ? 'Kepulauan Nusantara' : 'Pelabuhan Mokha, Yaman';
      }
    } else if (jenis === 'penutup') {
      judulKartu = judulKartuAsli || judulEpisode;
      subjudulKartu = String(naskah?.pertanyaanPenutup ?? '').trim().slice(0, 120) || undefined;
    } else {
      // ilustrasi tengah tema malam
      pitaEra = kartuWaktu || judulKartuAsli || undefined;
    }

    const kamera = KAMERA_MOTION_SAH.includes(a?.kamera)
      ? a.kamera
      : jenis === 'penutup'
      ? 'zoom_keluar'
      : idx % 2 === 0
      ? 'zoom_masuk'
      : 'geser_kanan';

    return {
      nomor: Number(a?.nomor) || idx + 1,
      jenis,
      tema: temaBawaan,
      durasi,
      ...(gambarBerkas ? { gambarBerkas } : {}),
      ...(lencanaBagian ? { lencanaBagian } : {}),
      ...(judulKartu ? { judulKartu } : {}),
      ...(judulBarisKedua ? { judulBarisKedua } : {}),
      ...(subjudulKartu ? { subjudulKartu } : {}),
      ...(pitaEra ? { pitaEra } : {}),
      ...(plakatTahun ? { plakatTahun } : {}),
      ...(plakatTempat ? { plakatTempat } : {}),
      ...(wilayahPeta ? { wilayahPeta } : {}),
      narasi,
      kataSorot,
      ...(itemSuara.berkas ? { suaraBerkas: path.basename(itemSuara.berkas) } : {}),
      ...(kataTimeline ? { kata: kataTimeline } : {}),
      kamera,
    };
  });

  return {
    judulSerial,
    nomorEpisode,
    judulEpisode,
    akun: konteks.akun || '@lekkopi.id',
    temaBawaan,
    kreditPenutup: konteks.kreditPenutup || 'Lek Kopi · Panjunan, Waru',
    ajakanPenutup: String(naskah?.pertanyaanPenutup || 'Simpan & bagikan jejak sejarah ini').slice(0, 120),
    musik: konteks.musik || null,
    musikVolume: konteks.musikVolume ?? 0.16,
    sfxWhoosh: konteks.sfx?.whoosh || null,
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
      formatSuara:
        metaSerial?.formatSuara === 'narator' || metaSerial?.formatSuara === 'campuran'
          ? metaSerial.formatSuara
          : 'dialog',
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
    judul: String(episodeBaru?.judul || `Episode ${nomor}`).slice(0, 88),
    ringkasan: String(episodeBaru?.ringkasan || '').slice(0, 450),
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
  const panjangNaskah = metaTugas.panjangNaskah || 'sedang';
  const bersambung = Boolean(metaTugas.bersambung);
  const gayaCerita = metaTugas.gayaCerita === 'dokumenter' ? 'dokumenter' : 'kedai';
  const temaVisual = metaTugas.temaVisual === 'perkamen' ? 'perkamen' : 'malam';
  const genderNarator = metaTugas.genderNarator === 'wanita' ? 'wanita' : 'pria';
  const hasilRiset = String(metaTugas.hasilRiset ?? '').trim();
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
        panjangNaskah,
        bersambung,
        gayaCerita,
        temaVisual,
        hasilRiset,
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

  // 1b. Khusus mode Dokumenter / CeritaMotion: buat ilustrasi AI seragam per adegan non-peta (maks 12 gambar)
  const petaVisualAi = {};
  let jumlahVisualAi = 0;
  if (gayaCerita === 'dokumenter' && adaGambarAi()) {
    const gayaGambarBawaan =
      temaVisual === 'perkamen'
        ? 'flat vintage historical storybook illustration with warm parchment paper grain, muted cream ochre terracotta umber palette, soft empty upper sky, vertical 9:16 composition, strictly no text, no letters, no banners, no signage, no watermark, no floating coffee cups'
        : 'atmospheric dark 2D painterly gouache illustration with subtle paper grain, deep indigo-charcoal shadows and warm glowing amber light, darkened lower third, vertical 9:16 composition, strictly no text, no letters, no signage, no watermark, no floating coffee cups';
    for (const [idx, a] of (naskah.adegan ?? []).slice(0, 12).entries()) {
      if (String(a?.jenisMotion ?? '').trim().toLowerCase() === 'peta') continue;
      const promptAsli = String(a?.promptVisual ?? '')
        .replace(/clean upper sky space for scroll title/gi, 'soft empty upper sky')
        .trim();
      const deskripsiFallback = [a?.judulKartu, a?.kartuWaktu, a?.dialog].filter(Boolean).join('. ').slice(0, 180);
      const promptVisual =
        promptAsli ||
        (deskripsiFallback
          ? `Stylized historical storybook scene depicting: ${deskripsiFallback}. ${gayaGambarBawaan}`
          : '');
      if (!promptVisual) continue;
      try {
        const resGambar = await buatGambarAi(promptVisual, '9:16', path.join(publik, `visual-dok-${idx}`), {
          mode: 'ilustrasi',
        });
        if (resGambar?.berkas) {
          petaVisualAi[idx] = path.basename(resGambar.berkas);
          jumlahVisualAi++;
        }
      } catch (e) {
        log(`Ilustrasi AI adegan ${idx + 1} gagal: ${String(e?.message ?? e).slice(0, 100)}`);
        if (galatKuota(e)) break;
      }
    }
  }

  // 2. Buat audio multi-tokoh (ElevenLabs dengan timestamps untuk lip-sync/kinetik + fallback berjenjang)
  const daftarVoice = Array.isArray(merekBakafrawi?.profil?.suara_elevenlabs)
    ? merekBakafrawi.profil.suara_elevenlabs
    : [];
  const itemDialog = naskah.adegan.map((a) => {
    if (gayaCerita === 'dokumenter') {
      return {
        teks: a.pembicara === 'tanpa' ? '' : a.dialog,
        pembicara: 'narator',
        gender: genderNarator,
      };
    }
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
  const pakaiCeritaMotion = gayaCerita === 'dokumenter';
  const propsSementara = pakaiCeritaMotion
    ? siapkanPropsCeritaMotion(naskah, {
        judulSerial,
        nomorEpisode,
        temaVisual,
        petaLatar,
        petaVisualAi,
        suaraHasil: suaraHasil.item,
        durasiSuara,
        sfx,
      })
    : siapkanPropsSerialKartun(naskah, {
        judulSerial,
        nomorEpisode,
        mood,
        gayaCerita,
        petaLatar,
        petaVisualAi,
        suaraHasil: suaraHasil.item,
        durasiSuara,
        sfx,
      });
  const totalDetikPerkiraan = pakaiCeritaMotion
    ? hitungDurasiCeritaMotion(propsSementara).total / FPS_MOTION
    : hitungDurasiSerialKartun(propsSementara).totalDetik;

  let musikNama = null;
  const dirMusik = path.join(DIR, '..', 'aset', 'musik');
  const laguAda = pilihMusik(await readdir(dirMusik).catch(() => []));
  if (laguAda) {
    const namaSalin = `musik-serial${path.extname(laguAda) || '.mp3'}`;
    await copyFile(path.join(dirMusik, laguAda), path.join(publik, namaSalin)).catch(() => null);
    if (existsSync(path.join(publik, namaSalin))) musikNama = namaSalin;
  }
  if (!musikNama) {
    const gayaMusik = pakaiCeritaMotion
      ? 'minimalis-gelap'
      : mood === 'komedi_ceria'
      ? 'terang-modern'
      : 'hangat-kafe';
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
  const propsPath = path.join(folder, pakaiCeritaMotion ? 'props-motion.json' : 'props-serial.json');
  await writeFile(propsPath, JSON.stringify(propsFinal));

  const totalDetikFinal = pakaiCeritaMotion
    ? hitungDurasiCeritaMotion(propsFinal).total / FPS_MOTION
    : hitungDurasiSerialKartun(propsFinal).totalDetik;
  const komposisiId = pakaiCeritaMotion ? 'CeritaMotion' : 'SerialKartun';
  const videoKeluar = path.join(folder, 'serial-kartun.mp4');
  log(`🎬 Remotion ${komposisiId} EP ${nomorEpisode}: ${propsFinal.adegan.length} adegan, ${totalDetikFinal.toFixed(1)} dtk`);

  await jalankan(
    process.execPath,
    [CLI, 'render', 'src/index.ts', komposisiId, videoKeluar, `--props=${propsPath}`, `--public-dir=${publik}`, '--log=error'],
    { cwd: REMOTION },
  );

  const sampul = path.join(folder, 'sampul-serial.jpg');
  await ffmpeg(['-y', '-ss', '1.2', '-i', videoKeluar, '-frames:v', '1', '-q:v', '3', sampul]).catch(() => null);

  const hasil = [
    { jenis: 'video', rasio: 'story', durasi: Math.round(totalDetikFinal), url: await simpan(videoKeluar, 'video/mp4') },
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
    `serial: ${serialId} · episode ${nomorEpisode} (${gayaCerita}${pakaiCeritaMotion ? `:${temaVisual} · ${komposisiId} · narator ${genderNarator}` : ''})`,
    `latar foto terpakai: ${Object.keys(petaLatar).length}`,
    ...(jumlahVisualAi > 0 ? [`ilustrasi AI dokumenter: ${jumlahVisualAi}`] : []),
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
        panjangNaskah,
        bersambung,
        gayaCerita,
        temaVisual,
        genderNarator,
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
