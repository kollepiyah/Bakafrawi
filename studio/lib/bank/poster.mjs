// poster.mjs — Studio gambar: postingan feed, carousel, dan story Instagram (KB §105).
//
// Naskah gambar ditulis Lek AI di bot (konten_murni.ts): tiap slide berisi judul, sub,
// stiker, menu (harga diisi bot dari data kasir, bukan dikarang AI), tag foto bank, dan
// pilihan gaya + palet. Di sini slide disusun sebagai halaman HTML dari cetakan buatan
// tangan, lalu dipotret Chromium jadi JPEG (Instagram hanya menerima JPEG). Desain bebas
// buatan AI sengaja tidak dipakai: teks kepotong / bertumpuk sulit dijaga per gambar.
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ffmpeg } from './alat.mjs'
import { adaGambarAi, buatGambarAi, galatKuota, pemakaianGambar, rapikanHasil } from './gambar-ai.mjs'
import { FOLDER_HURUF, pilihPaket } from './huruf.mjs'

export const UKURAN = { feed: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } }
export const GAYA_GAMBAR = ['editorial', 'pop', 'minimal', 'retro', 'gelap', 'kolase']

// bg = dasar, ink = tulisan di atas dasar, aksen = sorotan, lembut = teks kedua.
export const PALET = {
  kopi: { bg: '#2B1D14', ink: '#F5EBDD', aksen: '#C58F5C', lembut: '#D9C7AE', gelap: true },
  krem: { bg: '#F4EADB', ink: '#2B1D14', aksen: '#B5651D', lembut: '#6B5442', gelap: false },
  matcha: { bg: '#E6EFD8', ink: '#22361A', aksen: '#6E9B3A', lembut: '#4B6340', gelap: false },
  stroberi: { bg: '#FCE4EC', ink: '#5E1530', aksen: '#E8457A', lembut: '#8E4A62', gelap: false },
  mangga: { bg: '#FFF1CF', ink: '#5A3104', aksen: '#F29F05', lembut: '#8A5A1C', gelap: false },
  cokelat: { bg: '#4A2C20', ink: '#FBEFE3', aksen: '#F2C14E', lembut: '#E3CDB8', gelap: true },
  'hitam-emas': { bg: '#111111', ink: '#F5EBDD', aksen: '#E8C27A', lembut: '#BFB3A3', gelap: true },
}
export const NAMA_PALET = Object.keys(PALET)

// Huruf teks kecil: Segoe UI di PC Windows, Liberation Sans (bawaan Chrome) di server GitHub.
const SANS = "'Segoe UI',Roboto,'Liberation Sans',Arial,sans-serif"

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const rpTeks = (n) => 'Rp' + Math.round(Number(n)).toLocaleString('id-ID')
const urlBerkas = (p) => (p ? pathToFileURL(p).href : '')

/** Nama keluarga huruf → berkas di folder huruf ('Abril Fatface' → AbrilFatface-Regular.ttf). */
export function berkasHuruf(keluarga, folder = FOLDER_HURUF) {
  const dasar = keluarga.replace(/\s+/g, '')
  for (const akhir of ['-Regular.ttf', '-Bold.ttf']) {
    const p = path.join(folder, dasar + akhir)
    if (existsSync(p)) return p
  }
  return null
}

function cssHuruf(paket) {
  return Object.values(paket).map((k) => {
    const f = berkasHuruf(k)
    return f ? `@font-face{font-family:'${k}';src:url('${urlBerkas(f)}')}` : ''
  }).join('\n')
}

// Logo Lek Kopi putih di kotak hitam: 'screen' menghapus kotaknya di latar gelap,
// dibalik + 'multiply' di latar terang.
const logoCss = (gelap) => (gelap ? 'mix-blend-mode:screen' : 'filter:invert(1);mix-blend-mode:multiply')

/** Huruf mengecil sendiri sampai muat kotaknya (data-pas), lalu body[data-siap] menandai siap dipotret. */
const SKRIP_PAS = `<script>
document.fonts.ready.then(() => {
  for (const el of document.querySelectorAll('[data-pas]')) {
    let s = parseFloat(getComputedStyle(el).fontSize); const min = Number(el.dataset.pas) || 24
    // Kelonggaran ±30% ukuran huruf: huruf hias melampaui kotak barisnya (line-height < 1.2)
    // dan itu terbaca sebagai luapan, padahal tidak ada yang terpotong.
    // Tinggi isi diukur lewat Range, bukan scrollHeight: teks rata-bawah (flex-end) meluap
    // ke ATAS, dan luapan ke atas tidak pernah masuk scrollHeight.
    const isi = () => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect() }
    const luap = () => isi().height > el.clientHeight + s * 0.5 || el.scrollWidth > el.clientWidth + 2
    while (luap() && s > min) { s -= 2; el.style.fontSize = s + 'px' }
  }
  document.body.dataset.siap = '1'
})
</script>`

/**
 * Satu slide → dokumen HTML.
 * @param o.slide  { judul, sub, stiker, harga, menu }
 * @param o.gaya   salah satu GAYA_GAMBAR; o.palet kunci PALET
 * @param o.foto   path foto utama (bank); o.latar path foto latar (Unsplash) — boleh kosong
 * @param o.rasio  'feed' | 'story'; o.nomor/o.total untuk titik carousel
 */
export function htmlSlide(o) {
  const { w, h } = UKURAN[o.rasio] ?? UKURAN.feed
  const p = PALET[o.palet] ?? PALET.kopi
  const k = o.paket ?? pilihPaket(0)
  const s = o.slide ?? {}
  const gaya = GAYA_GAMBAR.includes(o.gaya) ? o.gaya : 'editorial'
  const foto = urlBerkas(o.foto || o.latar)
  const latar = urlBerkas(o.latar)
  const tegak = o.rasio === 'story'
  // Story: ±220 px atas & ±260 px bawah tertutup nama akun dan kolom balas Instagram.
  const T = tegak ? 230 : 56
  const harga = Number(s.harga) > 0 ? rpTeks(s.harga) : ''
  const titik = o.total > 1
    ? `<div class="titik">${Array.from({ length: o.total }, (_, i) => `<i class="${i + 1 === o.nomor ? 'on' : ''}"></i>`).join('')}</div>` : ''
  const logo = o.logo ? `<img class="logo" src="${urlBerkas(o.logo)}">` : `<div class="logo teks">Lek Kopi</div>`
  const judul = esc(s.judul)
  const sub = esc(s.sub)
  const stiker = esc(s.stiker)

  const dasar = `*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{position:relative;background:${p.bg};color:${p.ink};font-family:'${k.tebal}',${SANS};-webkit-font-smoothing:antialiased}
.logo{position:absolute;width:150px;${logoCss(gaya === 'editorial' || gaya === 'gelap' || gaya === 'kolase' ? true : p.gelap)}}
.logo.teks{font-family:'${k.judul}',serif;font-size:44px;width:auto;mix-blend-mode:normal;filter:none}
.titik{position:absolute;left:0;right:0;bottom:${tegak ? 230 : 40}px;display:flex;justify-content:center;gap:14px}
.titik i{width:16px;height:16px;border-radius:50%;background:currentColor;opacity:.35}.titik i.on{opacity:1}
.sub{font-family:${SANS};font-weight:500}`

  let css = ''
  let isi = ''
  if (gaya === 'editorial') {
    css = `.foto{position:absolute;inset:0;background:url('${foto}') center/cover}
.tirai{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 22%,rgba(0,0,0,0) ${tegak ? 48 : 40}%,rgba(0,0,0,.88) 100%)}
.logo{top:${T}px;left:60px}
.harga{position:absolute;top:${T}px;right:60px;width:230px;height:230px;border-radius:50%;background:${p.aksen};color:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(8deg);font-size:54px;box-shadow:0 18px 40px rgba(0,0,0,.35)}
.harga small{font:600 24px ${SANS};letter-spacing:3px;margin-bottom:4px}
.bawah{position:absolute;left:70px;right:70px;bottom:${tegak ? 300 : 110}px;color:#fff}
.kicker{display:inline-block;font:700 28px ${SANS};letter-spacing:5px;text-transform:uppercase;color:#111;background:${p.aksen};padding:8px 18px;border-radius:6px;margin-bottom:20px}
.judul{font-family:'${k.judul}',serif;font-size:132px;line-height:1.02;height:${tegak ? 420 : 290}px;display:flex;align-items:flex-end;overflow:hidden}
.sub{font-size:38px;line-height:1.35;color:#eee;margin-top:22px;max-height:160px;overflow:hidden}
.titik{color:#fff}`
    isi = `<div class="foto"></div><div class="tirai"></div>${logo}
${harga ? `<div class="harga"><small>HANYA</small>${harga}</div>` : ''}
<div class="bawah">${stiker ? `<div class="kicker">${stiker}</div>` : ''}<div class="judul" data-pas="60">${judul}</div>${sub ? `<div class="sub" data-pas="26">${sub}</div>` : ''}</div>${titik}`
  } else if (gaya === 'pop') {
    const sisi = tegak ? 760 : 620
    css = `body{background:${p.aksen};color:${p.ink}}
body:before{content:'';position:absolute;inset:0;background:radial-gradient(${p.bg}55 3px,transparent 4px) 0 0/38px 38px}
.logo{top:${tegak ? T - 40 : 40}px;left:50%;transform:translateX(-50%)}
.polaroid{position:absolute;top:${tegak ? 400 : 200}px;left:50%;width:${sisi + 48}px;margin-left:-${(sisi + 48) / 2}px;background:#fff;padding:24px 24px 26px;transform:rotate(-4deg);box-shadow:0 30px 60px rgba(0,0,0,.28)}
.polaroid .f{width:${sisi}px;height:${sisi}px;background:url('${foto}') center/cover}
.polaroid .sub{font-family:'${k.tangan}',cursive;font-weight:400;color:#333;font-size:44px;line-height:1.15;text-align:center;margin-top:12px;height:104px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.judul{position:absolute;left:50px;right:50px;bottom:${tegak ? 290 : 90}px;height:${tegak ? 300 : 210}px;display:flex;align-items:flex-end;justify-content:center;text-align:center;font-size:130px;line-height:.95;text-transform:uppercase;color:#fff;-webkit-text-stroke:4px ${p.ink};text-shadow:10px 10px 0 ${p.ink};overflow:hidden}
.stiker{position:absolute;top:${tegak ? 350 : 150}px;right:60px;width:250px;height:250px;background:${p.ink};color:${p.bg};clip-path:polygon(50% 0,61% 18%,82% 10%,80% 32%,100% 40%,85% 56%,96% 76%,74% 78%,68% 100%,50% 86%,32% 100%,26% 78%,4% 76%,15% 56%,0 40%,20% 32%,18% 10%,39% 18%);display:flex;align-items:center;justify-content:center;text-align:center;font-size:40px;line-height:1;padding:46px;transform:rotate(12deg)}
.harga{position:absolute;top:${tegak ? 360 : 160}px;left:40px;background:${p.ink};color:#fff;font-size:54px;padding:12px 30px;transform:rotate(-8deg);box-shadow:8px 8px 0 #fff;z-index:2}
.titik{color:${p.ink}}`
    isi = `${logo}<div class="polaroid"><div class="f"></div>${sub ? `<div class="sub" data-pas="28">${sub}</div>` : ''}</div>
${stiker ? `<div class="stiker" data-pas="24">${stiker}</div>` : ''}${harga ? `<div class="harga">${harga}</div>` : ''}
<div class="judul" data-pas="70">${judul}</div>${titik}`
  } else if (gaya === 'minimal') {
    const atas = tegak ? 250 : 80
    const tf = tegak ? 1000 : 700
    const tj = tegak ? 300 : 200
    const ts = tegak ? 120 : 70
    css = `.lengkung{position:absolute;top:${atas}px;left:120px;right:120px;height:${tf}px;border-radius:420px 420px 28px 28px;background:url('${foto}') center/cover;box-shadow:0 24px 50px rgba(0,0,0,.18)}
.garis{position:absolute;left:120px;right:120px;top:${atas + tf + 40}px;height:2px;background:${p.ink};opacity:.25}
.kicker{position:absolute;left:0;right:0;top:${atas + tf + 64}px;text-align:center;font:600 28px ${SANS};letter-spacing:8px;text-transform:uppercase;color:${p.aksen}}
.judul{position:absolute;left:90px;right:90px;top:${atas + tf + 112}px;height:${tj}px;display:flex;align-items:center;justify-content:center;text-align:center;font-family:'${k.judul}',serif;font-size:96px;line-height:1.05;overflow:hidden}
.sub{position:absolute;left:150px;right:150px;top:${atas + tf + 122 + tj}px;height:${ts}px;text-align:center;font-size:32px;line-height:1.4;color:${p.lembut};overflow:hidden}
.harga{position:absolute;top:${atas + tf - 90}px;right:90px;background:${p.aksen};color:#fff;font:700 44px ${SANS};padding:18px 30px;border-radius:999px}
.logo{bottom:${tegak ? 60 : 26}px;left:50%;transform:translateX(-50%);width:96px}
.titik{display:none}`
    isi = `<div class="lengkung"></div><div class="garis"></div>${stiker ? `<div class="kicker">${stiker}</div>` : ''}
<div class="judul" data-pas="50">${judul}</div>${sub ? `<div class="sub" data-pas="22">${sub}</div>` : ''}${harga ? `<div class="harga">${harga}</div>` : ''}${logo}`
  } else if (gaya === 'retro') {
    const d = tegak ? 760 : 640
    const pusat = tegak ? 40 : 38
    css = `body{background:repeating-conic-gradient(from 0deg at 50% ${pusat}%,${p.aksen} 0 9deg,${p.bg} 9deg 18deg)}
.lingkar{position:absolute;left:50%;top:${pusat}%;width:${d}px;height:${d}px;margin:-${d / 2}px 0 0 -${d / 2}px;border-radius:50%;border:18px solid ${p.ink};background:url('${foto}') center/cover;box-shadow:0 0 0 14px ${p.bg}}
.pita{position:absolute;left:-20px;right:-20px;bottom:${tegak ? 330 : 120}px;height:${tegak ? 360 : 300}px;background:${p.ink};transform:rotate(-3deg)}
.judul{position:absolute;left:60px;right:60px;bottom:${tegak ? 390 : 170}px;height:${tegak ? 260 : 210}px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:130px;line-height:.95;text-transform:uppercase;color:${p.bg};text-shadow:5px 5px 0 ${p.aksen};transform:rotate(-3deg);overflow:hidden}
.sub{position:absolute;left:80px;right:80px;bottom:${tegak ? 250 : 40}px;height:70px;text-align:center;font-family:'${k.tangan}',cursive;font-weight:400;font-size:52px;color:${p.ink};overflow:hidden;white-space:nowrap}
.harga{position:absolute;top:${T + 14}px;right:60px;background:${p.ink};color:${p.aksen};font-size:56px;padding:16px 30px;border:5px dashed ${p.aksen};transform:rotate(7deg)}
.stiker{position:absolute;top:${T + 14}px;left:200px;font:800 30px ${SANS};letter-spacing:4px;text-transform:uppercase;color:${p.ink};background:${p.bg};padding:10px 20px}
.logo{top:${T}px;left:50px;width:130px}
.titik{color:${p.ink};bottom:${tegak ? 190 : 14}px}`
    isi = `<div class="lingkar"></div>${logo}${stiker ? `<div class="stiker">${stiker}</div>` : ''}${harga ? `<div class="harga">${harga}</div>` : ''}
<div class="pita"></div><div class="judul" data-pas="56">${judul}</div>${sub ? `<div class="sub" data-pas="28">${sub}</div>` : ''}${titik}`
  } else if (gaya === 'gelap') {
    css = `body{background:#0d0b0a}
.foto{position:absolute;inset:0;background:url('${foto}') center/cover;filter:saturate(.85) contrast(1.08)}
.vinyet{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 38%,rgba(0,0,0,0) 30%,rgba(0,0,0,.82) 78%),linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(0,0,0,.75) 100%)}
.bingkai{position:absolute;inset:34px;border:2px solid ${p.aksen}88}
.logo{top:${tegak ? T : 70}px;left:50%;transform:translateX(-50%);width:140px}
.judul{position:absolute;left:70px;right:70px;bottom:${tegak ? 560 : 290}px;height:${tegak ? 340 : 300}px;display:flex;align-items:flex-end;justify-content:center;text-align:center;font-family:'${k.tangan}',cursive;font-size:140px;line-height:1.05;color:${p.aksen};transform:rotate(-5deg);text-shadow:0 4px 30px rgba(0,0,0,.6);overflow:hidden}
.sub{position:absolute;left:110px;right:110px;bottom:${tegak ? 420 : 170}px;height:${tegak ? 110 : 96}px;text-align:center;font:600 30px ${SANS};letter-spacing:5px;text-transform:uppercase;color:#eee;line-height:1.5;overflow:hidden}
.harga{position:absolute;bottom:${tegak ? 320 : 86}px;left:0;right:0;text-align:center;font-size:52px;color:#fff}
.stiker{position:absolute;top:${tegak ? T + 170 : 240}px;left:0;right:0;text-align:center;font:700 26px ${SANS};letter-spacing:10px;text-transform:uppercase;color:${p.aksen}}
.titik{color:${p.aksen};bottom:${tegak ? 230 : 50}px}`
    isi = `<div class="foto"></div><div class="vinyet"></div><div class="bingkai"></div>${logo}${stiker ? `<div class="stiker">${stiker}</div>` : ''}
<div class="judul" data-pas="60">${judul}</div>${sub ? `<div class="sub" data-pas="20">${sub}</div>` : ''}${harga ? `<div class="harga">${harga}</div>` : ''}${titik}`
  } else {
    // kolase: latar Unsplash buram + kartu foto bank + judul bertumpuk dua huruf.
    const kata = String(s.judul ?? '').split(/\s+/).filter(Boolean)
    const tumpuk = kata.map((x, i) => `<span class="${i % 2 ? 'b' : 'a'}">${esc(x)}</span>`).join(' ')
    css = `.latar{position:absolute;inset:-40px;background:url('${latar || foto}') center/cover;filter:blur(${latar ? 2 : 18}px) brightness(.55)}
.kartu{position:absolute;top:${tegak ? 400 : 150}px;right:70px;width:${tegak ? 640 : 540}px;height:${tegak ? 800 : 680}px;background:url('${urlBerkas(o.foto) || foto}') center/cover;border:16px solid #fff;transform:rotate(5deg);box-shadow:0 30px 60px rgba(0,0,0,.45)}
.logo{top:${T}px;left:60px}
.judul{position:absolute;left:60px;width:${tegak ? 600 : 560}px;top:${tegak ? 1260 : 870}px;height:${tegak ? 470 : 330}px;font-size:118px;line-height:1;color:#fff;overflow:hidden}
.judul .a{font-family:'${k.tebal}';text-transform:uppercase}.judul .b{font-family:'${k.judul}',serif;color:${p.aksen}}
.sub{position:absolute;right:70px;left:${tegak ? 680 : 640}px;top:${tegak ? 1300 : 900}px;height:200px;font-size:30px;line-height:1.4;color:#eee;overflow:hidden}
.harga{position:absolute;top:${tegak ? 340 : 110}px;right:60px;background:${p.aksen};color:#111;font-size:50px;padding:14px 28px;transform:rotate(-4deg)}
.stiker{position:absolute;left:60px;top:${tegak ? 1190 : 790}px;font:700 26px ${SANS};letter-spacing:5px;text-transform:uppercase;color:#111;background:${p.aksen};padding:8px 16px;border-radius:6px}
.titik{color:#fff}`
    isi = `<div class="latar"></div><div class="kartu"></div>${logo}${harga ? `<div class="harga">${harga}</div>` : ''}${stiker ? `<div class="stiker">${stiker}</div>` : ''}
<div class="judul" data-pas="52">${tumpuk}</div>${sub ? `<div class="sub" data-pas="22">${sub}</div>` : ''}${titik}`
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>${cssHuruf(k)}\n${dasar}\n${css}</style></head><body>${isi}${SKRIP_PAS}</body></html>`
}

// ------------------------------------------------------------- Chromium

const CALON_CHROME = [
  process.env.STUDIO_CHROME,
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/opt/pw-browsers/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

export function cariChrome() {
  const p = CALON_CHROME.find((x) => x && existsSync(x))
  if (!p) throw new Error('Chrome/Chromium/Edge tidak ditemukan untuk membuat gambar (isi STUDIO_CHROME)')
  return p
}

/** Potret [{ html, keluar, rasio, fileHtml? }] dengan satu peramban. */
export async function potret(daftar) {
  const { chromium } = await import('playwright-core')
  const b = await chromium.launch({ executablePath: cariChrome(), args: ['--allow-file-access-from-files', '--no-sandbox'] })
  try {
    for (const d of daftar) {
      const { w, h } = UKURAN[d.rasio] ?? UKURAN.feed
      const hal = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
      const fileHtml = d.fileHtml ?? d.keluar.replace(/\.jpe?g$/i, '.html')
      await writeFile(fileHtml, d.html)
      await hal.goto(pathToFileURL(fileHtml).href)
      await hal.waitForSelector('body[data-siap]', { timeout: 20000 })
      await hal.screenshot({ path: d.keluar, type: 'jpeg', quality: 92 })
      await hal.close()
    }
  } finally {
    await b.close()
  }
}

// ------------------------------------------------------------ Unsplash

/**
 * Satu foto latar dari Unsplash (portrait) → { berkas, kredit } atau null.
 * Pedoman API Unsplash: pemicu download_location wajib, dan nama fotografer dicantumkan
 * (Studio menambahkannya ke caption).
 */
export async function fotoUnsplash(kata, kunci, folder, ambil = fetch) {
  if (!kunci || !String(kata ?? '').trim()) return null
  const q = new URLSearchParams({ query: kata, per_page: '10', orientation: 'portrait', content_filter: 'high' })
  const r = await ambil(`https://api.unsplash.com/search/photos?${q}`, { headers: { authorization: `Client-ID ${kunci}` } })
  if (!r.ok) throw new Error(`Unsplash ${r.status}`)
  const hasil = (await r.json()).results ?? []
  if (!hasil.length) return null
  const f = hasil[Math.floor(Math.random() * Math.min(5, hasil.length))]
  await ambil(f.links.download_location, { headers: { authorization: `Client-ID ${kunci}` } }).catch(() => {})
  const g = await ambil(`${f.urls.raw}&w=1600&fm=jpg&q=85`)
  if (!g.ok) throw new Error(`Unsplash unduh ${g.status}`)
  const berkas = path.join(folder, `unsplash-${f.id}.jpg`)
  await writeFile(berkas, Buffer.from(await g.arrayBuffer()))
  return { berkas, kredit: `${f.user?.name ?? 'Unsplash'} / Unsplash` }
}

// -------------------------------------------------------------- render

const benih = (id) => [...String(id)].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7)

/**
 * Foto untuk satu slide dari bank: tag sama, foto dulu (kualitas kurasi tertinggi), lalu
 * video (diambil satu bingkai). Foto yang sudah dipakai slide lain dilewati bila ada cadangan.
 */
export function pilihFoto(bank, tag, terpakai = new Set()) {
  const nilai = (m) => Number(m.kurasi?.kualitas) || 0
  const calon = bank.filter((m) => (m.jenis === 'foto' || m.jenis === 'video') && m.kurasi?.layak !== false)
  const urut = (xs) => [...xs].sort((a, b) => (a.jenis === b.jenis ? nilai(b) - nilai(a) : a.jenis === 'foto' ? -1 : 1))
  const tagSama = urut(calon.filter((m) => m.tag === tag))
  const awalanSama = urut(calon.filter((m) => m.tag.split('/')[0] === String(tag).split('/')[0]))
  for (const daftar of [tagSama, awalanSama]) {
    const baru = daftar.find((m) => !terpakai.has(m.path))
    if (baru) return baru
    if (daftar.length) return daftar[0]
  }
  return null
}

/**
 * Render naskah gambar → { berkas: { feed: [jpg…], story: jpg|null }, catatan, kredit }.
 * konten.ig_tujuan menentukan yang dibuat: 'utama' feed saja, 'story' story saja, 'keduanya'.
 */
export async function renderGambar(konten, bank, folderHasil, opsi = {}) {
  const n = konten.naskah_json
  if (!n?.slide?.length) throw new Error('Naskah gambar kosong')
  const siapkan = opsi.siapkan ?? (async () => {})
  const kerja = path.join(folderHasil, '_kerja', String(konten.id))
  await rm(kerja, { recursive: true, force: true })
  await mkdir(kerja, { recursive: true })
  const paket = pilihPaket(benih(konten.id))
  const catatan = [`gaya ${n.gaya} · palet ${n.palet} · huruf ${paket.judul}`]
  const kredit = []
  const logo = bank.find((m) => m.jenis === 'logo')?.path ?? null
  if (logo) await siapkan([logo])

  // Naskah ber-latar 'ai' (Gambar AI nyala saat naskah ditulis): latar dari penyedia AI, Unsplash cadangan.
  const buatAi = n.latar === 'ai' ? (opsi.buatGambar ?? (adaGambarAi() ? buatGambarAi : null)) : null
  let jumlahAi = 0
  let biayaAi = 0
  let aiBerhenti = n.latar === 'ai' && !buatAi
  if (aiBerhenti && n.slide.some((s) => s.kata_unsplash)) catatan.push('latar AI dilewati: belum ada penyedia (Cloudflare/Gemini) — pakai Unsplash')
  const terpakai = new Set()
  const bahan = []
  for (const [i, s] of n.slide.entries()) {
    const m = pilihFoto(bank, s.tag, terpakai)
    let foto = null
    if (m) {
      terpakai.add(m.path)
      await siapkan([m.path])
      if (m.jenis === 'video') {
        foto = path.join(kerja, `bingkai-${i + 1}.jpg`)
        const t = Math.max(0.5, (Number(m.durasi) || 2) / 2)
        await ffmpeg(['-y', '-ss', String(t), '-i', m.path, '-frames:v', '1', '-q:v', '2', foto])
      } else foto = m.path
    }
    let latar = null
    if (s.kata_unsplash && (n.gaya === 'kolase' || !foto) && buatAi && !aiBerhenti) {
      try {
        const h = rapikanHasil(await buatAi(s.kata_unsplash, '4:5', path.join(kerja, `latar-ai-${i + 1}`)))
        latar = h.berkas
        biayaAi += Number(h.biayaUsd) || 0
        if (h.catatan) catatan.push(h.catatan)
        jumlahAi++
      } catch (e) {
        if (galatKuota(e)) { aiBerhenti = true; catatan.push(`latar AI berhenti: kuota penyedia habis (${String(e.message).slice(0, 120)})`) }
        else catatan.push(`latar AI slide ${i + 1} gagal: ${String(e.message).slice(0, 120)}`)
      }
    }
    if (!latar && s.kata_unsplash && (n.gaya === 'kolase' || !foto)) {
      try {
        const u = await (opsi.unsplash ?? fotoUnsplash)(s.kata_unsplash, opsi.kunciUnsplash, kerja)
        if (u) { latar = u.berkas; kredit.push(u.kredit) }
      } catch (e) { catatan.push(`latar Unsplash gagal: ${e.message}`) }
    }
    if (!foto && !latar) catatan.push(`⚠️ slide ${i + 1}: bank tidak punya foto untuk tag "${s.tag}"`)
    bahan.push({ slide: s, foto, latar })
  }

  const tujuan = konten.ig_tujuan ?? 'utama'
  const nama = `${new Date().toISOString().slice(0, 10)}_${String(konten.id).slice(0, 8)}`
  const tugas = []
  const feed = []
  let story = null
  if (tujuan !== 'story') {
    bahan.forEach((b, i) => {
      const keluar = path.join(folderHasil, `${nama}_${i + 1}.jpg`)
      feed.push(keluar)
      tugas.push({ rasio: 'feed', keluar, html: htmlSlide({ ...b, gaya: n.gaya, palet: n.palet, paket, logo, rasio: 'feed', nomor: i + 1, total: bahan.length }) })
    })
  }
  if (tujuan !== 'utama') {
    story = path.join(folderHasil, `${nama}_story.jpg`)
    tugas.push({ rasio: 'story', keluar: story, html: htmlSlide({ ...bahan[0], gaya: n.gaya, palet: n.palet, paket, logo, rasio: 'story', nomor: 1, total: 1 }) })
  }
  // HTML di folder kerja (ikut terhapus), JPEG di folder hasil (disimpan ke Drive).
  await (opsi.potret ?? potret)(tugas.map((t) => ({ ...t, fileHtml: path.join(kerja, path.basename(t.keluar).replace(/\.jpg$/, '.html')) })))
  if (jumlahAi) catatan.push(`${jumlahAi} latar gambar AI`)
  return { berkas: { feed, story }, catatan, kredit: [...new Set(kredit)], pemakaian: pemakaianGambar(jumlahAi, biayaAi) }
}
