import { copyFile, mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ulangi } from './bank/alat.mjs';

// Narasi lewat edge-tts (paket msedge-tts, tanpa akun) — suara yang sama dipakai cadangan Studio Lek Kopi.
const SUARA = () => process.env.STUDIO_SUARA || 'id-ID-ArdiNeural';
const LAJU = () => process.env.STUDIO_LAJU || '+4%';

const aman = (t) => t.replace(/[<>&]/g, ' ');

async function sekali(teks, keluar) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const tts = new MsEdgeTTS();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'suara-'));
  try {
    await tts.setMetadata(SUARA(), OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioFilePath } = await tts.toFile(dir, aman(teks), { rate: LAJU() });
    if (!(await stat(audioFilePath)).size) throw new Error('edge-tts mengirim berkas suara kosong');
    await copyFile(audioFilePath, keluar);
  } finally {
    try { tts.close?.(); } catch { /* sudah tertutup */ }
    await rm(dir, { recursive: true, force: true });
  }
}

/** edge-tts layanan tak resmi yang sering memutus sesaat: dicoba sampai 4 kali sebelum menyerah. */
export async function bacakan(teks, keluar) {
  await ulangi(() => sekali(teks, keluar)).catch((e) => {
    throw new Error(`Suara narasi gagal 4 kali (edge-tts): ${e?.message ?? e}`);
  });
  return keluar;
}
