import { permintaanDariAdmin } from "@/lib/admin-server";
import { ambilWorkflowRuns } from "@/lib/deck-server";
import { daftarTugas, ringkasBiayaBulanIni } from "@/lib/studio-server";
import { ambilInsightInstagram } from "@/lib/instagram-insight";

// Data untuk dashboard deck: workflow runs GitHub Actions + tugas Studio + Insight Instagram + biaya AI.
export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  try {
    const [workflows, tugas, insight, biaya] = await Promise.all([
      ambilWorkflowRuns(10),
      daftarTugas(10),
      ambilInsightInstagram(),
      ringkasBiayaBulanIni().catch(() => null),
    ]);
    return Response.json({ ok: true, workflows, tugas, insight, biaya });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal memuat deck." }, { status: 500 });
  }
}
