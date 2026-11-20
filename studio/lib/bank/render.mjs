// render.mjs — naskah → MP4 1080×1920 (KB §77, §81, §97).
//
// Dua bentuk video (naskah_json.mode):
//   • sinematik (bawaan sejak 15 Nov 2026): TANPA suara — musik latar, potongan
//     jatuh di ketukan musik, transisi xfade antar-klip, judul serif.
//   • narasi (naskah lama / pilihan Kyai): suara per adegan + subtitle + musik pelan.
// Sesudah dirender, hasilnya diperiksa "mata" AI; adegan yang gambarnya tidak
// cocok diganti klipnya dan dirender ulang (maks 2 kali).
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ffmpeg, probe } from './alat.mjs'
import { parameterGaya } from './gaya.mjs'
import { FOLDER_HURUF, pilihPaket, terapkanHuruf } from './huruf.mjs'
import { cariKetukan, sesuaikanKeKetukan, YAKIN_MINIMAL } from './irama.mjs'
import { adaGambarAi, buatGambarAi, pemakaianGambar, siapkanAdeganAi } from './gambar-ai.mjs'
import { aiSiap, jumlahPemakaian, periksaHasil, pilihKlip } from './otak.mjs'
import {
  argAkhir, argLembar, argMusik, argPcm, argSambung, argSegmen, argSuara, benih, buatAss, daftarConcat,
  daftarKlip, daftarTransisi, jumlahShot, petakanSaran, pilihShot, rencana,
} from './rakit.mjs'
import { suaraAdegan } from './suara.mjs'
import { remotionSiap, renderSinematikRemotion } from '../video.mjs'

const MAKS_PERIKSA = 2

/** Nomor adegan (mulai 1) untuk tiap bingkai lembar pemeriksa; 0 = penutup. */
export function petaBingkai(r, n) {
  return Array.from({ length: n }, (_, i) => {
    const t = ((i + 0.5) / n) * r.total
    const a = r.adegan.findIndex((x) => t >= x.mulai && t < x.mulai + x.durasi)
    return a + 1
  })
}

/** Durasi adegan sinematik dari naskah, lalu digeser supaya batas adegan jatuh di ketukan musik. */
async function durasiSinematik(naskah, musik, kerja, catatan) {
  const rencanaAwal = naskah.adegan.map((a) => Number(a.durasi) || 2.5)
  if (!musik) return rencanaAwal
  try {
    await ffmpeg(argPcm(musik, 'musik.pcm'), { cwd: kerja })
    const b = await readFile(path.join(kerja, 'musik.pcm'))
    const irama = cariKetukan(new Int16Array(b.buffer, b.byteOffset, Math.floor(b.length / 2)))
    if (irama.yakin < YAKIN_MINIMAL) {
      catatan.push('ketukan musik kurang jelas — potongan dibagi rata')
      return rencanaAwal
    }
    catatan.push(`potongan mengikuti ketukan musik (${Math.round(irama.bpm)} BPM)`)
    return sesuaikanKeKetukan(rencanaAwal, irama.ketukan)
  } catch (e) {
    catatan.push(`ketukan musik gagal dibaca: ${e.message.slice(0, 80)}`)
    return rencanaAwal
  }
}

/**
 * @param konten baris content_items (id, naskah_json)
 * @param bank   baris bank_media (dengan kurasi bila ada)
 * @param folderHasil folder keluaran (mis. D:\Lek Kopi Konten\hasil)
 * @param opsi.profilGaya profil dari agent.gaya
 * @param opsi.pengaturan agent.pengaturan_kantor() (filter, transisi, musik_volume)
 * @param opsi.buatSuara pengganti pembuat suara (teks, berkas) — uji tanpa jaringan
 * @param opsi.periksa false = lewati pemeriksa AI
 * @param opsi.pilihAI false = lewati sutradara AI (klip dipilih dari tag & kata saja)
 * @param opsi.siapkan (paths) → pastikan berkas bank ada di disk (mode awan: unduh dari Google Drive)
 * @param opsi.buatGambar pengganti pembuat gambar AI (deskripsi, rasio, keluar) — uji tanpa jaringan
 */
export async function renderKonten(konten, bank, folderHasil, opsi = {}) {
  // Pengaturan Kantor AI (layar aplikasi) mengalahkan gaya hasil belajar; '' = ikut hasil belajar.
  const atur = opsi.pengaturan ?? {}
  // Huruf berganti per video (paket dari stok) supaya video tidak berwajah sama terus.
  const paket = pilihPaket(benih(konten.id))
  const gaya = terapkanHuruf(parameterGaya(opsi.profilGaya, { filter: atur.filter || undefined, transisi: atur.transisi || undefined }), paket)
  const siapkan = opsi.siapkan ?? (async () => {})
  if (Number(atur.musik_volume) > 0) gaya.sinematik.musikVolume = Math.min(1, Math.max(0.3, Number(atur.musik_volume) / 100))
  let naskah = konten.naskah_json
  if (!naskah?.adegan?.length) throw new Error('Naskah kosong')
  const sinematik = naskah.mode === 'sinematik'
  const kerja = path.join(folderHasil, '_kerja', String(konten.id))
  await rm(kerja, { recursive: true, force: true })
  await mkdir(kerja, { recursive: true })
  // Disalin ke folder kerja: fontsdir relatif menghindari titik dua "D:" yang merusak sintaks filter.
  await cp(FOLDER_HURUF, path.join(kerja, 'huruf'), { recursive: true })

  const logo = bank.find((m) => m.jenis === 'logo')?.path
  const musikSemua = bank.filter((m) => m.jenis === 'musik')
  const musik = musikSemua.length ? musikSemua[benih(konten.id) % musikSemua.length].path : null
  await siapkan([logo, musik].filter(Boolean))
  const catatan = [`huruf: ${paket.tebal} · ${paket.judul}`]
  const pakaiAI = [] // pemilih klip & pemeriksa — dijumlah ke hasil.pemakaian

  // 0a. Foto produk ASLI dari aplikasi kedai (adegan.foto_url): diunduh langsung & diprioritaskan daripada gambar AI.
  const mediaProduk = []
  let jumlahFotoApp = 0
  const adeganDenganProduk = []
  for (let i = 0; i < naskah.adegan.length; i++) {
    const a = naskah.adegan[i]
    if (a.foto_url && /^https?:\/\//i.test(a.foto_url)) {
      try {
        const res = await fetch(a.foto_url, { signal: AbortSignal.timeout(12_000) })
        if (res.ok) {
          const ct = res.headers.get('content-type') || ''
          const ext = ct.includes('png') ? '.png' : ct.includes('webp') ? '.webp' : '.jpg'
          const berkas = path.join(kerja, `produk-${i}${ext}`)
          await writeFile(berkas, Buffer.from(await res.arrayBuffer()))
          const tagBaru = `produk/${i}`
          mediaProduk.push({ path: berkas, tag: tagBaru, jenis: 'foto', ai: true, kurasi: { kualitas: 5, deskripsi: a.teks_layar || a.bidikan || '' } })
          adeganDenganProduk.push({ ...a, tag: tagBaru })
          jumlahFotoApp++
          continue
        }
      } catch (e) {
        catatan.push(`foto produk adegan ${i + 1} gagal diunduh: ${String(e.message ?? e).slice(0, 80)}`)
      }
    }
    adeganDenganProduk.push(a)
  }
  if (jumlahFotoApp) {
    naskah = { ...naskah, adegan: adeganDenganProduk }
    bank = [...bank, ...mediaProduk]
    catatan.push(`${jumlahFotoApp} foto produk asli dari aplikasi dipakai`)
  }

  // 0b. Adegan bertag "ai": gambar AI jadi media tiruan bertag ai/<n>, dihidupkan zoompan/Ken Burns.
  const ai = await siapkanAdeganAi(naskah.adegan, bank, kerja,
    opsi.buatGambar ?? (adaGambarAi() ? buatGambarAi : null))
  if (ai.jumlah || ai.catatan.length) {
    naskah = { ...naskah, adegan: ai.adegan }
    bank = [...bank, ...ai.media]
    catatan.push(...ai.catatan)
    if (ai.jumlah) catatan.push(`${ai.jumlah} gambar AI dihidupkan`)
    pakaiAI.push(pemakaianGambar(ai.jumlah, ai.biayaUsd))
  }

  // 1. Durasi adegan: dari suara (narasi, sekali saja walau gambar dirender ulang) atau
  //    dari naskah + ketukan musik (sinematik).
  let suara = []
  let durasi
  if (sinematik) {
    if (!musik) catatan.push('⚠️ bank belum punya musik (folder bank\\musik) — video ini tanpa suara')
    else catatan.push(`musik: ${path.basename(musik)}`)
    durasi = await durasiSinematik(naskah, musik, kerja, catatan)
  } else {
    const hasilSuara = await suaraAdegan(naskah.adegan.map((a) => a.suara), kerja,
      opsi.buatSuara ? { buat: (t, f) => opsi.buatSuara(t, f), jalur: 'edge' } : {})
    if (hasilSuara.catatan) catatan.push(hasilSuara.catatan)
    suara = hasilSuara.berkas
    durasi = []
    for (const f of suara) durasi.push((await probe(f)).durasi)
  }

  const keluar = path.join(folderHasil, `${new Date().toISOString().slice(0, 10)}_${String(konten.id).slice(0, 8)}.mp4`)
  const panjangKlip = new Map(bank.map((m) => [m.path, Number(m.durasi) || 0]))
  const hdr = new Map()
  const cekHdr = async (p) => {
    if (!hdr.has(p)) hdr.set(p, (await probe(p)).hdr)
    return hdr.get(p)
  }
  const dilarang = new Set()
  let r
  let media

  // Sutradara AI: urutan klip per adegan dari deskripsi kurasi (sekali per video). Gagal → pemilih lama.
  let saran = []
  if (opsi.pilihAI !== false && aiSiap()) {
    try {
      const daftar = daftarKlip(bank.filter((m) => !m.ai))
      const pk = await pilihKlip(naskah, daftar)
      pakaiAI.push(pk.pakai)
      saran = petakanSaran(pk.data, daftar, naskah.adegan.length)
      // Adegan gambar AI & foto produk asli tidak diatur sutradara: klipnya sudah pasti gambar itu sendiri.
      naskah.adegan.forEach((a, i) => { if (/^(ai|produk)\//.test(String(a.tag))) saran[i] = [] })
    } catch (e) {
      catatan.push(`pemilih klip AI gagal: ${e.message}`)
    }
  }

  let sampulAkhir = null
  const pakaiRemotion = opsi.mesin !== 'ffmpeg' && process.env.STUDIO_BANK_MESIN !== 'ffmpeg' && remotionSiap()

  for (let percobaan = 0; ; percobaan++) {
    // 2. Pilih klip per potongan (tempo dari gaya) — klip yang ditolak pemeriksa tidak dipakai lagi.
    media = pilihShot(naskah.adegan, bank, benih(konten.id) + percobaan, jumlahShot(durasi, gaya, { tetap: sinematik }), dilarang, saran)
    r = rencana(naskah.adegan, durasi, media, { logo, latarPenutup: process.env.STUDIO_LATAR_PENUTUP, tetap: sinematik })

    await siapkan([...new Set(r.segmen.map((s) => s.sumber))])

    let suksesRemotion = false
    if (pakaiRemotion) {
      try {
        const resRem = await renderSinematikRemotion({
          rencana: r,
          merek: opsi.merekInfo ?? {},
          logo,
          musik,
          musikVolume: gaya.sinematik.musikVolume,
          suara,
          gaya: opsi.gayaPreset || 'sinematik-kafe',
          folder: kerja,
          keluar,
        })
        if (resRem.sampul) {
          const tujuanSampul = `${keluar}.jpg`
          await cp(resRem.sampul, tujuanSampul)
          sampulAkhir = tujuanSampul
        }
        if (percobaan === 0) catatan.push(`mesin: Remotion Sinematik (${opsi.gayaPreset || 'sinematik-kafe'})`)
        suksesRemotion = true
      } catch (e) {
        catatan.push(`Remotion gagal (${String(e.message ?? e).slice(0, 100)}), beralih ke FFmpeg`)
      }
    }

    if (!suksesRemotion) {
      const transisi = sinematik ? daftarTransisi(r, gaya.sinematik.transisi) : []
      const segBerkas = []
      for (const s of r.segmen) {
        if (s.jenis === 'video') s.hdr = await cekHdr(s.sumber)
        const nama = `seg_${s.indeks}.mp4`
        // Sinematik: segmen diperpanjang sebesar transisi sesudahnya (xfade memakan ekor segmen ini).
        const tambah = transisi[s.indeks]?.durasi ?? 0
        const sPanjang = tambah ? {
          ...s, durasi: Math.round((s.durasi + tambah) * 1000) / 1000, tambal: true,
          ulang: s.ulang || (s.jenis === 'video' && panjangKlip.get(s.sumber) < s.mulaiKlip + s.durasi + tambah),
        } : s
        await ffmpeg(argSegmen(sPanjang, nama, gaya), { cwd: kerja })
        segBerkas.push(nama)
      }
      if (sinematik) {
        await ffmpeg(argSambung(segBerkas, r.segmen.map((s) => s.durasi), transisi, 'gambar.mp4'), { cwd: kerja })
      } else {
        await writeFile(path.join(kerja, 'daftar.txt'), daftarConcat(segBerkas))
        await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', 'daftar.txt', '-c', 'copy', 'gambar.mp4'], { cwd: kerja })
      }

      // 3. Suara + gambar. Subtitle memakai nama relatif: path Windows ber-titik
      //    dua (D:) merusak sintaks filter `subtitles=`.
      await writeFile(path.join(kerja, 'sub.ass'), buatAss(r, { gaya }))
      if (sinematik) {
        await ffmpeg(argMusik({ musik, total: r.total, keluar: 'audio.wav', volume: gaya.sinematik.musikVolume }), { cwd: kerja })
      } else {
        await ffmpeg(argSuara({ suara: suara.map((f) => path.basename(f)), r, musik, keluar: 'audio.wav', gaya }), { cwd: kerja })
      }
      await ffmpeg(argAkhir({ video: 'gambar.mp4', audio: 'audio.wav', total: r.total, ass: 'sub.ass', logo, keluar, huruf: 'huruf', penutup: r.penutup?.mulai ?? null }), { cwd: kerja })
      const tujuanSampul = `${keluar}.jpg`
      await ffmpeg(['-y', '-ss', '1.2', '-i', keluar, '-frames:v', '1', '-q:v', '3', tujuanSampul]).then(() => { sampulAkhir = tujuanSampul }).catch(() => null)
    }

    // 4. Pemeriksa AI.
    if (opsi.periksa === false || !aiSiap()) break
    const n = 6
    await ffmpeg(argLembar(keluar, { durasi: r.total, n, kolom: 3, lebar: 300, keluar: 'periksa.jpg' }), { cwd: kerja })
    let hasil
    try {
      const ph = await periksaHasil(path.join(kerja, 'periksa.jpg'), naskah, petaBingkai(r, n))
      pakaiAI.push(ph.pakai)
      hasil = ph.data
    } catch (e) {
      catatan.push(`pemeriksa AI gagal: ${e.message}`)
      break
    }
    if (hasil.lolos || !hasil.bermasalah?.length) { catatan.push(`diperiksa AI: lolos${percobaan ? ` (sesudah ${percobaan} kali ganti klip)` : ''}`); break }
    if (percobaan >= MAKS_PERIKSA) { catatan.push(`catatan pemeriksa AI: ${hasil.alasan}`); break }
    for (const no of hasil.bermasalah) for (const m of media[no - 1] ?? []) dilarang.add(m.path)
    catatan.push(`ganti klip adegan ${hasil.bermasalah.join(', ')}: ${hasil.alasan}`)
  }

  await rm(kerja, { recursive: true, force: true })
  return {
    berkas: keluar, sampul: sampulAkhir, durasi: r.total, media: media.flat().map((m) => m.path), catatan, mode: sinematik ? 'sinematik' : 'narasi',
    pemakaian: jumlahPemakaian(pakaiAI),
  }
}
