import { permintaanDariAdmin } from "@/lib/admin-server";
import {
  adaKunciServer,
  daftarWebCustomStudio,
  simpanWebCustomStudio,
} from "@/lib/studio-server";
import {
  normalisasiUrlWeb,
  slugWebCustom,
  type KategoriWebCustom,
  type WebCustomStudio,
} from "@/lib/web-custom-murni";

export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) {
    return Response.json({ ok: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." }, { status: 500 });
  }
  try {
    return Response.json({ ok: true, daftar: await daftarWebCustomStudio() });
  } catch (e) {
    return Response.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal memuat daftar Web Custom." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) {
    return Response.json({ ok: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." }, { status: 500 });
  }

  const isi = (await req.json().catch(() => ({}))) as {
    aksi?: "simpan" | "hapus";
    id?: string;
    nama?: string;
    url?: string;
    kategori?: KategoriWebCustom;
    deskripsi?: string;
    aksen?: string;
  };

  try {
    if (isi.aksi === "simpan") {
      const cekUrl = normalisasiUrlWeb(String(isi.url ?? ""));
      if (!cekUrl.ok) {
        return Response.json({ ok: false, pesan: cekUrl.pesan }, { status: 400 });
      }
      const slug = slugWebCustom(cekUrl.domain);
      const nama = String(isi.nama ?? "").trim().slice(0, 64) || cekUrl.domain;
      const lama = await daftarWebCustomStudio();
      const ada = lama.find((x) => x.id === isi.id || x.slug === slug);
      const itemBaru: WebCustomStudio = {
        id: ada?.id ?? `web-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        slug,
        nama,
        url: cekUrl.url,
        kategori: isi.kategori ?? ada?.kategori ?? "custom",
        deskripsi: String(isi.deskripsi ?? "").trim().slice(0, 260),
        ...(isi.aksen && /^#[0-9a-fA-F]{6}$/.test(isi.aksen.trim()) ? { aksen: isi.aksen.trim() } : {}),
        dibuat: ada?.dibuat ?? new Date().toISOString(),
      };
      const tanpaLama = lama.filter((x) => x.id !== itemBaru.id && x.slug !== itemBaru.slug);
      const daftar = await simpanWebCustomStudio([itemBaru, ...tanpaLama]);
      return Response.json({
        ok: true,
        item: itemBaru,
        daftar,
        pesan: `Web Custom "${itemBaru.nama}" (${cekUrl.domain}) tersimpan.`,
      });
    }

    if (isi.aksi === "hapus") {
      const id = String(isi.id ?? "").trim();
      const lama = await daftarWebCustomStudio();
      if (!lama.some((x) => x.id === id || x.slug === id)) {
        return Response.json({ ok: false, pesan: "Web Custom tidak ditemukan." }, { status: 404 });
      }
      const daftar = await simpanWebCustomStudio(lama.filter((x) => x.id !== id && x.slug !== id));
      return Response.json({ ok: true, daftar, pesan: "Web Custom dihapus dari daftar Studio." });
    }

    return Response.json({ ok: false, pesan: "Aksi web custom tidak dikenali." }, { status: 400 });
  } catch (e) {
    return Response.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal memproses Web Custom." },
      { status: 500 },
    );
  }
}
