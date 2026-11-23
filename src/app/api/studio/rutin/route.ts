import { permintaanDariAdmin } from "@/lib/admin-server";
import type { JadwalRutin } from "@/lib/jadwal-tayang-murni";
import { SUPABASE_URL } from "@/lib/lingkungan";
import {
  acakUlangJadwalRutin,
  adaKunciServer,
  bacaJadwalRutin,
  buatPratinjauRutin,
  simpanJadwalRutin,
  tayangkanRutinSekarang,
} from "@/lib/studio-server";

// Pengaturan jadwal otomatis setiap jam buka (mis. upload video Story Opening Lek Kopi).
export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) {
    return Response.json({ ok: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." }, { status: 500 });
  }
  const url = new URL(req.url);
  const merek = url.searchParams.get("merek") || "lekkopi";
  try {
    const data = await bacaJadwalRutin(merek);
    return Response.json({ ok: true, ...data });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal memuat jadwal rutin." }, { status: 400 });
  }
}

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) {
    return Response.json({ ok: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." }, { status: 500 });
  }
  const origin = new URL(req.url).origin;
  const isi = (await req.json()) as {
    aksi?: "simpan" | "tayang-sekarang" | "pratinjau" | "izin-unggah" | "acak-ulang";
    merek?: string;
    namaBerkas?: string;
    jadwal?: Partial<JadwalRutin>;
  };
  const merek = isi.merek || "lekkopi";
  try {
    if (isi.aksi === "izin-unggah") {
      const bersih = String(isi.namaBerkas || "opening.mp4")
        .toLowerCase()
        .replace(/[^a-z0-9.]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const ekst = /\.(png|jpg|jpeg)$/i.test(bersih) ? bersih.match(/\.(png|jpg|jpeg)$/i)![0] : ".mp4";
      const dasar = bersih.replace(/\.[a-z0-9]+$/i, "") || "opening";
      const jalur = `rutin/${merek}/${Date.now()}-${dasar}${ekst}`;
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
    if (isi.aksi === "pratinjau") {
      const r = await buatPratinjauRutin(merek, origin);
      return Response.json({
        ok: true,
        ...r,
        pesan: `Pratinjau Story Jam Buka sedang dibuat${r.dipicu ? " sekarang (±1–2 menit)" : " pada putaran mesin berikutnya"}. Hasilnya akan muncul di Riwayat Studio & dikirim ke Telegram untuk Kyai cek dulu (tidak langsung tayang).`,
      });
    }
    if (isi.aksi === "acak-ulang") {
      const r = await acakUlangJadwalRutin(merek, origin);
      return Response.json({
        ok: true,
        ...r,
        pesan: r.videoBerikutnya?.judul
          ? `Video acak berikutnya diganti ke: ${r.videoBerikutnya.judul}.`
          : "Video acak berikutnya berhasil diundi ulang.",
      });
    }
    if (isi.aksi === "tayang-sekarang") {
      const r = await tayangkanRutinSekarang(merek, origin);
      return Response.json({
        ok: true,
        ...r,
        pesan: `Story Jam Buka (${r.videoDipilih ? `"${r.videoDipilih}"` : `${r.jumlahVideo} video`}) sedang ditayangkan ke Instagram${r.dipicu ? " sekarang." : " pada putaran mesin berikutnya."}`,
      });
    }
    const r = await simpanJadwalRutin(merek, isi.jadwal ?? {}, origin);
    const teksBerikutnya = r.berikutnya
      ? new Date(r.berikutnya).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full", timeStyle: "short" }) + " WIB"
      : null;
    return Response.json({
      ok: true,
      ...r,
      pesan: r.jadwal.aktif && teksBerikutnya
        ? `Jadwal jam buka otomatis disimpan! Tayang berikutnya: ${teksBerikutnya}.`
        : "Pengaturan jadwal jam buka disimpan (nonaktif).",
    });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal menyimpan jadwal rutin." }, { status: 400 });
  }
}
