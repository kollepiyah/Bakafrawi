import "server-only";
import { rest } from "./db-server";

const VERSI = () => process.env.IG_API_VERSI || "v27.0";

export type PostInsight = {
  id: string;
  produk: string;
  jenis: string;
  caption: string | null;
  dibuat: string;
  tayangWaktu: string | null;
  permalink: string | null;
  mediaId: string | null;
  likes: number;
  comments: number;
  views?: number | null;
  reach?: number | null;
  saved?: number | null;
  shares?: number | null;
};

export type RingkasInsight = {
  tersambung: boolean;
  akun: string | null;
  totalTayang: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  posts: PostInsight[];
  pesan?: string;
};

type KredensialIg = {
  data: {
    ig_token?: string;
    ig_host?: "instagram" | "facebook";
    ig_user_id?: string;
    ig_akun?: string;
  };
};

type TugasTayang = {
  id: string;
  produk_slug: string;
  jenis: string;
  caption: string | null;
  dibuat: string;
  status_tayang: string;
  tayang: {
    instagram?: {
      reels?: { id?: string; permalink?: string };
      feed?: { id?: string; permalink?: string };
      waktu?: string;
    };
  } | null;
};

export async function ambilInsightInstagram(): Promise<RingkasInsight> {
  try {
    // 1. Ambil kredensial Instagram Bakafrawi
    const kredList = (await rest("studio_kredensial?merek=eq.bakafrawi&layanan=eq.instagram&select=data")) as KredensialIg[] | null;
    const kred = kredList?.[0]?.data;
    const tersambung = Boolean(kred?.ig_token && kred?.ig_user_id);
    const akun = kred?.ig_akun ?? null;

    // 2. Ambil tugas yang sudah berstatus 'tayang'
    const tugasList = (await rest(
      "studio_tugas?merek=eq.bakafrawi&status_tayang=eq.tayang&tayang=not.is.null&order=dibuat.desc&limit=8",
    )) as TugasTayang[] | null;

    if (!tugasList || tugasList.length === 0) {
      return {
        tersambung,
        akun,
        totalTayang: 0,
        totalLikes: 0,
        totalComments: 0,
        totalViews: 0,
        posts: [],
        pesan: tersambung ? "Belum ada konten yang diposting ke Instagram." : "Instagram belum tersambung.",
      };
    }

    const token = kred?.ig_token;
    const host = kred?.ig_host === "facebook" ? "graph.facebook.com" : "graph.instagram.com";

    // 3. Tarik metrik tiap postingan secara paralel
    const posts: PostInsight[] = await Promise.all(
      tugasList.map(async (t): Promise<PostInsight> => {
        const infoIg = t.tayang?.instagram;
        const media = infoIg?.reels ?? infoIg?.feed;
        const mediaId = media?.id ?? null;
        let permalink = media?.permalink ?? null;
        const tayangWaktu = infoIg?.waktu ?? t.dibuat;

        let likes = 0;
        let comments = 0;
        let views: number | null = null;
        let reach: number | null = null;
        let saved: number | null = null;
        let shares: number | null = null;

        if (token && mediaId) {
          try {
            // Ambil like_count, comments_count, permalink
            const urlMedia = `https://${host}/${VERSI()}/${mediaId}?fields=id,like_count,comments_count,permalink&access_token=${token}`;
            const res = await fetch(urlMedia, { cache: "no-store" }).catch(() => null);
            if (res && res.ok) {
              const j = await res.json();
              likes = Number(j.like_count) || 0;
              comments = Number(j.comments_count) || 0;
              if (j.permalink) permalink = j.permalink;
            }

            // Coba ambil insights jika diizinkan (reach, views, saved, shares)
            const urlInsights = `https://${host}/${VERSI()}/${mediaId}/insights?metric=reach,views,saved,shares&access_token=${token}`;
            const resIns = await fetch(urlInsights, { cache: "no-store" }).catch(() => null);
            if (resIns && resIns.ok) {
              const jIns = await resIns.json();
              if (Array.isArray(jIns.data)) {
                for (const item of jIns.data) {
                  const val = Number(item.values?.[0]?.value ?? item.total_value?.value) || 0;
                  if (item.name === "views") views = val;
                  if (item.name === "reach") reach = val;
                  if (item.name === "saved") saved = val;
                  if (item.name === "shares") shares = val;
                }
              }
            }
          } catch {
            // Abaikan kegagalan jaringan individual, gunakan default 0
          }
        }

        return {
          id: t.id,
          produk: t.produk_slug,
          jenis: t.jenis,
          caption: t.caption,
          dibuat: t.dibuat,
          tayangWaktu,
          permalink,
          mediaId,
          likes,
          comments,
          views,
          reach,
          saved,
          shares,
        };
      }),
    );

    const totalLikes = posts.reduce((a, b) => a + b.likes, 0);
    const totalComments = posts.reduce((a, b) => a + b.comments, 0);
    const totalViews = posts.reduce((a, b) => a + (b.views ?? 0), 0);

    return {
      tersambung,
      akun,
      totalTayang: posts.length,
      totalLikes,
      totalComments,
      totalViews,
      posts,
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
