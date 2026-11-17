import "server-only";

// Bot Telegram Bakafrawi di sisi situs (webhook). Token & kode rahasia dari variabel Vercel (Secret).
const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
export const adaBot = () => Boolean(TOKEN() && process.env.TELEGRAM_WEBHOOK_SECRET);

export async function tg(metode: string, isi: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN()}/${metode}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(isi),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!j.ok) throw new Error(`Telegram ${metode}: ${j.description}`);
  return j.result;
}

export const kirim = (chat: number, teks: string) => tg("sendMessage", { chat_id: chat, text: teks, disable_web_page_preview: true });

/** Sambungkan webhook bot ke situs ini, dengan kode rahasia agar hanya Telegram yang bisa memanggil. */
export async function pasangWebhook(asal: string) {
  await tg("setWebhook", {
    url: `${asal}/api/telegram`,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await tg("setMyCommands", {
    commands: [
      { command: "poster", description: "Buat poster: /poster maktaba [ai]" },
      { command: "video", description: "Buat video: /video maktaba [ai]" },
      { command: "status", description: "5 konten terakhir" },
      { command: "bantuan", description: "Cara pakai bot" },
    ],
  });
}

export async function infoWebhook(): Promise<{ url: string; galat?: string } | null> {
  if (!TOKEN()) return null;
  const r = await tg("getWebhookInfo", {});
  return { url: r.url, galat: r.last_error_message };
}
