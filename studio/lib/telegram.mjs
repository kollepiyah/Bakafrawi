// Kabar Studio ke pemilik lewat bot Telegram Bakafrawi. Tombol persetujuan ditangani webhook
// situs (/api/telegram), bukan mesin ini.
const api = (m) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`;
export const adaTelegram = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

async function panggil(metode, isi) {
  let galat;
  for (const jeda of [0, 2000, 5000]) {
    if (jeda) await new Promise((r) => setTimeout(r, jeda));
    try {
      const r = await fetch(api(metode), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(isi) });
      const j = await r.json();
      if (!j.ok) throw Object.assign(new Error(`Telegram ${metode}: ${j.description}`), { tetap: true });
      return j.result;
    } catch (e) {
      galat = e;
      if (e.tetap) break; // ditolak Telegram, bukan jaringan — mengulang tak menolong
    }
  }
  throw galat;
}

/** Tombol persetujuan; data diurai /api/telegram (t=tayang sekarang, s=story sekarang, j=19.00, j09=09.00, j12=12.00, x=tolak, u=buat ulang). */
export const tombolTayang = (id) => ({
  inline_keyboard: [
    [{ text: '✅ Tayangkan sekarang', callback_data: `t:${id}` }, { text: '📱 Story sekarang', callback_data: `s:${id}` }],
    [{ text: '🕘 Buka 09.00', callback_data: `j09:${id}` }, { text: '🕛 Siang 12.00', callback_data: `j12:${id}` }, { text: '🕖 Prime 19.00', callback_data: `j:${id}` }],
    [{ text: '🔁 Buat ulang', callback_data: `u:${id}` }, { text: '❌ Tolak', callback_data: `x:${id}` }],
  ],
});

export async function kirimTeks(chatId, teks, tombol) {
  return panggil('sendMessage', { chat_id: chatId, text: teks.slice(0, 4000), disable_web_page_preview: true, ...(tombol ? { reply_markup: tombol } : {}) });
}

/** Kirim hasil Studio (album poster atau video) lalu pesan bertombol untuk persetujuan. */
export async function kirimHasil(chatId, { tugas, namaProduk, hasil, caption }) {
  const video = hasil.find((h) => h.jenis === 'video');
  if (video) {
    await panggil('sendVideo', { chat_id: chatId, video: video.url, width: 1080, height: 1920, duration: video.durasi, supports_streaming: true, caption: `🎬 ${namaProduk}` });
  } else {
    const gambar = hasil.filter((h) => h.jenis === 'gambar').slice(0, 10);
    await panggil('sendMediaGroup', { chat_id: chatId, media: gambar.map((g, i) => ({ type: 'photo', media: g.url, ...(i === 0 ? { caption: `🖼 ${namaProduk}` } : {}) })) });
  }
  const sasaran = video ? 'Reels / Story Instagram' : 'feed (4:5) + Story Instagram';
  const infoJadwal = tugas.status_tayang === 'dijadwalkan' && tugas.jadwal_tayang
    ? `\n🕖 Sudah dijadwalkan otomatis: ${new Date(tugas.jadwal_tayang).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })} WIB.`
    : '';
  return kirimTeks(
    chatId,
    `${caption}\n\n— Siap tayang ke ${sasaran}.${infoJadwal}\nPilih tombol atau balas chat untuk jadwal custom (mis. "jadwalkan besok jam 14.30").`,
    tombolTayang(tugas.id),
  );
}
