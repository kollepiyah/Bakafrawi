// Uji lokal gaya iklan (tanpa database, tanpa menulis apa pun ke produksi) — Maktaba POS.
//   node uji-iklan.mjs [foto-pembuka.jpg]
// Layar dari keluaran/iklan-bahan (dipotret dari mode pratinjau Maktaba, data rekaan). Naskah: Claude
// bila ANTHROPIC_API_KEY ada, selain itu naskah contoh di bawah (bentuk sama dengan keluaran Claude).
// Foto orang separuh bawah: argumen pertama (pengganti foto AI saat kunci gambar AI tidak ada di laptop).
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ffmpeg } from './lib/bank/alat.mjs';
import { rencanaAdegan, susunIklan } from './lib/iklan.mjs';
import { buatNaskahVideo } from './lib/naskah.mjs';
import { bukaPeramban } from './lib/peramban.mjs';
import { temaMerek } from './lib/templat.mjs';
import { readFile } from 'node:fs/promises';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BAHAN = path.join(DIR, 'keluaran', 'iklan-bahan');
const contoh = JSON.parse(await readFile(path.join(DIR, 'contoh-tugas-video.json'), 'utf8'));
const produk = contoh.situs.produk.find((p) => p.slug === 'maktaba-pos');
const layar = ['pos', 'dasbor', 'laporan', 'kas'].map((n) => ({ berkas: path.join(BAHAN, `${n}.png`), lebar: 1170, tinggi: 2532, keterangan: n }));

const folder = path.join(DIR, 'keluaran', `iklan-${Date.now()}`);
await mkdir(folder, { recursive: true });
console.log('📁', folder);

const kecilkan = async (b) => {
  const k = path.join(folder, `${path.basename(b)}.kecil.jpg`);
  await ffmpeg(['-y', '-i', b, '-vf', 'scale=540:-2', '-q:v', '5', k]);
  return (await readFile(k)).toString('base64');
};
const k = { layar: 0, fokus_x: 0.5, fokus_y: 0.4, zoom: 1.6, sorot: [], foto: '' };
const naskah = process.env.ANTHROPIC_API_KEY
  ? await buatNaskahVideo(produk, contoh.situs, '', null, layar, kecilkan)
  : {
    hook: { judul: 'Jangan buka toko tanpa aplikasi ini', sorot: 'aplikasi ini', coretan: 'serius, gratis!' },
    adegan: [
      { ...k, teks: 'Masih nyatat penjualan di buku tulis?', atas: 'judul', sorot: ['buku'], foto: 'Indonesian shop owner writing sales in a notebook' },
      { ...k, teks: 'Kenalin, Maktaba POS. Kasir pintar dari HP.', atas: 'hp', layar: 1 },
      { ...k, teks: 'Pilih barang, bayar, struk langsung ke WhatsApp.', atas: 'layar', layar: 0, fokus_x: 0.5, fokus_y: 0.2, zoom: 1, sorot: ['WhatsApp'] },
      { ...k, teks: 'Omzet hari ini langsung kelihatan.', atas: 'layar', layar: 1, fokus_x: 0.5, fokus_y: 0.4, zoom: 1, sorot: ['omzet'] },
      { ...k, teks: 'Untungnya juga kehitung otomatis.', atas: 'layar', layar: 2, fokus_x: 0.5, fokus_y: 0.6, zoom: 1, sorot: ['untungnya', 'otomatis'] },
      { ...k, teks: 'Coba gratis sekarang, cek link di bio!', atas: 'cta', sorot: ['gratis'] },
    ],
    ajakan: 'Coba gratis',
  };
console.log('📝', naskah.sumber ?? 'naskah contoh', JSON.stringify(naskah.adegan.map((a) => [a.atas, a.teks])));

const foto = process.argv[2] ? [path.resolve(process.argv[2])] : [];
const rencana = rencanaAdegan(naskah.adegan, { layar, foto, hook: naskah.hook });
const peramban = await bukaPeramban();
try {
  const r = await susunIklan({
    folder, rencana, peramban, keluar: path.join(folder, 'iklan-maktaba.mp4'), musik: process.env.STUDIO_MUSIK || null,
    kartu: { tema: temaMerek({ nama: 'Maktaba POS', profil: { aksen: '#F5C542', situs: 'bakafrawi.com' } }), produk, logo: pathToFileURL(path.join(DIR, '..', 'public', 'produk', 'maktaba-logo.png')).href, ajakan: naskah.ajakan, kontak: contoh.situs.kontak },
  });
  console.log(`✅ ${r.berkas} (${r.total.toFixed(1)} dtk)`);
} finally {
  await peramban.close();
}
