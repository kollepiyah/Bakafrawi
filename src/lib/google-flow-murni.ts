// Aturan & skema murni untuk Google Flow Bridge (Veo 3 / Veo 3.1 prompt pack per adegan).
// Sengaja mandiri tanpa impor runtime relatif agar langsung lolos node --test maupun Next.js.

export type BahasaFlow = "indonesia" | "jawa_timur" | "jawa_campur";
export type GayaFlow =
  | "storytelling_hangat"
  | "komedi_santai"
  | "sinematik_produk"
  | "pov_relatable"
  | "fooh_3d"
  | "iklan_komersial"
  | "sketsa_visual";
export type FormatDialogFlow = "obrolan_2_orang" | "monolog_kamera" | "storytelling_narasi" | "tanpa_dialog_sfx";

export type AdeganGoogleFlow = {
  nomor: number;
  durasiDetik: number;
  ringkasAksi: string;
  dialog: string;
  arahanLogat: string;
  teksLayar: string;
  promptGoogleFlow: string;
};

export type PaketGoogleFlow = {
  judul: string;
  ringkasanKonsep: string;
  karakterBible: string;
  promptGambarKarakter: string;
  adegan: AdeganGoogleFlow[];
  caption: string;
  hashtag: string[];
};

export const OPSI_FORMAT_DIALOG_FLOW: { kode: FormatDialogFlow; label: string; ket: string }[] = [
  { kode: "obrolan_2_orang", label: "Obrolan 2 Orang (Banyak Ngobrol)", ket: "Tektokan natural 2 tokoh, paling hidup di Reels" },
  { kode: "monolog_kamera", label: "Ngobrol ke Kamera (POV/Curhat)", ket: "1 tokoh cerita santai langsung ke penonton" },
  { kode: "storytelling_narasi", label: "Storytelling Sinematik", ket: "Cerita visual + narasi hangat" },
  { kode: "tanpa_dialog_sfx", label: "Tanpa Dialog (Visual + SFX)", ket: "Cocok untuk FOOH 3D, iklan fast-cut, & sketsa visual" },
];

export const OPSI_PRODUK_BAKAFRAWI: { slug: string; label: string; info: string }[] = [
  { slug: "ammu-online", label: "Ammu Online (Pesantren)", info: "Aplikasi manajemen pondok pesantren: data santri, SPP/pembayaran, absensi, tahfidz, dan laporan langsung ke HP wali santri" },
  { slug: "maktaba-pos", label: "Maktaba POS (Kasir UMKM)", info: "Aplikasi kasir & stok UMKM: catat transaksi cepat, struk otomatis, laporan omzet & laba bersih langsung dari HP" },
  { slug: "waseela", label: "Waseela", info: "Aplikasi layanan digital buatan Bakafrawi Project" },
  { slug: "custom", label: "Jasa Aplikasi & Website Custom", info: "Jasa pembuatan website, aplikasi Android, dan sistem bisnis custom sesuai kebutuhan usaha/lembaga" },
];

export const OPSI_BAHASA_FLOW: { kode: BahasaFlow; label: string; ket: string }[] = [
  { kode: "indonesia", label: "Indonesia Santai", ket: "Natural sehari-hari, tidak kaku" },
  { kode: "jawa_timur", label: "Jawa Timur / Suroboyoan", ket: "Akrab, hangat, logat Jatim/Sidoarjo" },
  { kode: "jawa_campur", label: "Campuran Indo–Jawa", ket: "Santai ala anak muda Jawa Timur" },
];

export const OPSI_GAYA_FLOW: { kode: GayaFlow; label: string; ket: string }[] = [
  { kode: "storytelling_hangat", label: "Storytelling Hangat", ket: "Cerita relatable yang menyentuh" },
  { kode: "komedi_santai", label: "Sketsa Komedi Santai", ket: "Dialog kocak & ringan ala Reels viral" },
  { kode: "sinematik_produk", label: "Sinematik Produk Full AI", ket: "Visual estetik + narasi memikat" },
  { kode: "pov_relatable", label: "POV Relatable", ket: "Sudut pandang pelanggan / pemilik usaha" },
  { kode: "fooh_3d", label: "FOOH 3D Billboard / Objek Raksasa", ket: "Efek 3D spektakuler di gedung/lokasi nyata (ala Starbucks 3D)" },
  { kode: "iklan_komersial", label: "Iklan Komersial Fast-Cut", ket: "Potongan cepat produk + model seragam ikut beat musik (ala FROTH)" },
  { kode: "sketsa_visual", label: "Sketsa Komedi Visual", ket: "Aksi lucu 2 klip tanpa dialog panjang + SFX nyata (ala Balina)" },
];

export const SKEMA_GOOGLE_FLOW = {
  type: "object",
  additionalProperties: false,
  required: ["judul", "ringkasanKonsep", "karakterBible", "promptGambarKarakter", "adegan", "isiCaption", "hashtagTambahan"],
  properties: {
    judul: { type: "string", description: "Judul konsep Reels 3-7 kata yang menarik" },
    ringkasanKonsep: { type: "string", description: "Ringkasan alur cerita 1-2 kalimat" },
    karakterBible: {
      type: "string",
      description:
        "Identitas fisik tetap semua tokoh utama dalam bahasa Inggris (usia, bentuk wajah/rambut, baju/peci/hijab, posisi berdiri kiri/kanan) + spesifikasi lokasi, furnitur, warna properti, dan pencahayaan tetap agar semua klip Google Flow menyatu seperti 1 video utuh.",
    },
    promptGambarKarakter: {
      type: "string",
      description:
        "Prompt gambar (Text-to-Image, rasio 9:16, medium shot jernih menghadap kamera) dalam bahasa Inggris untuk dibuat SEKALI di Google Flow → Image, lalu dipakai sebagai Ingredient/Bahan Referensi di semua klip agar wajah, baju, dan produk 100% konsisten. Photorealistic, lighting alami sesuai lokasi utama, tanpa teks, tanpa logo palsu, tanpa layar HP.",
    },
    adegan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nomor", "durasiDetik", "ringkasAksi", "dialog", "arahanLogat", "teksLayar", "promptGoogleFlow"],
        properties: {
          nomor: { type: "integer" },
          durasiDetik: { type: "integer", description: "Durasi klip Google Flow, biasanya 8 detik" },
          ringkasAksi: { type: "string", description: "Ringkasan aksi adegan dalam Bahasa Indonesia (1 kalimat jelas)" },
          dialog: { type: "string", description: "Kalimat dialog/narasi persis atau tag [SFX: ...] (maks 18 kata agar pas 8 detik)" },
          arahanLogat: { type: "string", description: "Arahan nada, emosi, dan logat suara (mis. 'Santai, logat Jawa Timur hangat, sedikit terkekeh')" },
          teksLayar: { type: "string", description: "Teks subtitle/sorotan singkat 3-6 kata di layar" },
          promptGoogleFlow: {
            type: "string",
            description:
              "Prompt lengkap siap-copy untuk Google Flow (Veo 3, vertical 9:16) dalam format 6 baris berlabel jelas: SHOT & CAMERA, SUBJECT & CONTINUITY, SETTING & LIGHTING, ACTION TIMELINE (0-8s dengan pembagian 0-2s / 2-5s / 5-8s), AUDIO & DIALOGUE (atau AUDIO & SFX), dan CONSTRAINTS.",
          },
        },
      },
    },
    isiCaption: {
      type: "string",
      description: "Caption Instagram 2-3 kalimat (hook + cerita singkat). JANGAN tulis alamat, jam buka, link bio, atau hashtag.",
    },
    hashtagTambahan: {
      type: "array",
      items: { type: "string" },
      description: "3-4 hashtag kontekstual tanpa tanda #",
    },
  },
} as const;

export function buatPromptGoogleFlow({
  merek,
  produk,
  topik,
  bahasa = "jawa_campur",
  gaya = "storytelling_hangat",
  formatDialog = "obrolan_2_orang",
  jumlahAdegan = 4,
  riwayat = [],
}: {
  merek?: string | null;
  produk?: string;
  topik?: string;
  bahasa?: BahasaFlow;
  gaya?: GayaFlow;
  formatDialog?: FormatDialogFlow;
  jumlahAdegan?: number;
  riwayat?: string[];
}) {
  const m = String(merek ?? "").toLowerCase().includes("lek") ? "lekkopi" : "bakafrawi";
  const infoProduk = m === "bakafrawi"
    ? OPSI_PRODUK_BAKAFRAWI.find((p) => p.slug === produk) ?? OPSI_PRODUK_BAKAFRAWI[0]
    : null;
  const namaBrand = m === "lekkopi" ? "Lek Kopi" : (infoProduk ? `${infoProduk.label} — Bakafrawi Project` : "Bakafrawi Project");
  const jml = Math.min(6, Math.max(1, Math.round(jumlahAdegan)));

  const deskripsiMerek =
    m === "lekkopi"
      ? "Lek Kopi (@lekkopi.id): kedai kopi outdoor hangat di Panjunan, Waru, Sidoarjo, menu resmi dari https://lekkopi.bakafrawi.com (Kopi Lek, Americano, Arum Dalu, Butterscoth Latte, Kopasus, Komandan, Matcha Latte, Tubruk — dilarang mengarang menu di luar daftar resmi), suasana nongkrong sore-malam yang ramah."
      : `Bakafrawi Project (@bakafrawi.project): studio software & desain di Sidoarjo. Produk yang dipromosikan: ${infoProduk?.label} — ${infoProduk?.info}.`;

  const arahanFormat =
    formatDialog === "tanpa_dialog_sfx"
      ? "FORMAT WAJIB: TANPA DIALOG UCAPAN (VISUAL + SFX + MUSIK). Jangan menulis kalimat dialog manusia yang diucapkan! Isi kolom `dialog` dengan deskripsi efek suara & mood audio singkat (format `[SFX: ...]`), dan buat blok `AUDIO & SFX:` pada `promptGoogleFlow` berfokus pada foley nyata, ambient lokasi, serta ritme visual."
      : formatDialog === "obrolan_2_orang"
      ? "FORMAT WAJIB: OBROLAN 2 ORANG (BANYAK NGOBROL TEKTOKAN). Setiap klip 8 detik wajib berisi percakapan 2 arah yang hidup: Tokoh A bicara 1 kalimat singkat, Tokoh B langsung menimpali 1 kalimat singkat dengan ekspresi wajah & bahasa tubuh alami (total 15-20 kata per klip). Di blok `AUDIO & DIALOGUE:`, wajib sebutkan identitas fisik masing-masing pembicara sebelum dialognya (mis. `Man in black apron says cleanly: \"...\"` lalu `Woman in cream hijab replies playfully: \"...\"`) agar Veo 3 tidak tertukar mulut."
      : formatDialog === "monolog_kamera"
      ? "FORMAT WAJIB: NGOBROL LANGSUNG KE KAMERA (POV/CURHAT). 1 tokoh berbicara akrab menatap lensa kamera dengan gerakan tangan wajar seperti kreator Reels viral (14-18 kata per klip, ekspresif). Sebutkan `Speaker looking directly into camera says: \"...\"` di `AUDIO & DIALOGUE:`."
      : "FORMAT: STORYTELLING SINEMATIK dengan dialog/narasi hangat, ekspresi kuat, dan gerak sinematik (13-17 kata per klip).";

  const arahanGayaKhusus =
    gaya === "fooh_3d"
      ? "GAYA KHUSUS FOOH 3D (Fake Out Of Home): Kamera street-level realistis merekam bangunan/lokasi nyata atau suasana jalan sore dengan lalu lintas/orang berjalan. Panel/billboard 3D raksasa terbuka secara mekanis lalu objek produk raksasa (mis. gelas kopi raksasa dengan cairan berpercik & biji kopi melayang) menyembul keluar secara anamorfik fotorealistik dengan bayangan dan pantulan cahaya nyata. Cukup 1–2 klip spektakuler."
      : gaya === "iklan_komersial"
      ? "GAYA KHUSUS IKLAN KOMERSIAL FAST-CUT (ala FROTH): Potongan cepat energik yang menjaga 1 foto produk/gelas sebagai pusat perhatian konsisten di setiap klip, dipadukan variasi shot model memakai warna seragam rapi (close-up macro es kopi berembun, model tersenyum menyodorkan minuman ke kamera, match-cut perputaran gelas, hingga shot top-down cheers bersama). Cocok untuk diedit cepat mengikuti beat musik."
      : gaya === "sketsa_visual"
      ? "GAYA KHUSUS SKETSA KOMEDI VISUAL (ala Balina Cafe): Cerita mini tanpa dialog panjang dalam 2–3 klip yang sangat mudah diikuti secara visual: Klip 1 setup + twist lucu tak terduga (mis. minuman diletakkan lalu disambar cepat oleh teman/pengendara lewat dengan ekspresi kaget), Klip 2 payoff close-up tokoh yang menikmati minuman dengan puas + senyum santai. Gunakan ekspresi wajah jelas dan SFX foley kuat."
      : "";

  const adalahVisualProduk = gaya === "fooh_3d" || gaya === "iklan_komersial";
  const arahanBahasa =
    formatDialog === "tanpa_dialog_sfx"
      ? "Tidak perlu dialog ucapan — tuliskan aksi visual & efek suara (SFX) dengan sangat jelas dan hidup."
      : bahasa === "jawa_timur"
      ? "Gunakan dialog Bahasa Jawa Timur / Suroboyoan-Sidoarjoan yang natural, sopan, akrab, dan tidak dibuat-buat (seperti obrolan warga Sidoarjo/Surabaya sehari-hari)."
      : bahasa === "jawa_campur"
      ? "Gunakan dialog Bahasa Indonesia santai bercampur kosakata & logat Jawa Timur tipis yang natural dan enak didengar audiens luas Indonesia."
      : "Gunakan dialog Bahasa Indonesia sehari-hari yang santai, natural, dan terasa seperti manusia sungguhan (bukan bahasa iklan kaku).";

  const aturanSuaraPrompt =
    formatDialog === "tanpa_dialog_sfx"
      ? "AUDIO & SFX: Realistic close-up foley sounds ([tuliskan suara benda/aksi nyata]) + natural ambient location sound. No human speech, no background music, no subtitles."
      : formatDialog === "obrolan_2_orang"
      ? "AUDIO & DIALOGUE: [Sebutkan identitas fisik Tokoh A] says with [logat & emosi]: \"[dialog A persis]\". Immediately [Identitas fisik Tokoh B] replies with [logat & emosi]: \"[dialog B persis]\". Natural conversational pace, [ambient lokasi]. No background music, no on-screen captions."
      : "AUDIO & DIALOGUE: [Sebutkan identitas fisik pembicara & arah pandang] speaks clearly with [logat & emosi]: \"[dialog persis]\". Natural conversational pace, [ambient lokasi]. No background music, no on-screen captions.";

  const blokRiwayat = riwayat.length
    ? `\n\nRIWAYAT IDE SEBELUMNYA (DILARANG mengulang konsep/hook yang mirip):\n${riwayat.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    : "";

  return {
    system:
      `Kamu sutradara kreatif & prompt engineer ahli untuk Google Flow (Veo 3 / Veo 3.1) khusus konten Reels Instagram vertikal 9:16. ` +
      `Brand: ${deskripsiMerek} ` +
      `Setiap klip adalah video AI 8 detik. Tugasmu memastikan arahan prompt sangat spesifik, terstruktur baris-per-baris, punya kesinambungan visual antarklip, dan tidak ambigu saat ditempel ke Google Flow.`,
    prompt: [
      `Buatkan 1 paket storyboard & prompt siap-copy Google Flow (Veo 3) terdiri dari TEPAT ${jml} adegan (@ 8 detik per klip, total ${jml * 8} detik).`,
      arahanFormat,
      `Gaya konten: ${gaya.replace(/_/g, " ")}.`,
      arahanGayaKhusus,
      arahanBahasa,
      topik?.trim()
        ? `Topik/arahan dari pemilik: ${topik.trim()}`
        : `Topik bebas — pilihkan 1 ide paling segar & relatable untuk ${namaBrand}.`,
      "Aturan wajib struktur cerita & Langkah 0:",
      "- Adegan 1 wajib langsung HOOK visual/kalimat kuat pada 0-2 detik pertama (tanpa salam pembuka klise). Alur antar-klip harus sambung: Klip 1 hook/masalah → Klip tengah konflik/demo/momen utama → Klip terakhir payoff & ajakan ringan.",
      adalahVisualProduk
        ? "- Buat `promptGambarKarakter` (Langkah 0) berupa prompt 9:16 photorealistic untuk foto hero produk / adegan pembuka bersih agar bisa dipasang sebagai Reference Ingredient di Google Flow sehingga tampilan objek produk 100% KONSISTEN antar klip."
        : "- Buat `promptGambarKarakter` (Langkah 0) berupa prompt Text-to-Image 9:16 medium shot menghadap kamera dengan pencahayaan alami di lokasi utama, untuk digenerate 1× di Google Flow → Image lalu dipakai sebagai Reference Ingredient agar wajah, rambut/hijab/peci, dan baju karakter 100% KONSISTEN tidak berubah di semua klip.",
      "FORMAT WAJIB SETIAP `promptGoogleFlow` (tulis dalam bahasa Inggris kecuali kutipan dialog Indonesia/Jawa, gunakan TEPAT 6 baris berlabel berikut):",
      "1) `SHOT & CAMERA:` jenis framing (mis. Eye-level medium close-up, shallow DOF 35mm), gerakan kamera halus (`slow handheld push-in`, `locked tripod`, dll.), vertical 9:16.",
      "2) `SUBJECT & CONTINUITY:` tempel ulang ringkasan fisik tokoh/produk dari `karakterBible` (posisi kiri/kanan, pakaian, properti di tangan); untuk Klip 2 ke atas wajib tulis `Seamless continuation right after Clip N-1: ...`.",
      "3) `SETTING & LIGHTING:` lokasi nyata yang konsisten (mis. warm outdoor coffee bar in Sidoarjo with paving ground and hanging warm bulbs pada sore hari, atau rapi real small shop/office) + kualitas cahaya realistis.",
      "4) `ACTION TIMELINE (0-8s):` bagi gerakan nyata ke 3 segmen waktu jelas: `0-2s: ...; 2-5s: ...; 5-8s: ...` sesuai dialog/SFX agar gerakan mulut & aksi pas 8 detik.",
      `5) \`${aturanSuaraPrompt}\``,
      adalahVisualProduk
        ? "6) `CONSTRAINTS:` Keep exact product consistency from the reference ingredient. Vertical 9:16 photorealistic commercial look. STRICTLY NO garbled AI text, NO fake UI screens, NO watermarks."
        : "6) `CONSTRAINTS:` Keep the exact same character face, hair, and outfit from the reference ingredient. Vertical 9:16 photorealistic look. STRICTLY NO shop signs, NO wooden logo boards, NO brand logos on walls/cups, NO readable phone/laptop screens, NO on-screen text, NO watermarks.",
      blokRiwayat,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
