import { samaAman } from "@/lib/bot-murni";
import { detakAgenda } from "@/lib/agenda-server";

export const maxDuration = 60;

// Dipanggil pg_cron Supabase tiap 5 menit (agenda_detak) dengan kode rahasia AGENDA_DETAK_RAHASIA.
export async function POST(req: Request) {
  const rahasia = process.env.AGENDA_DETAK_RAHASIA ?? "";
  if (!rahasia || !samaAman(req.headers.get("x-detak-rahasia") ?? "", rahasia)) return new Response("forbidden", { status: 403 });
  try {
    return Response.json({ ok: true, laporan: await detakAgenda() });
  } catch (e) {
    console.error("Detak agenda:", e);
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal." }, { status: 500 });
  }
}
