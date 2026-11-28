// node --test studio/lib/serial-kartun.test.mjs — unit test worker Serial Kartun 2D Lek Kopi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { gabungRiwayatEpisode, normalisasiNaskahSerialWorker, pilihKarakterCeritaOtomatis, siapkanPropsCeritaMotion, siapkanPropsSerialKartun, SkemaNaskahSerial } from './serial-kartun.mjs';
import { KANDIDAT_MODEL_WORKER, parseJsonToleran, urutanPenyediaWorker } from './router-worker.mjs';
import { deteksiGenderCerita, kataDariMetadataEdge, pilihVoicePerTokoh, suaraDialogSerial } from './bank/suara.mjs';
import { hitungTargetBitrateKbps } from './bank/alat.mjs';
import { promptGambar } from './bank/gambar-ai.mjs';
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
  assert.ok(['zoom_masuk', 'goyang_kaget', 'diam'].includes(props.adegan[0].kamera));
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

  // Parser JSON toleran tahan blok <think>, trailing comma & newline mentah di dalam string
  const parsed = parseJsonToleran('<think>Mari susun {draft} dulu</think>\n```json\n{"judul":"Qahwah\nMokha","adegan":[{"nomor":1,},]}\n```');
  assert.equal(parsed.judul, 'Qahwah\nMokha');
  assert.equal(parsed.adegan[0].nomor, 1);

  // Normalisasi naskah serial worker meloloskan JSON Cloudflare/OpenRouter yang enum sfx/kamera-nya meleset
  const mentahCf = {
    naskah: {
      judul: 'Jejak Kopi Nusantara',
      scenes: [
        { nomor: '1', latar: 'kebun', kamera: 'pan_slow', pembicara: 'narator', narasi: 'Adegan satu mulai.', sfx: 'none' },
        { latar: 'pelabuhan', dialog: 'Adegan dua berlanjut.', sfx: '' },
        { dialog: 'Adegan tiga penutup.' },
      ],
    },
  };
  const rapi = normalisasiNaskahSerialWorker(mentahCf, { nomorEpisode: 2, gayaCerita: 'dokumenter' });
  const cek = SkemaNaskahSerial.safeParse(rapi);
  assert.equal(cek.success, true);
  assert.equal(rapi.adegan.length, 3);
  assert.equal(rapi.adegan[0].sfx, 'tanpa');
  assert.equal(rapi.adegan[0].kamera, 'zoom_masuk');
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

test('narator pria/wanita beralih bersih ke suara Indonesia natural (Edge/Gemini) saat ElevenLabs 402 & tidak mengulang error tiap adegan', async () => {
  const daftarFav = [
    { id: 'm6elNOMAsoqePTs244dg', nama: 'Mbak Indah' },
    { id: 'R86jddkroI9bJwXFfjsr', nama: 'Mas Jowo' },
  ];

  // Mode otomatis narator pria harus memilih Mas Jowo, BUKAN Mbak Indah (urutan pertama)
  assert.equal(pilihVoicePerTokoh('narator', { daftarVoice: daftarFav, gender: 'pria' }), 'R86jddkroI9bJwXFfjsr');
  assert.equal(pilihVoicePerTokoh('narator', { daftarVoice: daftarFav, gender: 'wanita' }), 'm6elNOMAsoqePTs244dg');

  // Deteksi gender cerita otomatis & parser WordBoundary Edge TTS
  assert.equal(deteksiGenderCerita('Nisa seorang gadis yang menunggu ibu di stasiun.'), 'wanita');
  assert.equal(deteksiGenderCerita('Lek Aceng menelusuri pelabuhan Banten bersama pedagang.'), 'pria');
  assert.equal(deteksiGenderCerita('Nisa pergi ke stasiun.', 'pria'), 'pria');
  const kataEdge = kataDariMetadataEdge({
    Metadata: [
      { Type: 'WordBoundary', Data: { Offset: 1_000_000, Duration: 2_000_000, text: { Text: 'Kisah' } } },
      { Type: 'WordBoundary', Data: { Offset: 3_500_000, Duration: 3_000_000, text: { Text: 'kopi' } } },
    ],
  });
  assert.deepEqual(kataEdge, [
    { teks: 'Kisah', mulai: 0.1, selesai: 0.3 },
    { teks: 'kopi', mulai: 0.35, selesai: 0.65 },
  ]);

  // Saat Voice Library ditolak ElevenLabs (402 paid_plan_required), langsung beralih ke suara Indonesia natural
  // (tanpa fallback bule Adam) dan TIDAK mencoba ulang ElevenLabs di adegan ke-2 & ke-3!
  const dir = await mkdtemp(path.join(os.tmpdir(), 'suara-gender-'));
  try {
    const panggilan = [];
    const hasil = await suaraDialogSerial(
      [
        { teks: 'Kisah Qahwah dari Yaman.', pembicara: 'narator', gender: 'pria' },
        { teks: 'Lek Aceng menelusuri pelabuhan Banten.', pembicara: 'narator', gender: 'pria' },
        { teks: 'Biji kopi mulai menyebar di Nusantara.', pembicara: 'narator', gender: 'pria' },
      ],
      dir,
      {
        jalur: 'elevenlabs',
        suaraTokoh: { narator: 'kYZOIefFr4yPpf7CGkHt' },
        buat: async (_t, _k, j, info) => {
          panggilan.push({ j, voiceId: info.voiceId, edgeSuara: info.profil?.edgeSuara, geminiSuara: info.profil?.geminiSuara });
          if (j === 'elevenlabs') {
            throw new Error('ElevenLabs TTS 402: {"detail":{"code":"paid_plan_required","message":"Free users cannot use library voices via the API."}}');
          }
          if (j === 'gemini') {
            throw new Error('Gemini TTS 404: model not found');
          }
          return { kata: [{ teks: 'Kisah', mulai: 0.1, selesai: 0.4 }], voiceId: info.profil?.edgeSuara };
        },
      },
    );

    // ElevenLabs hanya dipanggil 1x (adegan 1), tidak 3x!
    assert.equal(panggilan.filter((p) => p.j === 'elevenlabs').length, 1);
    assert.equal(hasil.item.length, 3);
    assert.equal(hasil.item[0].jalur, 'edge');
    assert.equal(hasil.item[0].voiceId, 'id-ID-ArdiNeural');
    assert.equal(hasil.item[0].kata.length, 1);
    assert.equal(hasil.item[2].jalur, 'edge');
    assert.equal(hasil.catatan.length, 1);
    assert.match(hasil.catatan[0] ?? '', /edge natural \(id-ID-ArdiNeural\)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('pilihKarakterCeritaOtomatis & siapkanPropsCeritaMotion menyematkan animasi karakter berjalan, arsip & gender cerita', () => {
  const kJalan = pilihKarakterCeritaOtomatis(
    { dialog: 'Lek Aceng berjalan menyusuri pelabuhan Banten di pagi hari.' },
    0,
    { jenis: 'pembuka', genderNarator: 'pria', konteksCerita: 'Jejak Kopi Nusantara' },
  );
  assert.equal(kJalan.aksi, 'jalan_kanan');
  assert.equal(kJalan.tokohUtama, 'petualang');

  const kDialog = pilihKarakterCeritaOtomatis(
    { dialog: 'Nisa bertemu dengan ibunya dan menyerahkan surat lama itu.' },
    1,
    { jenis: 'ilustrasi', genderNarator: 'wanita', konteksCerita: 'Stasiun Mati' },
  );
  assert.equal(kDialog.aksi, 'dialog_dua');
  assert.equal(kDialog.tokohUtama, 'wanita');
  assert.equal(kDialog.properti, 'arsip');

  const props = siapkanPropsCeritaMotion(
    {
      judulEpisode: 'Arsip Banten',
      adegan: [
        { nomor: 1, jenisMotion: 'pembuka', dialog: 'Lek Aceng melangkah masuk pelabuhan Banten.' },
        { nomor: 2, jenisMotion: 'arsip', judulKartu: 'CATATAN VOC', kartuWaktu: 'BANTEN · 1696', dialog: 'Tercatat kiriman pertama biji kopi Arabika.' },
        { nomor: 3, jenisMotion: 'penutup', dialog: 'Secangkir kopi hangat menyimpan sejarah panjang.' },
      ],
    },
    { judulSerial: 'Biji Merah', nomorEpisode: 1, temaVisual: 'perkamen', genderNarator: 'pria' },
  );
  assert.equal(props.adegan[0].karakter?.aksi, 'jalan_kanan');
  assert.equal(props.adegan[1].jenis, 'arsip');
  assert.equal(props.adegan[1].karakter, undefined);
  assert.equal(props.adegan[1].stempelArsip, 'BANTEN · 1696');
  assert.equal(props.adegan[2].karakter?.aksi, 'berdiri_tenang');
  assert.equal(props.adegan[2].karakter?.properti, 'cangkir');
});

test('promptGambar mode ilustrasi sejarah tidak menyisipkan prompt gelas meja kafe, dan peta Nusantara terdeteksi otomatis', () => {
  const p = promptGambar('A vintage historical illustration of coffee plants in Parakan with cream sky', {
    mode: 'ilustrasi',
  });
  assert.equal(p.includes('cafe tabletop product photography'), false);
  assert.equal(p.includes('single beverage'), false);
  assert.match(p, /no floating modern cafe cups/i);

  // Bahkan tanpa mode eksplisit, kata kunci historical/illustration tetap bebas bungkus produk kafe
  const pAuto = promptGambar('Flat vintage historical illustration of coffee harvest in Gayo Aceh');
  assert.equal(pAuto.includes('cafe tabletop product photography'), false);

  const propsNusantara = siapkanPropsCeritaMotion(
    {
      judulEpisode: 'Jejak Kopi Nusantara',
      adegan: [
        {
          nomor: 1,
          jenisMotion: 'perkamen',
          kartuWaktu: 'BATAVIA · 1696',
          dialog: 'Bibit kopi pertama mulai ditanam di Jawa.',
        },
        {
          nomor: 2,
          jenisMotion: 'peta',
          kartuWaktu: 'SUMATERA, SULAWESI, DAN BALI · ABAD KE-19',
          dialog: 'Perkebunan kopi menyebar ke Aceh Gayo, Sumatera, Sulawesi, dan Bali.',
        },
      ],
    },
    { judulSerial: 'Jejak Kopi Nusantara', nomorEpisode: 1, temaVisual: 'perkamen' },
  );

  // Perkamen tanpa judulKartu tetap dapat judul gulungan otomatis dari kartuWaktu
  assert.equal(propsNusantara.adegan[0].judulKartu, 'Batavia');
  // Peta cerita Indonesia memakai wilayah Nusantara, BUKAN Mokha
  assert.equal(propsNusantara.adegan[1].wilayahPeta, 'nusantara');
  assert.equal(propsNusantara.adegan[1].judulKartu, 'NUSANTARA');
});

test('hitungTargetBitrateKbps menjaga ukuran video panjang tetap di bawah batas 50 MB Storage', () => {
  const brPanjang = hitungTargetBitrateKbps(180, 42, 128);
  assert.ok(brPanjang >= 650 && brPanjang <= 2000);
  // Perkiraan ukuran total (video + audio) 180 detik harus aman < 42 MB
  const estimasiMb = ((brPanjang + 128) * 180) / 8 / 1024;
  assert.ok(estimasiMb < 42, `Estimasi ${estimasiMb.toFixed(1)} MB terlalu besar`);

  const brPendek = hitungTargetBitrateKbps(30, 42, 128);
  assert.equal(brPendek, 3800);
});

test('pilihKarakterCeritaOtomatis memvariasikan 8 tokoh berwarna, pose baru & mencegah aksi monoton berurutan', () => {
  const kPetani = pilihKarakterCeritaOtomatis(
    { dialog: 'Para petani memetik ceri kopi merah di lereng Gayo dan berkumpul ramai bersama warga.' },
    1,
    { jenis: 'perkamen', konteksCerita: 'Jejak Kopi Nusantara' },
  );
  assert.equal(kPetani.tokohUtama, 'petani');
  assert.equal(kPetani.aksi, 'ramai_tiga');
  assert.equal(kPetani.gaya, 'ilustrasi');

  const kSeduh = pilihKarakterCeritaOtomatis(
    { dialog: 'Sambil duduk di meja kayu, ia menyeduh secangkir kopi hangat perlahan.' },
    2,
    { jenis: 'ilustrasi', konteksCerita: 'Jejak Kopi Nusantara', sebelumnya: kPetani },
  );
  assert.equal(kSeduh.aksi, 'duduk_seduh');
  assert.equal(kSeduh.properti, 'cangkir');

  const kHorizon = pilihKarakterCeritaOtomatis(
    { dialog: 'Ia berdiri menatap cakrawala laut dan gunung saat fajar menyingsing.' },
    3,
    { jenis: 'ilustrasi', konteksCerita: 'Jejak Kopi Nusantara', sebelumnya: kSeduh },
  );
  assert.equal(kHorizon.aksi, 'tatap_horizon');

  // Dua adegan berurutan dengan teks sama tidak mengulang aksi yang sama
  const kUlang = pilihKarakterCeritaOtomatis(
    { dialog: 'Ia kembali menatap laut jauh di cakrawala fajar.' },
    4,
    { jenis: 'ilustrasi', konteksCerita: 'Jejak Kopi Nusantara', sebelumnya: kHorizon },
  );
  assert.notEqual(kUlang.aksi, kHorizon.aksi);

  // Override manual 'tanpa' menyembunyikan karakter
  const kTanpa = pilihKarakterCeritaOtomatis(
    { dialog: 'Pemandangan alam saja.', karakter: { aksi: 'tanpa' } },
    2,
    { jenis: 'ilustrasi' },
  );
  assert.equal(kTanpa, undefined);
});

test('gabungRiwayatEpisode menyimpan metadata sambungan episode (gayaCerita, adeganTerakhir, jembatanBerikutnya)', () => {
  const hasil = gabungRiwayatEpisode(
    undefined,
    'jejak-kopi',
    {
      nomor: 1,
      judul: 'Pelabuhan Banten',
      ringkasan: 'Lek Aceng menemukan arsip kapal VOC.',
      tema: 'Sejarah Kopi',
      mood: 'cerita_kopi',
      gayaCerita: 'dokumenter',
      temaVisual: 'perkamen',
      adeganTerakhir: 'Lek Aceng melipat surat tua dan bersiap berlayar ke Gayo.',
      jembatanBerikutnya: 'Bagaimana perjalanan Lek Aceng di Gayo? Tunggu Episode 2!',
      tugasId: 't-100',
    },
    { judulSerial: 'Jejak Kopi Nusantara' },
  );
  const ep = hasil.serial[0].episode[0];
  assert.equal(ep.gayaCerita, 'dokumenter');
  assert.equal(ep.temaVisual, 'perkamen');
  assert.match(ep.adeganTerakhir, /berlayar ke Gayo/);
  assert.match(ep.jembatanBerikutnya, /Episode 2/);
});

test('pilihKarakterCeritaOtomatis mengisi shot closeup/medium, posisi pindah-pindah, & beatKedua otomatis', () => {
  const k1 = pilihKarakterCeritaOtomatis(
    { dialog: 'Lek Aceng melangkah di malam sunyi membawa lentera menuju pelabuhan tua.' },
    0,
    { jenis: 'pembuka', konteksCerita: 'Jejak Kopi Nusantara' },
  );
  assert.equal(k1.shot, 'medium');
  assert.ok(['kiri', 'tengah', 'kanan'].includes(k1.posisi));
  assert.ok(k1.beatKedua);
  assert.notEqual(k1.beatKedua.posisi, k1.posisi);
  assert.equal(k1.beatKedua.shot, 'closeup');

  const k2 = pilihKarakterCeritaOtomatis(
    { dialog: 'Suasana mendadak tegang di tengah hutan lebat ketika suara aneh terdengar.' },
    1,
    { jenis: 'ilustrasi', konteksCerita: 'Jejak Kopi Nusantara', sebelumnya: k1 },
  );
  assert.equal(k2.ekspresi, 'tegang');
  assert.notEqual(k2.posisi, k1.posisi);
  assert.notEqual(k2.shot, k1.shot);
});
