import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { LAYAR } from './templat.mjs';

const jalankan = promisify(execFile);
export const DURASI_PEMBUKA = 3.0;
export const DURASI_PENUTUP = 3.2;

export async function durasi(berkas) {
  const { stdout } = await jalankan('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', berkas]);
  return Number.parseFloat(stdout) || 0;
}

const waktu = (d) => {
  const j = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60), s = d % 60;
  return `${j}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};

/** Subtitle per kalimat narasi; lama tiap kalimat sebanding panjang hurufnya. */
export function buatAss(kalimat, mulai, total) {
  const huruf = kalimat.reduce((n, k) => n + k.length, 0) || 1;
  let t = mulai;
  const baris = kalimat.map((k) => {
    const lama = (k.length / huruf) * total;
    const b = `Dialogue: 0,${waktu(t)},${waktu(t + lama)},Teks,,0,0,0,,${k.replace(/\n/g, ' ')}`;
    t += lama;
    return b;
  });
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Teks,DejaVu Sans,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&HC0101216,1,0,0,0,100,100,0,0,3,18,0,2,${LAYAR.x + 30},${LAYAR.x + 30},300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${baris.join('\n')}
`;
}

/**
 * Rakit video 1080×1920: kartu pembuka → rekaman di dalam bingkai HP (+ subtitle) → kartu penutup,
 * dengan narasi di bawahnya. Semua berkas berada di `folder` (ffmpeg dijalankan dari sana supaya
 * jalur subtitle tak perlu di-escape — di Windows titik dua "C:" merusak filter ass).
 */
export async function rakitVideo({ folder, rekaman, mulaiRekaman, bingkai, pembuka, penutup, narasi, kalimat, keluar }) {
  const lamaNarasi = await durasi(narasi);
  const lamaRekaman = Math.max(0, (await durasi(rekaman)) - mulaiRekaman);
  // Bagian tengah sepanjang narasi (dikurangi yang sudah terbacakan di pembuka), minimal 8 detik.
  const tengah = Math.max(8, lamaNarasi - DURASI_PEMBUKA + 1.2);
  const total = DURASI_PEMBUKA + tengah + DURASI_PENUTUP;
  await writeFile(path.join(folder, 'teks.ass'), buatAss(kalimat, DURASI_PEMBUKA + 0.2, Math.min(lamaNarasi, tengah) - 0.4));

  const { x, y, w, h } = LAYAR;
  const filter = [
    // Kartu pembuka & penutup "dihidupkan": zoom pelan (Ken Burns). Diperbesar dulu 2× supaya
    // gerak zoompan tidak bergetar.
    `[0:v]scale=2160:3840,zoompan=z='min(zoom+0.0009,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,setsar=1,format=yuv420p[a]`,
    // Rekaman dipotong dari detik layak tampil; bila lebih pendek dari narasi, bingkai terakhir ditahan.
    `[1:v]trim=start=${mulaiRekaman.toFixed(2)},setpts=PTS-STARTPTS,fps=30,scale=${w}:${h},setsar=1,tpad=stop_mode=clone:stop_duration=${Math.ceil(tengah)},trim=duration=${tengah.toFixed(2)}[rek]`,
    `color=c=0x0c0e12:s=1080x1920:r=30:d=${tengah.toFixed(2)}[dasar]`,
    `[dasar][rek]overlay=${x}:${y}[isi]`,
    `[isi][2:v]overlay=0:0,ass=teks.ass,setsar=1,format=yuv420p[b]`,
    `[3:v]scale=2160:3840,zoompan=z='min(zoom+0.0006,1.07)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,setsar=1,format=yuv420p[c]`,
    `[a][b][c]concat=n=3:v=1:a=0[v]`,
    `[4:a]adelay=300|300,apad,atrim=duration=${total.toFixed(2)},afade=t=out:st=${(total - 0.6).toFixed(2)}:d=0.6[au]`,
  ].join(';');
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', '30', '-loop', '1', '-t', String(DURASI_PEMBUKA), '-i', pembuka,
    '-i', rekaman,
    '-loop', '1', '-t', tengah.toFixed(2), '-i', bingkai,
    '-framerate', '30', '-loop', '1', '-t', String(DURASI_PENUTUP), '-i', penutup,
    '-i', narasi,
    '-filter_complex', filter,
    '-map', '[v]', '-map', '[au]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-r', '30',
    keluar,
  ];
  await jalankan('ffmpeg', args, { cwd: folder, maxBuffer: 1 << 26 });
  return { total, lamaRekaman };
}
