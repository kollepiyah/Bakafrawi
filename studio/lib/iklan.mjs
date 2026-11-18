// Gaya iklan Reels "kekinian" (19 Nov 2026, Kyai menilai video lama monoton & subtitle tak sinkron):
//   • hook ≤ 2 dtk langsung bicara masalah, tanpa kartu diam;
//   • satu adegan per kalimat (1,5–3 dtk), tiap adegan bergerak: zoom halus ke bagian penting,
//     HP melayang miring, kartu ajakan — dirangkai transisi pendek + bunyi whoosh;
//   • subtitle 2–3 kata, kata yang sedang diucapkan disorot, waktunya dari batas kata edge-tts
//     (bukan dibagi rata per huruf seperti perakit lama);
//   • musik latar yang mengecil otomatis saat narasi bicara (sidechain).
import { copyFile, cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ffmpeg, probe, ulangi } from './bank/alat.mjs';
import { FOLDER_HURUF } from './bank/huruf.mjs';
import { potret } from './peramban.mjs';
import { htmlIklan, TENGAH_SUBTITLE } from './templat.mjs';

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const TRANSISI = 0.3;
const JENIS_TRANSISI = ['zoomin', 'slideup', 'smoothleft', 'circleopen', 'slideleft', 'fadewhite'];

// ------------------------------------------------------------ suara + waktu kata

const aman = (t) => String(t).replace(/[<>&]/g, ' ');

/** Narasi satu adegan + waktu tiap kata (detik dari awal berkas). Diulang bila edge-tts memutus. */
export async function suaraKata(teks, keluar, { suara = process.env.STUDIO_SUARA || 'id-ID-ArdiNeural', laju = '+8%' } = {}) {
  return ulangi(async () => {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
    const tts = new MsEdgeTTS();
    const dir = await mkdtemp(path.join(os.tmpdir(), 'iklan-suara-'));
    try {
      await tts.setMetadata(suara, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
      const r = await tts.toFile(dir, aman(teks), { rate: laju });
      if (!(await stat(r.audioFilePath)).size) throw new Error('edge-tts mengirim suara kosong');
      await copyFile(r.audioFilePath, keluar);
      const meta = r.metadataFilePath ? JSON.parse(await readFile(r.metadataFilePath, 'utf8')) : { Metadata: [] };
      return { berkas: keluar, durasi: (await probe(keluar)).durasi, kata: kataDariMetadata(meta) };
    } finally {
      try { tts.close(); } catch { /* sudah tertutup */ }
      await rm(dir, { recursive: true, force: true });
    }
  });
}

/** Metadata WordBoundary edge-tts (satuan 100 ns) → [{ teks, mulai, selesai }] dalam detik. */
export function kataDariMetadata(meta) {
  return (meta?.Metadata ?? [])
    .filter((m) => m.Type === 'WordBoundary' && m.Data?.text?.Text)
    .map((m) => ({ teks: m.Data.text.Text, mulai: m.Data.Offset / 1e7, selesai: (m.Data.Offset + m.Data.Duration) / 1e7 }));
}

// ------------------------------------------------------------ jadwal & subtitle (murni)

/**
 * Jadwal adegan: tiap adegan selama suaranya + jeda, adegan berikutnya mulai TRANSISI lebih awal
 * (ditimpa transisi). Memulangkan [{ mulai, durasi, suaraMulai }] dan total.
 */
export function jadwal(durasiSuara, { jeda = 0.35, minimal = 1.6, awalSuara = 0.12 } = {}) {
  let t = 0;
  const adegan = durasiSuara.map((d, i) => {
    const durasi = Math.max(minimal, d + jeda + (i ? TRANSISI : 0));
    const a = { mulai: t, durasi, suaraMulai: t + (i ? TRANSISI : 0) + awalSuara };
    t += durasi - TRANSISI;
    return a;
  });
  return { adegan, total: t + TRANSISI };
}

/**
 * Kelompokkan kata jadi potongan subtitle ≤ maks kata; titik/koma/tanya mengakhiri potongan. Tiap
 * frasa dibagi rata (4 kata → 2+2, bukan 3+1) supaya tak ada satu kata yatim seperti "BIO!".
 */
export function kelompokKata(kata, maks = 3) {
  const frasa = [];
  let f = [];
  for (const w of kata) {
    f.push(w);
    if (/[.,!?]$/.test(w.teks)) {
      frasa.push(f);
      f = [];
    }
  }
  if (f.length) frasa.push(f);
  return frasa.flatMap((fr) => {
    const n = Math.ceil(fr.length / maks);
    const hasil = [];
    let i = 0;
    for (let k = 0; k < n; k++) {
      const ukuran = Math.floor(fr.length / n) + (k < fr.length % n ? 1 : 0);
      hasil.push(fr.slice(i, i + ukuran));
      i += ukuran;
    }
    return hasil;
  });
}

const waktuAss = (d) => {
  const j = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60), s = d % 60;
  return `${j}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};
const bersih = (t) => String(t).replace(/[{}\\]/g, '').replace(/[.,!;:]+$/, '');
const pokok = (t) => bersih(t).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Kata disorot (serif miring): yang ditandai Claude, mengandung angka, atau bagian nama produk. */
export function kataSorot(teks, sorot = [], nama = '') {
  const daftar = new Set([...sorot.flatMap((x) => String(x).split(/\s+/)), ...String(nama).split(/\s+/)].map(pokok).filter(Boolean));
  return /\d/.test(teks) || daftar.has(pokok(teks));
}

/**
 * ASS subtitle gaya Reels teknologi: 1–2 kata sekali tampil di pita tengah layar, muncul dengan pop.
 * Kata sorot memakai serif miring, kata lain huruf tebal kecil. adegan: [{ kata, suaraMulai,
 * tone: 'terang'|'gelap', sorot }]. Tiap potongan tampil sampai potongan berikutnya mulai.
 */
export function assKata(adegan, { tengah = 1065, tebal = 'Archivo Black', serif = 'DM Serif Display', nama = '' } = {}) {
  const baris = [];
  for (const a of adegan) {
    const warna = a.tone === 'gelap' ? '&H00FFFFFF&' : '&H00151515&';
    for (const potong of kelompokKata(a.kata, 2)) {
      const teks = potong.map((w) => (kataSorot(w.teks, a.sorot, nama)
        ? `{\\fn${serif}\\i1\\fs118}${bersih(w.teks)}`
        : `{\\fn${tebal}\\i0\\fs96}${bersih(w.teks).toLowerCase()}`)).join(' ');
      const mulai = a.suaraMulai + potong[0].mulai;
      const akhir = a.suaraMulai + potong.at(-1).selesai + 0.3;
      baris.push({ mulai, akhir, teks: `{\\an5\\pos(${W / 2},${tengah})\\c${warna}\\fscx86\\fscy86\\t(0,90,\\fscx100\\fscy100)}${teks}` });
    }
  }
  // Tak boleh ada dua baris tampil bersamaan (ASS menumpuknya): tiap baris berhenti saat baris berikutnya mulai.
  baris.sort((p, q) => p.mulai - q.mulai);
  baris.forEach((b, i) => { if (baris[i + 1]) b.akhir = Math.min(b.akhir, baris[i + 1].mulai); });
  const dialog = baris.filter((b) => b.akhir > b.mulai).map((b) => `Dialogue: 0,${waktuAss(b.mulai)},${waktuAss(b.akhir)},Kata,,0,0,0,,${b.teks}`);
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kata,${tebal},96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialog.join('\n')}
`;
}

// ------------------------------------------------------------ adegan → klip

const kurva = (a, b) => `(${a}+(${b}-${a})*(on/N)*(on/N)*(3-2*(on/N)))`; // smoothstep a→b

/**
 * Gambar tegak resolusi tinggi → klip 1080×1920 yang bergerak: zoom z0→z1 sambil menggeser fokus
 * (fx,fy relatif 0–1 terhadap pita 9:16 yang dipilih). pita = posisi atas pita 9:16 (0–1) di gambar
 * yang lebih tinggi dari 9:16. posisi = letak titik fokus di layar (0,42 = agak ke atas, supaya
 * angka yang disorot tidak tertutup kotak subtitle di sepertiga bawah).
 */
export async function klipGerak(gambar, keluar, durasi, { z0 = 1, z1 = 1.25, f0 = [0.5, 0.5], f1 = [0.5, 0.5], pita = 0, posisi = 0.5 } = {}) {
  const info = await probe(gambar);
  const lebar = info.lebar, tinggi = info.tinggi;
  const tPita = Math.min(tinggi, Math.round((lebar * 16) / 9));
  const y = Math.round(Math.max(0, tinggi - tPita) * pita);
  const N = Math.round(durasi * FPS);
  const fx = kurva(f0[0], f1[0]).replace(/N/g, N), fy = kurva(f0[1], f1[1]).replace(/N/g, N), z = kurva(z0, z1).replace(/N/g, N);
  const filter = [
    `crop=${lebar}:${tPita}:0:${y}`,
    `scale=${W * 2}:${H * 2}:flags=lanczos`,
    `zoompan=z='${z}':x='max(0,min(iw-iw/zoom,${fx}*iw-iw/zoom/2))':y='max(0,min(ih-ih/zoom,${fy}*ih-${posisi}*ih/zoom))':d=${N}:s=${W}x${H}:fps=${FPS}`,
    'setsar=1,format=yuv420p',
  ].join(',');
  await ffmpeg(['-y', '-loop', '1', '-i', gambar, '-vf', filter, '-frames:v', String(N), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', keluar]);
  return keluar;
}

// ------------------------------------------------------------ rencana adegan (murni)

const jepit = (v, a, b) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : (a + b) / 2));

/**
 * Naskah adegan Claude → rencana render. layar: [{ berkas, lebar, tinggi }]; foto: berkas foto AI per
 * nomor adegan (null bila gagal/tanpa kunci). Tiap adegan → { teks, sorot, tone, atas, bawah, gerak }:
 * atas = isi kartu separuh atas, bawah = foto terakhir yang sudah muncul (pengganti wajah pembicara).
 */
export function rencanaAdegan(adegan, { layar = [], foto = [], hook = {} } = {}) {
  const ambilLayar = (i) => (layar.length ? layar[((Math.trunc(i) || 0) % layar.length + layar.length) % layar.length] : null);
  let bawah = null;
  return adegan.map((a, i) => {
    if (foto[i]) bawah = foto[i];
    const dasarBawah = { variasi: i };
    const l = ambilLayar(a.layar);
    let jenis = i === 0 ? 'judul' : a.atas;
    if ((jenis === 'layar' || jenis === 'hp') && !l) jenis = 'logo';
    const dasar = { ...dasarBawah, teks: String(a.teks).trim(), sorot: a.sorot ?? [], gerak: { z0: 1, z1: 1.06, f0: [0.5, 0.45], f1: [0.5, 0.42] } };
    if (jenis === 'cta') return { ...dasar, tone: 'terang', atas: { jenis: 'cta' }, bawah: null };
    if (jenis === 'judul') return { ...dasar, tone: 'terang', atas: { jenis: 'judul', judul: hook.judul || a.teks, sorot: hook.sorot ?? '', coretan: hook.coretan ?? '' }, bawah };
    if (jenis === 'hp') {
      const lain = layar.filter((x) => x !== l).slice(0, 2).map((x) => x.berkas);
      return { ...dasar, tone: 'terang', atas: { jenis: 'hp', layar: [l.berkas, ...lain] }, bawah };
    }
    if (jenis === 'layar') {
      return {
        ...dasar, tone: 'gelap', bawah,
        atas: { jenis: 'layar', berkas: l.berkas, lebar: l.lebar, tinggi: l.tinggi, fx: jepit(a.fokus_x, 0, 1), fy: jepit(a.fokus_y, 0, 1), zoom: jepit(a.zoom, 1, 1.15) },
        // Zoom mendatar dibatasi 1,15: UI HP berupa kartu selebar layar, potongan yang lebih sempit
        // memotong teks di tepi dan terlihat asal. Kesan "zoom" datang dari pita setinggi kartu + dorongan pelan.
        gerak: { z0: 1, z1: 1.1, f0: [0.5, 0.45], f1: [0.5, 0.3] },
      };
    }
    return { ...dasar, tone: 'terang', atas: { jenis: 'logo' }, bawah };
  });
}

// ------------------------------------------------------------ musik & bunyi (buatan sendiri, bebas hak cipta)

/** Beat lo-fi sederhana (kick, clap, hi-hat, akor Am–F–C–G, bass) — cadangan bila belum ada musik pilihan. */
export async function musikContoh(keluar, durasi, bpm = 104) {
  const b = (60 / bpm).toFixed(4);
  const akor = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  const i = `mod(floor(t/(8*${b})),4)`;
  const pilih = (n) => akor.reduceRight((acc, c, k) => `if(eq(${i},${k}),${c[n]},${acc})`, akor[0][n]);
  const pad = [0, 1, 2].map((n) => `sin(2*PI*${pilih(n)}*t)`).join('+');
  const tb = `mod(t,${b})`;
  const ekspresi = [
    `0.55*sin(2*PI*(45+90*exp(-25*${tb}))*${tb})*exp(-7*${tb})`,
    `0.22*(random(0)*2-1)*exp(-18*mod(t+${b},2*${b}))`,
    `0.07*(random(1)*2-1)*exp(-70*mod(t+${b}/2,${b}))`,
    `0.045*(${pad})*(0.75+0.25*sin(2*PI*0.5*t))`,
    `0.22*sin(2*PI*(${pilih(0)}/2)*t)*exp(-3*${tb})`,
  ].join('+');
  // Rumus dikutip: koma di dalam if(...) jangan dibaca sebagai pemisah filter.
  await ffmpeg(['-y', '-f', 'lavfi', '-i', `aevalsrc=exprs='${ekspresi}':s=44100:d=${durasi.toFixed(2)}`,
    '-af', `lowpass=f=9000,afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, durasi - 1.2).toFixed(2)}:d=1.2,alimiter=limit=0.9`, keluar]);
  return keluar;
}

export async function whoosh(keluar) {
  await ffmpeg(['-y', '-f', 'lavfi', '-i', 'anoisesrc=d=0.5:color=pink:amplitude=0.7',
    '-af', 'highpass=f=700,lowpass=f=6000,afade=t=in:d=0.28,afade=t=out:st=0.28:d=0.22,volume=0.5', keluar]);
  return keluar;
}

// ------------------------------------------------------------ rakit

/**
 * klip: berkas mp4 per adegan (durasi sesuai jadwal). suara: [{ berkas }] per adegan. musik: berkas
 * atau null (dibuat musikContoh). Memulangkan durasi total.
 */
export async function rakitIklan({ folder, klip, jadwalAdegan, total, suara, ass, musik, keluar }) {
  await cp(FOLDER_HURUF, path.join(folder, 'huruf'), { recursive: true });
  await writeFile(path.join(folder, 'teks.ass'), ass);

  // 1. Gambar: rantai xfade + subtitle.
  const vIn = klip.flatMap((k) => ['-i', k]);
  const f = [];
  let akhir = '[0:v]';
  for (let i = 1; i < klip.length; i++) {
    const nama = i === klip.length - 1 ? '[vx]' : `[x${i}]`;
    f.push(`${akhir}[${i}:v]xfade=transition=${JENIS_TRANSISI[(i - 1) % JENIS_TRANSISI.length]}:duration=${TRANSISI}:offset=${jadwalAdegan[i].mulai.toFixed(3)}${nama}`);
    akhir = nama;
  }
  f.push(`${klip.length > 1 ? '[vx]' : '[0:v]'}ass=teks.ass:fontsdir=huruf,format=yuv420p[v]`);
  await ffmpeg(['-y', ...vIn, '-filter_complex', f.join(';'), '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', String(FPS), 'gambar.mp4'], { cwd: folder });

  // 2. Suara: narasi tiap adegan di tempatnya, musik mengecil saat narasi (sidechain), whoosh di tiap transisi.
  const lagu = musik ?? await musikContoh(path.join(folder, 'musik.wav'), total);
  const desir = await whoosh(path.join(folder, 'whoosh.wav'));
  const aIn = [...suara.flatMap((s) => ['-i', s.berkas]), '-i', lagu, ...jadwalAdegan.slice(1).flatMap(() => ['-i', desir])];
  const nS = suara.length;
  const af = [];
  suara.forEach((_, i) => af.push(`[${i}:a]adelay=${Math.round(jadwalAdegan[i].suaraMulai * 1000)}:all=1,apad[n${i}]`));
  af.push(`${suara.map((_, i) => `[n${i}]`).join('')}amix=inputs=${nS}:normalize=0,atrim=duration=${total.toFixed(2)},asplit=2[nar][kunci]`);
  af.push(`[${nS}:a]atrim=duration=${total.toFixed(2)},volume=0.55[lagu]`);
  af.push('[lagu][kunci]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[laguk]');
  jadwalAdegan.slice(1).forEach((a, i) => af.push(`[${nS + 1 + i}:a]adelay=${Math.round(Math.max(0, a.mulai - 0.12) * 1000)}:all=1,apad[w${i}]`));
  const w = jadwalAdegan.slice(1).map((_, i) => `[w${i}]`).join('');
  af.push(`[nar][laguk]${w}amix=inputs=${2 + jadwalAdegan.length - 1}:normalize=0,atrim=duration=${total.toFixed(2)},alimiter=limit=0.95[a]`);
  await ffmpeg(['-y', ...aIn, '-filter_complex', af.join(';'), '-map', '[a]', '-ar', '44100', 'suara.wav'], { cwd: folder });

  // 3. Satukan.
  await ffmpeg(['-y', '-i', 'gambar.mp4', '-i', 'suara.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', keluar], { cwd: folder });
  return total;
}

/**
 * Seluruh alur satu video iklan dari rencana adegan → { berkas, total, sampul }.
 * kartu: data kartu HTML bersama ({ tema, produk, logo, ajakan, kontak }).
 */
export async function susunIklan({ folder, rencana, peramban, kartu, musik = null, keluar, log = console.log }) {
  const suara = [];
  for (const [i, a] of rencana.entries()) {
    suara.push(await suaraKata(a.teks, path.join(folder, `suara-${i}.mp3`)));
    log(`🎙 ${i + 1}: ${suara[i].durasi.toFixed(2)} dtk, ${suara[i].kata.length} kata`);
  }
  const { adegan: jadwalAdegan, total } = jadwal(suara.map((s) => s.durasi));

  const url = (b) => (b && !/^(https?|file):/.test(b) ? pathToFileURL(b).href : b);
  const huruf = { tebal: url(path.join(FOLDER_HURUF, 'ArchivoBlack-Regular.ttf')), tangan: url(path.join(FOLDER_HURUF, 'Kalam-Bold.ttf')) };
  const klip = [];
  for (const [i, a] of rencana.entries()) {
    const gambar = path.join(folder, `kartu-${i}.png`);
    const atas = { ...a.atas, berkas: url(a.atas.berkas), layar: a.atas.layar?.map(url) };
    await potret(peramban, { w: W, h: H, skala: 2, keluar: gambar, html: htmlIklan({ ...kartu, atas, bawah: url(a.bawah), variasi: a.variasi, tone: a.tone, huruf }) });
    klip.push(await klipGerak(gambar, path.join(folder, `klip-${i}.mp4`), jadwalAdegan[i].durasi, a.gerak));
  }

  const ass = assKata(rencana.map((a, i) => ({ kata: suara[i].kata, suaraMulai: jadwalAdegan[i].suaraMulai, tone: a.tone, sorot: a.sorot })), { tengah: TENGAH_SUBTITLE, nama: kartu.produk?.nama ?? '' });
  await rakitIklan({ folder, klip, jadwalAdegan, total, suara, ass, musik, keluar });
  // Sampul Reels: bingkai detik ke-1 (judul besar + subtitle pembuka sudah tampil).
  const sampul = path.join(folder, 'sampul.jpg');
  await ffmpeg(['-y', '-ss', '1', '-i', keluar, '-frames:v', '1', '-q:v', '3', sampul]);
  return { berkas: keluar, total, sampul };
}

export const _uji = { kurva };
