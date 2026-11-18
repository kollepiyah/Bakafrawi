import { permintaanDariAdmin } from "@/lib/admin-server";
import { kenaliTokenInstagram } from "@/lib/instagram-server";
import { adaKunciServer, bacaKredensial, bacaPengaturan, daftarMerek, hapusKredensial, simpanKredensial } from "@/lib/studio-server";
import { adaBot, infoWebhook, pasangWebhook } from "@/lib/telegram-server";

// Status & pengaturan sambungan Studio (Instagram per merek, Telegram) untuk panel admin. Token tak
// pernah dikirim balik ke browser — hanya nama akun & tanggal kedaluwarsa.
export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) return Response.json({ ok: true, siap: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." });
  const [p, merek] = await Promise.all([bacaPengaturan(), daftarMerek()]);
  const webhook = await infoWebhook().catch((e) => ({ url: "", galat: e.message }));
  const instagram = await Promise.all(
    merek.map(async (m) => {
      const k = await bacaKredensial(m.slug, "instagram");
      return { merek: m.slug, nama: m.nama, aktif: m.aktif, akun: k ? { akun: k.ig_akun, kedaluwarsa: k.ig_kedaluwarsa ?? null, host: k.ig_host } : null };
    }),
  );
  return Response.json({ ok: true, siap: true, instagram, telegram: { bot: adaBot(), terdaftar: Boolean(p.telegram_chat_id), webhook } });
}

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const isi = (await req.json()) as { merek?: string; igToken?: string; igId?: string; putusIg?: boolean; pasangWebhook?: boolean };
  try {
    if (isi.igToken || isi.putusIg) {
      const merek = (await daftarMerek()).find((m) => m.slug === (isi.merek ?? "bakafrawi"));
      if (!merek) throw new Error("Merek tidak dikenal.");
      if (isi.putusIg) {
        await hapusKredensial(merek.slug, "instagram");
        return Response.json({ ok: true, pesan: `Instagram ${merek.nama} diputus.` });
      }
      const akun = await kenaliTokenInstagram(isi.igToken!.trim(), isi.igId?.trim() || undefined, merek.slug);
      await simpanKredensial(merek.slug, "instagram", akun);
      return Response.json({ ok: true, pesan: `Instagram ${merek.nama} tersambung: ${akun.ig_akun}` });
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
