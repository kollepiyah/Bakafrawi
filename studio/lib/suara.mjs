import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Narasi lewat edge-tts (paket msedge-tts, tanpa akun) — suara yang sama dipakai cadangan Studio Lek Kopi.
const SUARA = () => process.env.STUDIO_SUARA || 'id-ID-ArdiNeural';
const LAJU = () => process.env.STUDIO_LAJU || '+4%';

const aman = (t) => t.replace(/[<>&]/g, ' ');

export async function bacakan(teks, keluar) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const tts = new MsEdgeTTS();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'suara-'));
  try {
    await tts.setMetadata(SUARA(), OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioFilePath } = await tts.toFile(dir, aman(teks), { rate: LAJU() });
    await copyFile(audioFilePath, keluar);
  } finally {
    tts.close?.();
    await rm(dir, { recursive: true, force: true });
  }
  return keluar;
}
