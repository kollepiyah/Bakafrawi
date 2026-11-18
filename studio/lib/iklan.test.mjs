// node --test studio/lib/iklan.test.mjs — aturan murni gaya iklan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assKata, jadwal, kataDariMetadata, kataSorot, kelompokKata, rencanaAdegan, TRANSISI } from './iklan.mjs';
import { potongLayar } from './templat.mjs';

const k = (teks, mulai, selesai) => ({ teks, mulai, selesai });

test('kataDariMetadata: satuan 100 ns → detik', () => {
  const meta = { Metadata: [{ Type: 'WordBoundary', Data: { Offset: 1000000, Duration: 3703750, text: { Text: 'Masih' } } }, { Type: 'SessionEnd', Data: {} }] };
  assert.deepEqual(kataDariMetadata(meta), [{ teks: 'Masih', mulai: 0.1, selesai: 0.470375 }]);
});

test('kelompokKata: tanda baca memotong, dibagi rata tanpa kata yatim', () => {
  const g = kelompokKata([k('Kenalin,', 0, 1), k('Maktaba', 1, 2), k('POS.', 2, 3), k('Kasir', 3, 4), k('pintar', 4, 5), k('cukup', 5, 6), k('dari', 6, 7)]);
  assert.deepEqual(g.map((x) => x.map((w) => w.teks)), [['Kenalin,'], ['Maktaba', 'POS.'], ['Kasir', 'pintar'], ['cukup', 'dari']]);
  assert.deepEqual(kelompokKata(['Cek', 'link', 'di', 'bio!'].map((t, i) => k(t, i, i + 1)), 2).map((x) => x.length), [2, 2]);
  assert.deepEqual(kelompokKata(['a', 'b', 'c'].map((t, i) => k(t, i, i + 1)), 2).map((x) => x.length), [2, 1]);
});

test('kataSorot: tandaan Claude, angka, dan nama produk', () => {
  assert.equal(kataSorot('Omzet', ['omzet']), true);
  assert.equal(kataSorot('Rp134.500'), true);
  assert.equal(kataSorot('POS.', [], 'Maktaba POS'), true);
  assert.equal(kataSorot('langsung', ['omzet'], 'Maktaba POS'), false);
});

test('potongLayar: titik fokus di tengah kartu, tak pernah keluar gambar', () => {
  const p = potongLayar({ lebar: 1170, tinggi: 2532 }, { fx: 0.5, fy: 0.4, zoom: 2 }, 900, 760);
  assert.equal(p.wi, 1800);
  assert.ok(Math.abs(-p.y + 380 - 0.4 * p.hi) < 1e-6);
  const tepi = potongLayar({ lebar: 1170, tinggi: 2532 }, { fx: 1, fy: 1, zoom: 1.3 }, 900, 760);
  assert.ok(-tepi.x <= tepi.wi - 900 + 1e-9 && -tepi.y <= tepi.hi - 760 + 1e-9);
});

test('rencanaAdegan: adegan 1 kartu judul, foto bawah terbawa, layar kosong aman', () => {
  const L = [{ berkas: 'a.png', lebar: 1170, tinggi: 2532 }, { berkas: 'b.png', lebar: 1170, tinggi: 2532 }];
  const r = rencanaAdegan([
    { teks: 'Hook?', atas: 'layar' },
    { teks: 'Ini', atas: 'hp', layar: 5 },
    { teks: 'Omzet', atas: 'layar', layar: 0, fokus_x: 0.3, fokus_y: 0.9, zoom: 9, sorot: ['omzet'] },
    { teks: 'Coba', atas: 'cta' },
  ], { layar: L, foto: ['f0.png', null, 'f2.png'], hook: { judul: 'Jangan begini', sorot: 'begini', coretan: 'serius!' } });
  assert.deepEqual(r[0].atas, { jenis: 'judul', judul: 'Jangan begini', sorot: 'begini', coretan: 'serius!' });
  assert.equal(r[0].bawah, 'f0.png');
  assert.deepEqual(r[1].atas.layar, ['b.png', 'a.png']); // nomor di luar jangkauan diputar
  assert.equal(r[1].bawah, 'f0.png'); // foto terakhir terbawa
  assert.equal(r[2].atas.zoom, 1.15); // zoom dijepit
  assert.equal(r[2].tone, 'gelap');
  assert.equal(r[2].bawah, 'f2.png');
  assert.equal(r[3].atas.jenis, 'cta');
  assert.equal(r[3].bawah, null);
  assert.equal(rencanaAdegan([{ teks: 'x' }, { teks: 'y', atas: 'layar' }], {})[1].atas.jenis, 'logo');
});

test('jadwal: adegan berikutnya mulai TRANSISI lebih awal, suara sesudah transisi', () => {
  const { adegan, total } = jadwal([1.0, 2.0]);
  assert.equal(adegan[0].mulai, 0);
  assert.equal(adegan[0].durasi, 1.6); // minimal
  assert.ok(Math.abs(adegan[1].mulai - (1.6 - TRANSISI)) < 1e-9);
  assert.ok(adegan[1].suaraMulai > adegan[1].mulai + TRANSISI);
  assert.ok(Math.abs(total - (adegan[1].mulai + adegan[1].durasi)) < 1e-9);
});

test('assKata: 1–2 kata di tengah, tanpa tumpukan, sorot serif miring, warna ikut nada', () => {
  const ass = assKata([
    { kata: [k('Omzet', 0, 0.4), k('hari', 0.4, 0.7), k('ini', 0.7, 1.0), k('langsung', 1.0, 1.5), k('kelihatan.', 1.5, 2.2)], suaraMulai: 1, tone: 'gelap', sorot: ['omzet'] },
    { kata: [k('Untungnya', 0, 0.6)], suaraMulai: 3.3, tone: 'terang' },
  ], { tengah: 1065 });
  const t = (s) => { const [j, m, d] = s.split(':'); return Number(j) * 3600 + Number(m) * 60 + Number(d); };
  const baris = ass.split('\n').filter((l) => l.startsWith('Dialogue'));
  assert.equal(baris.length, 4); // Omzet hari | ini langsung | kelihatan | untungnya
  const w = baris.map((l) => l.split(',')).map((p) => [t(p[1]), t(p[2])]);
  for (let i = 1; i < w.length; i++) assert.ok(w[i][0] >= w[i - 1][1] - 1e-9, `baris ${i} menumpuk`);
  assert.match(baris[0], /\\pos\(540,1065\)\\c&H00FFFFFF&/);
  assert.match(baris[0], /\\i1\\fs118}Omzet/);
  assert.match(baris[2], /kelihatan$/); // titik dibuang
  assert.match(baris[3], /\\c&H00151515&/);
});
