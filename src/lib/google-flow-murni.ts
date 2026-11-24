// Aturan & skema murni untuk Google Flow Bridge (Veo 3 / Veo 3.1 prompt pack per adegan).
// Sengaja mandiri tanpa impor runtime relatif agar langsung lolos node --test maupun Next.js.

export type BahasaFlow = "indonesia" | "jawa_timur" | "jawa_campur";
export type GayaFlow = "storytelling_hangat" | "komedi_santai" | "sinematik_produk" | "pov_relatable";
export type FormatDialogFlow = "obrolan_2_orang" | "monolog_kamera" | "storytelling_narasi";

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
        "Deskripsi konsisten dalam bahasa Inggris untuk karakter utama (usia, pakaian, wajah/rambut, peci/hijab bila pesantren) & latar tempat agar semua klip Google Flow terlihat seperti 1 video utuh",
    },
    promptGambarKarakter: {
      type: "string",
      description:
        "Prompt gambar (Text-to-Image) dalam bahasa Inggris untuk dibuat SEKALI di Google Flow lalu dipakai sebagai Ingredient/Bahan Referensi di semua klip agar wajah & pakaian karakter 100% konsisten tidak berubah-ubah. Tanpa teks, tanpa logo palsu, tanpa layar HP.",
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
          ringkasAksi: { type: "string", description: "Ringkasan aksi adegan dalam Bahasa Indonesia (1 kalimat)" },
          dialog: { type: "string", description: "Kalimat dialog/narasi persis yang diucapkan karakter di adegan ini (maks 18 kata agar pas 8 detik)" },
          arahanLogat: { type: "string", description: "Arahan nada, emosi, dan logat suara (mis. 'Santai, logat Jawa Timur hangat, sedikit terkekeh')" },
          teksLayar: { type: "string", description: "Teks subtitle/sorotan singkat 3-6 kata di layar" },
          promptGoogleFlow: {
            type: "string",
            description:
              "Prompt lengkap siap-copy untuk Google Flow (Veo 3, vertical 9:16) dalam bahasa Inggris untuk visual/kamera/pencahayaan/ambient sound, sambil menuliskan kalimat dialog PERSIS dalam bahasa Indonesia/Jawa di dalam tanda kutip beserta arahan logat agar lip-sync & suara Veo 3 sangat natural. Sertakan deskripsi karakter dari karakterBible di setiap klip.",
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
  const jml = Math.min(6, Math.max(2, Math.round(jumlahAdegan)));

  const deskripsiMerek =
    m === "lekkopi"
      ? "Lek Kopi (@lekkopi.id): kedai kopi outdoor hangat di Panjunan, Waru, Sidoarjo, menu andalan kopi susu, espresso, matcha, Sakura Iced Coffee, suasana nongkrong sore-malam yang ramah."
      : `Bakafrawi Project (@bakafrawi.project): studio software & desain di Sidoarjo. Produk yang dipromosikan: ${infoProduk?.label} — ${infoProduk?.info}.`;

  const arahanFormat =
    formatDialog === "obrolan_2_orang"
      ? "FORMAT WAJIB: OBROLAN 2 ORANG (BANYAK NGOBROL TEKTOKAN). Setiap klip 8 detik harus berisi percakapan 2 arah yang hidup (Tokoh A bicara 1 kalimat singkat, Tokoh B langsung menimpali 1 kalimat singkat dengan ekspresi wajah & gerak tangan alami). Total 16-22 kata per klip."
      : formatDialog === "monolog_kamera"
      ? "FORMAT WAJIB: NGOBROL LANGSUNG KE KAMERA (POV/CURHAT). 1 tokoh berbicara akrab langsung menatap kamera seperti kreator Reels viral (15-20 kata per klip, ekspresif)."
      : "FORMAT: STORYTELLING SINEMATIK dengan dialog/narasi hangat dan visual ekspresif (14-18 kata per klip).";

  const arahanBahasa =
    bahasa === "jawa_timur"
      ? "Gunakan dialog Bahasa Jawa Timur / Suroboyoan-Sidoarjoan yang natural, sopan, akrab, dan tidak dibuat-buat (seperti obrolan warga Sidoarjo/Surabaya sehari-hari)."
      : bahasa === "jawa_campur"
      ? "Gunakan dialog Bahasa Indonesia santai bercampur kosakata & logat Jawa Timur tipis yang natural dan enak didengar audiens luas Indonesia."
      : "Gunakan dialog Bahasa Indonesia sehari-hari yang santai, natural, dan terasa seperti manusia sungguhan (bukan bahasa iklan kaku).";

  const blokRiwayat = riwayat.length
    ? `\n\nRIWAYAT IDE SEBELUMNYA (DILARANG mengulang konsep/hook yang mirip):\n${riwayat.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    : "";

  return {
    system:
      `Kamu sutradara kreatif & prompt engineer ahli untuk Google Flow (Veo 3 / Veo 3.1) khusus konten Reels Instagram vertikal 9:16. ` +
      `Brand: ${deskripsiMerek} ` +
      `Semua visual adalah 100% Full AI. Pastikan setiap prompt Google Flow sangat detail secara sinematografi (kamera, pencahayaan, ekspresi, pakaian konsisten, ambient sound) dan mencantumkan dialog persis yang diucapkan agar Veo 3 menghasilkan suara & logat yang sangat natural.`,
    prompt: [
      `Buatkan 1 paket storyboard & prompt siap-copy Google Flow (Veo 3) terdiri dari TEPAT ${jml} adegan (@ 8 detik per klip, total ${jml * 8} detik).`,
      arahanFormat,
      `Gaya konten: ${gaya.replace(/_/g, " ")}.`,
      arahanBahasa,
      topik?.trim()
        ? `Topik/arahan dari pemilik: ${topik.trim()}`
        : `Topik bebas — pilihkan 1 ide cerita/obrolan paling segar & relatable untuk ${namaBrand}.`,
      "Aturan wajib tiap adegan:",
      "- Adegan 1 harus langsung HOOK kuat di 2 detik pertama (tanpa salam pembuka klise).",
      "- Buat promptGambarKarakter (Langkah 0) agar pemilik bisa men-generate 1 gambar referensi karakter utama untuk fitur 'Ingredients to Video' Google Flow supaya wajah & baju karakter 100% KONSISTEN tidak berubah-ubah antar klip.",
      "- Di setiap promptGoogleFlow, wajib sertakan instruksi: `Keep the exact same character face, hair, and outfit from the reference ingredient. Vertical 9:16 cinematic video, ...` lalu tulis dialog PERSIS dalam tanda kutip beserta arahan logat.",
      "- LARANGAN KERAS di semua prompt visual: `STRICTLY NO shop signs, NO wooden logo boards, NO brand logos on walls/cups, NO readable phone/laptop screens, NO on-screen text, NO watermarks.` (agar tidak pernah muncul logo palsu atau tampilan aplikasi palsu).",
      blokRiwayat,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
