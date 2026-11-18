import { sinkronGoogle } from "@/lib/agenda-server";
import { stateSah, tukarKode } from "@/lib/google-server";
import { simpanPengaturan } from "@/lib/studio-server";

export const maxDuration = 60;

// Google mengarahkan kembali ke sini setelah Kyai memberi izin. Tak ada token admin di sini, jadi
// yang menjaga adalah state bertanda tangan (hanya dibuat untuk admin, berlaku 10 menit).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ke = (hasil: string) => Response.redirect(`${url.origin}/admin?halaman=agenda&google=${encodeURIComponent(hasil)}`, 302);
  const kode = url.searchParams.get("code");
  if (url.searchParams.get("error") || !kode) return ke("dibatalkan");
  if (!stateSah(url.searchParams.get("state") ?? "")) return ke("kedaluwarsa");
  try {
    const { refresh, email } = await tukarKode(kode, url.origin);
    await simpanPengaturan({ google_refresh_token: refresh, google_email: email, google_galat: null });
    await sinkronGoogle().catch((e) => console.error("Sinkron pertama:", e));
    return ke("ok");
  } catch (e) {
    console.error("Google kembali:", e);
    return ke(e instanceof Error ? e.message.slice(0, 150) : "gagal");
  }
}
