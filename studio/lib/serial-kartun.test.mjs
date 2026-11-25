// node --test studio/lib/serial-kartun.test.mjs — unit test worker Serial Kartun 2D Lek Kopi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { gabungRiwayatEpisode, siapkanPropsSerialKartun } from './serial-kartun.mjs';
import { urutanPenyediaWorker } from './router-worker.mjs';
import { pilihVoicePerTokoh, suaraDialogSerial } from './bank/suara.mjs';
import {
  contohSerialKartun,
  DURASI_INTRO_DETIK,
  DURASI_PENUTUP_DETIK,
  FPS_SERIAL,
  hitungDurasiSerialKartun,
} from '../remotion/src/data/serial-waktu.ts';

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
});
