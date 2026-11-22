// Aturan murni pencatatan pengunjung situs (tanpa jaringan) — anti-bot & klasifikasi sumber.

const POLA_BOT =
  /bot|crawl|spider|slurp|mediapartners|adsbot|bingpreview|facebookexternalhit|facebot|whatsapp|telegrambot|twitterbot|linkedinbot|discordbot|pinterest|slackbot|applebot|duckduckbot|yandex|baiduspider|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|monitor|curl|wget|python|node-fetch|axios|go-http-client|java\/|okhttp|postman|insomnia|vercel/i;

export function adalahBot(userAgent: string): boolean {
  const ua = userAgent.trim();
  if (!ua || ua.length < 12) return true;
  return POLA_BOT.test(ua);
}

export function adalahPerangkatHp(userAgent: string): boolean {
  return /android|iphone|ipad|ipod|mobile|opera mini|iemobile/i.test(userAgent);
}

/** Bersihkan jalur halaman; mengembalikan null bila halaman internal/admin yang tak perlu dihitung. */
export function normalisasiJalur(mentah: string): string | null {
  const bersih = mentah.trim().split(/[?#]/)[0] || "/";
  if (!bersih.startsWith("/")) return null;
  if (/^\/(admin|api|_next|favicon|robots|sitemap)/i.test(bersih)) return null;
  if (/\.(png|jpg|jpeg|webp|svg|ico|css|js|mp4|xml|txt|json)$/i.test(bersih)) return null;
  const tanpaUjung = bersih.length > 1 ? bersih.replace(/\/+$/, "") : "/";
  return tanpaUjung.slice(0, 120);
}

/** Ubah URL perujuk (document.referrer) menjadi label sumber yang mudah dibaca Kyai. */
export function sumberDariPerujuk(perujuk: string): string {
  const t = perujuk.trim();
  if (!t) return "Langsung";
  try {
    const host = new URL(t).hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === "bakafrawi.com" || host.endsWith(".bakafrawi.com") || host === "localhost") return "Langsung";
    if (host.includes("instagram.com") || host === "l.instagram.com") return "Instagram";
    if (host.includes("google.")) return "Google";
    if (host.includes("whatsapp.com") || host === "wa.me") return "WhatsApp";
    if (host.includes("tiktok.com")) return "TikTok";
    if (host.includes("facebook.com") || host === "fb.com" || host === "m.facebook.com" || host === "l.facebook.com") return "Facebook";
    if (host.includes("threads.net")) return "Threads";
    if (host.includes("youtube.com") || host === "youtu.be") return "YouTube";
    if (host.includes("t.me") || host.includes("telegram.")) return "Telegram";
    if (host.includes("bing.com")) return "Bing";
    return host.slice(0, 40);
  } catch {
    return "Langsung";
  }
}

export type RingkasanPengunjung = {
  hariIniUnik: number;
  hariIniTayangan: number;
  pekanUnik: number;
  pekanTayangan: number;
  bulanUnik: number;
  bulanTayangan: number;
  totalUnik: number;
  totalTayangan: number;
  persenHp: number;
  halamanTeratas: { jalur: string; tayangan: number }[];
  sumberTeratas: { sumber: string; tayangan: number }[];
};
