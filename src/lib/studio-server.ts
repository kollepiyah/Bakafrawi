import "server-only";
import { SUPABASE_URL } from "./lingkungan";

// Aksi Studio di sisi server, dipakai bersama oleh panel admin (/api/studio/*) dan bot Telegram
// (/api/telegram) — satu tempat supaya aturan tayang/jadwal tak berbeda antara keduanya.
// Memakai kunci service role (rahasia server Vercel, TIDAK berawalan NEXT_PUBLIC_).

const KUNCI = () => process.env.SUPABASE_SERVICE_KEY ?? "";
export const adaKunciServer = () => Boolean(SUPABASE_URL && KUNCI());

async function rest(jalur: string, init: RequestInit = {}) {
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

export type Pengaturan = {
  telegram_chat_id: number | null;
  ig_akun: string | null;
  ig_user_id: string | null;
  ig_token: string | null;
  ig_host: "instagram" | "facebook";
  ig_kedaluwarsa: string | null;
};

export async function bacaPengaturan(): Promise<Pengaturan> {
  return ((await rest("studio_pengaturan?id=eq.1&select=*")) as Pengaturan[])[0];
}

export async function simpanPengaturan(isi: Partial<Pengaturan> & Record<string, unknown>) {
  await rest("studio_pengaturan?id=eq.1", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...isi, diubah: new Date().toISOString() }) });
}

export type RingkasTugas = { id: string; jenis: string; produk_slug: string; status: string; status_tayang: string; jadwal_tayang: string | null };

export async function daftarTugas(batas = 5): Promise<RingkasTugas[]> {
  return rest(`studio_tugas?select=id,jenis,produk_slug,status,status_tayang,jadwal_tayang&order=dibuat.desc&limit=${batas}`);
}

/** Pukul 19.00 WIB berikutnya (12.00 UTC); bila sudah lewat hari ini → besok. */
export function jamTayangBerikutnya(sekarang = new Date()) {
  const t = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), sekarang.getUTCDate(), 12, 0, 0));
  if (t.getTime() <= sekarang.getTime() + 5 * 60_000) t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

export type AksiTayang = "sekarang" | "jadwal" | "tolak" | "batal";

/** Ubah status tayang satu tugas. Hanya tugas yang sudah selesai dibuat yang bisa ditayangkan. */
export async function aturTayang(id: string, aksi: AksiTayang) {
  const isi =
    aksi === "sekarang" ? { status_tayang: "antre", jadwal_tayang: null }
    : aksi === "jadwal" ? { status_tayang: "dijadwalkan", jadwal_tayang: jamTayangBerikutnya().toISOString() }
    : aksi === "tolak" ? { status_tayang: "ditolak", jadwal_tayang: null }
    : { status_tayang: "belum", jadwal_tayang: null };
  // Tak boleh mengubah yang sedang diproses / sudah tayang (cegah posting ganda).
  const hasil = (await rest(`studio_tugas?id=eq.${id}&status=eq.selesai&status_tayang=not.in.(proses,tayang)`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(isi),
  })) as RingkasTugas[];
  if (!hasil.length) throw new Error("Tugas tidak ditemukan, belum selesai, atau sudah/sedang tayang.");
  if (aksi === "sekarang") await picuStudio();
  return hasil[0];
}

export async function buatTugas(isi: { produk_slug: string; jenis: "gambar" | "video"; latar: "polos" | "ai"; arahan?: string }) {
  const [t] = (await rest("studio_tugas", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ arahan: "", ...isi }) })) as RingkasTugas[];
  return { tugas: t, dipicu: await picuStudio() };
}

export async function buatUlang(id: string) {
  const [lama] = (await rest(`studio_tugas?id=eq.${id}&select=produk_slug,jenis,latar,arahan`)) as { produk_slug: string; jenis: "gambar" | "video"; latar: "polos" | "ai"; arahan: string }[];
  if (!lama) throw new Error("Tugas asal tidak ditemukan.");
  await aturTayang(id, "tolak").catch(() => {});
  return buatTugas(lama);
}

/** Nyalakan mesin Studio (GitHub Actions) sekarang. false → tetap jalan via jadwal 30 menit. */
export async function picuStudio(): Promise<boolean> {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  if (!token) return false;
  const repo = process.env.GITHUB_STUDIO_REPO ?? "kollepiyah/Bakafrawi";
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/studio.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main" }),
  });
  return res.ok;
}
