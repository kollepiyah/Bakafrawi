import { permintaanDariAdmin } from "@/lib/admin-server";
import { kenaliTokenInstagram } from "@/lib/instagram-server";
import { statusPenyediaLlm } from "@/lib/llm-router";
import {
  adaKunciServer,
  aturAktifMerek,
  bacaKredensial,
  bacaPengaturan,
  daftarMerek,
  hapusKredensial,
  normalisasiSuaraFavorit,
  POLA_VOICE_ID,
  simpanKredensial,
  simpanSuaraFavorit,
  type SuaraFavorit,
} from "@/lib/studio-server";
import { adaBot, infoWebhook, pasangWebhook } from "@/lib/telegram-server";
import { adaTiktok, urlIzinTiktok } from "@/lib/tiktok-server";

// Status & pengaturan sambungan Studio (Instagram per merek, Telegram, Voice ID favorit ElevenLabs)
// untuk panel admin. Token tak pernah dikirim balik ke browser — hanya nama akun & kedaluwarsa.
export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) return Response.json({ ok: true, siap: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." });
  const [p, merek] = await Promise.all([bacaPengaturan(), daftarMerek()]);
  const webhook = await infoWebhook().catch((e) => ({ url: "", galat: e.message }));
  const instagram = await Promise.all(
    merek.map(async (m) => {
      const [k, t] = await Promise.all([bacaKredensial(m.slug, "instagram"), bacaKredensial(m.slug, "tiktok")]);
      return {
        merek: m.slug, nama: m.nama, aktif: m.aktif,
        akun: k ? { akun: k.ig_akun, kedaluwarsa: k.ig_kedaluwarsa ?? null, host: k.ig_host } : null,
        tiktok: t ? { akun: t.akun, kedaluwarsa: t.kedaluwarsa ?? null } : null,
      };
    }),
  );
  const suaraFavorit = normalisasiSuaraFavorit(merek.find((m) => m.slug === "bakafrawi")?.profil?.suara_elevenlabs);
  return Response.json({
    ok: true,
    siap: true,
    instagram,
    tiktokSiap: adaTiktok(),
    suaraFavorit,
    penyediaAi: statusPenyediaLlm(),
    telegram: { bot: adaBot(), terdaftar: Boolean(p.telegram_chat_id), webhook },
  });
}

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const isi = (await req.json()) as {
    merek?: string;
    aktif?: boolean;
    igToken?: string;
    igId?: string;
    putusIg?: boolean;
    mulaiTiktok?: boolean;
    putusTiktok?: boolean;
    pasangWebhook?: boolean;
    tambahSuara?: { id?: string; nama?: string; catatan?: string };
    hapusSuaraId?: string;
    suaraFavorit?: SuaraFavorit[];
  };
  try {
    if (isi.tambahSuara) {
      const id = String(isi.tambahSuara.id ?? "").trim();
      if (!POLA_VOICE_ID.test(id)) {
        throw new Error("Voice ID tidak valid. Salin kode Voice ID dari ElevenLabs (minimal 8 huruf/angka).");
      }
      const m = (await daftarMerek()).find((x) => x.slug === "bakafrawi");
      const lama = normalisasiSuaraFavorit(m?.profil?.suara_elevenlabs);
      const baru: SuaraFavorit = {
        id,
        nama: String(isi.tambahSuara.nama ?? "").trim().slice(0, 40) || id.slice(0, 12),
        ...(String(isi.tambahSuara.catatan ?? "").trim() ? { catatan: String(isi.tambahSuara.catatan ?? "").trim().slice(0, 80) } : {}),
      };
      const gabungan = lama.some((s) => s.id === id)
        ? lama.map((s) => (s.id === id ? baru : s))
        : [...lama, baru];
      const suaraFavorit = await simpanSuaraFavorit(gabungan);
      return Response.json({ ok: true, pesan: `Suara favorit "${baru.nama}" disimpan.`, suaraFavorit });
    }
    if (typeof isi.hapusSuaraId === "string" && isi.hapusSuaraId.trim()) {
      const target = isi.hapusSuaraId.trim();
      const m = (await daftarMerek()).find((x) => x.slug === "bakafrawi");
      const lama = normalisasiSuaraFavorit(m?.profil?.suara_elevenlabs);
      const suaraFavorit = await simpanSuaraFavorit(lama.filter((s) => s.id !== target));
      return Response.json({ ok: true, pesan: "Suara favorit dihapus.", suaraFavorit });
    }
    if (Array.isArray(isi.suaraFavorit)) {
      const suaraFavorit = await simpanSuaraFavorit(isi.suaraFavorit);
      return Response.json({ ok: true, pesan: "Daftar suara favorit diperbarui.", suaraFavorit });
    }
    if (isi.mulaiTiktok || isi.putusTiktok) {
      const m = (await daftarMerek()).find((x) => x.slug === isi.merek);
      if (!m) throw new Error("Merek tidak dikenal.");
      if (isi.putusTiktok) {
        await hapusKredensial(m.slug, "tiktok");
        return Response.json({ ok: true, pesan: `TikTok ${m.nama} diputus.` });
      }
      if (!adaTiktok()) throw new Error("TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET belum diisi di Vercel.");
      return Response.json({ ok: true, url: urlIzinTiktok(new URL(req.url).origin, m.slug) });
    }
    if (typeof isi.aktif === "boolean" && isi.merek && isi.merek !== "bakafrawi") {
      await aturAktifMerek(isi.merek, isi.aktif);
      return Response.json({ ok: true, pesan: `Merek ${isi.merek} ${isi.aktif ? "diaktifkan" : "dinonaktifkan"}.` });
    }
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
