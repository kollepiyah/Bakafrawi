// Narasi tiap adegan dengan edge-tts + waktu per kata → public/narasi/*.mp3 dan src/data/suara.json,
// plus musik latar contoh (buatan ffmpeg, bebas hak cipta) → public/musik.mp3.
//   npm run siapkan   (dijalankan ulang setiap kali narasi di src/data/script.ts diubah)
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { musikContoh, suaraKata } from '../lib/iklan.mjs';
import { naskahContoh } from './src/data/script.ts';

const DIR = path.dirname(fileURLToPath(import.meta.url));
await mkdir(path.join(DIR, 'public', 'narasi'), { recursive: true });

const suara = [];
for (const [i, a] of naskahContoh.adegan.entries()) {
  const berkas = `narasi/adegan-${i + 1}.mp3`;
  const s = await suaraKata(a.narasi, path.join(DIR, 'public', berkas));
  suara.push({ berkas, durasi: Number(s.durasi.toFixed(3)), kata: s.kata.map((k) => ({ teks: k.teks, mulai: Number(k.mulai.toFixed(3)), selesai: Number(k.selesai.toFixed(3)) })) });
  console.log(`🎙 ${i + 1}. ${a.jenis}: ${s.durasi.toFixed(2)} dtk, ${s.kata.length} kata`);
}
const total = suara.reduce((n, s) => n + s.durasi + 0.8, 0) + 2;
await musikContoh(path.join(DIR, 'public', 'musik.mp3'), total);
await writeFile(path.join(DIR, 'src', 'data', 'suara.json'), `${JSON.stringify({ suara, musik: 'musik.mp3' }, null, 2)}\n`);
console.log('✅ src/data/suara.json + public/musik.mp3');
