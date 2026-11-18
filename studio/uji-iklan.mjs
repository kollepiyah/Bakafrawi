// Contoh video gaya iklan (prototipe untuk dinilai Kyai, 19 Nov 2026) — Maktaba POS.
//   node uji-iklan.mjs   (butuh server pratinjau Maktaba di :5174 sudah dipotret ke keluaran/iklan-bahan)
// Naskah ditulis tangan di sini; setelah gaya disetujui, naskah & pilihan adegan ditulis Claude.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assKata, jadwal, klipGerak, rakitIklan, suaraKata } from './lib/iklan.mjs';
import { bukaPeramban, potret } from './lib/peramban.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BAHAN = path.join(DIR, 'keluaran', 'iklan-bahan');
const url = (p) => pathToFileURL(p).href;
const HURUF = url(path.join(DIR, 'huruf', 'ArchivoBlack-Regular.ttf'));
const LOGO = url(path.join(DIR, '..', 'public', 'produk', 'maktaba-logo.png'));
const EMAS = '#F5C542';

const tunggu = `<script>Promise.all([document.fonts.ready,...[...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))]).then(()=>document.body.setAttribute('data-siap',''))</script>`;
const dasar = (isi) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Tebal;src:url('${HURUF}')}
*{margin:0;padding:0;box-sizing:border-box} body{width:1080px;height:1920px;overflow:hidden;position:relative;background:#0c0e12;font-family:Tebal,sans-serif;color:#fff}
.glow{position:absolute;inset:0;background:radial-gradient(circle at 75% 18%,rgba(245,197,66,.35),transparent 45%),radial-gradient(circle at 15% 85%,rgba(80,120,255,.22),transparent 45%)}
</style></head><body>${isi}${tunggu}</body></html>`;

const HTML = {
  hook: dasar(`<div style="position:absolute;inset:-60px;background:url('${url(path.join(BAHAN, 'pos.png'))}') center/cover;filter:blur(22px) brightness(.32) saturate(1.2)"></div><div class="glow"></div>
    <div style="position:absolute;left:0;right:0;top:330px;text-align:center;font-size:150px;letter-spacing:-4px;color:${EMAS};transform:rotate(-6deg)">📒 ✏️ 😵‍💫</div>`),
  hp: dasar(`<div class="glow"></div>
    <div style="position:absolute;top:120px;left:0;right:0;text-align:center;font-size:58px;letter-spacing:2px;color:${EMAS}">MAKTABA POS</div>
    <div style="position:absolute;left:50%;top:250px;width:560px;margin-left:-280px;padding:18px;border-radius:70px;background:#05070a;border:4px solid rgba(255,255,255,.18);
      box-shadow:0 80px 140px -30px rgba(0,0,0,.95),0 0 120px rgba(245,197,66,.25);transform:perspective(1800px) rotateY(-16deg) rotateX(7deg) rotateZ(3deg)">
      <img src="${url(path.join(BAHAN, 'dasbor.png'))}" style="display:block;width:100%;border-radius:54px"></div>`),
  cta: dasar(`<div class="glow"></div>
    <div style="position:absolute;top:230px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:44px;text-align:center">
      <img src="${LOGO}" style="width:300px;height:300px;border-radius:70px;box-shadow:0 40px 90px -20px rgba(245,197,66,.55)">
      <div style="font-size:96px;letter-spacing:-1px">MAKTABA POS</div>
      <div style="font-family:sans-serif;font-size:44px;color:#c9ced8">Kasir pintar untuk toko & UMKM</div>
      <div style="margin-top:20px;background:${EMAS};color:#1a1408;border-radius:999px;padding:34px 80px;font-size:62px;box-shadow:0 30px 70px -20px rgba(245,197,66,.7)">COBA GRATIS →</div>
      <div style="font-family:sans-serif;font-size:40px;color:#9aa1ad">Link di bio · bakafrawi.com</div>
    </div>`),
};

// Satu kalimat per adegan. gambar = tangkapan layar pratinjau (data rekaan) atau kartu HTML di atas.
const ADEGAN = [
  { teks: 'Masih nyatat penjualan di buku tulis?', gaya: 'hook', kartu: 'hook', gerak: { z0: 1, z1: 1.18 } },
  { teks: 'Kenalin, Maktaba POS. Kasir pintar, cukup dari HP.', kartu: 'hp', gerak: { z0: 1.02, z1: 1.12, f0: [0.5, 0.42], f1: [0.5, 0.38] } },
  { teks: 'Pilih barang, bayar, struknya langsung ke WhatsApp.', gambar: 'pos.png', gerak: { z0: 1, z1: 1.45, f0: [0.5, 0.5], f1: [0.3, 0.33] } },
  { teks: 'Omzet hari ini langsung kelihatan.', gambar: 'dasbor.png', gerak: { z0: 1.05, z1: 1.6, f0: [0.5, 0.45], f1: [0.33, 0.38] } },
  { teks: 'Untungnya juga kehitung otomatis.', gambar: 'laporan.png', gerak: { z0: 1, z1: 1.55, f0: [0.5, 0.5], f1: [0.32, 0.66] } },
  { teks: 'Coba gratis sekarang. Cek link di bio!', kartu: 'cta', gerak: { z0: 1, z1: 1.07 } },
];

const folder = path.join(DIR, 'keluaran', `iklan-${Date.now()}`);
await mkdir(folder, { recursive: true });
console.log('📁', folder);

// 1. Suara + waktu kata tiap adegan.
const suara = [];
for (const [i, a] of ADEGAN.entries()) {
  suara.push(await suaraKata(a.teks, path.join(folder, `suara-${i}.mp3`)));
  console.log(`🎙 ${i + 1}: ${suara[i].durasi.toFixed(2)} dtk, ${suara[i].kata.length} kata`);
}
const { adegan: jadwalAdegan, total } = jadwal(suara.map((s) => s.durasi));

// 2. Kartu HTML → PNG resolusi 2× (tajam saat dizoom).
const peramban = await bukaPeramban();
try {
  for (const [nama, html] of Object.entries(HTML)) {
    const h = await peramban.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
    await writeFile(path.join(folder, `kartu-${nama}.html`), html);
    await h.goto(url(path.join(folder, `kartu-${nama}.html`)));
    await h.waitForSelector('body[data-siap]', { timeout: 30000 });
    await h.screenshot({ path: path.join(folder, `kartu-${nama}.png`) });
    await h.close();
  }
} finally {
  await peramban.close();
}
void potret;

// 3. Klip bergerak per adegan.
const klip = [];
for (const [i, a] of ADEGAN.entries()) {
  const gambar = a.kartu ? path.join(folder, `kartu-${a.kartu}.png`) : path.join(BAHAN, a.gambar);
  klip.push(await klipGerak(gambar, path.join(folder, `klip-${i}.mp4`), jadwalAdegan[i].durasi, a.gerak));
  console.log(`🎞 klip ${i + 1} (${jadwalAdegan[i].durasi.toFixed(2)} dtk)`);
}

// 4. Rakit: transisi, subtitle kata, musik + whoosh.
const ass = assKata(ADEGAN.map((a, i) => ({ kata: suara[i].kata, suaraMulai: jadwalAdegan[i].suaraMulai, gaya: a.gaya })), { aksen: '#F5C542' });
const keluar = path.join(folder, 'iklan-maktaba.mp4');
await rakitIklan({ folder, klip, jadwalAdegan, total, suara, ass, musik: process.env.STUDIO_MUSIK || null, keluar });
console.log(`✅ ${keluar} (${total.toFixed(1)} dtk)`);
