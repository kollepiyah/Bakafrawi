// Helper murni untuk daftar Website Custom / proyek klien di Studio Bakafrawi
// (mis. almansur.id, website pesantren, UMKM, company profile) tanpa harus masuk katalog publik situs.

export type KategoriWebCustom = "pesantren" | "umkm" | "perusahaan" | "pendidikan" | "custom";

export type WebCustomStudio = {
  id: string;
  slug: string;
  nama: string;
  url: string;
  kategori: KategoriWebCustom;
  deskripsi: string;
  aksen?: string;
  dibuat: string;
};

export const OPSI_KATEGORI_WEB_CUSTOM: { kode: KategoriWebCustom; label: string; aksenBawaan: string }[] = [
  { kode: "pesantren", label: "Pesantren / Lembaga Islam", aksenBawaan: "#10B981" },
  { kode: "pendidikan", label: "Sekolah / Pendidikan / Yayasan", aksenBawaan: "#38BDF8" },
  { kode: "umkm", label: "UMKM / Kafe / Toko Online", aksenBawaan: "#F59E0B" },
  { kode: "perusahaan", label: "Perusahaan / Company Profile", aksenBawaan: "#18B4A8" },
  { kode: "custom", label: "Website / Aplikasi Custom Lainnya", aksenBawaan: "#34E0CD" },
];

const KATEGORI_SAH = new Set<KategoriWebCustom>(["pesantren", "umkm", "perusahaan", "pendidikan", "custom"]);
const POLA_HEX = /^#[0-9a-fA-F]{6}$/;

/** Normalisasi URL website publik (otomatis tambah https:// bila hanya ketik domain seperti almansur.id). */
export function normalisasiUrlWeb(masukan: string): { ok: true; url: string; domain: string } | { ok: false; pesan: string } {
  let teks = String(masukan ?? "").trim();
  if (!teks) return { ok: false, pesan: "URL website wajib diisi (mis. almansur.id)." };
  if (!/^https?:\/\//i.test(teks)) {
    teks = `https://${teks}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(teks);
  } catch {
    return { ok: false, pesan: "Format URL website tidak sah (contoh: almansur.id atau https://almansur.id)." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, pesan: "URL harus memakai http:// atau https://." };
  }
  const host = parsed.hostname.toLowerCase();
  // Tolak alamat lokal/internal agar aman dari SSRF.
  if (
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  ) {
    return { ok: false, pesan: "URL harus berupa domain publik yang bisa diakses internet." };
  }
  parsed.hash = "";
  const urlBersih = parsed.toString().replace(/\/+$/, "");
  const domain = host.replace(/^www\./, "");
  return { ok: true, url: urlBersih, domain };
}

/** Buat slug aman (diawali `web-`) dari nama atau domain situs custom. */
export function slugWebCustom(namaAtauDomain: string): string {
  const dasar = String(namaAtauDomain ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  const bersih = dasar || "situs";
  return bersih.startsWith("web-") ? bersih : `web-${bersih}`;
}

/** Label kategori manusiawi untuk prompt AI dan lencana video. */
export function labelKategoriWebCustom(kategori?: string | null): string {
  const temu = OPSI_KATEGORI_WEB_CUSTOM.find((k) => k.kode === kategori);
  return temu?.label ?? "Website Custom";
}

/** Warna aksen bawaan sesuai kategori bila belum diisi manual. */
export function aksenKategoriWebCustom(kategori?: string | null): string {
  const temu = OPSI_KATEGORI_WEB_CUSTOM.find((k) => k.kode === kategori);
  return temu?.aksenBawaan ?? "#18B4A8";
}

/** Rapikan daftar Web Custom tersimpan dari JSON database (`bakafrawi.profil.web_custom`, maks 30 item). */
export function normalisasiDaftarWebCustom(mentah: unknown): WebCustomStudio[] {
  if (!Array.isArray(mentah)) return [];
  const hasil: WebCustomStudio[] = [];
  const sudahId = new Set<string>();
  const sudahSlug = new Set<string>();

  for (const item of mentah) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const cekUrl = normalisasiUrlWeb(String(obj.url ?? ""));
    if (!cekUrl.ok) continue;

    const kategoriMentah = String(obj.kategori ?? "custom").trim().toLowerCase() as KategoriWebCustom;
    const kategori: KategoriWebCustom = KATEGORI_SAH.has(kategoriMentah) ? kategoriMentah : "custom";
    const nama = String(obj.nama ?? "").trim().slice(0, 64) || cekUrl.domain;
    const slug = slugWebCustom(String(obj.slug || cekUrl.domain));
    const id = String(obj.id ?? "").trim() || slug;
    if (sudahId.has(id) || sudahSlug.has(slug)) continue;
    sudahId.add(id);
    sudahSlug.add(slug);

    const aksenRaw = String(obj.aksen ?? "").trim();
    const deskripsi = String(obj.deskripsi ?? "").trim().slice(0, 260);
    const dibuat = String(obj.dibuat ?? "").trim() || new Date().toISOString();

    hasil.push({
      id,
      slug,
      nama,
      url: cekUrl.url,
      kategori,
      deskripsi,
      ...(POLA_HEX.test(aksenRaw) ? { aksen: aksenRaw } : {}),
      dibuat,
    });
    if (hasil.length >= 30) break;
  }

  return hasil;
}
