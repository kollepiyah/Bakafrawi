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

test('maskotAdegan: pose Claude → pose bawaan jenis → tunjuk → pose lain → gambar tanpa pose', async () => {
  const { maskotAdegan } = await import('./video.mjs');
  const adegan = [{ jenis: 'hook' }, { jenis: 'layar', pose: 'jempol' }, { jenis: 'kasir' }, { jenis: 'penutup' }];
  const ibu = ['ibu/kaget.JPG', 'ibu/tunjuk.jpg', 'ibu/jempol.png', 'ibu/jempol.webm'];
  assert.deepEqual(maskotAdegan(adegan, ibu), ['ibu/kaget.JPG', 'ibu/jempol.webm', 'ibu/tunjuk.jpg', 'ibu/tunjuk.jpg']);
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
