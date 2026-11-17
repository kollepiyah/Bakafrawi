import { permintaanDariAdmin } from "@/lib/admin-server";

// Menyalakan mesin Studio (GitHub Actions) segera setelah admin membuat tugas. Tanpa token ini,
// tugas tetap dikerjakan oleh jadwal rutin workflow — hanya lebih lambat.
const REPO = process.env.GITHUB_STUDIO_REPO ?? "kollepiyah/Bakafrawi";

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const token = process.env.GITHUB_STUDIO_TOKEN;
  if (!token) return Response.json({ ok: true, dipicu: false, alasan: "GITHUB_STUDIO_TOKEN belum diisi" });
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/studio.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (!res.ok) return Response.json({ ok: true, dipicu: false, alasan: `GitHub ${res.status}` });
  return Response.json({ ok: true, dipicu: true });
}
