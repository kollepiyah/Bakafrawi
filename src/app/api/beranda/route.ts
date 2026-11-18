import { permintaanDariAdmin } from "@/lib/admin-server";
import { ringkasanBeranda } from "@/lib/agenda-server";

// Ringkasan hari ini untuk Beranda Bakafrawi Studio (layar web & APK).
export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await ringkasanBeranda()) });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal." }, { status: 500 });
  }
}
