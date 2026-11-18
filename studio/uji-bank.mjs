// Uji render video "bank media" (gaya Lek Kopi) di laptop tanpa database & tanpa AI:
//   node uji-bank.mjs "D:/Lek Kopi Konten/bank"
// Bank dibaca dari folder (subfolder = tag), naskah sinematik contoh disusun dari tag yang ada,
// hasilnya di studio/keluaran/bank-<waktu>/.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probe } from './lib/bank/alat.mjs';
import { daftarLokal, jenisBerkas, tagDari } from './lib/bank/bank.mjs';
import { renderKonten } from './lib/bank/render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const akar = process.argv[2];
if (!akar) {
  console.error('Pakai: node uji-bank.mjs <folder bank>');
  process.exit(1);
}

const bank = [];
for (const { rel } of await daftarLokal(akar)) {
  const jenis = jenisBerkas(rel);
  if (!jenis) continue;
  const penuh = path.join(akar, rel);
  const info = await probe(penuh).catch(() => ({}));
  bank.push({ path: penuh, tag: tagDari(rel), jenis, durasi: info.durasi ?? null });
}
const tag = [...new Set(bank.filter((m) => m.jenis === 'foto' || m.jenis === 'video').map((m) => m.tag))];
if (!tag.length) throw new Error('Bank tidak berisi foto/video.');
console.log(`bank: ${bank.length} berkas, tag: ${tag.join(', ')}`);

const pakai = (i) => tag[i % tag.length];
const naskah = {
  mode: 'sinematik',
  judul: 'Uji bank media',
  adegan: [
    { tag: pakai(0), teks_layar: 'Malam di Lek Kopi', durasi: 2.5, gaya_teks: 'judul', suara: '' },
    { tag: pakai(1), teks_layar: 'Diracik pelan', durasi: 2.2, gaya_teks: 'cerita', suara: '' },
    { tag: pakai(0), teks_layar: '', durasi: 2.0, gaya_teks: 'tanpa', suara: '' },
    { tag: pakai(1), teks_layar: 'Mampir yuk', durasi: 2.5, gaya_teks: 'cerita', suara: '' },
  ],
};
const folder = path.join(DIR, 'keluaran', `bank-${Date.now()}`);
await mkdir(folder, { recursive: true });
const hasil = await renderKonten({ id: 'uji-bank', naskah_json: naskah }, bank, folder, { periksa: false, pilihAI: false });
console.log(JSON.stringify({ berkas: hasil.berkas, durasi: hasil.durasi, mode: hasil.mode, catatan: hasil.catatan }, null, 2));
