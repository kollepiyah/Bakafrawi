import { simpanKredensial } from "@/lib/studio-server";
import { merekDariState, tukarKodeTiktok } from "@/lib/tiktok-server";

// TikTok mengarahkan kembali ke sini setelah Kyai memberi izin. Penjaganya state bertanda tangan
// (dibuat hanya untuk admin, berlaku 10 menit) yang juga membawa merek tujuan.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ke = (hasil: string) => Response.redirect(`${url.origin}/admin?halaman=studio&tiktok=${encodeURIComponent(hasil)}`, 302);
  const kode = url.searchParams.get("code");
  if (url.searchParams.get("error") || !kode) return ke("dibatalkan");
  const merek = merekDariState(url.searchParams.get("state") ?? "");
  if (!merek) return ke("kedaluwarsa");
  try {
    await simpanKredensial(merek, "tiktok", await tukarKodeTiktok(kode, url.origin));
    return ke("ok");
  } catch (e) {
    console.error("TikTok kembali:", e);
    return ke(e instanceof Error ? e.message.slice(0, 150) : "gagal");
  }
}
