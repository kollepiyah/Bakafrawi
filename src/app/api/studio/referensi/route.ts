import { permintaanDariAdmin } from "@/lib/admin-server";
import {
  bedahDanSimpanReferensi,
  daftarReferensiMerek,
  hapusReferensiMerek,
} from "@/lib/referensi-video";

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false, pesan: "Sesi admin habis, silakan muat ulang halaman." }, { status: 401 });
  const merek = new URL(req.url).searchParams.get("merek") || "bakafrawi";
  try {
    const daftar = await daftarReferensiMerek(merek);
    return Response.json({ ok: true, daftar });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal memuat referensi." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false, pesan: "Sesi admin habis, silakan muat ulang halaman." }, { status: 401 });
  const isi = (await req.json().catch(() => ({}))) as {
    merek?: string;
    url?: string;
    namaFile?: string;
    durasiDetik?: number;
    gambar?: { mimeType: string; data: string }[];
    catatan?: string;
  };
  const adaGambar = Array.isArray(isi.gambar) && isi.gambar.length > 0;
  if (!adaGambar && !isi.url?.trim()) {
    return Response.json({ ok: false, pesan: "Unggah video (.mp4) / screenshot, atau tempel tautan Reels/TikTok terlebih dahulu." }, { status: 400 });
  }
  try {
    const referensi = await bedahDanSimpanReferensi({
      merek: isi.merek || "bakafrawi",
      url: isi.url?.trim() || undefined,
      namaFile: isi.namaFile,
      durasiDetik: isi.durasiDetik,
      gambar: adaGambar ? isi.gambar!.slice(0, 6) : undefined,
      catatan: isi.catatan?.trim() || undefined,
    });
    return Response.json({ ok: true, referensi });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal membedah video referensi." }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const u = new URL(req.url);
  const merek = u.searchParams.get("merek") || "bakafrawi";
  const id = u.searchParams.get("id") || "";
  if (!id) return Response.json({ ok: false, pesan: "ID referensi wajib diisi." }, { status: 400 });
  try {
    await hapusReferensiMerek(merek, id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal menghapus referensi." }, { status: 400 });
  }
}
