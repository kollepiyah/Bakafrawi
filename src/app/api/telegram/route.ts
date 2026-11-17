import { cariProduk, samaAman, uraiPerintah, uraiTombol } from "@/lib/bot-murni";
import { ambilKonten } from "@/lib/konten";
import { aturTayang, bacaPengaturan, buatTugas, buatUlang, daftarTugas, simpanPengaturan } from "@/lib/studio-server";
import { kirim, tg } from "@/lib/telegram-server";

// Webhook bot Telegram Bakafrawi. Hanya Telegram (yang tahu kode rahasia webhook) yang bisa
// memanggil, dan hanya chat pemilik yang terdaftar lewat /start KODE yang dilayani.

const BANTUAN = `Bot Studio Bakafrawi
/poster <produk> — buat poster (tambah "ai" untuk latar gambar AI)
/video <produk> — buat video Reels (tambah "ai" untuk pembuka gambar AI)
/status — 5 konten terakhir
Hasil dikirim ke sini dengan tombol: Tayangkan sekarang · Jadwal 19.00 · Buat ulang · Tolak.`;

type Update = {
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
};

const LABEL_STATUS: Record<string, string> = { antre: "⏳ antre", proses: "⚙️ dibuat", selesai: "✅ jadi", gagal: "❌ gagal" };
const LABEL_TAYANG: Record<string, string> = { belum: "", antre: "· ⏳ menunggu tayang", dijadwalkan: "· 🕖 terjadwal", proses: "· 📤 sedang tayang", tayang: "· 📣 tayang", gagal: "· ⚠️ gagal tayang", ditolak: "· ditolak" };

export async function POST(req: Request) {
  if (!samaAman(req.headers.get("x-telegram-bot-api-secret-token") ?? "", process.env.TELEGRAM_WEBHOOK_SECRET ?? "")) {
    return new Response("forbidden", { status: 403 });
  }
  const u = (await req.json()) as Update;
  try {
    const pengaturan = await bacaPengaturan();
    const pemilik = pengaturan.telegram_chat_id;

    if (u.callback_query) {
      const cq = u.callback_query;
      const chat = cq.message?.chat.id;
      if (!chat || chat !== pemilik) {
        await tg("answerCallbackQuery", { callback_query_id: cq.id, text: "Bukan pemilik." });
        return Response.json({ ok: true });
      }
      const t = uraiTombol(cq.data ?? "");
      if (!t) return Response.json({ ok: true });
      let balasan: string;
      try {
        if (t.aksi === "ulang") {
          const { dipicu } = await buatUlang(t.id);
          balasan = `🔁 Dibuat ulang${dipicu ? " — mesin dinyalakan." : " — menunggu putaran jadwal."}`;
        } else {
          const tugas = await aturTayang(t.id, t.aksi);
          balasan =
            t.aksi === "sekarang" ? "📤 Ditayangkan ke Instagram sebentar lagi."
            : t.aksi === "jadwal" ? `🕖 Dijadwalkan ${new Date(tugas.jadwal_tayang!).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} WIB.`
            : "❌ Ditolak, tidak ditayangkan.";
        }
        if (cq.message) await tg("editMessageReplyMarkup", { chat_id: chat, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
      } catch (e) {
        balasan = `⚠️ ${e instanceof Error ? e.message : "Gagal."}`;
      }
      await tg("answerCallbackQuery", { callback_query_id: cq.id });
      await kirim(chat, balasan);
      return Response.json({ ok: true });
    }

    const pesan = u.message;
    if (!pesan?.text) return Response.json({ ok: true });
    const chat = pesan.chat.id;
    const p = uraiPerintah(pesan.text);

    if (p.jenis === "daftar") {
      const kode = process.env.TELEGRAM_KODE_DAFTAR ?? "";
      if (!samaAman(p.kode, kode)) {
        await kirim(chat, "Kode daftar salah.");
      } else {
        await simpanPengaturan({ telegram_chat_id: chat });
        await kirim(chat, `✅ Terdaftar sebagai pemilik.\n\n${BANTUAN}`);
      }
      return Response.json({ ok: true });
    }
    if (chat !== pemilik) {
      await kirim(chat, "Ini bot pribadi Bakafrawi.");
      return Response.json({ ok: true });
    }
    if (p.jenis === "buat") {
      const situs = await ambilKonten();
      const produk = cariProduk(situs.produk, p.kata);
      if (!produk) {
        await kirim(chat, `Produk "${p.kata}" tidak ditemukan. Pilihan: ${situs.produk.map((x) => x.slug).join(", ")}`);
      } else {
        const { dipicu } = await buatTugas({ produk_slug: produk.slug, jenis: p.konten, latar: p.ai ? "ai" : "polos" });
        await kirim(chat, `🎨 ${p.konten === "video" ? "Video" : "Poster"} ${produk.nama}${p.ai ? " (latar AI)" : ""} sedang dibuat${dipicu ? "" : " pada putaran jadwal berikutnya (≤ 30 menit)"}. Hasilnya dikirim ke sini.`);
      }
      return Response.json({ ok: true });
    }
    if (p.jenis === "status") {
      const daftar = await daftarTugas(5);
      await kirim(chat, daftar.length ? daftar.map((t) => `• ${t.jenis} ${t.produk_slug} — ${LABEL_STATUS[t.status] ?? t.status} ${LABEL_TAYANG[t.status_tayang] ?? ""}`).join("\n") : "Belum ada konten.");
      return Response.json({ ok: true });
    }
    await kirim(chat, BANTUAN);
  } catch (e) {
    console.error("Webhook Telegram:", e);
  }
  // Selalu 200 supaya Telegram tak mengulang-ulang pesan yang sama.
  return Response.json({ ok: true });
}
