import { permintaanDariAdmin } from "@/lib/admin-server";
import { daftarAcara, hapusAcara, tambahAcara, ubahAcara } from "@/lib/agenda-server";
import type { MasukanAcara } from "@/lib/agenda-murni";
import { rentangHariWIB } from "@/lib/agenda-murni";

// Agenda untuk layar Studio & APK. Baca: ?dari=&sampai= (ISO; bawaan hari ini + 14 hari).
export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const bawaan = rentangHariWIB(new Date(), 0, 14);
  const dari = q.get("dari") ? new Date(q.get("dari")!) : bawaan.dari;
  const sampai = q.get("sampai") ? new Date(q.get("sampai")!) : bawaan.sampai;
  if (Number.isNaN(dari.getTime()) || Number.isNaN(sampai.getTime())) return Response.json({ ok: false, pesan: "Rentang tanggal tidak terbaca." }, { status: 400 });
  try {
    return Response.json({ ok: true, acara: await daftarAcara(dari, sampai) });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal." }, { status: 500 });
  }
}

type Isi = MasukanAcara & { aksi?: "tambah" | "ubah" | "hapus"; id?: string };

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const { aksi, id, ...m } = (await req.json()) as Isi;
  try {
    const hasil =
      aksi === "tambah" ? await tambahAcara(m)
      : aksi === "ubah" && id ? await ubahAcara(id, m)
      : aksi === "hapus" && id ? await hapusAcara(id)
      : null;
    if (!hasil) return Response.json({ ok: false, pesan: "Aksi tidak dikenal." }, { status: 400 });
    return Response.json({ ok: true, ...hasil });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal." }, { status: 400 });
  }
}
