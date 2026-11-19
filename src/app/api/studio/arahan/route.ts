import { permintaanDariAdmin } from "@/lib/admin-server";
import { ambilKonten } from "@/lib/konten";
import { usulkanArahan } from "@/lib/usul-arahan";

export const maxDuration = 60;

// Tombol "Usulkan arahan" di formulir Studio: 3 pilihan arahan dari Claude untuk produk terpilih.
export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const isi = (await req.json().catch(() => ({}))) as { produk?: string; jenis?: string };
  try {
    const produk = (await ambilKonten()).produk.find((p) => p.slug === isi.produk);
    if (!produk) return Response.json({ ok: false, pesan: "Produk tidak ditemukan." }, { status: 400 });
    const usulan = await usulkanArahan(produk, isi.jenis === "gambar" ? "gambar" : "video");
    return Response.json({ ok: true, usulan });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal mengusulkan arahan." }, { status: 400 });
  }
}
