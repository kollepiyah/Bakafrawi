import { permintaanDariAdmin } from "@/lib/admin-server";
import { ringkasanAplikasi } from "@/lib/aplikasi-server";

export const maxDuration = 30;

// Ringkasan semua aplikasi Kyai untuk menu Aplikasi (layar web & APK).
export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true, aplikasi: await ringkasanAplikasi() });
}
