import { z } from "zod";

// Satu-satunya definisi bentuk isi situs: tipe TypeScript diturunkan dari skema ini, dan skema
// yang sama memvalidasi isi sebelum disimpan dari panel admin — supaya tipe & aturan tak berpisah.

const teks = z.string().trim();
const wajib = (label: string) => teks.min(1, `${label} wajib diisi`);
const url = z.string().trim().url("Alamat tautan tidak valid");

export const skemaGambar = z.object({
  src: wajib("Gambar"),
  alt: teks,
  lebar: z.number().int().positive(),
  tinggi: z.number().int().positive(),
  keterangan: teks.optional(),
});

export const skemaTautan = z.object({ label: wajib("Label tautan"), url, utama: z.boolean().optional() });

export const KATEGORI = ["saas", "aplikasi", "pesanan"] as const;
export const NAMA_KATEGORI: Record<(typeof KATEGORI)[number], string> = {
  saas: "SaaS (dijual berlangganan)",
  aplikasi: "Aplikasi Bakafrawi",
  pesanan: "Karya pesanan klien",
};

export const skemaProduk = z.object({
  slug: wajib("Slug").regex(/^[a-z0-9-]+$/, "Slug hanya huruf kecil, angka, dan tanda -"),
  nama: wajib("Nama produk"),
  kategori: z.enum(KATEGORI),
  label: teks,
  judul: wajib("Judul produk"),
  deskripsi: teks,
  klien: teks.optional(),
  platform: z.array(teks),
  fitur: z.array(z.object({ judul: wajib("Judul fitur"), isi: teks })),
  tautan: z.array(skemaTautan),
  logo: skemaGambar.optional(),
  layarDesktop: z.array(skemaGambar).optional(),
  layarHp: z.array(skemaGambar).optional(),
  /** Khusus produk SaaS: tampilkan tabel harga yang dibaca dari database aplikasinya. */
  tampilHarga: z.boolean().optional(),
  tampil: z.boolean(),
});

export const IKON_LAYANAN = ["web", "aplikasi", "lembaga", "saas"] as const;
export const JENIS_SOSIAL = ["instagram", "facebook", "playstore", "tiktok", "youtube", "github"] as const;

export const skemaSitus = z.object({
  nama: wajib("Nama"),
  tagline: teks,
  deskripsi: teks,
  urlSitus: url,
  statusProyek: teks,
  hero: z.object({ label: teks, judul: wajib("Judul hero"), sorot: z.array(teks), isi: teks }),
  statistik: z.array(z.object({ angka: wajib("Angka"), label: wajib("Label") })),
  layanan: z.array(z.object({ ikon: z.enum(IKON_LAYANAN), judul: wajib("Judul layanan"), isi: teks, tag: z.array(teks) })),
  produk: z.array(skemaProduk).refine((p) => new Set(p.map((x) => x.slug)).size === p.length, "Slug produk tidak boleh kembar"),
  proses: z.array(z.object({ judul: wajib("Judul langkah"), isi: teks })),
  tentang: z.object({ judul: teks, paragraf: z.array(teks), fakta: z.array(z.object({ label: teks, isi: teks })) }),
  kontak: z.object({
    email: z.string().trim().email("Email tidak valid"),
    whatsappTampil: teks,
    /** Format internasional tanpa tanda +, dipakai untuk tautan wa.me. */
    whatsappNomor: teks.regex(/^62\d{8,13}$/, "Nomor WA harus diawali 62, tanpa spasi/tanda"),
    lokasi: teks,
    sosial: z.array(z.object({ jenis: z.enum(JENIS_SOSIAL), url })),
  }),
  analitik: z.object({ gaId: teks, umamiId: teks, umamiShareUrl: teks }),
});

export type Gambar = z.infer<typeof skemaGambar>;
export type Tautan = z.infer<typeof skemaTautan>;
export type Produk = z.infer<typeof skemaProduk>;
export type KategoriProduk = Produk["kategori"];
export type Situs = z.infer<typeof skemaSitus>;
export type Layanan = Situs["layanan"][number];

/** WA "0878-9266-3748" → "6287892663748"; dipakai panel admin agar Kyai cukup mengetik nomor biasa. */
export function nomorWaInternasional(tampil: string) {
  const angka = tampil.replace(/\D/g, "");
  return angka.startsWith("0") ? "62" + angka.slice(1) : angka;
}
