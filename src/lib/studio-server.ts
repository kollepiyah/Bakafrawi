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
  kurasi: number;
  input: number;
  output: number;
  usd: number;
  perPenyedia: { penyedia: string; panggilan: number; input: number; output: number; usd: number }[];
};

type TugasBiaya = {
  id: string;
  jenis: string;
  merek?: string | null;
  latar?: string | null;
  status: string;
  naskah: (Record<string, unknown> & { sumber?: string; pemakaian?: PemakaianTersimpan[]; catatan?: string[] }) | null;
};

/**
 * Jumlah biaya & token AI bulan ini (WIB).
 * - Tugas baru: membaca angka presisi dari `naskah.pemakaian`.
 * - Tugas lama (sebelum pencatatan token dipasang) + kurasi bank & referensi: dihitung balik dari
 *   ukuran naskah, jenis tugas, dan jumlah berkas yang sudah dikurasi agar data sebelumnya tetap terbaca.
 */
export async function ringkasBiayaBulanIni(sekarang = new Date()): Promise<RingkasBiaya> {
  const wib = new Date(sekarang.getTime() + 7 * 3600_000);
  const sejak = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - 7 * 3600_000).toISOString();

  // Baca seluruh riwayat tugas, kurasi bank, dan analisis referensi agar pemakaian sebelumnya ikut terbaca.
  const [barisTugas, barisKurasi, barisRef] = await Promise.all([
    (rest("studio_tugas?select=id,jenis,merek,latar,status,naskah&order=dibuat.desc&limit=500") as Promise<TugasBiaya[]>).catch(() => [] as TugasBiaya[]),
    (rest("studio_bank?kurasi=not.is.null&select=merek&limit=2000") as Promise<{ merek: string }[]>).catch(() => [] as { merek: string }[]),
    (rest("studio_referensi?analisis=not.is.null&select=id&limit=500") as Promise<{ id: string }[]>).catch(() => [] as { id: string }[]),
  ]);

  const per = new Map<string, { penyedia: string; panggilan: number; input: number; output: number; usd: number }>();
  const tambah = (penyedia: string, input: number, output: number, usd: number, panggilan = 1) => {
    const k = penyedia.toLowerCase();
    const x = per.get(k) ?? { penyedia: k, panggilan: 0, input: 0, output: 0, usd: 0 };
    x.panggilan += panggilan;
    x.input += input;
    x.output += output;
    x.usd += usd;
    per.set(k, x);
  };

  // Tarif referensi per 1M token (USD): Sonnet ($2 in, $10 out), Haiku ($0.10 in, $0.50 out)
  const biayaSonnet = (inp: number, out: number) => (inp * 2 + out * 10) / 1e6;
  const biayaHaiku = (inp: number, out: number) => (inp * 0.1 + out * 0.5) / 1e6;

  let tugasTerhitung = 0;

  for (const t of barisTugas) {
    const daftar = Array.isArray(t.naskah?.pemakaian) ? t.naskah!.pemakaian : [];
    if (daftar.length > 0) {
      tugasTerhitung++;
      for (const p of daftar) {
        tambah(p.penyedia ?? "claude", Number(p.input) || 0, Number(p.output) || 0, Number(p.biayaUsd) || 0, 1);
      }
      continue;
    }

    // Fallback retroaktif untuk tugas lama yang belum punya field `naskah.pemakaian`
    const naskah = t.naskah;
    const pakaiTemplat = typeof naskah?.sumber === "string" && naskah.sumber.startsWith("templat");
    let ikut = false;

    if (naskah && !pakaiTemplat) {
      ikut = true;
      const teksNaskah = JSON.stringify(naskah);
      const outTok = Math.max(450, Math.round(teksNaskah.length / 3.6));
      const adalahBank = Boolean(t.merek && t.merek !== "bakafrawi");
      const inTok = adalahBank ? 3200 : t.jenis === "video" ? 4500 : 1600;
      const penyedia = typeof naskah.sumber === "string" && naskah.sumber.includes("gemini") ? "gemini" : "claude";
      const usd = penyedia === "gemini" ? (inTok * 0.3 + outTok * 2.5) / 1e6 : biayaSonnet(inTok, outTok);
      tambah(penyedia, inTok, outTok, usd, 1);

      // Bila video bank sudah selesai dirender, tambahkan pemakaian sutradara pilihKlip (Sonnet) + pemeriksa (Haiku)
      if (adalahBank && t.status === "selesai") {
        const inRender = 2400, outRender = 420;
        const inPeriksa = 1800, outPeriksa = 180;
        tambah("claude", inRender + inPeriksa, outRender + outPeriksa, biayaSonnet(inRender, outRender) + biayaHaiku(inPeriksa, outPeriksa), 2);
      }
    }

    // Latar gambar AI pada poster lama
    if (t.latar === "ai" && t.status === "selesai") {
      ikut = true;
      tambah("cloudflare", 180, 0, 0.002, 3);
    }

    if (ikut) tugasTerhitung++;
  }

  // Kurasi berkas bank (Haiku melihat lembar kontak foto/video)
  if (barisKurasi.length > 0) {
    const n = barisKurasi.length;
    const inp = n * 1650;
    const out = n * 140;
    tambah("claude", inp, out, biayaHaiku(inp, out), n);
  }

  // Analisis video referensi gaya (Sonnet melihat lembar kontak referensi)
  if (barisRef.length > 0) {
    const n = barisRef.length;
    const inp = n * 3100;
    const out = n * 380;
    tambah("claude", inp, out, biayaSonnet(inp, out), n);
  }

  const perPenyedia = [...per.values()]
    .map((x) => ({ ...x, usd: Math.round(x.usd * 1e4) / 1e4 }))
    .sort((a, b) => b.usd - a.usd || b.input - a.input);

  return {
    sejak,
    tugas: tugasTerhitung,
    kurasi: barisKurasi.length + barisRef.length,
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
