import { permintaanDariAdmin } from "@/lib/admin-server";
import type { SasaranTayang } from "@/lib/jadwal-tayang-murni";
import { SUPABASE_URL } from "@/lib/lingkungan";
import { adaKunciServer, buatTugasUnggahManual } from "@/lib/studio-server";

// Unggah video/foto manual dari Web/PWA maupun APK Android, lalu tayangkan sekarang, jadwalkan, atau simpan draf.
export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) {
    return Response.json({ ok: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." }, { status: 500 });
  }

  const isi = (await req.json()) as {
    aksi?: "izin-unggah" | "buat";
    merek?: string;
    namaBerkas?: string;
    judul?: string;
    url?: string;
    sampulUrl?: string | null;
    jenis?: "video" | "gambar";
    durasi?: number;
    caption?: string;
    sasaran?: SasaranTayang | string | null;
    modeTayang?: "sekarang" | "jadwal" | "draf";
    jadwal?: string | null;
  };

  const merek = String(isi.merek || "bakafrawi").trim();

  try {
    if (isi.aksi === "izin-unggah") {
      const bersih = String(isi.namaBerkas || "video.mp4")
        .toLowerCase()
        .replace(/[^a-z0-9.]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const cocokGambar = /\.(png|jpg|jpeg)$/i.exec(bersih);
      const ekst = cocokGambar ? cocokGambar[0].toLowerCase() : ".mp4";
      const dasar = bersih.replace(/\.[a-z0-9]+$/i, "").slice(0, 48) || "konten";
      const jalur = `manual/${merek}/${Date.now()}-${dasar}${ekst}`;
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
      const data = (await res.json()) as { url?: string; token?: string };
      return Response.json({
        ok: true,
        jalur,
        uploadUrl: data.url ? `${SUPABASE_URL}/storage/v1${data.url}` : null,
        token: data.token ?? null,
        publicUrl: `${SUPABASE_URL}/storage/v1/object/public/studio/${jalur}`,
      });
    }

    const r = await buatTugasUnggahManual({
      merek,
      judul: isi.judul,
      url: isi.url ?? "",
      sampulUrl: isi.sampulUrl ?? null,
      jenis: isi.jenis === "gambar" ? "gambar" : "video",
      durasi: isi.durasi,
      caption: isi.caption,
      sasaran: isi.sasaran,
      modeTayang: isi.modeTayang,
      jadwal: isi.jadwal,
    });

    const teksWaktu = r.jadwalIso
      ? new Date(r.jadwalIso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) + " WIB"
      : null;
    const labelSasaran =
      isi.sasaran === "story"
        ? "Story Instagram"
        : isi.sasaran === "reels+story"
        ? "Reels + Story"
        : isi.sasaran === "feed"
        ? "Feed Instagram"
        : isi.sasaran === "feed+story"
        ? "Feed + Story"
        : isi.jenis === "gambar"
        ? "Feed + Story"
        : "Reels Instagram";

    const pesan =
      isi.modeTayang === "sekarang"
        ? `Konten diunggah & sedang ditayangkan ke ${labelSasaran}${r.dipicu ? " sekarang." : " pada putaran mesin berikutnya."}`
        : isi.modeTayang === "jadwal" && teksWaktu
        ? `Konten diunggah & dijadwalkan tayang otomatis ke ${labelSasaran} pada ${teksWaktu}.`
        : "Konten manual diunggah & disimpan sebagai draf di Riwayat.";

    return Response.json({ ok: true, ...r, pesan });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal mengunggah konten manual." }, { status: 400 });
  }
}
