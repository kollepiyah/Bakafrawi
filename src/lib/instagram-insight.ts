import "server-only";
import { rest } from "./db-server";

const VERSI = () => process.env.IG_API_VERSI || "v27.0";

export type PostInsight = {
  id: string;
  merek: string;
  produk: string;
  jenis: string;
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
  merek: string | null;
  produk_slug: string;
  jenis: string;
  caption: string | null;
  dibuat: string;
  status_tayang: string;
  hasil: { jenis: string; rasio: string; url: string }[] | null;
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
    // 1. Kredensial Instagram semua merek (Bakafrawi, Lek Kopi, …)
    const kredList = ((await rest("studio_kredensial?layanan=eq.instagram&select=merek,data")) as (KredensialIg & { merek: string })[] | null) ?? [];
    const kredPer = new Map(kredList.map((k) => [k.merek, k.data]));
    const tersambung = kredList.some((k) => Boolean(k.data?.ig_token && k.data?.ig_user_id));
    const akun = kredList.map((k) => k.data?.ig_akun).filter(Boolean).join(", ") || null;

    // 2. Ambil tugas yang sudah berstatus 'tayang'
    const tugasList = (await rest(
      "studio_tugas?status_tayang=eq.tayang&tayang=not.is.null&select=id,merek,produk_slug,jenis,caption,dibuat,status_tayang,tayang,hasil&order=dibuat.desc&limit=8",
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

    // 3. Tarik metrik tiap postingan secara paralel (token sesuai merek postingan)
    const posts: PostInsight[] = await Promise.all(
      tugasList.map(async (t): Promise<PostInsight> => {
        const kred = kredPer.get(t.merek ?? "bakafrawi");
        const token = kred?.ig_token;
        const host = kred?.ig_host === "facebook" ? "graph.facebook.com" : "graph.instagram.com";
        const infoIg = t.tayang?.instagram;
        const media = infoIg?.reels ?? infoIg?.feed;
        const mediaId = media?.id ?? null;
        let permalink = media?.permalink ?? null;
        const tayangWaktu = infoIg?.waktu ?? t.dibuat;
        // Thumbnail cadangan dari hasil Studio: sampul video / poster; dari IG bila tersedia.
        const h = t.hasil ?? [];
        let thumbnail: string | null =
          h.find((x) => x.rasio === "sampul")?.url ?? h.find((x) => x.jenis === "gambar")?.url ?? null;
        const videoUrl = h.find((x) => x.jenis === "video")?.url ?? null;

        let likes = 0;
        let comments = 0;
        let views: number | null = null;
        let reach: number | null = null;
        let saved: number | null = null;
        let shares: number | null = null;

        if (token && mediaId) {
          try {
            // Ambil like_count, comments_count, permalink
            const urlMedia = `https://${host}/${VERSI()}/${mediaId}?fields=id,like_count,comments_count,permalink,thumbnail_url,media_url,media_type&access_token=${token}`;
            const res = await fetch(urlMedia, { cache: "no-store" }).catch(() => null);
            if (res && res.ok) {
              const j = await res.json();
              likes = Number(j.like_count) || 0;
              comments = Number(j.comments_count) || 0;
              if (j.permalink) permalink = j.permalink;
              if (j.thumbnail_url) thumbnail = j.thumbnail_url;
              else if (!thumbnail && j.media_type === "IMAGE" && j.media_url) thumbnail = j.media_url;
            }

            // Insights (reach, views, saved, shares). Satu metrik tak didukung menggagalkan semuanya →
            // coba himpunan yang lebih kecil, lalu "plays" (nama lama tayangan Reels).
            const metrikCoba = ["reach,views,saved,shares", "views", "reach", "plays"];
            for (const metrik of metrikCoba) {
              const urlInsights = `https://${host}/${VERSI()}/${mediaId}/insights?metric=${metrik}&access_token=${token}`;
              const resIns = await fetch(urlInsights, { cache: "no-store" }).catch(() => null);
              if (!resIns || !resIns.ok) continue;
              const jIns = await resIns.json();
              if (!Array.isArray(jIns.data)) continue;
              for (const item of jIns.data) {
                const val = Number(item.values?.[0]?.value ?? item.total_value?.value) || 0;
                if (item.name === "views" || (item.name === "plays" && views == null)) views = val;
                if (item.name === "reach") reach = val;
                if (item.name === "saved") saved = val;
                if (item.name === "shares") shares = val;
              }
              if (views != null) break;
            }
          } catch {
            // Abaikan kegagalan jaringan individual, gunakan default 0
          }
        }

        return {
          id: t.id,
          merek: t.merek ?? "bakafrawi",
          produk: t.produk_slug,
          jenis: t.jenis,
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
