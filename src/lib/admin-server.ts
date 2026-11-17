import "server-only";
import { adaSupabase, modeLokal, SUPABASE_ANON, SUPABASE_URL } from "./lingkungan";

/**
 * Apakah permintaan ini datang dari admin. Token sesi Supabase dikirim di header Authorization;
 * pemeriksaannya memanggil is_admin() di database dengan token itu — keputusan tetap di server
 * database, bukan di browser.
 */
export async function permintaanDariAdmin(req: Request): Promise<boolean> {
  if (modeLokal) return true;
  if (!adaSupabase) return false;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  return res.ok && (await res.json()) === true;
}
