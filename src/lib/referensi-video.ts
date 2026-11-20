import "server-only";
import { createHash } from "node:crypto";
import { rest } from "./db-server";
import { panggilLlmJson, type GambarInput } from "./llm-router";

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
    const sinyal = AbortSignal.timeout(4000);
    if (platform === "tiktok") {
      const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { cache: "no-store", signal: sinyal });
      if (r.ok) {
        const j = await r.json();
        judul = String(j.title ?? "");
        penulis = String(j.author_name ?? "");
        thumbnail = typeof j.thumbnail_url === "string" ? j.thumbnail_url : null;
      }
    } else if (platform === "youtube") {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { cache: "no-store", signal: sinyal });
      if (r.ok) {
        const j = await r.json();
        judul = String(j.title ?? "");
        penulis = String(j.author_name ?? "");
        thumbnail = typeof j.thumbnail_url === "string" ? j.thumbnail_url : null;
      }
    } else {
      const r = await fetch(url, {
        cache: "no-store",
        signal: sinyal,
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
      description: "Pilih satu preset yang paling dekat: editorial-scroll, sinematik-kafe, clean-ui, dark-keynote, pov-chat, atau split-hook",
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
 * Bedah video referensi (dari unggahan file video/screenshot lewat Vision AI, atau link TikTok/YouTube)
 * menjadi Blueprint Gaya nyata dan simpan ke `studio_referensi`.
 */
export async function bedahDanSimpanReferensi(opsi: {
  merek: string;
  url?: string;
  namaFile?: string;
  durasiDetik?: number;
  gambar?: GambarInput[];
  catatan?: string;
}): Promise<ReferensiTersimpan> {
  const urlBersih = (opsi.url ?? "").trim();
  const adaGambar = Boolean(opsi.gambar?.length);
  if (!adaGambar && !/^https?:\/\//i.test(urlBersih)) {
    throw new Error("Unggah video (.mp4) / screenshot, atau tempel tautan https:// yang valid.");
  }

  const meta = urlBersih ? await ambilMetadataLink(urlBersih) : { platform: "lain" as const, judul: "", penulis: "", deskripsi: "", thumbnail: null };

  // Jujur bila link Instagram diblokir login wall dan tidak ada bingkai video/screenshot yang diunggah.
  if (!adaGambar && meta.platform === "instagram" && !meta.judul && !meta.deskripsi) {
    throw new Error(
      "Instagram memblokir akses tautan ini sehingga AI tidak bisa menonton isi videonya. Silakan unggah file video (.mp4) atau 2–4 screenshot adegannya di kolom Unggah agar AI benar-benar melihat dan meniru gaya aslinya.",
    );
  }

  const namaMerek = opsi.merek === "lekkopi"
    ? "Lek Kopi (kedai kopi & tempat nongkrong santai di Waru, Sidoarjo)"
    : "Bakafrawi Project (software developer aplikasi kasir/POS, UMKM, dan website custom)";

  const { data } = await panggilLlmJson<Omit<BlueprintReferensi, "platform" | "thumbnail">>({
    system: `Kamu adalah sutradara kreatif & analis konten viral Instagram Reels dan TikTok Indonesia.
Tugasmu: menganalisis secara NYATA & PRESISI bingkai video referensi yang diberikan (warna latar, font/tipografi, tata letak, gaya scroll/transisi, sudut kamera, durasi & ritme potongan) lalu menerjemahkannya menjadi Blueprint Gaya agar mesin Studio AI meniru gaya tersebut untuk merek: ${namaMerek}.
Jangan mengarang elemen yang tidak ada di referensi. Bila referensi bergaya editorial majalah / latar krem / scroll vertikal / mockup web-menu mewah, pilih presetCocok = "editorial-scroll".`,
    gambar: opsi.gambar?.slice(0, 6),
    prompt: [
      adaGambar
        ? `Di atas adalah ${opsi.gambar!.length} bingkai berurutan (awal → tengah → akhir) dari video referensi${opsi.durasiDetik ? ` berdurasi ${opsi.durasiDetik.toFixed(1)} detik` : ""}${opsi.namaFile ? ` (${opsi.namaFile})` : ""}.`
        : `Tautan video referensi (${meta.platform}): ${urlBersih}`,
      meta.penulis ? `Kreator: ${meta.penulis}` : "",
      meta.judul ? `Judul/Caption terdeteksi: ${meta.judul}` : "",
      meta.deskripsi ? `Deskripsi: ${meta.deskripsi}` : "",
      opsi.catatan ? `Catatan pemilik (bagian yang disukai / ingin ditiru): ${opsi.catatan}` : "",
      "",
      "Bedah persis apa yang terlihat di bingkai-bingkai tersebut: palet warna, gaya huruf (serif/sans), tata letak, gerakan/transisi, jumlah adegan, serta buat `arahanTiru` konkret agar mesin Studio bisa meniru gaya simpel & estetik ini untuk merek kita.",
    ].filter(Boolean).join("\n"),
    skema: SKEMA_BLUEPRINT,
    maksToken: 3000,
    pakaiSearch: !adaGambar,
  }, "bedah referensi");

  const blueprint: BlueprintReferensi = {
    ...data,
    platform: urlBersih ? meta.platform : "lain",
    thumbnail: meta.thumbnail,
  };

  const kunciHash = urlBersih || `${opsi.namaFile ?? "upload"}-${Date.now()}`;
  const hash = createHash("sha1").update(kunciHash).digest("hex").slice(0, 12);
  const id = `link:${hash}`;
  const kini = new Date().toISOString();

  await rest("studio_referensi?on_conflict=merek,id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      merek: opsi.merek,
      id,
      sumber: "ig",
      permalink: urlBersih || null,
      caption: blueprint.judul,
      analisis: blueprint,
      dianalisis: kini,
    }),
  });

  return {
    id,
    merek: opsi.merek,
    permalink: urlBersih || null,
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
