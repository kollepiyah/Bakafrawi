import "server-only";
import { rest } from "./db-server";

const VERSI = () => process.env.IG_API_VERSI || "v27.0";

// Cache 3 menit di server agar auto-refresh Beranda (tiap 30 dtk) tidak memicu rate-limit Meta Graph API.
let cacheInsight: { waktu: number; data: RingkasInsight } | null = null;
const TTL_CACHE_MS = 3 * 60_000;

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

/** Ambil insight (views/plays/reach/impressions/saved/shares/replies) untuk satu media IG (Reels, Feed, atau Story). */
async function tarikMetrikMedia(host: string, token: string, mediaId: string, adalahStory = false) {
  let views: number | null = null;
  let reach: number | null = null;
  let saved: number | null = null;
  let shares: number | null = null;
  let replies: number | null = null;
  let galat: string | null = null;

  // Story tidak mendukung metrik 'saved' (akan ditolak Meta API); gunakan paket metrik khusus Story.
  const paketMetrik = adalahStory
    ? ["views,reach,replies,shares", "views,reach", "reach,replies,shares", "impressions,reach", "views", "reach"]
    : ["views,reach,saved,shares", "views", "reach"];

  for (const metrik of paketMetrik) {
    const url = `https://${host}/${VERSI()}/${mediaId}/insights?metric=${metrik}&access_token=${token}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(9000) }).catch(() => null);
    if (!res) continue;
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      const pesanErr = j?.error?.message ? String(j.error.message) : null;
      // Untuk Story yang sudah lewat 24 jam, Meta API mengembalikan error/kosong — jangan timpa galat global izin token.
      if (!adalahStory && !galat && pesanErr) galat = pesanErr;
      // Bila error permission/OAuth (#10 / #200 / #190), hentikan percobaan metrik lain agar cepat.
      if (j?.error?.code === 10 || j?.error?.code === 190 || j?.error?.code === 200) {
        if (!galat && pesanErr) galat = pesanErr;
        break;
      }
      continue;
    }
    if (!Array.isArray(j?.data)) continue;

    for (const item of j.data) {
      const val = Number(item.values?.[0]?.value ?? item.total_value?.value);
      if (!Number.isFinite(val)) continue;
      if (
        item.name === "views" ||
        (item.name === "impressions" && views == null) ||
        (item.name === "plays" && views == null) ||
        (item.name === "ig_reels_aggregated_all_plays_count" && views == null)
      ) {
        views = val;
      }
      if (item.name === "reach") reach = val;
      if (item.name === "saved") saved = val;
      if (item.name === "shares") shares = val;
      if (item.name === "replies") replies = val;
    }
    if (views != null || (adalahStory && reach != null)) break;
  }

  // Bila Instagram tidak mengembalikan 'views' tetapi ada 'reach', gunakan reach sebagai estimasi penonton.
  if (views == null && reach != null) views = reach;

  return { views, reach, saved, shares, replies, galat };
}

/** Simpan snapshot insight Story ke baris studio_tugas agar tetap terbaca meski Story sudah lewat 24 jam. */
async function simpanSnapshotStory(t: TugasTayang, snap: SnapshotInsightStory) {
  if (!t.tayang?.instagram) return;
  const igLama = t.tayang.instagram;
  const storyLama = igLama.story ?? igLama.stories?.[0];
  if (!storyLama?.id) return;

  const snapLama = storyLama.insight;
  if (
    snapLama &&
    snapLama.views === snap.views &&
    snapLama.reach === snap.reach &&
    snapLama.replies === snap.replies &&
    snapLama.shares === snap.shares
  ) {
    return;
  }

  const storyBaru = { ...storyLama, insight: { ...snap, diambil: new Date().toISOString() } };
  const storiesBaru = Array.isArray(igLama.stories)
    ? igLama.stories.map((s) => (s.id === storyLama.id ? { ...s, insight: storyBaru.insight } : s))
    : igLama.stories;

  const tayangBaru = {
    ...t.tayang,
    instagram: {
      ...igLama,
      story: storyBaru,
      ...(storiesBaru ? { stories: storiesBaru } : {}),
    },
  };
  await rest(`studio_tugas?id=eq.${encodeURIComponent(t.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ tayang: tayangBaru }),
  }).catch(() => {});
}

export async function ambilInsightInstagram(paksaSegar = false): Promise<RingkasInsight> {
  if (!paksaSegar && cacheInsight && Date.now() - cacheInsight.waktu < TTL_CACHE_MS) {
    return cacheInsight.data;
  }
  try {
    // 1. Kredensial Instagram semua merek + tugas tayang + cache studio_referensi
    const [kredList, tugasList, refList] = await Promise.all([
      (rest("studio_kredensial?layanan=eq.instagram&select=merek,data") as Promise<KredensialIg[] | null>).catch(() => null),
      (rest(
        "studio_tugas?status_tayang=eq.tayang&tayang=not.is.null&select=id,merek,produk_slug,jenis,caption,dibuat,status_tayang,tayang,hasil&order=dibuat.desc&limit=10",
      ) as Promise<TugasTayang[] | null>).catch(() => null),
      (rest(
        "studio_referensi?sumber=eq.ig&select=merek,id,permalink,caption,diposting_at,statistik&order=diposting_at.desc.nullslast&limit=20",
      ) as Promise<ReferensiIg[] | null>).catch(() => null),
    ]);

    const daftarKred = kredList ?? [];
    const kredPer = new Map(daftarKred.map((k) => [k.merek, k.data]));
    const tersambung = daftarKred.some((k) => Boolean(k.data?.ig_token && k.data?.ig_user_id));
    const akun = daftarKred.map((k) => k.data?.ig_akun).filter(Boolean).join(", ") || null;

    // Peta statistik dari studio_referensi (key: mediaId tanpa prefix "ig:")
    const refPerMedia = new Map<string, ReferensiIg>();
    for (const r of refList ?? []) {
      const mId = r.id.replace(/^ig:/, "");
      refPerMedia.set(mId, r);
    }

    const mediaSudah = new Set<string>();
    const posts: PostInsight[] = [];
    let galatInsightPertama: string | null = null;

    // 2. Proses tugas yang ditayangkan dari Studio (Reels, Feed, maupun Story)
    if (tugasList && tugasList.length > 0) {
      const hasilTugas = await Promise.all(
        tugasList.map(async (t): Promise<PostInsight> => {
          const merek = t.merek ?? "bakafrawi";
          const kred = kredPer.get(merek);
          const token = kred?.ig_token;
          const host = kred?.ig_host === "facebook" ? "graph.facebook.com" : "graph.instagram.com";
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
          if (mediaId) mediaSudah.add(mediaId);

          let permalink = mediaUtama?.permalink ?? null;
          const tayangWaktu = infoIg?.waktu ?? t.dibuat;
          const h = t.hasil ?? [];
          let thumbnail: string | null =
            h.find((x) => x.rasio === "sampul")?.url ?? h.find((x) => x.jenis === "gambar")?.url ?? null;
          const videoUrl = h.find((x) => x.jenis === "video")?.url ?? null;

          const ref = mediaId ? refPerMedia.get(mediaId) : undefined;
          const snapStory = adalahStory ? storyUtama?.insight : undefined;
          let likes = Number(ref?.statistik?.suka) || 0;
          let comments = Number(ref?.statistik?.komentar) || 0;
          let views: number | null =
            snapStory?.views != null
              ? Number(snapStory.views)
              : ref?.statistik?.tayangan != null
              ? Number(ref.statistik.tayangan)
              : null;
          let reach: number | null = snapStory?.reach != null ? Number(snapStory.reach) : null;
          let saved: number | null = ref?.statistik?.simpan != null ? Number(ref.statistik.simpan) : null;
          let shares: number | null =
            snapStory?.shares != null
              ? Number(snapStory.shares)
              : ref?.statistik?.bagikan != null
              ? Number(ref.statistik.bagikan)
              : null;
          let replies: number | null = snapStory?.replies != null ? Number(snapStory.replies) : null;
          const umurJam = (Date.now() - new Date(tayangWaktu).getTime()) / 3_600_000;
          let arsipStory = adalahStory && umurJam >= 24;

          if (token && mediaId) {
            try {
              const fieldsMedia = adalahStory
                ? "id,permalink,thumbnail_url,media_url,media_type"
                : "id,like_count,comments_count,permalink,thumbnail_url,media_url,media_type";
              const urlMedia = `https://${host}/${VERSI()}/${mediaId}?fields=${fieldsMedia}&access_token=${token}`;
              const res = await fetch(urlMedia, { cache: "no-store", signal: AbortSignal.timeout(9000) }).catch(() => null);
              if (res && res.ok) {
                const j = await res.json();
                if (!adalahStory) {
                  likes = Number(j.like_count) || likes;
                  comments = Number(j.comments_count) || comments;
                }
                if (j.permalink) permalink = j.permalink;
                // Pertahankan sampul Studio (frame detik 1.5); hanya pakai thumbnail IG bila belum ada.
                if (!thumbnail && j.thumbnail_url) thumbnail = j.thumbnail_url;
                else if (!thumbnail && j.media_type === "IMAGE" && j.media_url) thumbnail = j.media_url;
              }

              const m = await tarikMetrikMedia(host, token, mediaId, adalahStory);
              if (m.galat && !galatInsightPertama) galatInsightPertama = m.galat;
              if (m.views != null) views = m.views;
              if (m.reach != null) reach = m.reach;
              if (m.saved != null) saved = m.saved;
              if (m.shares != null) shares = m.shares;
              if (m.replies != null) replies = m.replies;

              if (adalahStory && (m.views != null || m.reach != null)) {
                arsipStory = false;
                void simpanSnapshotStory(t, { views, reach, replies, shares });
              }
            } catch {
              // Gunakan data fallback/snapshot bila gagal jaringan atau Story sudah > 24 jam
            }
          }

          return {
            id: t.id,
            merek,
            produk: t.produk_slug,
            jenis: t.jenis,
            format,
            caption: t.caption,
            dibuat: t.dibuat,
            tayangWaktu,
            permalink,
            mediaId,
            thumbnail,
            videoUrl,
            likes,
            comments,
            views,
            reach,
            saved,
            shares,
            replies,
            ...(adalahStory ? { arsipStory } : {}),
          };
        }),
      );
      posts.push(...hasilTugas);
    }

    // 3. Tarik juga postingan (Feed/Reels) & Story aktif (<24 jam) langsung dari akun IG yang tersambung
    for (const k of daftarKred) {
      const token = k.data?.ig_token;
      const userId = k.data?.ig_user_id;
      if (!token || !userId) continue;

      const host = k.data.ig_host === "facebook" ? "graph.facebook.com" : "graph.instagram.com";
      const milik = k.data.ig_host === "facebook" ? userId : "me";

      // 3a. Story aktif (<24 jam) — endpoint /{user}/stories (/{user}/media tidak pernah mengembalikan Story!)
      const qStory = new URLSearchParams({
        fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp",
        access_token: token,
      });
      const resStory = await fetch(`https://${host}/${VERSI()}/${milik}/stories?${qStory}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(9000),
      }).catch(() => null);
      if (resStory && resStory.ok) {
        const js = await resStory.json().catch(() => null);
        const daftarStory = (js?.data ?? []) as MediaAkunIg[];
        const tambahanStory = await Promise.all(
          daftarStory
            .filter((s) => s.id && !mediaSudah.has(s.id))
            .slice(0, 8)
            .map(async (s): Promise<PostInsight> => {
              mediaSudah.add(s.id);
              const adalahVideo = s.media_type === "VIDEO";
              const metrik = await tarikMetrikMedia(host, token, s.id, true);
              if (metrik.galat && !galatInsightPertama) galatInsightPertama = metrik.galat;
              return {
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
                comments: metrik.replies ?? 0,
                views: metrik.views,
                reach: metrik.reach,
                saved: null,
                shares: metrik.shares,
                replies: metrik.replies,
                arsipStory: false,
              };
            }),
        );
        posts.push(...tambahanStory);
      }

      // 3b. Feed & Reels terbaru dari /{user}/media
      const q = new URLSearchParams({
        fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
        limit: "8",
        access_token: token,
      });

      const res = await fetch(`https://${host}/${VERSI()}/${milik}/media?${q}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(9000),
      }).catch(() => null);
      if (!res || !res.ok) continue;
      const j = await res.json().catch(() => null);
      const daftarMedia = (j?.data ?? []) as MediaAkunIg[];

      const tambahan = await Promise.all(
        daftarMedia
          .filter((m) => m.id && !mediaSudah.has(m.id))
          .slice(0, 6)
          .map(async (m): Promise<PostInsight> => {
            mediaSudah.add(m.id);
            const ref = refPerMedia.get(m.id);
            const adalahVideo = m.media_type === "VIDEO" || m.media_product_type === "REELS";
            const format: PostInsight["format"] = m.media_product_type === "STORY"
              ? "story"
              : adalahVideo
              ? "reels"
              : "feed";
            const metrik = await tarikMetrikMedia(host, token, m.id, format === "story");
            if (metrik.galat && !galatInsightPertama) galatInsightPertama = metrik.galat;
            const views = metrik.views ?? (ref?.statistik?.tayangan != null ? Number(ref.statistik.tayangan) : null);

            return {
              id: `ig-${m.id}`,
              merek: k.merek,
              produk: k.merek,
              jenis: adalahVideo ? "video" : "gambar",
              format,
              caption: m.caption ?? ref?.caption ?? null,
              dibuat: m.timestamp ?? ref?.diposting_at ?? new Date().toISOString(),
              tayangWaktu: m.timestamp ?? ref?.diposting_at ?? null,
              permalink: m.permalink ?? ref?.permalink ?? null,
              mediaId: m.id,
              thumbnail: m.thumbnail_url ?? (!adalahVideo ? m.media_url ?? null : null),
              videoUrl: adalahVideo ? m.media_url ?? null : null,
              likes: Number(m.like_count ?? ref?.statistik?.suka) || 0,
              comments: Number(m.comments_count ?? ref?.statistik?.komentar) || 0,
              views,
              reach: metrik.reach,
              saved: metrik.saved ?? (ref?.statistik?.simpan != null ? Number(ref.statistik.simpan) : null),
              shares: metrik.shares ?? (ref?.statistik?.bagikan != null ? Number(ref.statistik.bagikan) : null),
              replies: metrik.replies,
            };
          }),
      );
      posts.push(...tambahan);
    }

    // 4. Bila token IG belum aktif atau gagal, tapi ada data di studio_referensi, tampilkan dari cache referensi
    if (posts.length === 0 && (refList?.length ?? 0) > 0) {
      for (const r of refList ?? []) {
        const mId = r.id.replace(/^ig:/, "");
        if (mediaSudah.has(mId)) continue;
        mediaSudah.add(mId);
        posts.push({
          id: r.id,
          merek: r.merek,
          produk: r.merek,
          jenis: "video",
          format: "reels",
          caption: r.caption,
          dibuat: r.diposting_at ?? new Date().toISOString(),
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
    }

    posts.sort((a, b) => new Date(b.tayangWaktu ?? b.dibuat).getTime() - new Date(a.tayangWaktu ?? a.dibuat).getTime());

    const totalLikes = posts.reduce((a, b) => a + b.likes, 0);
    const totalComments = posts.reduce((a, b) => a + b.comments, 0);
    const totalViews = posts.reduce((a, b) => a + (b.views ?? 0), 0);
    const daftarStoryPost = posts.filter((p) => p.format === "story");
    const totalStory = daftarStoryPost.length;
    const totalStoryViews = daftarStoryPost.reduce((a, b) => a + (b.views ?? 0), 0);

    const hasilAkhir: RingkasInsight = {
      tersambung,
      akun,
      totalTayang: posts.length,
      totalLikes,
      totalComments,
      totalViews,
      totalStory,
      totalStoryViews,
      posts,
      galatInsight: galatInsightPertama,
      ...(posts.length === 0
        ? { pesan: tersambung ? "Belum ada konten yang diposting ke Instagram." : "Instagram belum tersambung." }
        : {}),
    };
    cacheInsight = { waktu: Date.now(), data: hasilAkhir };
    return hasilAkhir;
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
