// node --test studio/lib/serial-kartun.test.mjs — unit test worker Serial Kartun 2D Lek Kopi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { gabungRiwayatEpisode, siapkanPropsCeritaMotion, siapkanPropsSerialKartun } from './serial-kartun.mjs';
import { KANDIDAT_MODEL_WORKER, parseJsonToleran, urutanPenyediaWorker } from './router-worker.mjs';
import { pilihVoicePerTokoh, suaraDialogSerial } from './bank/suara.mjs';
import {
  contohSerialKartun,
  DURASI_INTRO_DETIK,
  DURASI_PENUTUP_DETIK,
  FPS_SERIAL,
  hitungDurasiSerialKartun,
} from '../remotion/src/data/serial-waktu.ts';
import { hitungDurasiCeritaMotion } from '../remotion/src/data/cerita-motion.ts';

test('siapkanPropsSerialKartun menormalisasi adegan, tokoh, latar & durasi', () => {
  const props = siapkanPropsSerialKartun(
    {
      judulEpisode: 'Rebutan Butterscoth Latte',
      pertanyaanPenutup: 'Tim Matcha Latte atau Kopi Lek?',
      adegan: [
        {
          nomor: 1,
          latarKode: 'bar',
          kartuWaktu: 'SORE · 16.30',
          kamera: 'tidak_ada',
          tokohKiri: { id: 'mas_barista', ekspresi: 'senyum', properti: 'matcha_latte', efek: 'tanpa' },
          tokohKanan: { id: 'mbak_pelanggan', ekspresi: 'kaget', properti: 'tanpa', efek: 'tanda_seru' },
          pembicara: 'kanan',
          namaPembicara: 'Mbak Rara',
          dialog: 'Mas Lek, Butterscoth Latte masih ada kan sore ini?',
          sfx: 'pop',
        },
        {
          nomor: 2,
          latarKode: 'lokasi_tak_terdaftar',
          kamera: 'zoom_keluar',
          tokohKiri: null,
          tokohKanan: null,
          pembicara: 'kanan',
          namaPembicara: '',
          dialog: 'Masih dong!',
          sfx: 'tanpa',
        },
      ],
    },
    {
      judulSerial: 'Cerita di Lek Kopi',
      nomorEpisode: 3,
      petaLatar: { bar: 'latar-0-bar.jpg' },
      suaraHasil: [
        { berkas: '/tmp/dialog_0_mbak_pelanggan.mp3', kata: [{ teks: 'Mas', mulai: 0, selesai: 0.3 }] },
        { berkas: null, kata: [] },
      ],
      durasiSuara: [3.2, 0],
    },
  );

  assert.equal(props.nomorEpisode, 3);
  assert.equal(props.adegan.length, 2);
  assert.equal(props.adegan[0].latarBerkas, 'latar-0-bar.jpg');
  assert.equal(props.adegan[0].kamera, 'zoom_masuk');
  assert.equal(props.adegan[0].durasi, 3.7);
  assert.equal(props.adegan[0].suaraBerkas, 'dialog_0_mbak_pelanggan.mp3');
  assert.equal(props.adegan[0].kata.length, 1);

  // Adegan 2 tanpa tokoh → dipasangkan tokoh fallback & latar fallback
  assert.equal(props.adegan[1].latarKode, 'outdoor');
  assert.equal(props.adegan[1].latarBerkas, 'latar-0-bar.jpg');
  assert.equal(props.adegan[1].tokohKiri.id, 'mas_barista');
  assert.equal(props.adegan[1].pembicara, 'kiri');
});

test('siapkanPropsSerialKartun mendukung hingga 16 adegan dan audio panjang hingga >16 detik tanpa terpotong', () => {
  const adegan = Array.from({ length: 12 }, (_, i) => ({
    nomor: i + 1,
    latarKode: 'outdoor',
    kamera: 'zoom_masuk',
    tokohKiri: { id: 'pak_tetangga', ekspresi: 'senyum', properti: 'kopi_panas', efek: 'tanpa' },
    tokohKanan: null,
    pembicara: 'narator',
    namaPembicara: 'Narator',
    dialog: 'Narasi sinematik panjang tentang kisah penemuan kopi oleh Syekh Abul Hasan Asy-Syadzili di lembah sunyi yang dingin pada malam hari.',
    sfx: 'tanpa',
  }));
  const suaraHasil = adegan.map((_, i) => ({ berkas: `/tmp/narasi_${i}.mp3`, kata: [] }));
  const durasiSuara = adegan.map((_, i) => (i === 0 ? 16 : 6.5));

  const props = siapkanPropsSerialKartun(
    { judulEpisode: 'Biji Merah dari Lembah Sunyi', adegan },
    { judulSerial: 'Kisah Kopi', nomorEpisode: 1, suaraHasil, durasiSuara },
  );

  assert.equal(props.adegan.length, 12);
  assert.equal(props.adegan[0].durasi, 16.5);
  assert.equal(props.adegan[1].durasi, 7);
});

test('siapkanPropsSerialKartun mode dokumenter mengosongkan tokoh dan memakai petaVisualAi', () => {
  const props = siapkanPropsSerialKartun(
    {
      judulEpisode: 'Qahwah Pertama',
      pertanyaanPenutup: 'Dari sejarah ini, pelajaran apa yang paling berkesan?',
      adegan: [
        {
          nomor: 1,
          latarKode: 'gua',
          kartuWaktu: 'YAMAN · ABAD KE-15',
          kamera: 'zoom_masuk',
          tokohKiri: { id: 'mas_barista', ekspresi: 'senyum', properti: 'kopi_panas', efek: 'tanpa' },
          pembicara: 'kiri',
          namaPembicara: '',
          dialog: 'Kisah awal minuman qahwah di kalangan ahli ibadah.',
          sfx: 'tanpa',
        },
        {
          nomor: 2,
          latarKode: 'sejarah',
          pembicara: 'narator',
          dialog: 'Catatan al-Jaziri menyebut tradisi ini menyebar dari Yaman.',
        },
      ],
    },
    {
      gayaCerita: 'dokumenter',
      judulSerial: 'Jejak Sejarah Kopi',
      nomorEpisode: 1,
      mood: 'cerita_kopi',
      petaLatar: { outdoor: 'latar_outdoor.png' },
      petaVisualAi: { 0: 'dok_adegan_01.png' },
      durasiSuara: [5.0, 4.0],
    },
  );

  assert.equal(props.gayaCerita, 'dokumenter');
  assert.equal(props.adegan[0].tokohKiri, null);
  assert.equal(props.adegan[0].tokohKanan, null);
  assert.equal(props.adegan[0].pembicara, 'narator');
  assert.equal(props.adegan[0].namaPembicara, 'Narator');
  assert.equal(props.adegan[0].latarBerkas, 'dok_adegan_01.png');
  assert.equal(props.adegan[0].latarKode, 'gua');
  assert.equal(props.adegan[0].durasi, 5.5);
  assert.equal(props.adegan[1].latarBerkas, 'latar_outdoor.png');
  assert.equal(props.latarIntroBerkas, 'dok_adegan_01.png');
});

test('pilihVoicePerTokoh memberi suara berbeda antar tokoh & sesuai gender', () => {
  const daftarVoice = [
    { id: 'VoicePriaSatu111', nama: 'Mas Jowo' },
    { id: 'VoicePriaDua2222', nama: 'Mas Andi' },
    { id: 'VoiceWanita11111', nama: 'Mbak Indah' },
  ];
  const vBarista = pilihVoicePerTokoh('mas_barista', { daftarVoice });
  const vPelanggan = pilihVoicePerTokoh('mas_pelanggan', { daftarVoice });
  const vMbak = pilihVoicePerTokoh('mbak_pelanggan', { daftarVoice });
  assert.equal(vBarista, 'VoicePriaSatu111');
  assert.equal(vPelanggan, 'VoicePriaDua2222');
  assert.equal(vMbak, 'VoiceWanita11111');
  assert.notEqual(vBarista, vPelanggan);

  // Override manual diprioritaskan
  const vManual = pilihVoicePerTokoh('mas_barista', {
    suaraTokoh: { mas_barista: 'CustomVoiceId999' },
    daftarVoice,
  });
  assert.equal(vManual, 'CustomVoiceId999');
});

test('suaraDialogSerial melewati adegan kucing/sunyi dan fallback ke edge bila elevenlabs gagal', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'uji-serial-suara-'));
  try {
    const dipanggil = [];
    const res = await suaraDialogSerial(
      [
        { teks: 'Halo rek!', pembicara: 'mas_barista', gender: 'pria' },
        { teks: '[meong kaget]', pembicara: 'kucing_kedai', gender: 'pria' },
        { teks: 'Mau es kopi susu dong!', pembicara: 'mbak_pelanggan', gender: 'wanita' },
      ],
      tmp,
      {
        jalur: 'elevenlabs',
        buat: async (teks, berkas, jalur, info) => {
          dipanggil.push({ teks, jalur, gender: info.gender });
          if (jalur === 'elevenlabs' && info.pembicara === 'mbak_pelanggan') {
            throw new Error('429 kuota habis');
          }
          return { kata: jalur === 'elevenlabs' ? [{ teks: 'Halo', mulai: 0, selesai: 0.4 }] : [], voiceId: info.voiceId };
        },
      },
    );

    assert.equal(res.item.length, 3);
    assert.equal(res.item[0].jalur, 'elevenlabs');
    assert.equal(res.item[0].kata.length, 1);
    assert.equal(res.item[1].jalur, 'sunyi');
    assert.equal(res.item[1].berkas, null);
    assert.ok(['gemini', 'edge'].includes(res.item[2].jalur));
    assert.ok(res.catatan.length >= 1);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('hitungDurasiSerialKartun menghitung total frame Intro + Adegan + Penutup', () => {
  const dur = hitungDurasiSerialKartun(contohSerialKartun);
  const ekspektasiIntro = Math.round(DURASI_INTRO_DETIK * FPS_SERIAL);
  const ekspektasiPenutup = Math.round(DURASI_PENUTUP_DETIK * FPS_SERIAL);
  assert.equal(dur.introFrames, ekspektasiIntro);
  assert.equal(dur.penutupFrames, ekspektasiPenutup);
  assert.equal(dur.jadwal[0].mulai, ekspektasiIntro);
  assert.equal(dur.jadwal.length, contohSerialKartun.adegan.length);
  assert.equal(dur.total, dur.penutupMulai + ekspektasiPenutup);
});

test('gabungRiwayatEpisode menyimpan episode secara urut & anti-duplikat', () => {
  const awal = {
    latar: [],
    serial: [{ id: 'cerita-lek-kopi', judul: 'Cerita di Lek Kopi', episode: [{ nomor: 1, judul: 'Ep 1', tugasId: 't1' }] }],
    serialAktifId: 'cerita-lek-kopi',
  };
  const tambah = gabungRiwayatEpisode(awal, 'cerita-lek-kopi', {
    nomor: 2,
    judul: 'Ep 2',
    ringkasan: 'Cerita baru',
    tugasId: 't2',
  });
  assert.equal(tambah.serial[0].episode.length, 2);

  // Tugas sama tidak menggandakan episode
  const ulang = gabungRiwayatEpisode(tambah, 'cerita-lek-kopi', {
    nomor: 2,
    judul: 'Ep 2 Final',
    ringkasan: 'Ringkasan final',
    tugasId: 't2',
  });
  assert.equal(ulang.serial[0].episode.length, 2);
  assert.equal(ulang.serial[0].episode[1].judul, 'Ep 2 Final');

  // Jika profil.serial_kartun masih kosong sebelum Ep 1 selesai, entri serial dibuat otomatis
  const dariKosong = gabungRiwayatEpisode(
    undefined,
    'cerita-lek-kopi',
    { nomor: 1, judul: 'Ep 1 Perdana', ringkasan: 'Pembuka', mood: 'komedi_ceria', tugasId: 't0' },
    { judulSerial: 'Cerita di Lek Kopi', mood: 'komedi_ceria', formatSuara: 'campuran' },
  );
  assert.equal(dariKosong.serial.length, 1);
  assert.equal(dariKosong.serial[0].id, 'cerita-lek-kopi');
  assert.equal(dariKosong.serial[0].formatSuara, 'campuran');
  assert.equal(dariKosong.serial[0].episode.length, 1);
  assert.equal(dariKosong.serial[0].episode[0].judul, 'Ep 1 Perdana');
});

test('urutanPenyediaWorker mendahulukan AI gratis, memisahkan vision & mematikan Claude saat STUDIO_TANPA_CLAUDE=1', () => {
  const semuaKunci = {
    GROQ_API_KEY: 'gsk_test',
    NVIDIA_API_KEY: 'nvapi_test',
    GEMINI_API_KEY: 'gem_test',
    OPENROUTER_API_KEY: 'or_test',
    CF_ACCOUNT_ID: 'cf_acc',
    CF_API_TOKEN: 'cf_tok',
    ANTHROPIC_API_KEY: 'sk-ant-test',
  };

  const teks = urutanPenyediaWorker({ env: semuaKunci }).map((p) => p.nama);
  assert.deepEqual(teks, ['groq', 'nvidia', 'gemini', 'openrouter', 'cloudflare', 'claude']);

  const vision = urutanPenyediaWorker({ adaGambar: true, env: semuaKunci }).map((p) => p.nama);
  assert.deepEqual(vision, ['gemini', 'groq', 'openrouter', 'claude']);

  const tanpaClaude = urutanPenyediaWorker({
    tanpaClaude: true,
    paksa: 'claude',
    env: semuaKunci,
  }).map((p) => p.nama);
  assert.ok(!tanpaClaude.includes('claude'));
  assert.deepEqual(tanpaClaude, ['groq', 'nvidia', 'gemini', 'openrouter', 'cloudflare']);

  const viaEnv = urutanPenyediaWorker({
    env: { ...semuaKunci, STUDIO_TANPA_CLAUDE: '1' },
  }).map((p) => p.nama);
  assert.ok(!viaEnv.includes('claude'));

  // Pastikan daftar model aktif worker bebas dari model EOL/404 dan memakai model aktif terbaru
  assert.ok(!KANDIDAT_MODEL_WORKER.groq.includes('meta-llama/llama-4-scout-17b-16e-instruct'));
  assert.equal(KANDIDAT_MODEL_WORKER.groq[0], 'llama-3.3-70b-versatile');
  assert.ok(!KANDIDAT_MODEL_WORKER.nvidia.includes('meta/llama-3.1-70b-instruct'));
  assert.ok(!KANDIDAT_MODEL_WORKER.nvidia.includes('mistralai/mistral-large-2-instruct'));
  assert.ok(KANDIDAT_MODEL_WORKER.nvidia.includes('meta/llama-3.3-70b-instruct'));
  assert.equal(KANDIDAT_MODEL_WORKER.gemini[0], 'gemini-3.8-flash');
  assert.ok(!KANDIDAT_MODEL_WORKER.gemini.includes('gemini-2.0-flash'));
  assert.equal(KANDIDAT_MODEL_WORKER.openrouter[0], 'openrouter/free');
  assert.ok(!KANDIDAT_MODEL_WORKER.openrouter.includes('google/gemini-2.0-flash-exp:free'));
  assert.ok(KANDIDAT_MODEL_WORKER.cloudflare.includes('@cf/meta/llama-4-scout-17b-16e-instruct'));

  // Parser JSON toleran tahan trailing comma & newline mentah di dalam string
  const parsed = parseJsonToleran('```json\n{"judul":"Qahwah\nMokha","adegan":[{"nomor":1,},]}\n```');
  assert.equal(parsed.judul, 'Qahwah\nMokha');
  assert.equal(parsed.adegan[0].nomor, 1);
});

test('siapkanPropsCeritaMotion memetakan adegan pembuka/perkamen/peta/penutup dan timestamps ElevenLabs', () => {
  const props = siapkanPropsCeritaMotion(
    {
      judulEpisode: 'Qahwah',
      pertanyaanPenutup: 'Simpan & bagikan kisah ini',
      adegan: [
        {
          nomor: 1,
          jenisMotion: 'pembuka',
          judulKartu: 'Qahwah',
          kartuWaktu: 'Bagian 1',
          dialog: 'Kopi lahir dari doa di sunyinya malam.',
          kataSorot: ['kopi', 'doa'],
        },
        {
          nomor: 2,
          jenisMotion: 'perkamen',
          judulKartu: 'Buah Merah di Lereng Yaman',
          kartuWaktu: 'YAMAN · ABAD KE-15',
          dialog: 'Para ulama menyeduh biji merah hingga fajar.',
        },
        {
          nomor: 3,
          jenisMotion: 'peta',
          judulKartu: 'MOKHA',
          kartuWaktu: 'Abad ke-15 · Pelabuhan Mokha, Yaman',
          dialog: 'Dari Mokha, Qahwah berlayar menembus dunia.',
        },
        {
          nomor: 4,
          jenisMotion: 'penutup',
          dialog: 'Di balik cangkir hangat ada ketekunan abadi.',
        },
      ],
    },
    {
      judulSerial: 'Jejak Sufi di Lembah Yaman',
      nomorEpisode: 1,
      temaVisual: 'perkamen',
      petaVisualAi: { 0: 'dok-0.png', 1: 'dok-1.png', 2: 'seharusnya-diabaikan.png', 3: 'dok-3.png' },
      suaraHasil: [
        { berkas: '/tmp/vo1.mp3', kata: [{ teks: 'Kopi', mulai: 0.1, selesai: 0.4 }] },
        { berkas: '/tmp/vo2.mp3', kata: [] },
        { berkas: '/tmp/vo3.mp3', kata: [] },
        { berkas: '/tmp/vo4.mp3', kata: [] },
      ],
      durasiSuara: [4.0, 5.0, 5.5, 4.2],
    },
  );

  assert.equal(props.temaBawaan, 'perkamen');
  assert.equal(props.adegan.length, 4);
  assert.equal(props.adegan[0].jenis, 'pembuka');
  assert.equal(props.adegan[0].gambarBerkas, 'dok-0.png');
  assert.deepEqual(props.adegan[0].kata, [{ kata: 'Kopi', mulai: 0.1, selesai: 0.4 }]);
  assert.equal(props.adegan[1].judulKartu, 'Buah Merah di');
  assert.equal(props.adegan[1].judulBarisKedua, 'Lereng Yaman');
  assert.equal(props.adegan[1].pitaEra, 'YAMAN · ABAD KE-15');
  assert.equal(props.adegan[2].jenis, 'peta');
  assert.equal(props.adegan[2].gambarBerkas, undefined);
  assert.equal(props.adegan[2].plakatTahun, 'Abad ke-15');
  assert.equal(props.adegan[2].plakatTempat, 'Pelabuhan Mokha, Yaman');
  assert.equal(props.adegan[3].jenis, 'penutup');
  assert.ok(hitungDurasiCeritaMotion(props).total > 500);
});

test('narator pria tidak jatuh ke suara wanita saat otomatis maupun saat ElevenLabs menolak Voice Library', async () => {
  const daftarFav = [
    { id: 'm6elNOMAsoqePTs244dg', nama: 'Mbak Indah' },
    { id: 'R86jddkroI9bJwXFfjsr', nama: 'Mas Jowo' },
  ];

  // Mode otomatis narator pria harus memilih Mas Jowo, BUKAN Mbak Indah (urutan pertama)
  assert.equal(pilihVoicePerTokoh('narator', { daftarVoice: daftarFav, gender: 'pria' }), 'R86jddkroI9bJwXFfjsr');
  assert.equal(pilihVoicePerTokoh('narator', { daftarVoice: daftarFav, gender: 'wanita' }), 'm6elNOMAsoqePTs244dg');

  // Saat Voice Library ditolak ElevenLabs (400 bad_request), coba voice premade pria ElevenLabs dulu agar timestamps tetap jalan
  const dir = await mkdtemp(path.join(os.tmpdir(), 'suara-gender-'));
  try {
    const panggilan = [];
    const hasil = await suaraDialogSerial(
      [{ teks: 'Kisah Qahwah dari Yaman.', pembicara: 'narator', gender: 'pria' }],
      dir,
      {
        jalur: 'elevenlabs',
        suaraTokoh: { narator: '1k39YpzqXZn52BgyLyGO' },
        buat: async (_t, _k, j, info) => {
          panggilan.push({ j, voiceId: info.voiceId, geminiSuara: info.profil?.geminiSuara });
          if (j === 'elevenlabs' && info.voiceId === '1k39YpzqXZn52BgyLyGO') {
            throw new Error('ElevenLabs TTS 400: {"detail":{"code":"bad_request","message":"You need to upgrade to use library voices"}}');
          }
          return { kata: [{ teks: 'Kisah', mulai: 0.1, selesai: 0.4 }], voiceId: info.voiceId };
        },
      },
    );

    assert.equal(hasil.item[0].jalur, 'elevenlabs');
    assert.equal(hasil.item[0].voiceId, 'pNInz6obpgDQGcFmaJgB');
    assert.equal(hasil.item[0].kata.length, 1);
    assert.equal(panggilan[0].geminiSuara, 'Charon');
    assert.match(hasil.catatan[0] ?? '', /You need to upgrade to use library voices/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
