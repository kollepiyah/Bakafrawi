import "server-only";
import { SUPABASE_URL } from "./lingkungan";

// Akses database dengan kunci service role (rahasia server Vercel, TIDAK berawalan NEXT_PUBLIC_),
// dipakai bersama Studio, agenda, dan bot Telegram.

const KUNCI = () => process.env.SUPABASE_SERVICE_KEY ?? "";
export const adaKunciServer = () => Boolean(SUPABASE_URL && KUNCI());

export async function rest(jalur: string, init: RequestInit = {}) {
  if (!adaKunciServer()) throw new Error("SUPABASE_SERVICE_KEY belum diisi di Vercel.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${jalur}`, {
    ...init,
    cache: "no-store",
    headers: { apikey: KUNCI(), Authorization: `Bearer ${KUNCI()}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`Database ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const teks = await res.text();
  return teks ? JSON.parse(teks) : null;
}
