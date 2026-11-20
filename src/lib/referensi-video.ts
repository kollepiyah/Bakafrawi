import "server-only";
import { createHash } from "node:crypto";
import { rest } from "./db-server";
import { panggilLlmJson } from "./llm-router";

export type BlueprintReferensi = {
  judul: string;
  platform: "instagram" | "tiktok" | "youtube" | "lain";
  ringkas: string;
  hook3Detik: string;
  gayaVisual: string;
  gayaTeks: string;
  pacing: string;
  presetCocok: string;
  strukturAdegan: string[];
  arahanTiru: string;
  thumbnail?: string | null;
};

export type ReferensiTersimpan = {
  id: string;
  merek: string;
  permalink: string | null;
  caption: string | null;
  dianalisis: string | null;
  analisis: BlueprintReferensi | null;
};

function deteksiPlatform(url: string): BlueprintReferensi["platform"] {
  const u = url.toLowerCase();
  if (u.includes("instagram.com") || u.includes("instagr.am")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  return "lain";
}

/** Tarik metadata publik ringan (TikTok oEmbed / OpenGraph) tanpa scraping berat. */
async function ambilMetadataLink(url: string) {
  const platform = deteksiPlatform(url);
  let judul = "";
  let penulis = "";
  let deskripsi = "";
  let thumbnail: string | null = null;

  try {
    if (platform === "tiktok") {
      const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        judul = String(j.title ?? "");
        penulis = String(j.author_name ?? "");
        thumbnail = typeof j.thumbnail_url === "string" ? j.thumbnail_url : null;
      }
    } else if (platform === "youtube") {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        judul = String(j.title ?? "");
        penulis = String(j.author_name ?? "");
        thumbnail = typeof j.thumbnail_url === "string" ? j.thumbnail_url : null;
      }
    } else {
      const r = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; BakafrawiStudio/1.0)" },
      });
      if (r.ok) {
        const html = (await r.text()).slice(0, 60_000);
        const og = (prop: string) => {
          const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"));
          return m ? m[1] : "";
        };
        judul = og("og:title") || og("twitter:title");
        deskripsi = og("og:description") || og("description");
        thumbnail = og("og:image") || null;
      }
    }
  } catch {
    // Metadata opsional; Gemini Search tetap bisa membedah tautan + catatan pengguna.
  }

  return { platform, judul, penulis, deskripsi, thumbnail };
}

const SKEMA_BLUEPRINT = {
  type: "object",
  properties: {
    judul: { type: "string", description: "Nama singkat pola/gaya video referensi ini (3-6 kata)" },
    ringkas: { type: "string", description: "Ringkasan 1 kalimat kenapa gaya video ini menarik / viral" },
    hook3Detik: { type: "string", description: "Pola hook 3 detik pertama (visual & teks pembuka)" },
    gayaVisual: { type: "string", description: "Gaya visual, sudut kamera, pencahayaan, warna, transisi" },
    gayaTeks: { type: "string", description: "Gaya tipografi/teks layar (posisi, ukuran, stabilo, animasi)" },
    pacing: { type: "string", description: "Ritme potongan klip, mis. cepat 1.5-2.5 dtk atau sinematik santai 3-4 dtk" },
    presetCocok: {
      type: "string",
      description: "Pilih satu preset yang paling dekat: clean-ui, dark-keynote, pov-chat, split-hook, atau sinematik-kafe",
    },
    strukturAdegan: {
      type: "array",
      items: { type: "string" },
      description: "4-6 langkah struktur adegan dari awal sampai CTA akhir",
    },
    arahanTiru: {
      type: "string",
      description: "Arahan konkret 2-3 kalimat siap tempel ke formulir Studio agar AI meniru pola video ini untuk merek kita",
    },
  },
  required: ["judul", "ringkas", "hook3Detik", "gayaVisual", "gayaTeks", "pacing", "presetCocok", "strukturAdegan", "arahanTiru"],
};

/**
 * Bedah link Reels/TikTok/Shorts menjadi Blueprint Gaya dan simpan ke `studio_referensi`
 * supaya Studio belajar & bisa meniru polanya untuk merek tersebut.
 */
export async function bedahDanSimpanReferensi(opsi: {
  merek: string;
  url: string;
  catatan?: string;
}): Promise<ReferensiTersimpan> {
  const urlBersih = opsi.url.trim();
  if (!/^https?:\/\//i.test(urlBersih)) throw new Error("Tautan video harus diawali https://");

  const meta = await ambilMetadataLink(urlBersih);
  const namaMerek = opsi.merek === "lekkopi"
    ? "Lek Kopi (kedai kopi & tempat nongkrong santai di Waru, Sidoarjo)"
    : "Bakafrawi Project (software developer aplikasi kasir/POS, UMKM, dan website custom)";

  const { data } = await panggilLlmJson<Omit<BlueprintReferensi, "platform" | "thumbnail">>({
    system: `Kamu adalah sutradara kreatif & analis konten viral Instagram Reels dan TikTok Indonesia.
Tugasmu: membedah video referensi yang dikirim pemilik merek lalu menerjemahkannya menjadi Blueprint Gaya yang bisa langsung ditiru oleh mesin Studio AI untuk merek: ${namaMerek}.
Gunakan bahasa Indonesia yang tajam, konkret, dan praktis.`,
    prompt: [
      `Tautan video referensi (${meta.platform}): ${urlBersih}`,
      meta.penulis ? `Kreator: ${meta.penulis}` : "",
      meta.judul ? `Judul/Caption terdeteksi: ${meta.judul}` : "",
      meta.deskripsi ? `Deskripsi: ${meta.deskripsi}` : "",
      opsi.catatan ? `Catatan pemilik (bagian yang disukai / ingin ditiru): ${opsi.catatan}` : "",
      "",
      "Bedah pola video ini (cari info publik tentang video/tren tersebut bila perlu) dan buat Blueprint Gaya + arahanTiru yang langsung bisa dipakai membuat konten baru untuk merek kita.",
    ].filter(Boolean).join("\n"),
    skema: SKEMA_BLUEPRINT,
    maksToken: 3000,
    pakaiSearch: true,
  }, "bedah referensi");

  const blueprint: BlueprintReferensi = {
    ...data,
    platform: meta.platform,
    thumbnail: meta.thumbnail,
  };

  const hash = createHash("sha1").update(urlBersih).digest("hex").slice(0, 12);
  const id = `link:${hash}`;
  const kini = new Date().toISOString();

  // Simpan ke studio_referensi (memakai sumber='ig' agar sesuai constraint tabel yang sudah ada).
  await rest("studio_referensi?on_conflict=merek,id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      merek: opsi.merek,
      id,
      sumber: "ig",
      permalink: urlBersih,
      caption: blueprint.judul,
      analisis: blueprint,
      dianalisis: kini,
    }),
  });

  return {
    id,
    merek: opsi.merek,
    permalink: urlBersih,
    caption: blueprint.judul,
    dianalisis: kini,
    analisis: blueprint,
  };
}

/** Daftar referensi video yang pernah ditempelkan/dipelajari untuk satu merek. */
export async function daftarReferensiMerek(merek: string, batas = 12): Promise<ReferensiTersimpan[]> {
  const m = encodeURIComponent(merek);
  const rows = (await rest(
    `studio_referensi?merek=eq.${m}&id=like.link:*&select=id,merek,permalink,caption,dianalisis,analisis&order=dianalisis.desc.nullslast&limit=${batas}`,
  ).catch(() => [])) as ReferensiTersimpan[];
  return rows ?? [];
}

/** Hapus satu referensi tersimpan. */
export async function hapusReferensiMerek(merek: string, id: string) {
  await rest(`studio_referensi?merek=eq.${encodeURIComponent(merek)}&id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}
