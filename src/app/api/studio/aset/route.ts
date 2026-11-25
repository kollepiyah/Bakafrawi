import { permintaanDariAdmin } from "@/lib/admin-server";
import { SUPABASE_URL } from "@/lib/lingkungan";
import {
  adaKunciServer,
  daftarAsetStudio,
  simpanAsetStudio,
  type AsetStudio,
} from "@/lib/studio-server";

const EKST_MASKOT = new Set([".png", ".jpg", ".jpeg", ".webp", ".webm", ".mp4", ".mov"]);
const EKST_MUSIK = new Set([".mp3", ".m4a", ".wav", ".ogg", ".aac"]);
const POSE_SAH = new Set(["kaget", "tunjuk", "hp", "jempol", "lambai"]);

function bersihkanSlug(nilai: string, bawaan = "aset"): string {
  const s = nilai
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || bawaan;
}

export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) {
    return Response.json({ ok: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." }, { status: 500 });
  }
  try {
    return Response.json({ ok: true, daftar: await daftarAsetStudio() });
  } catch (e) {
    return Response.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal membaca daftar aset." },
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
    aksi?: "izin-unggah" | "simpan" | "hapus";
    kategori?: "maskot" | "musik";
    karakter?: string;
    pose?: string;
    namaBerkas?: string;
    nama?: string;
    url?: string;
    jalur?: string;
    ekstensi?: string;
    id?: string;
  };

  try {
    if (isi.aksi === "izin-unggah") {
      const kategori = isi.kategori === "musik" ? "musik" : "maskot";
      const namaMentah = String(isi.namaBerkas ?? (kategori === "musik" ? "lagu.mp3" : "karakter.png"));
      const cocokEkst = /\.[a-z0-9]{2,6}$/i.exec(namaMentah.trim());
      const ekst = cocokEkst ? cocokEkst[0].toLowerCase() : "";
      const diizinkan = kategori === "musik" ? EKST_MUSIK : EKST_MASKOT;
      if (!ekst || !diizinkan.has(ekst)) {
        return Response.json(
          {
            ok: false,
            pesan:
              kategori === "musik"
                ? "Format audio harus .mp3, .m4a, .wav, .ogg, atau .aac."
                : "Format maskot harus .png, .jpg, .webp, .webm, .mp4, atau .mov.",
          },
          { status: 400 },
        );
      }
      const dasar = bersihkanSlug(namaMentah.replace(/\.[a-z0-9]+$/i, ""), kategori);
      const karakterSlug = kategori === "maskot" ? bersihkanSlug(String(isi.karakter ?? "ibu-hijab"), "ibu-hijab") : "";
      const jalur =
        kategori === "musik"
          ? `aset/musik/${Date.now()}-${dasar}${ekst}`
          : `aset/maskot/${karakterSlug}/${Date.now()}-${dasar}${ekst}`;

      const kunci = process.env.SUPABASE_SERVICE_KEY ?? "";
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/studio/${jalur}`, {
        method: "POST",
        headers: {
          apikey: kunci,
          Authorization: `Bearer ${kunci}`,
          "Content-Type": "application/json",
          "x-upsert": "true",
        },
        body: "{}",
      });
      if (!res.ok) {
        throw new Error(`Gagal menyiapkan unggahan (${res.status}): ${(await res.text()).slice(0, 160)}`);
      }
      const data = (await res.json()) as { url?: string };
      return Response.json({
        ok: true,
        jalur,
        ekstensi: ekst,
        uploadUrl: data.url ? `${SUPABASE_URL}/storage/v1${data.url}` : null,
        publicUrl: `${SUPABASE_URL}/storage/v1/object/public/studio/${jalur}`,
      });
    }

    if (isi.aksi === "simpan") {
      const kategori = isi.kategori === "musik" ? "musik" : "maskot";
      const poseMentah = String(isi.pose ?? "").trim().toLowerCase();
      const baru: AsetStudio = {
        id: `aset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kategori,
        ...(kategori === "maskot"
          ? {
              karakter: bersihkanSlug(String(isi.karakter ?? "ibu-hijab"), "ibu-hijab"),
              ...(POSE_SAH.has(poseMentah) ? { pose: poseMentah } : {}),
            }
          : {}),
        nama: String(isi.nama ?? "").trim().slice(0, 60) || "Aset Studio",
        url: String(isi.url ?? "").trim(),
        jalur: String(isi.jalur ?? "").trim().replace(/^\/+/, ""),
        ekstensi: String(isi.ekstensi ?? (kategori === "musik" ? ".mp3" : ".png")).toLowerCase(),
        dibuat: new Date().toISOString(),
      };
      const lama = await daftarAsetStudio();
      const daftar = await simpanAsetStudio([baru, ...lama]);
      return Response.json({ ok: true, daftar, pesan: "Aset berhasil ditambahkan." });
    }

    if (isi.aksi === "hapus") {
      const id = String(isi.id ?? "").trim();
      const lama = await daftarAsetStudio();
      const target = lama.find((x) => x.id === id);
      if (!target) {
        return Response.json({ ok: false, pesan: "Aset tidak ditemukan." }, { status: 404 });
      }
      const kunci = process.env.SUPABASE_SERVICE_KEY ?? "";
      await fetch(`${SUPABASE_URL}/storage/v1/object/studio/${target.jalur}`, {
        method: "DELETE",
        headers: { apikey: kunci, Authorization: `Bearer ${kunci}` },
      }).catch(() => null);
      const daftar = await simpanAsetStudio(lama.filter((x) => x.id !== id));
      return Response.json({ ok: true, daftar, pesan: "Aset dihapus." });
    }

    return Response.json({ ok: false, pesan: "Aksi aset tidak dikenali." }, { status: 400 });
  } catch (e) {
    return Response.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal memproses aset Studio." },
      { status: 500 },
    );
  }
}
