// bank.mjs — mengindeks folder bank media ke agent.bank_media.
//
// Susunan folder (subfolder = tag):
//   <bank>\racik\*.mp4|jpg   <bank>\menu\Kopi Lek\*.jpg   <bank>\suasana\...
//   <bank>\logo\logo.png     <bank>\musik\*.mp3
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { probe } from './alat.mjs'

const FOTO = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const VIDEO = new Set(['.mp4', '.mov', '.m4v'])
const MUSIK = new Set(['.mp3', '.m4a', '.wav'])

export function jenisBerkas(rel) {
  const ext = path.extname(rel).toLowerCase()
  const atas = rel.split(/[\\/]/)[0].toLowerCase()
  if (atas === 'logo' && FOTO.has(ext)) return 'logo'
  if (atas === 'musik' && MUSIK.has(ext)) return 'musik'
  if (FOTO.has(ext)) return 'foto'
  if (VIDEO.has(ext)) return 'video'
  return null
}

/** 'menu\\Kopi Lek\\a.jpg' → 'menu/Kopi Lek'; berkas di akar → 'umum'. */
export function tagDari(rel) {
  const bagian = rel.split(/[\\/]/).slice(0, -1)
  return bagian.length ? bagian.join('/') : 'umum'
}

async function* jelajah(dir, akar) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* jelajah(p, akar)
    else yield path.relative(akar, p)
  }
}

/** Isi folder bank di disk sebagai [{ rel, kunci }] (kunci = ukuran:waktu ubah). */
export async function daftarLokal(akar) {
  const hasil = []
  for await (const rel of jelajah(akar, akar)) {
    const st = await stat(path.join(akar, rel))
    hasil.push({ rel, kunci: `${st.size}:${st.mtimeMs}` })
  }
  return hasil
}

/**
 * Sinkronkan isi bank ke database. Memulangkan ringkasan.
 * Versi tiap berkas disimpan di kolom `versi`, jadi hanya berkas baru/berubah yang di-probe —
 * penting di mode awan, tempat probe berarti mengunduh dari Google Drive.
 * @param opsi.daftar  () → [{ rel, kunci }] (bawaan: folder di disk)
 * @param opsi.siapkan (paths) → unduh berkas sebelum di-probe (bawaan: tidak apa-apa)
 */
export async function indeksBank(sql, akar, opsi = {}) {
  const isi = opsi.daftar ? await opsi.daftar() : await daftarLokal(akar)
  const siapkan = opsi.siapkan ?? (async () => {})
  const db = new Map((await sql`select path, versi from agent.bank_media`).map((r) => [r.path, r]))
  const ada = new Set()
  let baru = 0
  for (const { rel, kunci } of isi) {
    const jenis = jenisBerkas(rel)
    if (!jenis) continue
    const penuh = path.join(akar, rel)
    ada.add(penuh)
    const lama = db.get(penuh)
    if (lama?.versi === kunci) continue
    // Baris dari sebelum ada kolom versi: dianggap tidak berubah — cukup catat versinya, tanpa unduh.
    if (lama && lama.versi == null) {
      await sql`update agent.bank_media set versi = ${kunci} where path = ${penuh}`
      continue
    }
    await siapkan([penuh])
    let info = { durasi: null, lebar: null, tinggi: null }
    // Foto ikut di-probe supaya ukurannya tercatat: foto kecil (< 1080 px) buram
    // saat diperbesar ke layar tegak, dan itu perlu diketahui Kyai.
    info = await probe(penuh).catch(() => info)
    await sql`insert into agent.bank_media (path, tag, jenis, durasi, lebar, tinggi, versi, diperbarui_at)
              values (${penuh}, ${tagDari(rel)}, ${jenis}, ${info.durasi}, ${info.lebar}, ${info.tinggi}, ${kunci}, now())
              on conflict (path) do update set tag = excluded.tag, jenis = excluded.jenis, durasi = excluded.durasi,
                lebar = excluded.lebar, tinggi = excluded.tinggi, versi = excluded.versi, diperbarui_at = now()`
    baru++
  }
  // Bank terbaca kosong padahal database berisi: hampir pasti folder salah / Drive tidak terbaca.
  // Jangan hapus apa-apa — kurasi puluhan berkas bisa hilang karena satu salah ketik.
  if (!ada.size && db.size) return { total: 0, baru, hilang: 0, kosong: true }
  const hilang = [...db.keys()].filter((p) => !ada.has(p))
  if (hilang.length) await sql`delete from agent.bank_media where path = any(${hilang})`
  return { total: ada.size, baru, hilang: hilang.length }
}
