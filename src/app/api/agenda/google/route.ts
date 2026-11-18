import { permintaanDariAdmin } from "@/lib/admin-server";
import { sinkronGoogle, statusGoogle } from "@/lib/agenda-server";
import { adaGoogle, cabutToken, urlIzin } from "@/lib/google-server";
import { bacaPengaturan, simpanPengaturan } from "@/lib/studio-server";

export const maxDuration = 60;

// Status & kendali sambungan Google Calendar. Refresh token tak pernah dikirim ke browser.
export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await statusGoogle()) });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const { aksi } = (await req.json()) as { aksi?: "mulai" | "putus" | "sinkron" };
  try {
    if (aksi === "mulai") {
      if (!adaGoogle()) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET belum diisi di Vercel.");
      return Response.json({ ok: true, url: urlIzin(new URL(req.url).origin) });
    }
    if (aksi === "putus") {
      const p = await bacaPengaturan();
      if (p.google_refresh_token) await cabutToken(p.google_refresh_token);
      await simpanPengaturan({ google_refresh_token: null, google_email: null, google_galat: null });
      return Response.json({ ok: true, pesan: "Google Calendar diputus. Agenda yang sudah ada tetap tersimpan." });
    }
    if (aksi === "sinkron") return Response.json({ ok: true, pesan: await sinkronGoogle() });
    return Response.json({ ok: false, pesan: "Aksi tidak dikenal." }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal." }, { status: 400 });
  }
}
