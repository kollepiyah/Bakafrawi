// Aturan dan formula murni untuk riset video Reels viral dan waktu tayang optimal.
// Murni tanpa server, bisa diuji dengan unit test.
import type { Produk } from "@/content/skema";

export type SlotWaktu = {
  slot: "pagi" | "siang" | "sore" | "malam";
  jam: string;
  nama: string;
  audiens: string;
  alasan: string;
  hariTerbaik: string[];
  skor: number; // 1-100 (efektivitas)
};

export const JADWAL_OPTIMAL: SlotWaktu[] = [
  {
    slot: "sore",
    jam: "17.30 - 19.30 WIB",
    nama: "Golden Prime Time",
    audiens: "Pemilik usaha, karyawan, umum (waktu pulang & santai)",
    alasan: "Trafik aktif tertinggi di Instagram & TikTok Indonesia. Algoritma menyebarkan video dengan retensi awal tinggi ke Explore.",
    hariTerbaik: ["Selasa", "Rabu", "Kamis", "Minggu"],
    skor: 98,
  },
  {
    slot: "siang",
    jam: "11.45 - 13.00 WIB",
    nama: "Istirahat Siang",
    audiens: "Pekerja kantor, pemilik toko, UMKM saat istirahat",
    alasan: "Waktu rehat makan siang, penonton fokus pada konten demo singkat 30 detik yang memberi solusi cepat.",
    hariTerbaik: ["Senin", "Selasa", "Rabu", "Kamis"],
    skor: 88,
  },
  {
    slot: "malam",
    jam: "20.30 - 21.45 WIB",
    nama: "Santai Malam",
    audiens: "Pemilik bisnis setelah tutup toko, netizen sebelum tidur",
    alasan: "Sangat baik untuk Reels bertema storytelling, keluh kesah bisnis, dan ajakan konsultasi WhatsApp.",
    hariTerbaik: ["Rabu", "Kamis", "Jumat", "Minggu"],
    skor: 85,
  },
  {
    slot: "pagi",
    jam: "07.00 - 08.30 WIB",
    nama: "Commute & Santai Pagi",
    audiens: "Aktivitas pagi hari sebelum jam sibuk kerja",
    alasan: "Cocok untuk konten tips praktis, motivasi bisnis singkat, dan poster pengingat.",
    hariTerbaik: ["Senin", "Rabu", "Jumat"],
    skor: 74,
  },
];

/** Hitung status waktu saat ini (jam WIB) terhadap jadwal optimal. */
export function statusWaktuSekarang(jamWIB: number) {
  if (jamWIB >= 17 && jamWIB < 20) {
    return {
      status: "sedang_prime_time",
      label: "🔥 Sekarang Golden Prime Time (17.30 - 19.30 WIB)",
      slot: JADWAL_OPTIMAL[0],
      saran: "Waktu terbaik! Segera jadwalkan atau tayangkan konten sekarang untuk jangkauan puncak.",
    };
  }
  if (jamWIB >= 11 && jamWIB < 14) {
    return {
      status: "sedang_prime_time",
      label: "☀️ Sekarang Prime Time Siang (11.45 - 13.00 WIB)",
      slot: JADWAL_OPTIMAL[1],
      saran: "Bagus untuk Reels demo fitur aplikasi 30 detik.",
    };
  }
  if (jamWIB >= 20 && jamWIB < 22) {
    return {
      status: "sedang_prime_time",
      label: "🌙 Sekarang Prime Time Malam (20.30 - 21.45 WIB)",
      slot: JADWAL_OPTIMAL[2],
      saran: "Cocok untuk Reels cerita/keluhan operasional toko & solusi.",
    };
  }
  if (jamWIB < 11) {
    return {
      status: "menunggu",
      label: "Menuju Prime Time Siang (11.45 WIB)",
      slot: JADWAL_OPTIMAL[1],
      saran: "Siapkan konten sekarang agar bisa ditayangkan tepat jam 11.45 WIB.",
    };
  }
  return {
    status: "menunggu",
    label: "Menuju Golden Prime Time (17.30 WIB)",
    slot: JADWAL_OPTIMAL[0],
    saran: "Jadwalkan untuk pukul 18.00–19.00 WIB nanti malam.",
  };
}

export type KonsepReelsViral = {
  judul: string;
  hook: string;
  sudutMasalah: string;
  alurVisual: string;
  teksLayarKunci: string;
  ajakanCta: string;
  arahanStudio: string; // Teks siap pakai untuk kolom arahan Studio
};

export const FORMULA_VIRAL = [
  {
    pilar: "Hook 3 Detik Pertama",
    deskripsi: "Sentil 'rasa sakit' atau 'kebiasaan salah' penonton. Jangan mulai dengan salam atau perkenalan diri.",
    contoh: "\"Toko kelihatan ramai tiap hari, tapi pas tutup buku uangnya gak ada?\"",
  },
  {
    pilar: "Visual Rhythm (Pacing)",
    deskripsi: "Tampilan berganti tiap 2–4 detik. Tampilkan layar HP yang bergerak/scroll dan kotak perbesaran fitur utama.",
    contoh: "Zoom-in ke fitur struk otomatis WhatsApp atau laporan laba bersih sekali klik.",
  },
  {
    pilar: "Teks Layar Kontras",
    deskripsi: "80% penonton Reels menonton tanpa suara. Teks judul & kata kunci penting harus terpampang jelas di tengah layar.",
    contoh: "Teks stabilo kuning/emas dengan frasa 2-4 kata yang memicu rasa penasaran.",
  },
  {
    pilar: "Call to Action Nyata",
    deskripsi: "Ajakan jelas yang tidak membebani penonton. Hubungkan langsung ke DM, WhatsApp, atau coba gratis.",
    contoh: "\"Coba demo gratisnya sekarang, link ada di bio!\"",
  },
];

export const SKEMA_RISET_REELS = {
  type: "object",
  additionalProperties: false,
  required: ["konsep"],
  properties: {
    konsep: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["judul", "hook", "sudutMasalah", "alurVisual", "teksLayarKunci", "ajakanCta", "arahanStudio"],
        properties: {
          judul: { type: "string", description: "Nama konsep Reels, mis. 'Hook Toko Bocor Halus'" },
          hook: { type: "string", description: "Kalimat pembuka 3 detik pertama yang memancing penasaran/emosi" },
          sudutMasalah: { type: "string", description: "Masalah nyata penonton yang diangkat (1 kalimat)" },
          alurVisual: { type: "string", description: "Arahan visual video (animasi layar, karakter, transisi)" },
          teksLayarKunci: { type: "string", description: "Teks sorotan di layar (2-5 kata)" },
          ajakanCta: { type: "string", description: "Kalimat penutup ajakan coba/konsultasi" },
          arahanStudio: { type: "string", description: "Arahan lengkap ringkas (2-3 kalimat) siap tempel ke kolom arahan Studio" },
        },
      },
    },
  },
} as const;

export const SISTEM_RISET_REELS =
  "Kamu adalah Creative Strategist & Reels Specialist untuk Bakafrawi Project (software developer di Sidoarjo pembuat Maktaba POS, sistem custom, dan website bisnis). " +
  "Tugasmu merancang konsep video Reels yang berpotensi viral tinggi di Indonesia: hook kuat menyentil emosi/masalah operasional nyata, alur cepat to-the-point, dan CTA jelas. " +
  "Bahasa Indonesia santai, alami, persuasif, tanpa kata-kata klise.";

export function promptRisetReels(
  produk: Pick<Produk, "nama" | "kategori" | "klien" | "judul" | "deskripsi" | "fitur">,
  topikKhusus?: string,
) {
  const fitur = produk.fitur.map((f) => `- ${f.judul}: ${f.isi}`).join("\n");
  return [
    `Buat 3 konsep video Reels berpotensi viral (durasi 30-45 detik) untuk produk: ${produk.nama}.`,
    topikKhusus ? `Fokuskan pada tema/topik: "${topikKhusus}".` : "Variasikan sudut: 1) Masalah menyakitkan/relatable, 2) Perbandingan cara lama vs cara modern, 3) Fitur rahasia penyelamat waktu.",
    "Setiap konsep harus menyertakan arahanStudio yang siap pakai untuk dimasukkan ke pembuat video AI.",
    "",
    `Data Produk:`,
    `Nama: ${produk.nama}`,
    `Judul: ${produk.judul}`,
    `Deskripsi: ${produk.deskripsi}`,
    `Fitur Unggulan:\n${fitur}`,
  ].join("\n");
}

export function rapikanRisetReels(mentah: unknown, jumlah = 3): KonsepReelsViral[] {
  const daftar = (mentah as { konsep?: unknown })?.konsep;
  if (!Array.isArray(daftar)) return [];
  const bersihkan = (v: unknown, maks = 300) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, maks);

  return daftar
    .map((k) => ({
      judul: bersihkan((k as KonsepReelsViral)?.judul, 60),
      hook: bersihkan((k as KonsepReelsViral)?.hook, 180),
      sudutMasalah: bersihkan((k as KonsepReelsViral)?.sudutMasalah, 200),
      alurVisual: bersihkan((k as KonsepReelsViral)?.alurVisual, 250),
      teksLayarKunci: bersihkan((k as KonsepReelsViral)?.teksLayarKunci, 80),
      ajakanCta: bersihkan((k as KonsepReelsViral)?.ajakanCta, 150),
      arahanStudio: bersihkan((k as KonsepReelsViral)?.arahanStudio, 400),
    }))
    .filter((k) => k.hook && k.arahanStudio)
    .slice(0, jumlah);
}
