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

test('pilihMaskot: berkas merek dulu, cadangan bakafrawi, video didahulukan dari gambar', async () => {
  const { pilihMaskot } = await import('./video.mjs');
  assert.equal(pilihMaskot(['bakafrawi.png', 'lek-kopi.webm'], 'lek-kopi'), 'lek-kopi.webm');
  assert.equal(pilihMaskot(['bakafrawi.png', 'bakafrawi.webm', 'README.md'], 'maktaba'), 'bakafrawi.webm');
  assert.equal(pilihMaskot(['README.md'], 'bakafrawi'), null);
});

test('pilihMusik: hanya berkas audio, acak tapi pasti salah satu', async () => {
  const { pilihMusik } = await import('./video.mjs');
  assert.equal(pilihMusik(['README.md', 'gambar.png']), null);
  assert.equal(pilihMusik(['b.mp3', 'a.m4a', 'x.txt'], () => 0), 'a.m4a');
  assert.equal(pilihMusik(['b.mp3', 'a.m4a'], () => 0.99), 'b.mp3');
});

test('pilihMaskot: JPG diterima paling akhir, huruf besar/kecil diabaikan', async () => {
  const { pilihMaskot } = await import('./video.mjs');
  assert.equal(pilihMaskot(['Bakafrawi.JPG'], 'maktaba-pos'), 'Bakafrawi.JPG');
  assert.equal(pilihMaskot(['bakafrawi.jpg', 'bakafrawi.png'], 'x'), 'bakafrawi.png');
});
