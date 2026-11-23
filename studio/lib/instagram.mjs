// Posting Instagram lewat Graph API — pola sama dengan Studio Lek Kopi (sosmed.mjs). Token disimpan
// per merek di studio_kredensial (kolom data); host 'instagram' (Instagram Login) atau 'facebook' (token gaya EA…).
const VERSI = () => process.env.IG_API_VERSI || 'v27.0';
const url = (k, p) => `https://graph.${k.ig_host === 'facebook' ? 'facebook' : 'instagram'}.com/${VERSI()}/${p}`;
const form = (o) => new URLSearchParams(Object.entries(o).map(([a, b]) => [a, String(b)]));
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(r, label) {
  const t = await r.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    throw new Error(`${label}: ${r.status} ${t.slice(0, 200)}`);
  }
  if (!r.ok || j.error) throw new Error(`${label}: ${j.error?.message ?? r.status}`);
  return j;
}

export const adaInstagram = (k) => Boolean(k?.ig_token && k?.ig_user_id);

/** Perpanjang token Instagram Login bila sisa < 10 hari (token gaya Facebook tak bisa diperpanjang). */
export async function segarkanToken(k) {
  if (!adaInstagram(k) || k.ig_host === 'facebook' || !k.ig_kedaluwarsa) return null;
  const sisa = new Date(k.ig_kedaluwarsa).getTime() - Date.now();
  const umur = Date.now() - new Date(k.ig_dibuat ?? 0).getTime();
  if (sisa > 10 * 864e5 || umur < 864e5) return null;
  const j = await json(await fetch(`https://graph.instagram.com/refresh_access_token?${form({ grant_type: 'ig_refresh_token', access_token: k.ig_token })}`), 'Perpanjang token IG');
  return { ig_token: j.access_token, ig_dibuat: new Date().toISOString(), ig_kedaluwarsa: new Date(Date.now() + Number(j.expires_in ?? 5184000) * 1000).toISOString() };
}

async function buatWadah(k, isi, label) {
  return (await json(await fetch(url(k, `${k.ig_user_id}/media`), { method: 'POST', body: form({ ...isi, access_token: k.ig_token }) }), label)).id;
}

/** Tunggu wadah selesai diproses Instagram lalu terbitkan → id media. */
async function terbitkan(k, wadah, apa, jeda) {
  for (let i = 0; i * jeda < 600_000; i++) {
    await tidur(i === 0 ? 3000 : jeda);
    const s = await json(await fetch(`${url(k, wadah)}?${form({ fields: 'status_code', access_token: k.ig_token })}`), 'Status IG');
    if (s.status_code === 'FINISHED') {
      return (await json(await fetch(url(k, `${k.ig_user_id}/media_publish`), { method: 'POST', body: form({ creation_id: wadah, access_token: k.ig_token }) }), 'Terbitkan IG')).id;
    }
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`Instagram gagal memproses ${apa} (${s.status_code})`);
  }
  throw new Error(`Instagram belum selesai memproses ${apa} dalam 10 menit`);
}

async function tautan(k, id) {
  try {
    return (await json(await fetch(`${url(k, id)}?${form({ fields: 'permalink', access_token: k.ig_token })}`), 'Permalink')).permalink ?? null;
  } catch {
    return null;
  }
}

export async function postingFeed(k, gambarUrl, caption) {
  const id = await terbitkan(k, await buatWadah(k, { image_url: gambarUrl, caption }, 'Wadah feed'), 'gambar', 5000);
  return { id, permalink: await tautan(k, id) };
}

export async function postingStory(k, mediaUrl, jenis) {
  const adalahVideo = jenis === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(String(mediaUrl ?? ''));
  const isi = adalahVideo ? { media_type: 'STORIES', video_url: mediaUrl } : { media_type: 'STORIES', image_url: mediaUrl };
  const id = await terbitkan(k, await buatWadah(k, isi, 'Wadah story'), adalahVideo ? 'video story' : 'story', adalahVideo ? 15_000 : 5000);
  return { id, jenis: adalahVideo ? 'video' : 'gambar', permalink: await tautan(k, id) };
}

export async function postingReels(k, videoUrl, caption) {
  const id = await terbitkan(k, await buatWadah(k, { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true' }, 'Wadah reels'), 'video', 20_000);
  return { id, permalink: await tautan(k, id) };
}
