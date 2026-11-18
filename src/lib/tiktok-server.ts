import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Sambungan TikTok per merek (draf ke kotak masuk TikTok; posting tetap ditekan Kyai di aplikasi).
// Aplikasi developer TikTok sama dengan Studio Lek Kopi (scope user.info.basic + video.upload);
// alamat kembali https://bakafrawi.com/api/studio/tiktok/kembali harus didaftarkan di portal TikTok.

const KUNCI = () => process.env.TIKTOK_CLIENT_KEY ?? "";
const RAHASIA = () => process.env.TIKTOK_CLIENT_SECRET ?? "";
export const adaTiktok = () => Boolean(KUNCI() && RAHASIA());
export const alamatKembaliTiktok = (asal: string) => `${asal}/api/studio/tiktok/kembali`;

const tanda = (isi: string) => createHmac("sha256", RAHASIA()).update(isi).digest("base64url");

/** state = "<kedaluwarsa>.<merek>.<acak>.<tanda>" — merek ikut ditandatangani. */
export function urlIzinTiktok(asal: string, merek: string) {
  const isi = `${Date.now() + 10 * 60_000}.${merek}.${randomBytes(9).toString("base64url")}`;
  const q = new URLSearchParams({
    client_key: KUNCI(),
    redirect_uri: alamatKembaliTiktok(asal),
    response_type: "code",
    scope: "user.info.basic,video.upload",
    state: `${isi}.${tanda(isi)}`,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

/** Merek dari state yang sah, atau null. */
export function merekDariState(state: string): string | null {
  const i = state.lastIndexOf(".");
  if (i < 0) return null;
  const isi = state.slice(0, i);
  const a = Buffer.from(state.slice(i + 1));
  const b = Buffer.from(tanda(isi));
  const [kedaluwarsa, merek] = isi.split(".");
  if (a.length !== b.length || !timingSafeEqual(a, b) || Number(kedaluwarsa) < Date.now()) return null;
  return merek || null;
}

/**
 * Tukar kode → data kredensial (bentuk yang dipakai mesin, sama dengan Studio Lek Kopi):
 * token 2 jam, refresh token yang BERGANTI tiap dipakai (mesin menyimpannya ulang).
 */
export async function tukarKodeTiktok(kode: string, asal: string) {
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: KUNCI(), client_secret: RAHASIA(), code: kode, grant_type: "authorization_code", redirect_uri: alamatKembaliTiktok(asal) }),
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error || !j.access_token) throw new Error(`TikTok menolak kode (${j.error_description ?? j.error ?? r.status}).`);
  let akun = "akun TikTok";
  try {
    const u = await (await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name", { headers: { authorization: `Bearer ${j.access_token}` } })).json();
    if (u.data?.user?.display_name) akun = u.data.user.display_name;
  } catch {
    /* nama akun hanya untuk tampilan */
  }
  return {
    token: j.access_token as string,
    refresh: j.refresh_token as string,
    open_id: j.open_id as string,
    akun,
    token_sampai: new Date(Date.now() + Number(j.expires_in ?? 7200) * 1000).toISOString(),
    kedaluwarsa: new Date(Date.now() + Number(j.refresh_expires_in ?? 15552000) * 1000).toISOString(),
  };
}
