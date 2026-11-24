import "server-only";
import { rest } from "./db-server";

const VERSI = () => process.env.IG_API_VERSI || "v27.0";

// Rem keras anti-spam Meta Graph API:
// 1) Pemuatan Beranda normal (paksaSegar = false) TIDAK PERNAH memanggil Meta API — hanya membaca cache Supabase.
// 2) Penyegaran manual (paksaSegar = true) dibatasi minimal 15 menit sekali per merek (persisten di studio_merek.profil).
// 3) Daftar media ditarik 1 request (`limit=15`), namun request metrik detail (`/insights`) tetap dibatasi maks 6 post terbaru + 2 story aktif (jeda 250ms).
// 4) Cache lama digabung (merge, maks 40 post/merek) agar postingan sebelumnya tidak hilang saat penyegaran.
// 5) Story > 24 jam = 0 request ke Meta (langsung pakai snapshot tersimpan).
// 6) Circuit breaker: begitu Meta menolak (rate-limit / OAuth / akun dibatasi), langsung berhenti & jeda 6 jam untuk akun itu.
const COOLDOWN_SEGAR_MS = 15 * 60_000;
const JEDA_CIRCUIT_BREAKER_MS = 6 * 3_600_000;
const JEDA_ANTAR_REQ_MS = 250;
const MAKS_MEDIA_TARIK = 20;
const MAKS_CACHE_PER_MEREK = 40;

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type PostInsight = {
  id: string;
  merek: string;
  produk: string;
  jenis: string;
  format: "reels" | "feed" | "story";
  caption: string | null;
  dibuat: string;
  tayangWaktu: string | null;
  permalink: string | null;
  mediaId: string | null;
  thumbnail: string | null;
  videoUrl: string | null;
  likes: number;
  comments: number;
  views?: number | null;
  reach?: number | null;
  saved?: number | null;
  shares?: number | null;
  replies?: number | null;
  arsipStory?: boolean;
};

export type RingkasInsight = {
  tersambung: boolean;
  akun: string | null;
  totalTayang: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  totalStory?: number;
  totalStoryViews?: number;
  posts: PostInsight[];
  diambilPada?: string | null;
  dariCache?: boolean;
  pesan?: string;
  galatInsight?: string | null;
};

type KredensialIg = {
  merek: string;
  data: {
    ig_token?: string;
    ig_host?: "instagram" | "facebook";
    ig_user_id?: string;
    ig_akun?: string;
  };
};

type CacheInsightMerek = {
  diambil: string;
  jedaSampai?: string | null;
  galat?: string | null;
  posts: PostInsight[];
};

type BarisMerek = {
  slug: string;
  aktif: boolean;
  profil: (Record<string, unknown> & { insight_cache?: CacheInsightMerek }) | null;
};

type SnapshotInsightStory = {
  views?: number | null;
  reach?: number | null;
  replies?: number | null;
  shares?: number | null;
  diambil?: string;
};

type InfoMediaIg = {
  id?: string;
  permalink?: string;
  jenis?: string;
  galat?: string;
  insight?: SnapshotInsightStory;
};

type TugasTayang = {
  id: string;
  merek: string | null;
  produk_slug: string;
  jenis: string;
  caption: string | null;
  dibuat: string;
  status_tayang: string;
  hasil: { jenis: string; rasio: string; url: string }[] | null;
  tayang: {
    sasaran?: string;
    rutin?: boolean;
    instagram?: {
      reels?: InfoMediaIg | null;
      feed?: InfoMediaIg | null;
      story?: InfoMediaIg | null;
      stories?: InfoMediaIg[] | null;
      waktu?: string;
    };
  } | null;
};

type ReferensiIg = {
  merek: string;
  id: string;
  permalink: string | null;
  caption: string | null;
  diposting_at: string | null;
  statistik: {
    suka?: number;
    komentar?: number;
    tayangan?: number;
    simpan?: number;
    bagikan?: number;
  } | null;
};

type MediaAkunIg = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

function adalahGalatKerasMeta(status: number, errObj?: { code?: number; message?: string } | null): boolean {
  if (status === 429 || status === 401 || status === 403) return true;
  const code = Number(errObj?.code);
  if ([4, 10, 17, 32, 190, 200, 368].includes(code)) return true;
  const msg = String(errObj?.message ?? "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("request limit") ||
    msg.includes("checkpoint") ||
    msg.includes("suspend") ||
    msg.includes("disabled") ||
    msg.includes("blocked") ||
    msg.includes("session")
  );
}

/**
 * Ambil 1 kali saja metrik paling aman (`views,reach`) untuk satu media IG.
 * Tidak melakukan loop percobaan ulang beruntun agar tidak pernah memicu alarm anti-bot Meta.
 */
async function tarikMetrikRingan(host: string, token: string, mediaId: string) {
  const url = `https://${host}/${VERSI()}/${mediaId}/insights?metric=views,reach&access_token=${token}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res) return { views: null, reach: null, galat: null, hentikanAkun: false };

  const j = await res.json().catch(() => null);
  if (!res.ok) {
    const pesanErr = j?.error?.message ? String(j.error.message) : `HTTP ${res.status}`;
    const hentikanAkun = adalahGalatKerasMeta(res.status, j?.error);
    return { views: null, reach: null, galat: hentikanAkun ? pesanErr : null, hentikanAkun };
  }

  let views: number | null = null;
  let reach: number | null = null;
  if (Array.isArray(j?.data)) {
    for (const item of j.data) {
      const val = Number(item.values?.[0]?.value ?? item.total_value?.value);
      if (!Number.isFinite(val)) continue;
      if (item.name === "views") views = val;
      if (item.name === "reach") reach = val;
    }
  }
  if (views == null && reach != null) views = reach;
  return { views, reach, galat: null, hentikanAkun: false };
}

/** Simpan snapshot insight Story ke baris studio_tugas agar tetap terbaca meski Story sudah lewat 24 jam. */
async function simpanSnapshotStory(t: TugasTayang, snap: SnapshotInsightStory) {
  if (!t.tayang?.instagram) return;
  const igLama = t.tayang.instagram;
  const storyLama = igLama.story ?? igLama.stories?.[0];
  if (!storyLama?.id) return;
  const snapLama = storyLama.insight;
  if (snapLama && snapLama.views === snap.views && snapLama.reach === snap.reach) return;

  const storyBaru = { ...storyLama, insight: { ...snap, diambil: new Date().toISOString() } };
  const storiesBaru = Array.isArray(igLama.stories)
    ? igLama.stories.map((s) => (s.id === storyLama.id ? { ...s, insight: storyBaru.insight } : s))
    : igLama.stories;

  await rest(`studio_tugas?id=eq.${encodeURIComponent(t.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      tayang: {
        ...t.tayang,
        instagram: {
          ...igLama,
          story: storyBaru,
          ...(storiesBaru ? { stories: storiesBaru } : {}),
        },
      },
    }),
  }).catch(() => {});
}

/** Simpan cache insight per merek ke studio_merek.profil.insight_cache agar persisten di Vercel Serverless. */
async function simpanCacheMerek(merek: BarisMerek, cache: CacheInsightMerek) {
  const profilBaru = { ...(merek.profil ?? {}), insight_cache: cache };
  await rest(`studio_merek?slug=eq.${encodeURIComponent(merek.slug)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ profil: profilBaru, diubah: new Date().toISOString() }),
  }).catch(() => {});
}

function bangunPostDariTugas(t: TugasTayang, refPerMedia: Map<string, ReferensiIg>): PostInsight {
  const merek = t.merek ?? "bakafrawi";
  const infoIg = t.tayang?.instagram;
  const storyUtama = infoIg?.story?.id ? infoIg.story : infoIg?.stories?.find((s) => Boolean(s?.id)) ?? null;
  const mediaUtama = infoIg?.reels?.id ? infoIg.reels : infoIg?.feed?.id ? infoIg.feed : storyUtama;
  const format: PostInsight["format"] = infoIg?.reels?.id
    ? "reels"
    : infoIg?.feed?.id
    ? "feed"
    : storyUtama?.id || t.tayang?.sasaran === "story" || t.produk_slug === "rutin-buka"
    ? "story"
    : t.jenis === "video"
    ? "reels"
    : "feed";
  const adalahStory = format === "story";
  const mediaId = mediaUtama?.id ?? null;
  const tayangWaktu = infoIg?.waktu ?? t.dibuat;
  const h = t.hasil ?? [];
  const thumbnail = h.find((x) => x.rasio === "sampul")?.url ?? h.find((x) => x.jenis === "gambar")?.url ?? null;
  const videoUrl = h.find((x) => x.jenis === "video")?.url ?? null;

  const ref = mediaId ? refPerMedia.get(mediaId) : undefined;
  const snapStory = adalahStory ? storyUtama?.insight : undefined;
  const umurJam = (Date.now() - new Date(tayangWaktu).getTime()) / 3_600_000;

  return {
    id: t.id,
    merek,
    produk: t.produk_slug,
    jenis: t.jenis,
    format,
    caption: t.caption,
    dibuat: t.dibuat,
    tayangWaktu,
    permalink: mediaUtama?.permalink ?? ref?.permalink ?? null,
    mediaId,
    thumbnail,
    videoUrl,
    likes: Number(ref?.statistik?.suka) || 0,
    comments: Number(ref?.statistik?.komentar) || 0,
    views:
      snapStory?.views != null
        ? Number(snapStory.views)
        : ref?.statistik?.tayangan != null
        ? Number(ref.statistik.tayangan)
        : null,
    reach: snapStory?.reach != null ? Number(snapStory.reach) : null,
    saved: ref?.statistik?.simpan != null ? Number(ref.statistik.simpan) : null,
    shares:
      snapStory?.shares != null
        ? Number(snapStory.shares)
        : ref?.statistik?.bagikan != null
        ? Number(ref.statistik.bagikan)
        : null,
    replies: snapStory?.replies != null ? Number(snapStory.replies) : null,
    ...(adalahStory ? { arsipStory: umurJam >= 24 } : {}),
  };
}

/**
 * Ambil ringkasan Insight Instagram.
 * - `paksaSegar = false` (bawaan saat buka Beranda): 100% BACA CACHE SUPABASE, 0 panggilan ke Meta API!
 * - `paksaSegar = true` (hanya saat Kyai klik tombol "Segarkan dari IG"): tarik ringan maksimal 1x per 15 menit.
 */
export async function ambilInsightInstagram(paksaSegar = false): Promise<RingkasInsight> {
  try {
    const [merekList, kredList, tugasList, refList] = await Promise.all([
      (rest("studio_merek?select=slug,aktif,profil") as Promise<BarisMerek[] | null>).catch(() => null),
      (rest("studio_kredensial?layanan=eq.instagram&select=merek,data") as Promise<KredensialIg[] | null>).catch(() => null),
      (rest(
        "studio_tugas?status_tayang=eq.tayang&tayang=not.is.null&select=id,merek,produk_slug,jenis,caption,dibuat,status_tayang,tayang,hasil&order=dibuat.desc&limit=40",
      ) as Promise<TugasTayang[] | null>).catch(() => null),
      (rest(
        "studio_referensi?sumber=eq.ig&select=merek,id,permalink,caption,diposting_at,statistik&order=diposting_at.desc.nullslast&limit=50",
      ) as Promise<ReferensiIg[] | null>).catch(() => null),
    ]);

    const daftarMerek = merekList ?? [];
    const petaMerek = new Map(daftarMerek.map((m) => [m.slug, m]));
    const daftarKred = (kredList ?? []).filter((k) => petaMerek.get(k.merek)?.aktif !== false);
    const tersambung = daftarKred.some((k) => Boolean(k.data?.ig_token && k.data?.ig_user_id));
    const akun = daftarKred.map((k) => k.data?.ig_akun).filter(Boolean).join(", ") || null;

    const refPerMedia = new Map<string, ReferensiIg>();
    for (const r of refList ?? []) {
      refPerMedia.set(r.id.replace(/^ig:/, ""), r);
    }

    const postsGabung = new Map<string, PostInsight>();
    const masukkanPost = (p: PostInsight) => {
      const kunci = p.mediaId || p.id;
      const lama = postsGabung.get(kunci);
      if (!lama) {
        postsGabung.set(kunci, p);
        return;
      }
      // Gabungkan tanpa menghilangkan sampul lokal Studio atau snapshot views yang sudah ada
      postsGabung.set(kunci, {
        ...lama,
        ...p,
        thumbnail: lama.thumbnail ?? p.thumbnail,
        videoUrl: lama.videoUrl ?? p.videoUrl,
        views: p.views ?? lama.views,
        reach: p.reach ?? lama.reach,
        likes: Math.max(lama.likes, p.likes),
        comments: Math.max(lama.comments, p.comments),
      });
    };

    // 1. Selalu muat tugas yang sudah tayang dari database lokal (0 request Meta)
    for (const t of tugasList ?? []) {
      masukkanPost(bangunPostDariTugas(t, refPerMedia));
    }

    // 2. Muat cache insight terakhir yang tersimpan di studio_merek.profil.insight_cache (0 request Meta)
    let diambilTerbaru: string | null = null;
    let galatInsight: string | null = null;
    let dariCache = true;
    const sekarangMs = Date.now();

    for (const m of daftarMerek) {
      if (!m.aktif) continue;
      const cache = m.profil?.insight_cache;
      if (cache?.diambil && (!diambilTerbaru || cache.diambil > diambilTerbaru)) {
        diambilTerbaru = cache.diambil;
      }
      if (cache?.galat && !galatInsight) {
        galatInsight = cache.galat;
      }
      for (const p of cache?.posts ?? []) {
        masukkanPost(p);
      }
    }

    // 3. HANYA tarik dari Meta Graph API jika Kyai menekan "Segarkan dari IG" secara manual (paksaSegar = true)
    if (paksaSegar && tersambung) {
      for (const k of daftarKred) {
        const barisMerek = petaMerek.get(k.merek);
        if (!barisMerek || !barisMerek.aktif) continue;

        const token = k.data?.ig_token;
        const userId = k.data?.ig_user_id;
        if (!token || !userId) continue;

        const cacheLama = barisMerek.profil?.insight_cache;
        // Cek circuit breaker (jeda 6 jam bila akun sedang kena batas / galat keras Meta)
        if (cacheLama?.jedaSampai && new Date(cacheLama.jedaSampai).getTime() > sekarangMs) {
          galatInsight =
            cacheLama.galat ??
            `Penarikan otomatis untuk ${k.data?.ig_akun ?? k.merek} sedang dijeda sementara demi keamanan akun.`;
          continue;
        }
        // Cek cooldown 15 menit persisten di database
        if (cacheLama?.diambil && sekarangMs - new Date(cacheLama.diambil).getTime() < COOLDOWN_SEGAR_MS) {
          continue;
        }

        dariCache = false;
        const host = k.data.ig_host === "facebook" ? "graph.facebook.com" : "graph.instagram.com";
        const milik = k.data.ig_host === "facebook" ? userId : "me";
        const hasilMerek: PostInsight[] = [];
        let galatMerek: string | null = null;
        let hentikan = false;

        // 3a. Ambil maks 2 Story aktif (<24 jam) dari /{milik}/stories secara berurutan santai
        const qStory = new URLSearchParams({
          fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
          access_token: token,
        });
        const resStory = await fetch(`https://${host}/${VERSI()}/${milik}/stories?${qStory}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }).catch(() => null);

        if (resStory) {
          const js = await resStory.json().catch(() => null);
          if (!resStory.ok) {
            if (adalahGalatKerasMeta(resStory.status, js?.error)) {
              hentikan = true;
              galatMerek = String(js?.error?.message ?? `HTTP ${resStory.status}`);
            }
          } else if (Array.isArray(js?.data)) {
            const daftarStory = (js.data as MediaAkunIg[]).slice(0, 2);
            for (const s of daftarStory) {
              if (!s.id || hentikan) break;
              await tidur(JEDA_ANTAR_REQ_MS);
              const met = await tarikMetrikRingan(host, token, s.id);
              if (met.hentikanAkun) {
                hentikan = true;
                galatMerek = met.galat;
                break;
              }
              const adalahVideo = s.media_type === "VIDEO";
              const postStory: PostInsight = {
                id: `ig-story-${s.id}`,
                merek: k.merek,
                produk: k.merek,
                jenis: adalahVideo ? "video" : "gambar",
                format: "story",
                caption: s.caption ?? null,
                dibuat: s.timestamp ?? new Date().toISOString(),
                tayangWaktu: s.timestamp ?? null,
                permalink: s.permalink ?? null,
                mediaId: s.id,
                thumbnail: s.thumbnail_url ?? (!adalahVideo ? s.media_url ?? null : null),
                videoUrl: adalahVideo ? s.media_url ?? null : null,
                likes: 0,
                comments: 0,
                views: met.views,
                reach: met.reach,
                saved: null,
                shares: null,
                arsipStory: false,
              };
              hasilMerek.push(postStory);
              masukkanPost(postStory);

              // Jika Story ini cocok dengan tugas Studio, simpan snapshotnya agar awet >24 jam
              const tugasCocok = (tugasList ?? []).find(
                (t) =>
                  t.tayang?.instagram?.story?.id === s.id ||
                  t.tayang?.instagram?.stories?.some((x) => x.id === s.id),
              );
              if (tugasCocok && (met.views != null || met.reach != null)) {
                void simpanSnapshotStory(tugasCocok, { views: met.views, reach: met.reach });
              }
            }
          }
        }

        // 3b. Ambil daftar Feed/Reels terbaru (1 request = maks 20 post), lalu tarik metrik asli views/reach
        // untuk post baru (< 7 hari) atau post lama yang angka penontonnya belum pernah tersimpan di cache.
        if (!hentikan) {
          await tidur(JEDA_ANTAR_REQ_MS);
          const qMedia = new URLSearchParams({
            fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
            limit: String(MAKS_MEDIA_TARIK),
            access_token: token,
          });
          const resMedia = await fetch(`https://${host}/${VERSI()}/${milik}/media?${qMedia}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
          }).catch(() => null);

          if (resMedia) {
            const jm = await resMedia.json().catch(() => null);
            if (!resMedia.ok) {
              if (adalahGalatKerasMeta(resMedia.status, jm?.error)) {
                hentikan = true;
                galatMerek = String(jm?.error?.message ?? `HTTP ${resMedia.status}`);
              }
            } else if (Array.isArray(jm?.data)) {
              const daftarMedia = (jm.data as MediaAkunIg[]).slice(0, MAKS_MEDIA_TARIK);
              for (const m of daftarMedia) {
                if (!m.id || hentikan) break;
                const lama = postsGabung.get(m.id);
                const umurHari = m.timestamp ? (sekarangMs - new Date(m.timestamp).getTime()) / 86_400_000 : 0;
                const perluTarikMetrik = lama?.views == null || umurHari < 7;
                let views: number | null = lama?.views ?? null;
                let reach: number | null = lama?.reach ?? null;
                if (perluTarikMetrik) {
                  await tidur(JEDA_ANTAR_REQ_MS);
                  const met = await tarikMetrikRingan(host, token, m.id);
                  if (met.hentikanAkun) {
                    hentikan = true;
                    galatMerek = met.galat;
                    break;
                  }
                  if (met.views != null) views = met.views;
                  if (met.reach != null) reach = met.reach;
                }
                const adalahVideo = m.media_type === "VIDEO" || m.media_product_type === "REELS";
                const format: PostInsight["format"] =
                  m.media_product_type === "STORY" ? "story" : adalahVideo ? "reels" : "feed";
                const postMedia: PostInsight = {
                  id: `ig-${m.id}`,
                  merek: k.merek,
                  produk: k.merek,
                  jenis: adalahVideo ? "video" : "gambar",
                  format,
                  caption: m.caption ?? null,
                  dibuat: m.timestamp ?? new Date().toISOString(),
                  tayangWaktu: m.timestamp ?? null,
                  permalink: m.permalink ?? null,
                  mediaId: m.id,
                  thumbnail: m.thumbnail_url ?? (!adalahVideo ? m.media_url ?? null : null),
                  videoUrl: adalahVideo ? m.media_url ?? null : null,
                  likes: Number(m.like_count) || 0,
                  comments: Number(m.comments_count) || 0,
                  views,
                  reach,
                  saved: null,
                  shares: null,
                };
                hasilMerek.push(postMedia);
                masukkanPost(postMedia);
              }
            }
          }
        }

        const waktuKini = new Date().toISOString();
        diambilTerbaru = waktuKini;
        if (galatMerek && !galatInsight) galatInsight = galatMerek;

        // Gabungkan (merge) hasil baru dengan cache lama merek agar postingan lama tidak terhapus saat refresh
        const gabungCache = new Map<string, PostInsight>();
        for (const p of cacheLama?.posts ?? []) gabungCache.set(p.mediaId || p.id, p);
        for (const p of hasilMerek) {
          const kP = p.mediaId || p.id;
          const lama = gabungCache.get(kP);
          gabungCache.set(
            kP,
            lama
              ? {
                  ...lama,
                  ...p,
                  thumbnail: p.thumbnail ?? lama.thumbnail,
                  videoUrl: p.videoUrl ?? lama.videoUrl,
                  views: p.views ?? lama.views,
                  reach: p.reach ?? lama.reach,
                  likes: Math.max(lama.likes, p.likes),
                  comments: Math.max(lama.comments, p.comments),
                }
              : p,
          );
        }
        const postsCacheSimpan = [...gabungCache.values()]
          .sort((a, b) => new Date(b.tayangWaktu ?? b.dibuat).getTime() - new Date(a.tayangWaktu ?? a.dibuat).getTime())
          .slice(0, MAKS_CACHE_PER_MEREK);

        await simpanCacheMerek(barisMerek, {
          diambil: waktuKini,
          jedaSampai: hentikan ? new Date(Date.now() + JEDA_CIRCUIT_BREAKER_MS).toISOString() : null,
          galat: galatMerek,
          posts: postsCacheSimpan,
        });
      }
    }

    // 4. Ikut gabungkan data historis postingan akun sendiri dari studio_referensi (0 request Meta).
    // Saring ketat: wajib ID media IG numerik (`ig:<angka>`) & punya `diposting_at` asli agar video
    // referensi gaya dari akun orang lain tidak nyasar masuk ke Insight.
    for (const r of refList ?? []) {
      if (!/^ig:\d+$/.test(r.id) || !r.diposting_at) continue;
      const mId = r.id.replace(/^ig:/, "");
      if (postsGabung.has(mId)) continue;
      masukkanPost({
        id: r.id,
        merek: r.merek,
        produk: r.merek,
        jenis: "video",
        format: "reels",
        caption: r.caption,
        dibuat: r.diposting_at,
        tayangWaktu: r.diposting_at,
        permalink: r.permalink,
        mediaId: mId,
        thumbnail: null,
        videoUrl: null,
        likes: Number(r.statistik?.suka) || 0,
        comments: Number(r.statistik?.komentar) || 0,
        views: r.statistik?.tayangan != null ? Number(r.statistik.tayangan) : null,
        reach: null,
        saved: r.statistik?.simpan != null ? Number(r.statistik.simpan) : null,
        shares: r.statistik?.bagikan != null ? Number(r.statistik.bagikan) : null,
      });
    }

    const posts = [...postsGabung.values()].sort(
      (a, b) => new Date(b.tayangWaktu ?? b.dibuat).getTime() - new Date(a.tayangWaktu ?? a.dibuat).getTime(),
    );

    const totalLikes = posts.reduce((a, b) => a + b.likes, 0);
    const totalComments = posts.reduce((a, b) => a + b.comments, 0);
    const totalViews = posts.reduce((a, b) => a + (b.views ?? 0), 0);
    const daftarStoryPost = posts.filter((p) => p.format === "story");

    return {
      tersambung,
      akun,
      totalTayang: posts.length,
      totalLikes,
      totalComments,
      totalViews,
      totalStory: daftarStoryPost.length,
      totalStoryViews: daftarStoryPost.reduce((a, b) => a + (b.views ?? 0), 0),
      posts,
      diambilPada: diambilTerbaru,
      dariCache,
      galatInsight,
      ...(posts.length === 0
        ? {
            pesan: tersambung
              ? "Mode hemat Meta aktif — tekan tombol Segarkan dari IG (maks 1× per 15 menit) untuk menarik data terbaru."
              : "Instagram belum tersambung.",
          }
        : {}),
    };
  } catch (e) {
    return {
      tersambung: false,
      akun: null,
      totalTayang: 0,
      totalLikes: 0,
      totalComments: 0,
      totalViews: 0,
      posts: [],
      pesan: e instanceof Error ? e.message : "Gagal memuat insight Instagram.",
    };
  }
}
