// node --test studio/lib/iklan.test.mjs — aturan murni gaya iklan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assKata, jadwal, kataDariMetadata, kelompokKata, TRANSISI } from './iklan.mjs';

const k = (teks, mulai, selesai) => ({ teks, mulai, selesai });

test('kataDariMetadata: satuan 100 ns → detik', () => {
  const meta = { Metadata: [{ Type: 'WordBoundary', Data: { Offset: 1000000, Duration: 3703750, text: { Text: 'Masih' } } }, { Type: 'SessionEnd', Data: {} }] };
  assert.deepEqual(kataDariMetadata(meta), [{ teks: 'Masih', mulai: 0.1, selesai: 0.470375 }]);
});

test('kelompokKata: maks 3 kata, tanda baca memotong', () => {
  const g = kelompokKata([k('Kenalin,', 0, 1), k('Maktaba', 1, 2), k('POS.', 2, 3), k('Kasir', 3, 4), k('pintar', 4, 5), k('cukup', 5, 6), k('dari', 6, 7)]);
  assert.deepEqual(g.map((x) => x.map((w) => w.teks)), [['Kenalin,'], ['Maktaba', 'POS.'], ['Kasir', 'pintar', 'cukup'], ['dari']]);
});

test('jadwal: adegan berikutnya mulai TRANSISI lebih awal, suara sesudah transisi', () => {
  const { adegan, total } = jadwal([1.0, 2.0]);
  assert.equal(adegan[0].mulai, 0);
  assert.equal(adegan[0].durasi, 1.6); // minimal
  assert.ok(Math.abs(adegan[1].mulai - (1.6 - TRANSISI)) < 1e-9);
  assert.ok(adegan[1].suaraMulai > adegan[1].mulai + TRANSISI);
  assert.ok(Math.abs(total - (adegan[1].mulai + adegan[1].durasi)) < 1e-9);
});

test('assKata: tak ada dua baris tampil bersamaan & kata aktif diwarnai', () => {
  const ass = assKata([
    { kata: [k('Omzet', 0, 0.4), k('hari', 0.4, 0.7), k('ini', 0.7, 1.0), k('langsung', 1.0, 1.5), k('kelihatan.', 1.5, 2.2)], suaraMulai: 1 },
    { kata: [k('Untungnya', 0, 0.6)], suaraMulai: 3.3 },
  ]);
  const t = (s) => { const [j, m, d] = s.split(':'); return Number(j) * 3600 + Number(m) * 60 + Number(d); };
  const baris = ass.split('\n').filter((l) => l.startsWith('Dialogue')).map((l) => l.split(',')).map((p) => [t(p[1]), t(p[2])]);
  assert.equal(baris.length, 6);
  for (let i = 1; i < baris.length; i++) assert.ok(baris[i][0] >= baris[i - 1][1] - 1e-9, `baris ${i} menumpuk`);
  assert.match(ass, /\\c&H0042C5F5&\\fscx112\\fscy112}OMZET/);
});
