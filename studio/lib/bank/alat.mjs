// alat.mjs — menjalankan ffmpeg/ffprobe dan pembantu berkas.
import { spawn } from 'node:child_process'

export function jalankan(perintah, args, opsi = {}) {
  return new Promise((ok, gagal) => {
    const p = spawn(perintah, args, { cwd: opsi.cwd, windowsHide: true })
    let err = ''
    let out = ''
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-20000) })
    p.on('error', (e) => gagal(new Error(`${perintah} tidak bisa dijalankan (${e.message}). Sudah dipasang?`)))
    p.on('close', (kode) => (kode === 0 ? ok(out) : gagal(new Error(`${perintah} gagal (${kode}): ${err.slice(-600)}`))))
  })
}

export const ffmpeg = (args, opsi) => jalankan(process.env.STUDIO_FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], opsi)

/** Durasi (detik) + ukuran media lewat ffprobe. */
export async function probe(berkas) {
  const out = await jalankan(process.env.STUDIO_FFPROBE || 'ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration:stream=width,height,codec_type,color_transfer', '-of', 'json', berkas,
  ])
  const j = JSON.parse(out)
  const v = (j.streams ?? []).find((s) => s.codec_type === 'video')
  return {
    durasi: Number(j.format?.duration) || 0,
    lebar: v?.width ?? null,
    tinggi: v?.height ?? null,
    // HLG (iPhone) atau PQ: perlu dipetakan ke SDR sebelum diedit (rakit.mjs KE_SDR).
    hdr: ['arib-std-b67', 'smpte2084'].includes(v?.color_transfer),
  }
}

export const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
