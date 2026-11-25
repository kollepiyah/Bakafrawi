import { permintaanDariAdmin } from "@/lib/admin-server";
import {
  bacaEvaluasiMingguan,
  jalankanEvaluasiMingguan,
} from "@/lib/evaluasi-mingguan-server";
import { adaKunciServer } from "@/lib/studio-server";

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) {
    return Response.json({ ok: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." }, { status: 500 });
  }
  try {
    return Response.json({ ok: true, evaluasi: await bacaEvaluasiMingguan() });
  } catch (e) {
    return Response.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal memuat evaluasi mingguan." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) {
    return Response.json({ ok: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." }, { status: 500 });
  }
  const isi = (await req.json().catch(() => ({}))) as { merek?: string };
  const merek = isi.merek === "bakafrawi" || isi.merek === "lekkopi" ? isi.merek : "semua";
  try {
    const { hasil, catatan } = await jalankanEvaluasiMingguan({ merek });
    return Response.json({ ok: true, evaluasi: hasil, catatan });
  } catch (e) {
    return Response.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal menjalankan evaluasi mingguan." },
      { status: 500 },
    );
  }
}
