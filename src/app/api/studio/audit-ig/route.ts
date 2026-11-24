import { permintaanDariAdmin } from "@/lib/admin-server";
import type { MerekAuditIg } from "@/lib/audit-ig-murni";
import { jalankanAuditInstagram } from "@/lib/audit-ig-server";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const isi = (await req.json().catch(() => ({}))) as { merek?: string; pertanyaan?: string };
  const merek: MerekAuditIg =
    isi.merek === "lekkopi" || isi.merek === "bakafrawi" ? isi.merek : "semua";
  try {
    const hasil = await jalankanAuditInstagram({
      merek,
      pertanyaan: typeof isi.pertanyaan === "string" ? isi.pertanyaan : "",
    });
    return Response.json({ ok: true, ...hasil });
  } catch (e) {
    return Response.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal melakukan audit performa Instagram." },
      { status: 400 },
    );
  }
}
