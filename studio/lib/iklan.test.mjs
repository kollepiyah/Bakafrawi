// node --test studio/lib/iklan.test.mjs — aturan murni video iklan (narasi + naskah Remotion).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kataDariMetadata } from './iklan.mjs';
import { keNaskah } from './video.mjs';
import { hitungWaktu, JEDA_AKHIR, JEDA_AWAL, naskahContoh } from '../remotion/src/data/script.ts';

test('kataDariMetadata: satuan 100 ns → detik', () => {
  const meta = { Metadata: [{ Type: 'WordBoundary', Data: { Offset: 1000000, Duration: 3703750, text: { Text: 'Masih' } } }, { Type: 'SessionEnd', Data: {} }] };
  assert.deepEqual(kataDariMetadata(meta), [{ teks: 'Masih', mulai: 0.1, selesai: 0.470375 }]);
});

const L = [{ berkas: 'a.png', lebar: 1170, tinggi: 2532 }, { berkas: 'b.png', lebar: 1170, tinggi: 2532 }];
const opsi = { nama: 'Maktaba POS', logo: 'logo', layar: L, info: 'bakafrawi.com · WA 0878', fitur: ['Kasir cepat', 'Stok & HPP', 'Keuangan', 'Gaji'] };

test('keNaskah: kolom dirapikan, penutup tunggal di akhir dengan kontak dari situs', () => {
  const n = keNaskah({
    adegan: [
      { jenis: 'penutup', narasi: 'Coba sekarang!', judul: 'Naik kelas', tombol: 'Coba', info: 'WA 0000 karangan' },
      { jenis: 'hook', narasi: 'Masih manual?', judul: 'Jangan rekap manual lagi', tekan: 'tidak ada di judul', kunci: ['manual'] },
      { jenis: 'layar', narasi: 'Omzet kelihatan.', layar: 7, fokus_x: 3, fokus_y: -1, sorotan: 'Omzet' },
    ],
  }, opsi);
  assert.deepEqual(n.adegan.map((a) => a.jenis), ['hook', 'layar', 'penutup']);
  assert.equal(n.adegan[0].tekan, ''); // frasa tekan harus bagian dari judul
  assert.equal(n.adegan[1].layar, 1); // 7 % 2
  assert.equal(n.adegan[1].fokus_x, 1);
  assert.equal(n.adegan[1].fokus_y, 0);
  assert.equal(n.adegan[2].info, 'bakafrawi.com · WA 0878'); // bukan karangan Claude
  assert.equal(n.merek.nama, 'Maktaba POS');
});

test('keNaskah: data kurang → adegan daftar dari fitur; tanpa penutup → ditambahkan', () => {
  const n = keNaskah({
    adegan: [
      { jenis: 'kasir', narasi: 'Transaksi cepat.', produk: [] },
      { jenis: 'alur', narasi: 'Otomatis.', simpul: ['a', 'b'] },
      { jenis: 'layar', narasi: 'Lihat layar.' },
      { jenis: 'daftar', narasi: '' },
    ],
  }, { ...opsi, layar: [] });
  assert.deepEqual(n.adegan.map((a) => a.jenis), ['daftar', 'daftar', 'daftar', 'penutup']);
  assert.deepEqual(n.adegan[0].daftar, ['Kasir cepat', 'Stok & HPP', 'Keuangan']);
  assert.match(n.adegan[3].narasi, /Maktaba POS/);
});

test('keNaskah: penghitung alur hanya bila label & dua angka berbeda', () => {
  const alur = (h) => keNaskah({ adegan: [{ jenis: 'alur', narasi: 'x', simpul: ['a', 'b', 'c'], ...h }] }, opsi).adegan[0].hitung;
  assert.deepEqual(alur({ hitung_label: 'Kopi', hitung_dari: 12, hitung_ke: 5 }), { label: 'Kopi', dari: 12, ke: 5 });
  assert.equal(alur({ hitung_label: '', hitung_dari: 12, hitung_ke: 5 }), null);
  assert.equal(alur({ hitung_label: 'Kopi', hitung_dari: 5, hitung_ke: 5 }), null);
});

test('hitungWaktu: durasi mengikuti suara, tanpa suara memakai durasi tulisan', () => {
  const tanpa = hitungWaktu(naskahContoh);
  assert.equal(tanpa.adegan[0].durasi, naskahContoh.adegan[0].durasi * 30);
  const suara = naskahContoh.adegan.map(() => ({ berkas: 'x.mp3', durasi: 10, kata: [] }));
  const dengan = hitungWaktu({ ...naskahContoh, suara });
  assert.equal(dengan.adegan[0].durasi, Math.round((JEDA_AWAL + 10 + JEDA_AKHIR) * 30));
  assert.equal(dengan.adegan[1].mulai, dengan.adegan[0].durasi);
});

test('naskahContoh lolos keNaskah tanpa berubah jenis (skema TS & perapi tetap sejalan)', () => {
  const n = keNaskah({ adegan: naskahContoh.adegan.map((a) => ({ ...a, label_angka: a.labelAngka, hitung_label: a.hitung?.label, hitung_dari: a.hitung?.dari, hitung_ke: a.hitung?.ke })) }, { ...opsi, layar: [L[0]] });
  assert.deepEqual(n.adegan.map((a) => a.jenis), naskahContoh.adegan.map((a) => a.jenis));
});

test('pilihMusik: hanya berkas audio, acak tapi pasti salah satu', async () => {
  const { pilihMusik } = await import('./video.mjs');
  assert.equal(pilihMusik(['README.md', 'gambar.png']), null);
  assert.equal(pilihMusik(['b.mp3', 'a.m4a', 'x.txt'], () => 0), 'a.m4a');
  assert.equal(pilihMusik(['b.mp3', 'a.m4a'], () => 0.99), 'b.mp3');
});

test('kelompokKarakter: subfolder per karakter + berkas akar lama, bukan gambar diabaikan', async () => {
  const { kelompokKarakter } = await import('./video.mjs');
  const k = kelompokKarakter(['ibu-hijab', 'ibu-hijab\\kaget.JPG', 'ibu-hijab/tunjuk.png', 'bapak-kopiah/lambai.webm', 'bakafrawi-jempol.jpg', 'Bakafrawi.jpg', 'catatan.txt']);
  assert.deepEqual([...k.keys()].sort(), ['bakafrawi-jempol'.replace('-jempol', ''), 'bapak-kopiah', 'ibu-hijab'].sort());
  assert.deepEqual(k.get('ibu-hijab'), ['ibu-hijab/kaget.JPG', 'ibu-hijab/tunjuk.png']);
  assert.deepEqual(k.get('bakafrawi'), ['bakafrawi-jempol.jpg', 'Bakafrawi.jpg']);
});

test('pilihKarakter: pilihan Claude → slug merek → acak', async () => {
  const { pilihKarakter } = await import('./video.mjs');
  const nama = ['ibu-hijab', 'bapak-kopiah', 'lek-kopi'];
  assert.equal(pilihKarakter(nama, { pilihan: 'Bapak-Kopiah ', slug: 'lek-kopi' }), 'bapak-kopiah');
  assert.equal(pilihKarakter(nama, { pilihan: 'karangan', slug: 'lek-kopi' }), 'lek-kopi');
  assert.equal(pilihKarakter(nama, { acak: () => 0 }), 'bapak-kopiah'); // urut abjad
  assert.equal(pilihKarakter([], {}), null);
});

test('maskotAdegan: video didahulukan; lalu pose Claude → pose bawaan → tunjuk → pose lain → tanpa pose', async () => {
  const { maskotAdegan } = await import('./video.mjs');
  const adegan = [{ jenis: 'hook' }, { jenis: 'layar', pose: 'jempol' }, { jenis: 'kasir' }, { jenis: 'penutup' }];
  const ibu = ['ibu/kaget.JPG', 'ibu/tunjuk.jpg', 'ibu/jempol.png', 'ibu/jempol.webm'];
  // Ada video → video dipakai di semua adegan (pose video lebih dulu), gambar hanya bila tak ada video.
  assert.deepEqual(maskotAdegan(adegan, ibu), Array(4).fill('ibu/jempol.webm'));
  const satuVideo = ['ibu/kaget.jpg', 'ibu/tunjuk.jpg', 'ibu/bicara.mp4'];
  assert.deepEqual(maskotAdegan(adegan, satuVideo), Array(4).fill('ibu/bicara.mp4'));
  const gambarSaja = ['ibu/kaget.JPG', 'ibu/tunjuk.jpg', 'ibu/jempol.png'];
  assert.deepEqual(maskotAdegan(adegan, gambarSaja), ['ibu/kaget.JPG', 'ibu/jempol.png', 'ibu/tunjuk.jpg', 'ibu/tunjuk.jpg']);
  assert.deepEqual(maskotAdegan(adegan, ['Bakafrawi.jpg']), Array(4).fill('Bakafrawi.jpg'));
  assert.deepEqual(maskotAdegan(adegan.slice(0, 1), ['lek-kopi-lambai.jpg']), ['lek-kopi-lambai.jpg']);
  assert.deepEqual(maskotAdegan(adegan.slice(0, 1), []), [null]);
});

test('keNaskah: pose dari Claude ikut bila sah', () => {
  const n = keNaskah({ adegan: [{ jenis: 'hook', narasi: 'Halo', judul: 'Halo', pose: 'kaget' }, { jenis: 'daftar', narasi: 'x', daftar: ['a'], pose: 'menari' }] }, opsi);
  assert.equal(n.adegan[0].pose, 'kaget');
  assert.equal(n.adegan[1].pose, undefined);
});

test('suaraKarakter: nama karakter perempuan → suara wanita, lainnya pria', async () => {
  const { suaraKarakter, SUARA } = await import('./video.mjs');
  assert.equal(suaraKarakter('ibu-hijab'), SUARA.wanita);
  assert.equal(suaraKarakter('Mbak_Kasir'), SUARA.wanita);
  assert.equal(suaraKarakter('bapak-kopiah'), SUARA.pria);
  assert.equal(suaraKarakter('ibuprofen'), SUARA.pria); // "ibu" harus kata utuh
  assert.equal(suaraKarakter(null, 'x'), 'x');
});

test('kataDariAlignmentElevenLabs: mengubah karakter & timestamp menjadi array kata Remotion', async () => {
  const { kataDariAlignmentElevenLabs } = await import('./bank/suara.mjs');
  const alignment = {
    characters: ['H', 'a', 'l', 'o', ',', ' ', ' ', 'K', 'y', 'a', 'i', '!'],
    character_start_times_seconds: [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
    character_end_times_seconds: [0.05, 0.1, 0.15, 0.2, 0.24, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.62],
  };
  assert.deepEqual(kataDariAlignmentElevenLabs(alignment), [
    { teks: 'Halo,', mulai: 0.0, selesai: 0.24 },
    { teks: 'Kyai!', mulai: 0.35, selesai: 0.62 },
  ]);
  assert.deepEqual(kataDariAlignmentElevenLabs(null), []);
});

test('jalurSuara: prioritas ElevenLabs → Gemini → Edge dan override STUDIO_JALUR_SUARA', async () => {
  const { jalurSuara } = await import('./bank/suara.mjs');
  const simpan = {
    el: process.env.ELEVENLABS_API_KEY,
    gem: process.env.GEMINI_API_KEY,
    azk: process.env.AZURE_SPEECH_KEY,
    azr: process.env.AZURE_SPEECH_REGION,
    paksa: process.env.STUDIO_JALUR_SUARA,
  };
  try {
    delete process.env.STUDIO_JALUR_SUARA;
    delete process.env.AZURE_SPEECH_KEY;
    delete process.env.AZURE_SPEECH_REGION;
    process.env.ELEVENLABS_API_KEY = 'el-test';
    process.env.GEMINI_API_KEY = 'gem-test';
    assert.equal(jalurSuara(), 'elevenlabs');

    delete process.env.ELEVENLABS_API_KEY;
    assert.equal(jalurSuara(), 'gemini');

    delete process.env.GEMINI_API_KEY;
    assert.equal(jalurSuara(), 'edge');

    process.env.STUDIO_JALUR_SUARA = 'edge';
    process.env.ELEVENLABS_API_KEY = 'el-test';
    assert.equal(jalurSuara(), 'edge');
  } finally {
    if (simpan.el === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = simpan.el;
    if (simpan.gem === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = simpan.gem;
    if (simpan.azk === undefined) delete process.env.AZURE_SPEECH_KEY; else process.env.AZURE_SPEECH_KEY = simpan.azk;
    if (simpan.azr === undefined) delete process.env.AZURE_SPEECH_REGION; else process.env.AZURE_SPEECH_REGION = simpan.azr;
    if (simpan.paksa === undefined) delete process.env.STUDIO_JALUR_SUARA; else process.env.STUDIO_JALUR_SUARA = simpan.paksa;
  }
});

test('suaraAdegan: ElevenLabs gagal → fallback berjenjang ke Gemini/Edge dengan catatan jelas', async () => {
  const { mkdtemp, rm, writeFile } = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { suaraAdegan } = await import('./bank/suara.mjs');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'uji-suara-fallback-'));
  const gemLama = process.env.GEMINI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = 'gem-test';
    const dicoba = [];
    const h = await suaraAdegan(['Adegan satu', 'Adegan dua'], dir, {
      jalur: 'elevenlabs',
      buat: async (_t, k, j) => {
        dicoba.push(j);
        if (j === 'elevenlabs') throw new Error('ElevenLabs TTS 429: quota habis');
        if (j === 'gemini') throw new Error('Gemini TTS 429: limit harian');
        await writeFile(k, 'mp3-stub');
      },
    });
    assert.equal(h.jalur, 'edge');
    assert.equal(h.berkas.length, 2);
    assert.match(h.catatan ?? '', /elevenlabs gagal.*ElevenLabs TTS 429/);
    assert.deepEqual(dicoba, ['elevenlabs', 'gemini', 'edge', 'edge']);
  } finally {
    if (gemLama === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = gemLama;
    await rm(dir, { recursive: true, force: true });
  }
});

test('daftarVoiceElevenLabs & pilihVoiceElevenLabs: gabung favorit DB + env multi-ID, deduplikasi, rotasi deterministik & prioritas manual', async () => {
  const { daftarVoiceElevenLabs, pilihVoiceElevenLabs } = await import('./bank/suara.mjs');
  const gabung = daftarVoiceElevenLabs(
    [
      { id: 'VoiceFavorit1Abc', nama: 'Hangat' },
      { id: 'pendek', nama: 'Salah' },
      'VoiceFavorit1Abc',
    ],
    'VoiceEnvDua999, VoiceFavorit1Abc\nVoiceEnvTiga888 ; bad',
  );
  assert.deepEqual(gabung, ['VoiceFavorit1Abc', 'VoiceEnvDua999', 'VoiceEnvTiga888']);

  // Pilihan manual selalu menang meski daftar banyak
  assert.equal(
    pilihVoiceElevenLabs({
      voiceId: 'ManualVoiceIdXYZ',
      daftarVoice: gabung,
      benih: 'Promo Lek Kopi',
    }),
    'ManualVoiceIdXYZ',
  );

  // Tanpa pilihan manual: rotasi deterministik berdasarkan teks naskah (case-sensitive)
  const pilih1a = pilihVoiceElevenLabs({ daftarVoice: gabung, benih: 'Promo Kopi Hari Senin' });
  const pilih1b = pilihVoiceElevenLabs({ daftarVoice: gabung, benih: 'Promo Kopi Hari Senin' });
  assert.equal(pilih1a, pilih1b);
  assert.ok(gabung.includes(pilih1a));

  // Kosong semua → fallback profil
  assert.equal(
    pilihVoiceElevenLabs({ daftarVoice: [], envNilai: '', profil: { elevenVoiceId: 'ProfilVoice12345' } }),
    'ProfilVoice12345',
  );
});

test('uraiPilihanSuara: bedakan profil bawaan vs Voice ID ElevenLabs (case-sensitive)', async () => {
  const { uraiPilihanSuara } = await import('./bank/suara.mjs');
  assert.deepEqual(uraiPilihanSuara('[Gaya: dial-menu] [Suara: jawa_timur] Promo kopi'), {
    profilSuara: 'jawa_timur',
    voiceId: null,
  });
  assert.deepEqual(uraiPilihanSuara('[Suara: AbCdEfGh123456] Tolong buatkan video'), {
    profilSuara: null,
    voiceId: 'AbCdEfGh123456',
  });
  assert.deepEqual(uraiPilihanSuara('Video promo biasa tanpa tag suara'), {
    profilSuara: null,
    voiceId: null,
  });
});

test('suaraAdegan: meneruskan voiceId pilihan / hasil rotasi ke jalur elevenlabs dan mengembalikannya', async () => {
  const { mkdtemp, rm, writeFile } = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { suaraAdegan } = await import('./bank/suara.mjs');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'uji-suara-voiceid-'));
  try {
    const terekam = [];
    const h = await suaraAdegan(['Adegan satu', 'Adegan dua'], dir, {
      jalur: 'elevenlabs',
      voiceId: 'CustomVoiceIdABC12',
      buat: async (_t, k, j, info) => {
        terekam.push({ j, voiceId: info?.voiceId });
        await writeFile(k, 'mp3-stub');
        return { kata: [] };
      },
    });
    assert.equal(h.jalur, 'elevenlabs');
    assert.equal(h.voiceId, 'CustomVoiceIdABC12');
    assert.deepEqual(terekam, [
      { j: 'elevenlabs', voiceId: 'CustomVoiceIdABC12' },
      { j: 'elevenlabs', voiceId: 'CustomVoiceIdABC12' },
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('bersihkanTepi: hijau di tepi setengah tembus dibuang, piksel padat tak disentuh', async () => {
  const { bersihkanTepi } = await import('./latar.mjs');
  const d = Buffer.from([10, 200, 20, 128, 10, 200, 20, 255, 0, 0, 0, 0]);
  bersihkanTepi(d);
  assert.deepEqual([...d.subarray(0, 4)], [10, 20, 20, Math.round((88 * 255) / 215)]);
  assert.deepEqual([...d.subarray(4, 8)], [10, 200, 20, 255]);
  assert.deepEqual([...d.subarray(8)], [0, 0, 0, 0]);
});

test('kotakGabung: gabungan kotak karakter di beberapa bingkai, diperlebar & genap, tak keluar bingkai', async () => {
  const { kotakGabung } = await import('./latar.mjs');
  const k = kotakGabung([{ x: 100, y: 50, w: 200, h: 600 }, { x: 60, y: 40, w: 220, h: 610 }], 720, 1280, 0.1);
  assert.deepEqual(k, { x: 36, y: 0, w: 288, h: 710 });
  assert.equal(k.w % 2, 0);
  const tepi = kotakGabung([{ x: 0, y: 0, w: 720, h: 1280 }], 720, 1280);
  assert.deepEqual(tepi, { x: 0, y: 0, w: 720, h: 1280 });
});

test('keNaskah: dark-keynote pakai latar gelap + teal Bakafrawi; split-hook & pov-chat gelap; clean-ui tetap putih', async () => {
  const { keNaskah } = await import('./video.mjs');
  const bahan = {
    adegan: [
      { jenis: 'hook', narasi: 'Masih manual?', kunci: ['manual'], label: 'Hook', judul: 'Stop Manual', tekan: 'Manual', sub: 'Sub', coretan: 'coba', dari: 'Lama', ke: 'Baru' },
      { jenis: 'penutup', narasi: 'Coba sekarang!', kunci: ['sekarang'], judul: 'Ayo Coba', tombol: 'Daftar' },
    ],
  };

  const dark = keNaskah(bahan, { nama: 'Maktaba POS', info: 'bakafrawi.com', gaya: 'dark-keynote' });
  assert.equal(dark.merek.latar, '#0A0C10');
  assert.equal(dark.merek.utama, '#18B4A8');
  assert.equal(dark.merek.kedua, '#34E0CD');
  assert.equal(dark.merek.tinta, '#F8FAFC');

  const split = keNaskah(bahan, { nama: 'Maktaba POS', info: 'bakafrawi.com', gaya: 'split-hook' });
  assert.equal(split.merek.latar, '#0D1017');
  assert.equal(split.merek.tinta, '#F8FAFC');

  const pov = keNaskah(bahan, { nama: 'Maktaba POS', info: 'bakafrawi.com', gaya: 'pov-chat' });
  assert.equal(pov.merek.latar, '#0F1419');
  assert.equal(pov.merek.tinta, '#F1F5F9');

  const clean = keNaskah(bahan, { nama: 'Maktaba POS', info: 'bakafrawi.com', gaya: 'clean-ui' });
  assert.equal(clean.merek.latar, '#FAFAFA');
  assert.equal(clean.merek.tinta, '#0B0B0F');
});

test('uraiPilihanKarakter & deteksiGenderKarakter: baca tag, arahan bebas, dan nama suara', async () => {
  const { uraiPilihanKarakter, deteksiGenderKarakter } = await import('./video.mjs');

  assert.deepEqual(uraiPilihanKarakter('[Gaya: otomatis] [Karakter: wanita] Promosi kasir cepat'), {
    karakter: 'wanita',
    bersih: '[Gaya: otomatis] Promosi kasir cepat',
  });
  assert.deepEqual(uraiPilihanKarakter('Tanpa tag'), { karakter: null, bersih: 'Tanpa tag' });

  assert.equal(deteksiGenderKarakter('[Karakter: wanita] Buat video Maktaba POS'), 'wanita');
  assert.equal(deteksiGenderKarakter('Tolong pakai karakter wanita untuk Maktaba POS'), 'wanita');
  assert.equal(deteksiGenderKarakter('Promosi Ammu Online', { namaSuara: 'Mbak Indah' }), 'wanita');
  assert.equal(deteksiGenderKarakter('Promosi Waseela', { namaSuara: 'Mas Jowo' }), 'pria');
  assert.equal(deteksiGenderKarakter('[Karakter: tanpa] Buat video produk'), 'tanpa');
  assert.equal(deteksiGenderKarakter('Buat video promosi aplikasi kasir'), null);
});

test('pilihKarakter dengan gender: wanita memaksa ibu-hijab, pria ke bapak-kopiah, tanpa → null', async () => {
  const { pilihKarakter } = await import('./video.mjs');
  const daftar = ['bapak-kopiah', 'ibu-hijab'];

  assert.equal(pilihKarakter(daftar, { pilihan: 'bapak-kopiah', gender: 'wanita' }), 'ibu-hijab');
  assert.equal(pilihKarakter(daftar, { pilihan: 'ibu-hijab', gender: 'pria' }), 'bapak-kopiah');
  assert.equal(pilihKarakter(daftar, { pilihan: 'ibu-hijab', gender: 'tanpa' }), null);
});

test('pilihVoiceElevenLabs dengan gender: menyaring daftarVoice sesuai wanita/pria', async () => {
  const { pilihVoiceElevenLabs } = await import('./bank/suara.mjs');
  const daftar = [
    { id: 'id_indah_11', nama: 'Mbak Indah' },
    { id: 'id_jowo_22', nama: 'Mas Jowo' },
  ];

  assert.equal(pilihVoiceElevenLabs({ daftarVoice: daftar, gender: 'wanita', benih: 'uji', envNilai: '' }), 'id_indah_11');
  assert.equal(pilihVoiceElevenLabs({ daftarVoice: daftar, gender: 'pria', benih: 'uji', envNilai: '' }), 'id_jowo_22');
});

test('namaBerkasAsetMaskot: pose sah jadi <pose>.<ext>, tanpa pose jadi <id>.<ext>', async () => {
  const { namaBerkasAsetMaskot } = await import('./video.mjs');
  assert.equal(
    namaBerkasAsetMaskot({ id: 'aset-123', pose: 'kaget', ekstensi: '.png', url: 'https://x.test/a.png' }),
    'kaget.png',
  );
  assert.equal(
    namaBerkasAsetMaskot({ id: 'aset-456', pose: '', ekstensi: '.webm', url: 'https://x.test/b.webm' }),
    'aset-456.webm',
  );
  assert.equal(
    namaBerkasAsetMaskot({ id: 'hero-kaget', pose: '', ekstensi: '.png', url: 'https://x.test/c.png' }),
    'hero-kaget-utama.png',
  );
});

test('pilihKolamGayaDenganEvaluasi: utamakan gayaPrioritas di dalam kolamDasar & buang gayaKurangi tanpa mengosongkan', async () => {
  const { pilihKolamGayaDenganEvaluasi } = await import('./video.mjs');
  const dasarKarakter = ['dark-keynote', 'split-hook', 'pov-chat'];

  assert.deepEqual(
    pilihKolamGayaDenganEvaluasi(dasarKarakter, {
      gayaPrioritas: ['sinematik-ai', 'pov-chat', 'dark-keynote'],
      gayaKurangi: ['split-hook'],
    }),
    ['pov-chat', 'dark-keynote'],
  );

  assert.deepEqual(
    pilihKolamGayaDenganEvaluasi(dasarKarakter, {
      gayaPrioritas: ['sinematik-ai'], // tak ada di dasarKarakter
      gayaKurangi: ['split-hook'],
    }),
    ['dark-keynote', 'pov-chat'],
  );

  // Bila semua gaya masuk daftar kurangi, tetap pertahankan kolam dasar agar tak kosong
  assert.deepEqual(
    pilihKolamGayaDenganEvaluasi(['dark-keynote'], {
      gayaPrioritas: [],
      gayaKurangi: ['dark-keynote'],
    }),
    ['dark-keynote'],
  );
});

test('WebShowcase: hitungDurasiWebShowcase & naskahWebShowcaseTemplat memakai data scan web asli', async () => {
  const { contohWebShowcase, hitungDurasiWebShowcase } = await import('../remotion/src/data/web-showcase.ts');
  const { naskahWebShowcaseTemplat } = await import('./naskah.mjs');
  const dur = hitungDurasiWebShowcase(contohWebShowcase);
  assert.equal(dur.babak.length, 5);
  assert.ok(dur.total >= 30 * 20);

  const tmpl = naskahWebShowcaseTemplat(
    {
      nama: 'Pesantren Al Manshur',
      kategori: 'pesanan',
      sektorLabel: 'Pesantren & Lembaga Islam',
      urlWeb: 'https://almansur.id',
      fitur: [{ judul: 'Profil Lembaga', isi: 'Rapi' }],
    },
    { kontak: { whatsappTampil: '0857-1047-7372' } },
    {
      domain: 'almansur.id',
      heading: ['Pondok Pesantren Mambaul Ulum', 'Pendaftaran Santri Baru', 'Berita Pondok'],
      navigasi: ['Beranda', 'Profil', 'PPDB'],
    },
  );
  assert.match(tmpl.hook.judul, /ALMANSUR\.ID/);
  assert.deepEqual(tmpl.browser.chips, ['Beranda', 'Profil', 'PPDB']);
  assert.equal(tmpl.spotlight.daftar[0], 'Pondok Pesantren Mambaul Ulum');
});
