import { permintaanDariAdmin } from "@/lib/admin-server";
import { kenaliTokenInstagram } from "@/lib/instagram-server";
import { adaKunciServer, bacaPengaturan, simpanPengaturan } from "@/lib/studio-server";
import { adaBot, infoWebhook, pasangWebhook } from "@/lib/telegram-server";

// Status & pengaturan sambungan Studio (Instagram, Telegram) untuk panel admin. Token tak pernah
// dikirim balik ke browser — hanya nama akun & tanggal kedaluwarsa.
export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) return Response.json({ ok: true, siap: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." });
  const p = await bacaPengaturan();
  const webhook = await infoWebhook().catch((e) => ({ url: "", galat: e.message }));
  return Response.json({
    ok: true,
    siap: true,
    instagram: p.ig_token ? { akun: p.ig_akun, kedaluwarsa: p.ig_kedaluwarsa, host: p.ig_host } : null,
    telegram: { bot: adaBot(), terdaftar: Boolean(p.telegram_chat_id), webhook },
  });
}

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const isi = (await req.json()) as { igToken?: string; igId?: string; putusIg?: boolean; pasangWebhook?: boolean };
  try {
    if (isi.igToken) {
      const akun = await kenaliTokenInstagram(isi.igToken.trim(), isi.igId?.trim() || undefined);
      await simpanPengaturan(akun);
      return Response.json({ ok: true, pesan: `Instagram tersambung: ${akun.ig_akun}` });
    }
    if (isi.putusIg) {
      await simpanPengaturan({ ig_token: null, ig_user_id: null, ig_akun: null, ig_kedaluwarsa: null });
      return Response.json({ ok: true, pesan: "Instagram diputus." });
    }
    if (isi.pasangWebhook) {
      if (!adaBot()) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET belum diisi di Vercel.");
      await pasangWebhook(new URL(req.url).origin);
      return Response.json({ ok: true, pesan: "Webhook bot tersambung ke situs ini." });
    }
    return Response.json({ ok: false, pesan: "Tidak ada yang diubah." }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal." }, { status: 400 });
  }
}
