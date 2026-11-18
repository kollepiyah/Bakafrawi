// drive.mjs — bank, referensi, dan hasil di Google Drive lewat rclone (mode awan, KB §103).
//
// Studio tetap bekerja dengan path lokal (folder BANK/HASIL/REFERENSI di server GitHub);
// modul ini memetakan path lokal ↔ "<remote>/<bagian>/<relatif>" dan hanya mengunduh
// berkas yang benar-benar dipakai — bank tidak pernah diunduh utuh.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { jalankan } from './alat.mjs'

const rclone = (args) => jalankan(process.env.STUDIO_RCLONE || 'rclone', args)

/**
 * @param remote mis. 'gdrive:Lek Kopi Konten'
 * @param akar   { bank, hasil, referensi } → folder lokal; nama kuncinya = nama folder di Drive
 * @param jalan  pengganti rclone (uji)
 */
export function buatDrive(remote, akar, jalan = rclone) {
  const dasar = remote.replace(/\/+$/, '')

  /** Path lokal → path Drive, atau null kalau di luar semua akar. */
  function keDrive(lokal) {
    for (const [nama, folder] of Object.entries(akar)) {
      const rel = path.relative(folder, lokal)
      if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return `${dasar}/${nama}/${rel.split(path.sep).join('/')}`
    }
    return null
  }

  return {
    keDrive,

    /** Isi satu bagian (mis. 'bank') sebagai [{ rel, kunci }]; kunci berubah kalau berkasnya berubah. */
    async daftar(nama) {
      let out
      try {
        out = await jalan(['lsjson', '-R', '--files-only', '--no-mimetype', '--drive-skip-gdocs', `${dasar}/${nama}`])
      } catch (e) {
        // Hanya "folder belum dibuat" yang berarti kosong. Galat login/token harus menggagalkan
        // putaran — kalau ditelan, bank terbaca kosong dan run tetap hijau (16 Nov 2026).
        if (/directory not found/i.test(e.message)) return []
        throw e
      }
      return JSON.parse(out || '[]').map((f) => ({ rel: f.Path, kunci: `${f.Size}:${f.ModTime}` }))
    },

    /** Pastikan berkas-berkas ini ada di disk; yang belum diunduh dari Drive. */
    async siapkan(daftar) {
      for (const lokal of daftar) {
        if (!lokal || existsSync(lokal)) continue
        const sumber = keDrive(lokal)
        if (!sumber) continue
        await jalan(['copyto', sumber, lokal])
      }
    },

    /** Unggah berkas lokal ke tempatnya di Drive (mis. hasil render). */
    async simpan(lokal) {
      const tujuan = keDrive(lokal)
      if (!tujuan) throw new Error(`Berkas di luar folder Studio: ${lokal}`)
      await jalan(['copyto', lokal, tujuan])
      return tujuan
    },
  }
}
