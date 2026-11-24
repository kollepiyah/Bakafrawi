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

/** Kenali nama berkas acak/generik bawaan kamera atau editor HP (jangan dianggap topik video). */
export function apakahNamaFileAcak(nama: string): boolean {
  const dasar = String(nama ?? "").replace(/\.[a-z0-9]+$/i, "").trim();
  if (!dasar || dasar.length <= 2) return true;
  if (/^(vid|img|pxl|dcim|wa|lv|vn|mov|mp4|capcut|inshot|screen[-_]?recording|record|untitled|video|foto|image|whatsapp[-_\s]?(video|image))[-_\s0-9a-f]*$/i.test(dasar)) {
    return true;
  }
  if (/^[0-9a-f]{8,}$/i.test(dasar.replace(/[-_\s]+/g, ""))) return true;
  // Dominan angka/simbol dan nyaris tanpa kata bermakna
  const tanpaAngka = dasar.replace(/[0-9_\-\s.]+/g, "");
  return tanpaAngka.length < 3;
}

export const SKEMA_CAPTION_OTOMATIS = {
  type: "object",
  additionalProperties: false,
  required: ["ringkasVisual", "judulSaran", "isiCaption", "hashtagTambahan"],
  properties: {
    ringkasVisual: {
      type: "string",
      description:
        "Ringkasan 1 kalimat objektif tentang isi adegan, objek/produk, suasana, dan teks di layar yang benar-benar tampak pada gambar/bingkai video (atau dari konteks bila tanpa gambar).",
    },
    judulSaran: {
      type: "string",
      description: "Judul ringkas 3–6 kata yang merangkum isi konten untuk Riwayat Studio.",
    },
    isiCaption: {
      type: "string",
      description:
        "Isi caption Instagram 2-3 kalimat (baris pertama hook menarik + 1-2 kalimat isi/cerita) yang 100% sesuai isi konten pada video/foto. JANGAN tulis alamat, jam buka, link bio, atau hashtag karena akan ditambahkan sistem secara konsisten.",
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
  jumlahBingkai = 0,
}: {
  merek?: string | null;
  judul?: string;
  konteks?: string;
  jenis?: "video" | "gambar";
  sasaran?: string;
  jumlahBingkai?: number;
}) {
  const profil = PROFIL_CAPTION_MEREK[normalisasiMerek(merek)];
  const judulBersih = String(judul ?? "").trim();
  const judulPakai = judulBersih && !apakahNamaFileAcak(judulBersih) ? judulBersih : "";

  return {
    system:
      `Kamu copywriter resmi ${profil.nama} (${profil.akunIg}) sekaligus analis visual konten Instagram. ` +
      `Gaya bahasa: ${profil.gayaBahasa} ` +
      `Jangan pernah mengarang promo, harga, atau peristiwa yang tidak terlihat pada media atau tidak tertulis di konteks.`,
    prompt: [
      `Buatkan caption Instagram untuk unggahan ${jenis === "gambar" ? "foto/poster" : "video Reels/Story"} (sasaran: ${sasaran || "reels"}).`,
      jumlahBingkai > 0
        ? `TERLAMPIR ${jumlahBingkai} BINGKAI DARI KONTEN (urut dari awal, tengah, hingga akhir). Amati seluruh bingkai dengan teliti: kenali produk/objek utama, aktivitas/ekspresi tokoh, suasana tempat, DAN baca teks apa pun yang muncul di layar video. Jadikan temuan visual nyata itu sebagai dasar utama penulisan ringkasVisual, judulSaran, dan isiCaption.`
        : "",
      judulPakai
        ? `Judul/nama konten: ${judulPakai}`
        : jumlahBingkai > 0 && judulBersih
        ? `Catatan: abaikan nama file generik "${judulBersih}", fokus murni pada isi visual bingkai video.`
        : "",
      konteks ? `Catatan/konteks tambahan pemilik: ${konteks}` : "",
      "Aturan wajib:",
      "1. Isi dulu `ringkasVisual` (apa yang benar-benar terlihat/tertulis di konten) dan `judulSaran` (3–6 kata).",
      "2. Baris pertama `isiCaption` harus hook singkat yang langsung nyambung dengan isi video dan menarik perhatian penonton.",
      "3. Tulis maksimal 2–3 kalimat pendek, enak dibaca di layar HP, dan 100% relevan dengan isi konten nyata.",
      "4. JANGAN menulis hashtag, alamat, jam buka, atau 'link di bio' karena sistem akan menambahkan blok CTA & hashtag konsisten secara otomatis.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
