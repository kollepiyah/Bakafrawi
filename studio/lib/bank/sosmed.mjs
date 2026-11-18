// =====================================================================
//  sosmed.mjs — sambungan & posting Instagram dan draf TikTok (KB §77).
//
//  Instagram (Instagram Login, graph.instagram.com): Reels hanya lewat
//  `video_url` publik → video diunggah sebentar ke bucket kantor-konten,
//  lalu dihapus sesudah tayang.
//  TikTok: unggah FILE_UPLOAD ke kotak masuk (scope video.upload); Kyai
//  menekan Posting di aplikasi TikTok. Caption tidak bisa dikirim lewat
//  jalur ini, jadi bot mengirim caption untuk ditempel.
// =====================================================================
import { readFile, stat } from 'node:fs/promises'
import { tidur } from './alat.mjs'

const IG_VERSI = () => process.env.IG_API_VERSI || 'v27.0'
const IG = (p) => `https://graph.instagram.com/${IG_VERSI()}/${p}`

async function json(r, label) {
  const t = await r.text()
  let j
  try { j = JSON.parse(t) } catch { throw new Error(`${label}: ${r.status} ${t.slice(0, 200)}`) }
  // TikTok membalas `error: {code: 'ok'}` saat BERHASIL; Meta memakai `error` hanya saat gagal.
  const galat = j.error && !(typeof j.error === 'object' && j.error.code === 'ok')
  if (!r.ok || galat) throw new Error(`${label}: ${j.error?.message ?? j.error_description ?? j.error?.code ?? j.error ?? r.status}`)
  return j
}

const form = (o) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)]))

// --------------------------------------------------------------- OAuth

export async function tukarKodeInstagram(kode, balik) {
  const id = process.env.IG_APP_ID
  const rahasia = process.env.IG_APP_SECRET
  if (!id || !rahasia) throw new Error('IG_APP_ID / IG_APP_SECRET belum diisi di .env Studio')
  const pendek = await json(await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST', body: form({ client_id: id, client_secret: rahasia, grant_type: 'authorization_code', redirect_uri: balik, code: kode }),
  }), 'Instagram tukar kode')
  const panjang = await json(await fetch(`https://graph.instagram.com/access_token?${form({
    grant_type: 'ig_exchange_token', client_secret: rahasia, access_token: pendek.access_token })}`), 'Instagram token panjang')
  const saya = await json(await fetch(`${IG('me')}?${form({ fields: 'user_id,username', access_token: panjang.access_token })}`), 'Instagram /me')
  return {
    data: { token: panjang.access_token, user_id: String(saya.user_id ?? pendek.user_id), akun: `@${saya.username}`, dibuat: new Date().toISOString() },
    kedaluwarsa: new Date(Date.now() + Number(panjang.expires_in ?? 5184000) * 1000).toISOString(),
  }
}

/**
 * Token dari dasbor Meta ("Buat token" di samping akun penguji) → kredensial.
 * Jalan pintas tanpa OAuth (14 Nov 2026: /sambung_ig kena "Invalid platform app").
 * Token dasbor berumur panjang (±60 hari) dan diperpanjang seperti biasa.
 */
export async function kenaliTokenInstagram(token) {
  const kedaluwarsa = new Date(Date.now() + 5184000 * 1000).toISOString()
  const dibuat = new Date().toISOString()
  // 1. Token Instagram Login (biasanya berawalan IG…) → graph.instagram.com.
  const r = await fetch(`${IG('me')}?${form({ fields: 'user_id,username', access_token: token })}`)
  if (r.ok) {
    const saya = await r.json()
    return { data: { token, host: 'instagram', user_id: String(saya.user_id ?? saya.id), akun: `@${saya.username}`, dibuat }, kedaluwarsa }
  }
  // 2. Token gaya Facebook (berawalan EA…, terbukti 14 Nov 2026) → graph.facebook.com.
  //    Bisa token akun IG langsung, atau token pengguna FB yang mengelola Halaman
  //    berakun Instagram bisnis.
  const galatIg = (await r.json().catch(() => ({}))).error?.message ?? r.status
  const langsung = await fetch(`${FB('me')}?${form({ fields: 'id,username', access_token: token })}`)
  if (langsung.ok) {
    const s = await langsung.json()
    if (s.username) return { data: { token, host: 'facebook', user_id: String(s.id), akun: `@${s.username}`, dibuat }, kedaluwarsa }
  }
  // 3. Token pengguna sistem Meta Business (terbukti 14 Nov 2026): akun IG ditetapkan
  //    langsung sebagai aset, tanpa Halaman → baca lewat IG_USER_ID (ID akun IG dari dasbor).
  const idIg = (process.env.IG_USER_ID || '').trim()
  if (idIg) {
    const a = await fetch(`${FB(idIg)}?${form({ fields: 'id,username', access_token: token })}`)
    const s = await a.json().catch(() => ({}))
    if (a.ok && s.username) return { data: { token, host: 'facebook', user_id: String(s.id), akun: `@${s.username}`, dibuat }, kedaluwarsa }
    throw new Error(`Akun Instagram ${idIg} belum bisa diakses token ini (${s.error?.message ?? a.status}). Tetapkan akun Instagram lekkopi.id sebagai aset pengguna sistem di Pengaturan Bisnis.`)
  }
  const hal = await fetch(`${FB('me/accounts')}?${form({ fields: 'name,instagram_business_account{id,username}', access_token: token })}`)
  if (hal.ok) {
    const j = await hal.json()
    const ig = (j.data ?? []).map((p) => p.instagram_business_account).filter(Boolean)
    const pilih = ig.find((a) => /lekkopi/i.test(a.username ?? '')) ?? ig[0]
    if (pilih) return { data: { token, host: 'facebook', user_id: String(pilih.id), akun: `@${pilih.username}`, dibuat }, kedaluwarsa }
    throw new Error('Token Facebook terbaca, tapi tidak ada akun Instagram yang terlihat. Isi IG_USER_ID di .env dan tetapkan akun Instagram sebagai aset pengguna sistem')
  }
  const galatFb = (await hal.json().catch(() => ({}))).error?.message ?? hal.status
  throw new Error(`Token ditolak Instagram (${galatIg}) dan Facebook (${galatFb})`)
}

const FB = (p) => `https://graph.facebook.com/${IG_VERSI()}/${p}`
/** Alamat Graph sesuai jenis token yang tersimpan. */
const graf = (k, p) => (k.data.host === 'facebook' ? FB(p) : IG(p))

/** Perpanjang token IG kalau sisa < 10 hari (dan umurnya ≥ 24 jam). */
export async function segarkanInstagram(k) {
  // Token gaya Facebook tidak bisa diperpanjang tanpa App Secret: Studio
  // mengabari Kyai untuk membuat token baru (lihat studio.mjs).
  if (k.data.host === 'facebook') return null
  const sisa = new Date(k.kedaluwarsa).getTime() - Date.now()
  const umur = Date.now() - new Date(k.data.dibuat ?? 0).getTime()
  if (sisa > 10 * 864e5 || umur < 864e5) return null
  const j = await json(await fetch(`https://graph.instagram.com/refresh_access_token?${form({
    grant_type: 'ig_refresh_token', access_token: k.data.token })}`), 'Instagram perpanjang token')
  return {
    data: { ...k.data, token: j.access_token, dibuat: new Date().toISOString() },
    kedaluwarsa: new Date(Date.now() + Number(j.expires_in ?? 5184000) * 1000).toISOString(),
  }
}

async function tokenTiktok(body) {
  const j = await json(await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, ...body }),
  }), 'TikTok token')
  return j
}

export async function tukarKodeTiktok(kode, balik) {
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) throw new Error('TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET belum diisi di .env Studio')
  const j = await tokenTiktok({ code: kode, grant_type: 'authorization_code', redirect_uri: balik })
  let akun = 'akun TikTok'
  try {
    const u = await json(await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name', {
      headers: { authorization: `Bearer ${j.access_token}` } }), 'TikTok user')
    if (u.data?.user?.display_name) akun = u.data.user.display_name
  } catch { /* nama akun hanya untuk tampilan */ }
  return simpanTiktok(j, akun)
}

function simpanTiktok(j, akun) {
  return {
    data: {
      token: j.access_token, refresh: j.refresh_token, open_id: j.open_id, akun,
      token_sampai: new Date(Date.now() + Number(j.expires_in ?? 7200) * 1000).toISOString(),
    },
    kedaluwarsa: new Date(Date.now() + Number(j.refresh_expires_in ?? 15552000) * 1000).toISOString(),
  }
}

/** Token TikTok berlaku 2 jam; refresh token BERGANTI tiap dipakai — wajib disimpan. */
export async function segarkanTiktok(k) {
  if (new Date(k.data.token_sampai).getTime() - Date.now() > 5 * 60_000) return null
  const j = await tokenTiktok({ grant_type: 'refresh_token', refresh_token: k.data.refresh })
  return simpanTiktok(j, k.data.akun)
}

// ------------------------------------------------------------- Storage

const storage = (p) => `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/${p}`
const kepala = () => ({ authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`, apikey: process.env.SUPABASE_ANON_KEY })

const JENIS_MIME = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

/**
 * Unggah sebentar ke bucket publik supaya Instagram bisa mengambilnya (Graph API hanya
 * menerima URL). `nama` bawaan lek-kopi.mp4 — nama lama, dipakai pembersih percobaan habis.
 */
export async function unggahPublik(token, berkas, namaBerkas = 'lek-kopi.mp4') {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY belum diisi di .env Studio')
  const nama = `${token}/${namaBerkas}`
  const mime = JENIS_MIME[(namaBerkas.match(/\.[a-z0-9]+$/i)?.[0] ?? '').toLowerCase()] ?? 'application/octet-stream'
  const r = await fetch(storage(`kantor-konten/${nama}`), {
    method: 'POST', headers: { ...kepala(), 'content-type': mime, 'x-upsert': 'false' },
    body: await readFile(berkas),
  })
  if (!r.ok && r.status !== 409) throw new Error(`Unggah Storage ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return { nama, url: storage(`public/kantor-konten/${nama}`) }
}

export async function hapusPublik(nama) {
  await fetch(storage(`kantor-konten/${nama}`), { method: 'DELETE', headers: kepala() }).catch(() => {})
}

// ----------------------------------------------------------- Instagram

async function buatWadah(k, isi, label) {
  const { token, user_id: uid } = k.data
  return (await json(await fetch(graf(k, `${uid}/media`), { method: 'POST', body: form({ ...isi, access_token: token }) }), label)).id
}

/**
 * Tunggu wadah selesai diproses lalu terbitkan. Meta menyarankan cek tiap menit, maks 5 menit;
 * kita cek tiap `jeda` s.d. 10 menit (gambar biasanya langsung FINISHED).
 */
async function tungguTerbit(k, wadah, apa, jeda = 20_000, tunggu = tidur) {
  const { token, user_id: uid } = k.data
  for (let i = 0; i * jeda < 600_000; i++) {
    await tunggu(i === 0 ? Math.min(jeda, 3000) : jeda)
    const s = await json(await fetch(`${graf(k, wadah)}?${form({ fields: 'status_code', access_token: token })}`), 'Instagram status')
    if (s.status_code === 'FINISHED') {
      const pub = await json(await fetch(graf(k, `${uid}/media_publish`), {
        method: 'POST', body: form({ creation_id: wadah, access_token: token }),
      }), 'Instagram publish')
      return pub.id
    }
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`Instagram memproses ${apa}: ${s.status_code}`)
  }
  throw new Error(`Instagram belum selesai memproses ${apa} dalam 10 menit`)
}

export async function postingInstagram(k, videoUrl, caption) {
  const wadah = await buatWadah(k, { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true' }, 'Instagram buat wadah')
  return tungguTerbit(k, wadah, 'video')
}

/** Postingan feed: satu gambar, atau carousel bila lebih dari satu (maks 10, JPEG). */
export async function postingGambarIg(k, urls, caption) {
  if (urls.length === 1) {
    const wadah = await buatWadah(k, { image_url: urls[0], caption }, 'Instagram buat wadah gambar')
    return tungguTerbit(k, wadah, 'gambar', 5000)
  }
  const anak = []
  for (const u of urls.slice(0, 10)) anak.push(await buatWadah(k, { image_url: u, is_carousel_item: 'true' }, 'Instagram slide carousel'))
  const wadah = await buatWadah(k, { media_type: 'CAROUSEL', children: anak.join(','), caption }, 'Instagram buat carousel')
  return tungguTerbit(k, wadah, 'carousel', 5000)
}

/** Story: gambar 9:16 atau video. Story tidak punya caption. */
export async function postingStoryIg(k, url, video = false) {
  const wadah = await buatWadah(k, { media_type: 'STORIES', [video ? 'video_url' : 'image_url']: url }, 'Instagram buat story')
  return tungguTerbit(k, wadah, 'story', video ? 20_000 : 5000)
}

// -------------------------------------------------------------- TikTok

/** Satu potong selama ≤ 64 MB (aturan TikTok: potongan 5–64 MB, berkas < 5 MB = satu potong). */
export function rencanaPotong(ukuran) {
  const MAKS = 64 * 1024 * 1024
  if (ukuran <= MAKS) return { chunk_size: ukuran, total_chunk_count: 1 }
  const potong = 32 * 1024 * 1024
  return { chunk_size: potong, total_chunk_count: Math.floor(ukuran / potong) }
}

/** Status unggahan TikTok: SEND_TO_USER_INBOX = draf sudah di kotak masuk; FAILED = gagal. */
export async function statusTiktok(k, publishId) {
  const j = await json(await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
    method: 'POST',
    headers: { authorization: `Bearer ${k.data.token}`, 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ publish_id: publishId }),
  }), 'TikTok status')
  return { status: j.data?.status ?? '?', alasan: j.data?.fail_reason ?? null }
}

export async function drafTiktok(k, berkas) {
  const ukuran = (await stat(berkas)).size
  const rp = rencanaPotong(ukuran)
  const init = await json(await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: { authorization: `Bearer ${k.data.token}`, 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ source_info: { source: 'FILE_UPLOAD', video_size: ukuran, ...rp } }),
  }), 'TikTok init')
  const isi = await readFile(berkas)
  for (let i = 0; i < rp.total_chunk_count; i++) {
    const awal = i * rp.chunk_size
    const akhir = i === rp.total_chunk_count - 1 ? ukuran - 1 : awal + rp.chunk_size - 1
    const r = await fetch(init.data.upload_url, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4', 'content-length': String(akhir - awal + 1), 'content-range': `bytes ${awal}-${akhir}/${ukuran}` },
      body: isi.subarray(awal, akhir + 1),
    })
    if (r.status !== 201 && r.status !== 206) throw new Error(`TikTok unggah potongan ${i + 1}: ${r.status}`)
  }
  return init.data.publish_id
}
