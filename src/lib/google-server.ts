import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Sambungan Google Calendar (OAuth "web server" + API REST, tanpa pustaka googleapis yang berat).
// Client id & secret dari variabel Vercel. Refresh token disimpan di studio_pengaturan (service role).

const ID = () => process.env.GOOGLE_CLIENT_ID ?? "";
const RAHASIA = () => process.env.GOOGLE_CLIENT_SECRET ?? "";
export const adaGoogle = () => Boolean(ID() && RAHASIA());

const LINGKUP = "openid email https://www.googleapis.com/auth/calendar.events";
const BERLAKU_STATE = 10 * 60_000;

export class GoogleTerputus extends Error {}

export const alamatKembali = (asal: string) => `${asal}/api/agenda/google/kembali`;

const tanda = (isi: string) => createHmac("sha256", RAHASIA()).update(isi).digest("base64url");

/** Alamat izin Google. state ditandatangani supaya hanya alur yang dimulai admin yang diterima. */
export function urlIzin(asal: string) {
  const isi = `${Date.now() + BERLAKU_STATE}.${randomBytes(12).toString("base64url")}`;
  const q = new URLSearchParams({
    client_id: ID(),
    redirect_uri: alamatKembali(asal),
    response_type: "code",
    scope: LINGKUP,
    access_type: "offline",
    prompt: "consent", // supaya Google selalu memberi refresh token baru
    include_granted_scopes: "true",
    state: `${isi}.${tanda(isi)}`,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export function stateSah(state: string): boolean {
  const i = state.lastIndexOf(".");
  if (i < 0) return false;
  const isi = state.slice(0, i);
  const a = Buffer.from(state.slice(i + 1));
  const b = Buffer.from(tanda(isi));
  return a.length === b.length && timingSafeEqual(a, b) && Number(isi.split(".")[0]) > Date.now();
}

async function token(isi: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: ID(), client_secret: RAHASIA(), ...isi }),
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (j.error === "invalid_grant") throw new GoogleTerputus("Izin Google dicabut atau kedaluwarsa — hubungkan ulang Google Calendar.");
    throw new Error(`Google token: ${j.error_description ?? j.error ?? res.status}`);
  }
  return j as { access_token: string; refresh_token?: string; id_token?: string };
}

/** Tukar kode dari Google dengan refresh token + email akun. */
export async function tukarKode(kode: string, asal: string) {
  const j = await token({ code: kode, grant_type: "authorization_code", redirect_uri: alamatKembali(asal) });
  if (!j.refresh_token) throw new Error("Google tidak memberi refresh token. Cabut akses Bakafrawi di myaccount.google.com/permissions lalu coba lagi.");
  // id_token datang langsung dari Google lewat TLS, jadi isinya cukup dibaca.
  const email = j.id_token ? (JSON.parse(Buffer.from(j.id_token.split(".")[1], "base64url").toString()).email as string) : null;
  return { refresh: j.refresh_token, email };
}

export async function aksesToken(refresh: string) {
  return (await token({ refresh_token: refresh, grant_type: "refresh_token" })).access_token;
}

export async function cabutToken(refresh: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: "POST" }).catch(() => {});
}

/** Panggil API Calendar untuk kalender utama. Mengembalikan { status, isi }; 404/409/410 tak dilempar. */
export async function kalender(akses: string, jalur: string, init: RequestInit = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/${jalur}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${akses}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 401) throw new GoogleTerputus("Akses Google ditolak — hubungkan ulang Google Calendar.");
  const teks = await res.text();
  if (!res.ok && ![404, 409, 410].includes(res.status)) throw new Error(`Google Calendar ${res.status}: ${teks.slice(0, 200)}`);
  return { status: res.status, isi: teks ? JSON.parse(teks) : null };
}
