// Bahan suara video iklan: narasi edge-tts dengan waktu tiap kata (dipakai caption kata-per-kata
// Remotion — dulu subtitle dibagi rata per huruf sehingga tak sinkron) dan musik latar contoh buatan
// ffmpeg (bebas hak cipta) selama Kyai belum memilih lagu.
import { copyFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ffmpeg, probe, ulangi } from './bank/alat.mjs';

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
