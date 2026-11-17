import "server-only";

// Mengenali token Instagram yang ditempel admin — tiga jenis yang terbukti di Lek Kopi (14 Nov 2026):
// 1) token Instagram Login (IG…) → graph.instagram.com, 2) token akun IG gaya Facebook (EA…),
// 3) token pengguna/sistem Facebook yang mengelola akun IG (lewat Halaman atau ID akun IG).
const V = process.env.IG_API_VERSI ?? "v27.0";
const IG = (p: string) => `https://graph.instagram.com/${V}/${p}`;
const FB = (p: string) => `https://graph.facebook.com/${V}/${p}`;
const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

export type AkunIg = { ig_token: string; ig_host: "instagram" | "facebook"; ig_user_id: string; ig_akun: string; ig_dibuat: string; ig_kedaluwarsa: string };

export async function kenaliTokenInstagram(token: string, idIg?: string): Promise<AkunIg> {
  const dasar = { ig_token: token, ig_dibuat: new Date().toISOString(), ig_kedaluwarsa: new Date(Date.now() + 60 * 864e5).toISOString() };
  const r = await fetch(`${IG("me")}?${q({ fields: "user_id,username", access_token: token })}`, { cache: "no-store" });
  if (r.ok) {
    const s = await r.json();
    return { ...dasar, ig_host: "instagram", ig_user_id: String(s.user_id ?? s.id), ig_akun: `@${s.username}` };
  }
  const galatIg = (await r.json().catch(() => ({})))?.error?.message ?? r.status;

  if (idIg) {
    const a = await fetch(`${FB(idIg)}?${q({ fields: "id,username", access_token: token })}`, { cache: "no-store" });
    const s = await a.json().catch(() => ({}));
    if (a.ok && s.username) return { ...dasar, ig_host: "facebook", ig_user_id: String(s.id), ig_akun: `@${s.username}` };
    throw new Error(`Akun Instagram ${idIg} tak bisa diakses token ini (${s?.error?.message ?? a.status}).`);
  }
  const langsung = await fetch(`${FB("me")}?${q({ fields: "id,username", access_token: token })}`, { cache: "no-store" });
  if (langsung.ok) {
    const s = await langsung.json();
    if (s.username) return { ...dasar, ig_host: "facebook", ig_user_id: String(s.id), ig_akun: `@${s.username}` };
  }
  const hal = await fetch(`${FB("me/accounts")}?${q({ fields: "name,instagram_business_account{id,username}", access_token: token })}`, { cache: "no-store" });
  if (hal.ok) {
    const akun = ((await hal.json()).data ?? []).map((p: { instagram_business_account?: { id: string; username: string } }) => p.instagram_business_account).filter(Boolean);
    const pilih = akun.find((a: { username: string }) => /bakafrawi/i.test(a.username)) ?? akun[0];
    if (pilih) return { ...dasar, ig_host: "facebook", ig_user_id: String(pilih.id), ig_akun: `@${pilih.username}` };
    throw new Error("Token Facebook terbaca, tetapi tidak ada akun Instagram yang terlihat. Isi juga ID akun Instagram-nya.");
  }
  throw new Error(`Token ditolak Instagram (${galatIg}) dan Facebook.`);
}
