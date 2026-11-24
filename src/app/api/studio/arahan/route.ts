import { permintaanDariAdmin } from "@/lib/admin-server";
import { ambilKonten } from "@/lib/konten";
import { usulkanArahan, usulkanArahanLekKopi } from "@/lib/usul-arahan";

export const maxDuration = 60;

// Tombol "Usulkan arahan / Ide" di formulir Studio (Bakafrawi & Lek Kopi). AI lewat llm-router.
export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const isi = (await req.json().catch(() => ({}))) as { merek?: string; produk?: string; jenis?: string };
  try {
    const adalahLekKopi =
      isi.merek === "lekkopi" ||
      String(isi.produk ?? "").startsWith("lekkopi") ||
      (!isi.merek && isi.produk === "lek-kopi");
    const jenis = isi.jenis === "gambar" ? "gambar" : "video";

    if (adalahLekKopi) {
      const usulan = await usulkanArahanLekKopi(jenis, String(isi.produk ?? ""));
      return Response.json({ ok: true, usulan });
    }

    const produk = (await ambilKonten()).produk.find((p) => p.slug === isi.produk);
    if (!produk) return Response.json({ ok: false, pesan: "Produk tidak ditemukan." }, { status: 400 });
    const usulan = await usulkanArahan(produk, jenis);
    return Response.json({ ok: true, usulan });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal mengusulkan arahan." }, { status: 400 });
  }
}
