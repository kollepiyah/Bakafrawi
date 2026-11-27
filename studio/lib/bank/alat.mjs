// alat.mjs — menjalankan ffmpeg/ffprobe dan pembantu berkas.
import { spawn } from 'node:child_process'
import { rename, rm, stat } from 'node:fs/promises'

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

/**
 * Bitrate video (kbps) agar total berkas ≤ batasMb. Murni.
 * Dipakai supaya video panjang tidak ditolak Storage Supabase (batas 50 MB paket Free → galat 413).
 */
export function hitungTargetBitrateKbps(durasiDetik, batasMb = 42, audioKbps = 128) {
  const detik = Math.max(10, Number(durasiDetik) || 60)
  const maksTotalKbps = Math.floor((batasMb * 1024 * 8 * 0.92) / detik)
  return Math.max(650, Math.min(3800, maksTotalKbps - audioKbps))
}

/**
 * Kecilkan video bila lebih besar dari batasMb (re-encode H.264 sesuai durasi). Menimpa berkas asli.
 * → { berkas, dikompres, ukuranAwal, ukuranAkhir }
 */
export async function kompresVideoJikaBesar(berkas, { batasMb = 44, log = console.log } = {}) {
  const batas = batasMb * 1024 * 1024
  const ukuranAwal = (await stat(berkas)).size
  if (ukuranAwal <= batas) return { berkas, dikompres: false, ukuranAwal, ukuranAkhir: ukuranAwal }

  const durasi = (await probe(berkas).catch(() => ({ durasi: 120 }))).durasi || 120
  const temp = `${berkas}.kompres.mp4`
  const enkode = async (bitrateKbps, audioKbps) => {
    await ffmpeg([
      '-y', '-i', berkas,
      '-c:v', 'libx264', '-preset', 'medium',
      '-b:v', `${bitrateKbps}k`, '-maxrate', `${Math.round(bitrateKbps * 1.25)}k`, '-bufsize', `${bitrateKbps * 2}k`,
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', `${audioKbps}k`,
      temp,
    ])
    return (await stat(temp)).size
  }

  try {
    let ukuranAkhir = await enkode(hitungTargetBitrateKbps(durasi, batasMb - 2, 128), 128)
    if (ukuranAkhir > 47 * 1024 * 1024) {
      ukuranAkhir = await enkode(hitungTargetBitrateKbps(durasi, 36, 96), 96)
    }
    await rename(temp, berkas)
    log(`🗜 Video dikecilkan ${(ukuranAwal / 1048576).toFixed(1)} MB → ${(ukuranAkhir / 1048576).toFixed(1)} MB agar muat di Storage`)
    return { berkas, dikompres: true, ukuranAwal, ukuranAkhir }
  } catch (e) {
    await rm(temp, { force: true }).catch(() => {})
    throw e
  }
}

export const tidur = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Jalankan ulang `kerja` bila gagal, dengan jeda bertambah. Untuk layanan yang sering putus sesaat
 * (edge-tts: "Stream closed before the synthesis completed" / ECONNRESET, 18–19 Nov 2026).
 */
export async function ulangi(kerja, jeda = [2000, 5000, 12000]) {
  for (let i = 0; ; i++) {
    try {
      return await kerja(i)
    } catch (e) {
      if (i >= jeda.length) throw e
      await tidur(jeda[i])
    }
  }
}
