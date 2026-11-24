// Standar caption & hashtag konsisten untuk semua merek (Lek Kopi & Bakafrawi Project).
// Dipakai oleh: Unggah Manual (auto-caption), Google Flow Bridge, dan agen konten Full AI.

export type MerekKonten = "lekkopi" | "bakafrawi";

export type ProfilCaptionMerek = {
  merek: MerekKonten;
  nama: string;
  akunIg: string;
  gayaBahasa: string;
  ctaBawaan: string;
  hashtagInti: string[];
};

export const PROFIL_CAPTION_MEREK: Record<MerekKonten, ProfilCaptionMerek> = {
  lekkopi: {
    merek: "lekkopi",
    nama: "Lek Kopi",
    akunIg: "@lekkopi.id",
    gayaBahasa:
      "Santai, akrab, hangat ala kedai kopi Sidoarjo/Waru (boleh sentuhan Jawa Timur ringan yang natural). Ringkas 2–3 kalimat, tidak kaku seperti brosur.",
    ctaBawaan:
      "📍 Jl. Kolonel Sugiono No. 112, Panjunan, Waru, Sidoarjo\n⏰ Senin–Sabtu, 14.00–23.00 WIB (tersedia di GoFood, GrabFood, ShopeeFood & TikTok GO)",
    hashtagInti: [
      "lekkopi",
      "lekkopisidoarjo",
      "kopiwaru",
      "kopisidoarjo",
      "ngopidisidoarjo",
      "kedaikopisidoarjo",
    ],
  },
  bakafrawi: {
    merek: "bakafrawi",
    nama: "Bakafrawi Project",
    akunIg: "@bakafrawi.project",
    gayaBahasa:
      "Jelas, membumi, profesional tapi santai untuk pemilik UMKM, pesantren, dan bisnis. Fokus ke masalah nyata dan solusi praktis tanpa bahasa terlalu teknis.",
    ctaBawaan: "💬 Konsultasi atau coba demo gratis lewat link di bio atau bakafrawi.com",
    hashtagInti: [
      "bakafrawi",
      "bakafrawiproject",
      "jasapembuatanaplikasi",
      "aplikasiumkm",
      "softwarehouseindonesia",
      "websitessidoarjo",
    ],
  },
};

export function normalisasiMerek(merek?: string | null): MerekKonten {
  return String(merek ?? "").toLowerCase().includes("lek") ? "lekkopi" : "bakafrawi";
}

function bersihkanTag(tag: string): string {
  return tag
    .replace(/^#+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Gabungkan isi caption + CTA konsisten merek + blok hashtag konsisten (inti + kontekstual, maks 10).
 * Tidak menduplikasi CTA atau hashtag bila sudah ada di isiCaption.
 */
export function formatCaptionKonsisten({
  merek,
  isiCaption,
  hashtagTambahan = [],
  sertakanCta = true,
}: {
  merek?: string | null;
  isiCaption: string;
  hashtagTambahan?: string[];
  sertakanCta?: boolean;
}): { captionLengkap: string; hashtag: string[] } {
  const profil = PROFIL_CAPTION_MEREK[normalisasiMerek(merek)];
  const badanBersih = String(isiCaption ?? "")
    .replace(/(?:^|\s)#[a-zA-Z0-9_]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const gabungTag = [...profil.hashtagInti, ...hashtagTambahan]
    .map(bersihkanTag)
    .filter(Boolean);
  const hashtagUnik = [...new Set(gabungTag)].slice(0, 10);
  const barisTag = hashtagUnik.map((t) => `#${t}`).join(" ");

  const sudahAdaCta =
    profil.merek === "lekkopi"
      ? /kolonel sugiono|14\.00/i.test(badanBersih)
      : /bakafrawi\.com|link di bio/i.test(badanBersih);

  const bagian: string[] = [];
  if (badanBersih) bagian.push(badanBersih);
  if (sertakanCta && !sudahAdaCta) bagian.push(profil.ctaBawaan);
  if (barisTag) bagian.push(barisTag);

  return {
    captionLengkap: bagian.join("\n\n").trim(),
    hashtag: hashtagUnik,
  };
}

export const SKEMA_CAPTION_OTOMATIS = {
  type: "object",
  additionalProperties: false,
  required: ["isiCaption", "hashtagTambahan"],
  properties: {
    isiCaption: {
      type: "string",
      description:
        "Isi caption Instagram 2-3 kalimat (baris pertama hook menarik + 1-2 kalimat isi/cerita). JANGAN tulis alamat, jam buka, link bio, atau hashtag karena akan ditambahkan sistem secara konsisten.",
    },
    hashtagTambahan: {
      type: "array",
      items: { type: "string" },
      description: "3-4 hashtag kontekstual sesuai isi konten (tanpa tanda #, huruf kecil tanpa spasi)",
    },
  },
} as const;

export function promptCaptionOtomatis({
  merek,
  judul,
  konteks,
  jenis,
  sasaran,
}: {
  merek?: string | null;
  judul?: string;
  konteks?: string;
  jenis?: "video" | "gambar";
  sasaran?: string;
}) {
  const profil = PROFIL_CAPTION_MEREK[normalisasiMerek(merek)];
  return {
    system: `Kamu copywriter resmi ${profil.nama} (${profil.akunIg}). Gaya bahasa: ${profil.gayaBahasa} Jangan mengarang promo/harga yang tidak disebutkan.`,
    prompt: [
      `Buatkan caption Instagram untuk unggahan ${jenis === "gambar" ? "foto/poster" : "video Reels/Story"} (sasaran: ${sasaran || "reels"}).`,
      judul ? `Judul/nama konten: ${judul}` : "",
      konteks ? `Catatan/konteks tambahan: ${konteks}` : "",
      "Aturan:",
      "1. Baris pertama harus hook singkat yang langsung nyambung dengan penonton.",
      "2. Maksimal 2–3 kalimat pendek, enak dibaca di HP.",
      "3. JANGAN menulis hashtag, alamat, jam buka, atau 'link di bio' karena sistem akan menambahkan blok CTA & hashtag konsisten secara otomatis.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
