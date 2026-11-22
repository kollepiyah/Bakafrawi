import { catatKunjungan, ringkasanKunjunganPublik } from "@/lib/kunjungan-server";

// GET: ringkasan pengunjung publik (hari ini & total) untuk footer situs.
export async function GET() {
  try {
    const data = await ringkasanKunjunganPublik();
    return Response.json(
      { ok: true, ...data },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return Response.json({ ok: true, hariIni: 0, total: 0 });
  }
}

// POST: catat satu kunjungan halaman dari browser pengunjung asli (anti-bot & abaikan admin).
export async function POST(req: Request) {
  try {
    const ua = req.headers.get("user-agent") ?? "";
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const ip = xff.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
    const isi = (await req.json().catch(() => ({}))) as { jalur?: string; perujuk?: string };
    const hasil = await catatKunjungan({
      ip,
      ua,
      jalur: typeof isi.jalur === "string" ? isi.jalur : "/",
      perujuk: typeof isi.perujuk === "string" ? isi.perujuk : "",
    });
    return Response.json({ ok: true, ...hasil });
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }
}
