import { permintaanDariAdmin } from "@/lib/admin-server";
import { picuStudio } from "@/lib/studio-server";

// Menyalakan mesin Studio (GitHub Actions) segera setelah admin membuat tugas. Tanpa token,
// tugas tetap dikerjakan oleh jadwal rutin workflow — hanya lebih lambat.
export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true, dipicu: await picuStudio() });
}
