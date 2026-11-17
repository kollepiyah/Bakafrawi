import { permintaanDariAdmin } from "@/lib/admin-server";
import { aturTayang, buatUlang, type AksiTayang } from "@/lib/studio-server";

const AKSI: (AksiTayang | "ulang")[] = ["sekarang", "jadwal", "tolak", "batal", "ulang"];

// Tombol tayang di panel admin: tayangkan sekarang / jadwal 19.00 / tolak / batal / buat ulang.
export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const { id, aksi } = (await req.json()) as { id?: string; aksi?: AksiTayang | "ulang" };
  if (!id || !aksi || !AKSI.includes(aksi)) return Response.json({ ok: false, pesan: "Permintaan tidak lengkap." }, { status: 400 });
  try {
    if (aksi === "ulang") return Response.json({ ok: true, ...(await buatUlang(id)) });
    return Response.json({ ok: true, tugas: await aturTayang(id, aksi) });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal." }, { status: 400 });
  }
}
