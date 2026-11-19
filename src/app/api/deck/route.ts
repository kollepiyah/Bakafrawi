import { permintaanDariAdmin } from "@/lib/admin-server";
import { ambilWorkflowRuns } from "@/lib/deck-server";
import { daftarTugas } from "@/lib/studio-server";

// Data untuk dashboard deck: workflow runs GitHub Actions + tugas Studio terbaru.
export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  try {
    const [workflows, tugas] = await Promise.all([ambilWorkflowRuns(10), daftarTugas(10)]);
    return Response.json({ ok: true, workflows, tugas });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal memuat deck." }, { status: 500 });
  }
}
