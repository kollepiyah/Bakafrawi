import "server-only";
import { adaKunciServer, rest } from "./db-server";

// Aksi Studio di sisi server, dipakai bersama oleh panel admin (/api/studio/*) dan bot Telegram
// (/api/telegram) — satu tempat supaya aturan tayang/jadwal tak berbeda antara keduanya.

export { adaKunciServer };

export type Pengaturan = {
  telegram_chat_id: number | null;
  google_refresh_token: string | null;
  google_email: string | null;
  google_galat: string | null;
  google_disinkron: string | null;
  ringkasan_terakhir: string | null;
};

export async function bacaPengaturan(): Promise<Pengaturan> {
  return ((await rest("studio_pengaturan?id=eq.1&select=*")) as Pengaturan[])[0];
}

export async function simpanPengaturan(isi: Partial<Pengaturan> & Record<string, unknown>) {
  await rest("studio_pengaturan?id=eq.1", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...isi, diubah: new Date().toISOString() }) });
}

export type HasilTugas = { jenis: string; rasio: string; url: string; durasi?: number };
export type RingkasTugas = {
  id: string; jenis: string; produk_slug: string; status: string; status_tayang: string; jadwal_tayang: string | null;
  merek?: string; dibuat?: string; judul?: string | null; hasil?: HasilTugas[];
};

export async function daftarTugas(batas = 5): Promise<RingkasTugas[]> {
  return rest(`studio_tugas?select=id,jenis,produk_slug,status,status_tayang,jadwal_tayang,merek,dibuat,hasil,judul:naskah->>judul&order=dibuat.desc&limit=${batas}`);
}

export type PemakaianTersimpan = { tahap?: string; penyedia?: string; model?: string; input?: number; output?: number; biayaUsd?: number };
export type RingkasBiaya = {
  sejak: string;
  tugas: number;
  input: number;
  output: number;
  usd: number;
  perPenyedia: { penyedia: string; panggilan: number; input: number; output: number; usd: number }[];
};

/** Jumlah biaya AI tercatat (naskah.pemakaian) untuk tugas yang dibuat sejak awal bulan ini (WIB). */
export async function ringkasBiayaBulanIni(sekarang = new Date()): Promise<RingkasBiaya> {
  const wib = new Date(sekarang.getTime() + 7 * 3600_000);
  const sejak = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - 7 * 3600_000).toISOString();
  const baris = (await rest(`studio_tugas?dibuat=gte.${encodeURIComponent(sejak)}&select=pemakaian:naskah->pemakaian&limit=1000`)) as { pemakaian: PemakaianTersimpan[] | null }[];
  const per = new Map<string, { penyedia: string; panggilan: number; input: number; output: number; usd: number }>();
  let tugas = 0;
  for (const b of baris) {
    const daftar = Array.isArray(b.pemakaian) ? b.pemakaian : [];
    if (daftar.length) tugas++;
    for (const p of daftar) {
      const k = p.penyedia ?? "lain";
      const x = per.get(k) ?? { penyedia: k, panggilan: 0, input: 0, output: 0, usd: 0 };
      x.panggilan++;
      x.input += Number(p.input) || 0;
      x.output += Number(p.output) || 0;
      x.usd += Number(p.biayaUsd) || 0;
      per.set(k, x);
    }
  }
  const perPenyedia = [...per.values()].sort((a, b) => b.usd - a.usd);
  return {
    sejak,
    tugas,
    input: perPenyedia.reduce((a, b) => a + b.input, 0),
    output: perPenyedia.reduce((a, b) => a + b.output, 0),
    usd: Math.round(perPenyedia.reduce((a, b) => a + b.usd, 0) * 1e4) / 1e4,
    perPenyedia,
  };
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

// ------------------------------------------------------------ merek & kredensial sosmed

export type Merek = { slug: string; nama: string; aktif: boolean; urutan: number; profil: Record<string, unknown> };
export type Layanan = "instagram" | "tiktok";

export async function daftarMerek(): Promise<Merek[]> {
  return rest("studio_merek?select=slug,nama,aktif,urutan,profil&order=urutan.asc");
}

export async function aturAktifMerek(slug: string, aktif: boolean) {
  await rest(`studio_merek?slug=eq.${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ aktif, diubah: new Date().toISOString() }),
  });
}

/** Kredensial satu merek; isinya rahasia — jangan pernah dikirim utuh ke browser. */
export async function bacaKredensial(merek: string, layanan: Layanan): Promise<Record<string, string> | null> {
  const [k] = (await rest(`studio_kredensial?merek=eq.${encodeURIComponent(merek)}&layanan=eq.${layanan}&select=data`)) as { data: Record<string, string> }[];
  return k?.data ?? null;
}

export async function simpanKredensial(merek: string, layanan: Layanan, data: Record<string, string>) {
  await rest("studio_kredensial?on_conflict=merek,layanan", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ merek, layanan, data, dicek: null, diubah: new Date().toISOString() }),
  });
}

export async function hapusKredensial(merek: string, layanan: Layanan) {
  await rest(`studio_kredensial?merek=eq.${encodeURIComponent(merek)}&layanan=eq.${layanan}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

export async function buatTugas(isi: { produk_slug: string; jenis: "gambar" | "video"; latar: "polos" | "ai"; arahan?: string; merek?: string }) {
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

export type TugasBot = {
  id: string;
  dibuat: string;
  jenis: string;
  produk_slug: string;
  latar: string;
  status: string;
  status_tayang: string;
  jadwal_tayang: string | null;
  caption: string | null;
  galat: string | null;
};

/** Daftar konten untuk otak bot (lebih lengkap dari daftarTugas). */
export async function daftarTugasBot(batas = 8): Promise<TugasBot[]> {
  return rest(`studio_tugas?select=id,dibuat,jenis,produk_slug,latar,status,status_tayang,jadwal_tayang,caption,galat&order=dibuat.desc&limit=${Math.min(Math.max(batas, 1), 20)}`);
}

/** Ganti caption; tak boleh untuk yang sedang/sudah tayang (caption di Instagram tak ikut berubah). */
export async function ubahCaption(id: string, caption: string) {
  const hasil = (await rest(`studio_tugas?id=eq.${id}&status_tayang=not.in.(proses,tayang)`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ caption }),
  })) as TugasBot[];
  if (!hasil.length) throw new Error("Konten tidak ditemukan atau sudah/sedang tayang.");
}

export async function simpanRiwayatBot(riwayat: unknown[]) {
  await simpanPengaturan({ bot_riwayat: riwayat });
}

export async function bacaRiwayatBot(): Promise<{ peran: "user" | "assistant"; teks: string }[]> {
  const [p] = (await rest("studio_pengaturan?id=eq.1&select=bot_riwayat")) as { bot_riwayat: { peran: "user" | "assistant"; teks: string }[] }[];
  return p?.bot_riwayat ?? [];
}
