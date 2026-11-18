// =====================================================================
//  mata.mjs — pekerjaan "melihat" Studio (KB §81):
//    • kurasiBank: foto/video bank yang belum dilihat → kurasi;
//    • pelajariReferensi: video IG merek + folder referensi → analisis
//      per video → rangkuman gaya merek.
//  Bakafrawi Studio (18 Nov 2026): penyimpanan lewat objek `db` per merek (dbMata di
//  merek-bank.mjs), bukan sql skema agent Lek Kopi; kredensial IG berbentuk studio_kredensial.
// =====================================================================
import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { ffmpeg, probe } from './alat.mjs'
import { bobotReferensi, normalKurasi, parameterGaya, ringkasPotong, waktuPotong } from './gaya.mjs'
import { aiSiap, analisisReferensi, kurasiMedia, rangkumGaya } from './otak.mjs'
import { argLembar } from './rakit.mjs'

const BATCH_KURASI = 25

/**
 * Kurasi paling banyak BATCH_KURASI berkas per putaran (biaya & waktu terkendali).
 * `siapkan` (paths) memastikan berkasnya ada di disk (mode awan: unduh dari Drive).
 */
export async function kurasiBank(db, folderKerja, catat, siapkan = async () => {}) {
  if (!aiSiap()) return 0
  const daftar = await db.belumKurasi(BATCH_KURASI)
  if (!daftar.length) return 0
  const kerja = path.join(folderKerja, '_kurasi')
  await mkdir(kerja, { recursive: true })
  let n = 0
  for (const m of daftar) {
    const lembar = path.join(kerja, `k${n}.jpg`)
    try {
      await siapkan([m.path])
      await ffmpeg(argLembar(m.path, m.jenis === 'video'
        ? { durasi: Number(m.durasi), n: 4, kolom: 2, lebar: 384, keluar: lembar }
        : { keluar: lembar, lebar: 384 }))
      const { data, pakai } = await kurasiMedia(lembar, m)
      const k = normalKurasi(data, m)
      await db.simpanKurasi(m.path, k)
      await catat('kurasi', `${m.tag}: ${k.deskripsi}`, { pemakaian: pakai })
      n++
    } catch (e) {
      // Berkas rusak/tak terbaca: tandai supaya tidak dicoba terus-menerus.
      await db.simpanKurasi(m.path, { galat: e.message.slice(0, 200), kualitas: 1 })
      await catat('galat', `kurasi ${m.path}: ${e.message}`)
    }
  }
  await rm(kerja, { recursive: true, force: true })
  return n
}

// ------------------------------------------------------------ referensi

const VIDEO = /\.(mp4|mov|m4v)$/i

async function unduh(url, ke) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`unduh ${r.status}`)
  await writeFile(ke, Buffer.from(await r.arrayBuffer()))
}

/**
 * Reels milik akun IG yang tersambung. Videonya hanya diunduh (ke folder referensi/ig) kalau
 * belum pernah dianalisis — yang sudah cukup diperbarui statistiknya.
 */
/** ig = data studio_kredensial instagram merek (ig_token, ig_host, ig_user_id) atau null. */
async function ambilIg(ig, folder, catat, sudah) {
  if (!ig?.ig_token) return []
  const k = { data: { token: ig.ig_token, host: ig.ig_host, user_id: ig.ig_user_id } }
  const versi = process.env.IG_API_VERSI || 'v27.0'
  const q = new URLSearchParams({
    fields: 'id,caption,media_type,media_product_type,media_url,permalink,timestamp,like_count,comments_count',
    limit: '30', access_token: k.data.token,
  })
  // Token gaya Facebook memakai graph.facebook.com dengan ID akun IG bisnis.
  const host = k.data.host === 'facebook' ? 'graph.facebook.com' : 'graph.instagram.com'
  const milik = k.data.host === 'facebook' ? k.data.user_id : 'me'
  const r = await fetch(`https://${host}/${versi}/${milik}/media?${q}`)
  const j = await r.json()
  if (!r.ok || j.error) { await catat('galat', `IG media: ${j.error?.message ?? r.status}`); return [] }
  const hasil = []
  await mkdir(path.join(folder, 'ig'), { recursive: true })
  for (const m of j.data ?? []) {
    if (m.media_type !== 'VIDEO' || !m.media_url) continue
    const berkas = path.join(folder, 'ig', `${m.id}.mp4`)
    const perlu = !sudah.has(`ig:${m.id}`)
    if (perlu && !existsSync(berkas)) await unduh(m.media_url, berkas).catch(() => null)
    if (perlu && !existsSync(berkas)) continue
    const statistik = { suka: m.like_count ?? 0, komentar: m.comments_count ?? 0 }
    // Tayangan/simpan/bagikan butuh izin instagram_business_manage_insights; kalau belum ada, lewati.
    try {
      const ins = await (await fetch(`https://${host}/${versi}/${m.id}/insights?${new URLSearchParams({ metric: 'views,saved,shares', access_token: k.data.token })}`)).json()
      for (const d of ins.data ?? []) {
        const v = d.values?.[0]?.value ?? d.total_value?.value
        if (d.name === 'views') statistik.tayangan = v
        if (d.name === 'saved') statistik.simpan = v
        if (d.name === 'shares') statistik.bagikan = v
      }
    } catch { /* statistik tambahan opsional */ }
    hasil.push({ id: `ig:${m.id}`, sumber: 'ig', path: berkas, permalink: m.permalink, caption: m.caption ?? '', diposting_at: m.timestamp, statistik })
  }
  return hasil
}

/** Video di akar folder referensi. `daftar` (mode awan) = isi folder referensi di Drive. */
async function berkasFolder(folder, daftar) {
  let nama
  if (daftar) nama = (await daftar()).map((f) => f.rel).filter((rel) => !rel.includes('/'))
  else if (!existsSync(folder)) return []
  else nama = (await readdir(folder, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name)
  return nama.filter((n) => VIDEO.test(n)).map((n) => {
    const p = path.join(folder, n)
    // id = nama berkas saja: folder kerja di server GitHub bisa berbeda tiap putaran.
    return { id: `berkas:${n}`, sumber: 'berkas', path: p, caption: '', statistik: {} }
  })
}

/** Ritme potongan lewat deteksi pergantian adegan (showinfo menulis ke stderr). */
async function potonganVideo(berkas, durasi) {
  const err = await new Promise((ok) => {
    const p = spawn(process.env.STUDIO_FFMPEG || 'ffmpeg', ['-hide_banner', '-i', berkas, '-vf', "select='gt(scene,0.3)',showinfo", '-an', '-f', 'null', '-'], { windowsHide: true })
    let s = ''
    p.stderr.on('data', (d) => { s += d })
    p.on('close', () => ok(s))
    p.on('error', () => ok(''))
  })
  return ringkasPotong(waktuPotong(err), durasi)
}

/**
 * Analisis referensi baru, lalu rangkum gaya kalau ada yang baru atau
 * Kyai meminta (/gaya ulang). Memulangkan ringkasan gaya baru atau null.
 * @param opsi.daftar  (mode awan) isi folder referensi di Drive
 * @param opsi.siapkan (mode awan) unduh video referensi sebelum dianalisis
 */
export async function pelajariReferensi(db, folderReferensi, folderKerja, catat, opsi = {}) {
  if (!aiSiap()) return null
  const sudah = await db.referensiSudah()
  const sumber = [...await ambilIg(opsi.ig, folderReferensi, catat, sudah), ...await berkasFolder(folderReferensi, opsi.daftar)]
  const kerja = path.join(folderKerja, '_referensi')
  await mkdir(kerja, { recursive: true })
  let baru = 0
  for (const v of sumber) {
    // Statistik IG diperbarui setiap kali, walau videonya sudah dianalisis.
    if (sudah.has(v.id)) {
      await db.perbaruiStatistik(v.id, v.statistik)
      continue
    }
    try {
      await opsi.siapkan?.([v.path])
      const { durasi } = await probe(v.path)
      const potong = await potonganVideo(v.path, durasi)
      const lembar = path.join(kerja, `r${baru}.jpg`)
      await ffmpeg(argLembar(v.path, { durasi, n: 9, kolom: 3, lebar: 240, keluar: lembar }))
      const { data, pakai } = await analisisReferensi(lembar, { durasi, potong, caption: v.caption, statistik: v.statistik })
      await db.simpanReferensi({ id: v.id, sumber: v.sumber, permalink: v.permalink ?? null, caption: v.caption, diposting_at: v.diposting_at ?? null, durasi, potong, statistik: v.statistik, analisis: data })
      await catat('referensi', data.ringkas, { pemakaian: pakai })
      baru++
    } catch (e) {
      await catat('galat', `referensi ${v.path}: ${e.message}`)
    }
  }
  await rm(kerja, { recursive: true, force: true })

  const minta = await db.mintaUlang()
  if (!baru && !minta) return null
  const semua = await db.semuaReferensi()
  if (!semua.length) {
    await db.simpanGaya(null)
    return null
  }
  const daftar = semua.map((r) => ({
    bobot: Math.round(bobotReferensi(r.statistik) * 100) / 100,
    durasi: Number(r.durasi), potong: r.potong, caption: (r.caption ?? '').slice(0, 400), analisis: r.analisis,
  }))
  const { data, pakai } = await rangkumGaya(daftar)
  // Simpan profil apa adanya + versi yang sudah dijepit, supaya yang dipakai render selalu aman.
  const profil = { ...data, render: parameterGaya(data.render), jumlah_referensi: daftar.length }
  await db.simpanGaya({ profil, ringkasan: data.ringkasan })
  await catat('gaya', data.ringkasan, { pemakaian: pakai, referensi: daftar.length })
  return { ringkasan: data.ringkasan, jumlah: daftar.length, baru }
}

