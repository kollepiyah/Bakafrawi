import "server-only";
import { adaKunciServer, rest } from "./db-server";
import {
  catatRiwayatVideoBuka,
  jamBukaBerikutnya,
  jamWibBerikutnya,
  normalisasiJadwalRutin,
  normalisasiSasaran,
  pilihVideoBuka,
  uraiJadwalCustomWIB,
  type JadwalRutin,
  type SasaranTayang,
} from "./jadwal-tayang-murni";
import {
  episodeBerikutnya,
  normalisasiKonfigSerial,
  type FormatSuaraSerial,
  type GayaCeritaSerial,
  type KonfigSerialLekKopi,
  type MenuRingkasSerial,
  type MoodSerial,
  type NaskahDrafSerial,
  type PanjangSerial,
} from "./serial-kartun-murni";
import { ambilMenuLekKopi } from "./naskah-bank";

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
  picu_terakhir?: string | null;
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
export function jamTayangBerikutnya(sekarang = new Date(), jamWib = 19, menitWib = 0) {
  return jamWibBerikutnya(jamWib, menitWib, sekarang);
}

export type AksiTayang = "sekarang" | "jadwal" | "tolak" | "batal";

export type OpsiAturTayang = {
  /** Waktu jadwal custom: "YYYY-MM-DDTHH:MM" (WIB) atau ISO string. Kosong = jamWib (bawaan 19.00 WIB). */
  jadwal?: string | null;
  /** Jam WIB cepat (mis. 9, 12, 14, 19) bila jadwal custom string tidak dikirim. */
  jamWib?: number;
  /** Sasaran tayang Instagram: otomatis, story, reels, reels+story, feed, feed+story. */
  sasaran?: SasaranTayang | string | null;
};

/** Ubah status tayang satu tugas. Hanya tugas yang sudah selesai dibuat yang bisa ditayangkan. */
export async function aturTayang(id: string, aksi: AksiTayang, opsi?: OpsiAturTayang) {
  let jadwalIso: string | null = null;
  if (aksi === "jadwal") {
    if (opsi?.jadwal && String(opsi.jadwal).trim()) {
      const parsed = uraiJadwalCustomWIB(String(opsi.jadwal));
      if (!parsed.ok) throw new Error(parsed.pesan);
      jadwalIso = parsed.tanggal.toISOString();
    } else if (typeof opsi?.jamWib === "number") {
      jadwalIso = jamTayangBerikutnya(new Date(), opsi.jamWib, 0).toISOString();
    } else {
      jadwalIso = jamTayangBerikutnya().toISOString();
    }
  }

  const sasaran = opsi?.sasaran ? normalisasiSasaran(opsi.sasaran) : undefined;
  const isi: Record<string, unknown> =
    aksi === "sekarang" ? { status_tayang: "antre", jadwal_tayang: null }
    : aksi === "jadwal" ? { status_tayang: "dijadwalkan", jadwal_tayang: jadwalIso }
    : aksi === "tolak" ? { status_tayang: "ditolak", jadwal_tayang: null }
    : { status_tayang: "belum", jadwal_tayang: null };

  if (sasaran) {
    isi.tayang = { sasaran };
  }

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
export type SuaraFavorit = { id: string; nama: string; catatan?: string };

export const POLA_VOICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Bersihkan daftar Voice ID ElevenLabs favorit (case-sensitive, maks 20 item). */
export function normalisasiSuaraFavorit(mentah: unknown): SuaraFavorit[] {
  if (!Array.isArray(mentah)) return [];
  const hasil: SuaraFavorit[] = [];
  const sudah = new Set<string>();
  for (const item of mentah) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const id = String(obj.id ?? "").trim();
    if (!POLA_VOICE_ID.test(id) || sudah.has(id)) continue;
    sudah.add(id);
    const nama = String(obj.nama ?? "").trim().slice(0, 40) || id.slice(0, 12);
    const catatan = String(obj.catatan ?? "").trim().slice(0, 80);
    hasil.push(catatan ? { id, nama, catatan } : { id, nama });
    if (hasil.length >= 20) break;
  }
  return hasil;
}

export async function daftarMerek(): Promise<Merek[]> {
  return rest("studio_merek?select=slug,nama,aktif,urutan,profil&order=urutan.asc");
}

/** Simpan daftar Voice ID favorit ElevenLabs ke profil merek utama (`bakafrawi`). */
export async function simpanSuaraFavorit(daftar: SuaraFavorit[]): Promise<SuaraFavorit[]> {
  const bersih = normalisasiSuaraFavorit(daftar);
  const m = (await daftarMerek()).find((x) => x.slug === "bakafrawi");
  if (!m) throw new Error("Profil Studio utama tidak ditemukan.");
  await rest("studio_merek?slug=eq.bakafrawi", {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      profil: { ...(m.profil ?? {}), suara_elevenlabs: bersih },
      diubah: new Date().toISOString(),
    }),
  });
  return bersih;
}

export type AsetStudio = {
  id: string;
  kategori: "maskot" | "musik";
  karakter?: string;
  pose?: string;
  nama: string;
  url: string;
  jalur: string;
  ekstensi: string;
  dibuat: string;
};

const POSE_ASET_SAH = new Set(["kaget", "tunjuk", "hp", "jempol", "lambai"]);

/** Rapikan & validasi daftar aset Supabase (`bakafrawi.profil.aset_studio`, maks 60 item). */
export function normalisasiAsetStudio(mentah: unknown): AsetStudio[] {
  if (!Array.isArray(mentah)) return [];
  const hasil: AsetStudio[] = [];
  const sudah = new Set<string>();
  for (const item of mentah) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const url = String(obj.url ?? "").trim();
    const jalur = String(obj.jalur ?? "").trim().replace(/^\/+/, "");
    if (!/^https:\/\//i.test(url) || !jalur) continue;
    const kategori: AsetStudio["kategori"] = obj.kategori === "musik" ? "musik" : "maskot";
    const id = String(obj.id ?? "").trim() || jalur;
    if (sudah.has(id) || sudah.has(jalur)) continue;
    sudah.add(id);
    sudah.add(jalur);

    const karakterSlug = String(obj.karakter ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    if (kategori === "maskot" && !karakterSlug) continue;

    const poseMentah = String(obj.pose ?? "").trim().toLowerCase();
    const pose = kategori === "maskot" && POSE_ASET_SAH.has(poseMentah) ? poseMentah : "";
    const ekstMentah = String(obj.ekstensi ?? "").trim().toLowerCase();
    const ekstensi = /^\.[a-z0-9]{2,6}$/.test(ekstMentah) ? ekstMentah : kategori === "musik" ? ".mp3" : ".png";
    const nama = String(obj.nama ?? "").trim().slice(0, 60) || karakterSlug || "aset";
    const dibuat = String(obj.dibuat ?? "").trim() || new Date().toISOString();

    hasil.push({
      id,
      kategori,
      ...(kategori === "maskot" ? { karakter: karakterSlug, ...(pose ? { pose } : {}) } : {}),
      nama,
      url,
      jalur,
      ekstensi,
      dibuat,
    });
    if (hasil.length >= 60) break;
  }
  return hasil;
}

export async function daftarAsetStudio(): Promise<AsetStudio[]> {
  const m = (await daftarMerek()).find((x) => x.slug === "bakafrawi");
  return normalisasiAsetStudio(m?.profil?.aset_studio);
}

/** Simpan daftar aset (`maskot` & `musik`) ke `studio_merek.profil.aset_studio` tanpa menimpa field lain. */
export async function simpanAsetStudio(daftar: AsetStudio[]): Promise<AsetStudio[]> {
  const bersih = normalisasiAsetStudio(daftar);
  const m = (await daftarMerek()).find((x) => x.slug === "bakafrawi");
  if (!m) throw new Error("Profil Studio utama tidak ditemukan.");
  await rest("studio_merek?slug=eq.bakafrawi", {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      profil: { ...(m.profil ?? {}), aset_studio: bersih },
      diubah: new Date().toISOString(),
    }),
  });
  return bersih;
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

export async function buatTugas(isi: {
  produk_slug: string;
  jenis: "gambar" | "video";
  latar: "polos" | "ai";
  arahan?: string;
  merek?: string;
  jadwal_tayang?: string | null;
  sasaran?: SasaranTayang | string | null;
}) {
  let jadwalIso: string | null = null;
  if (isi.jadwal_tayang && String(isi.jadwal_tayang).trim()) {
    const parsed = uraiJadwalCustomWIB(String(isi.jadwal_tayang));
    if (!parsed.ok) throw new Error(parsed.pesan);
    jadwalIso = parsed.tanggal.toISOString();
  }
  const sasaran = isi.sasaran ? normalisasiSasaran(isi.sasaran) : undefined;
  const baris: Record<string, unknown> = {
    produk_slug: isi.produk_slug,
    jenis: isi.jenis,
    latar: isi.latar,
    arahan: isi.arahan ?? "",
    ...(isi.merek ? { merek: isi.merek } : {}),
    ...(jadwalIso ? { status_tayang: "dijadwalkan", jadwal_tayang: jadwalIso } : {}),
    ...(sasaran && sasaran !== "otomatis" ? { tayang: { sasaran } } : {}),
  };
  const [t] = (await rest("studio_tugas", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(baris) })) as RingkasTugas[];
  return { tugas: t, dipicu: await picuStudio() };
}

export async function buatTugasUnggahManual(isi: {
  merek?: string;
  judul?: string;
  url: string;
  sampulUrl?: string | null;
  jenis: "video" | "gambar";
  durasi?: number;
  caption?: string;
  sasaran?: SasaranTayang | string | null;
  modeTayang?: "sekarang" | "jadwal" | "draf";
  jadwal?: string | null;
}) {
  const url = String(isi.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL berkas media tidak sah.");
  }
  const merek = String(isi.merek || "bakafrawi").trim();
  const jenis = isi.jenis === "gambar" ? "gambar" : "video";
  const sasaran = normalisasiSasaran(isi.sasaran);
  const modeTayang = isi.modeTayang === "sekarang" || isi.modeTayang === "jadwal" ? isi.modeTayang : "draf";

  let jadwalIso: string | null = null;
  if (modeTayang === "jadwal") {
    const parsed = uraiJadwalCustomWIB(String(isi.jadwal ?? ""));
    if (!parsed.ok) throw new Error(parsed.pesan);
    jadwalIso = parsed.tanggal.toISOString();
  }

  const judulBersih = String(isi.judul ?? "").trim().slice(0, 120) || (jenis === "video" ? "Video Unggah Manual" : "Foto Unggah Manual");
  const hasil: Record<string, unknown>[] = [
    {
      jenis,
      rasio: sasaran === "feed" ? "potret" : "story",
      url,
      ...(jenis === "video" && Number.isFinite(Number(isi.durasi)) && Number(isi.durasi) > 0
        ? { durasi: Math.round(Number(isi.durasi)) }
        : {}),
      judul: judulBersih,
    },
  ];
  if (isi.sampulUrl && /^https?:\/\//i.test(isi.sampulUrl.trim())) {
    hasil.push({ jenis: "gambar", rasio: "sampul", url: isi.sampulUrl.trim() });
  }

  const statusTayang = modeTayang === "sekarang" ? "antre" : modeTayang === "jadwal" ? "dijadwalkan" : "belum";
  const baris = {
    merek,
    jenis,
    produk_slug: "unggah-manual",
    arahan: judulBersih,
    latar: "polos",
    status: "selesai",
    selesai: new Date().toISOString(),
    status_tayang: statusTayang,
    jadwal_tayang: jadwalIso,
    caption: String(isi.caption ?? "").trim().slice(0, 2200),
    naskah: {
      sumber: "unggah-manual",
      judul: judulBersih,
      sasaran,
    },
    tayang: { sasaran },
    hasil,
    galat: null,
  };

  const [tugas] = (await rest("studio_tugas", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(baris),
  })) as RingkasTugas[];

  const dipicu = modeTayang === "sekarang" ? await picuStudio() : false;
  return { tugas, dipicu, jadwalIso };
}

export async function buatUlang(id: string) {
  const [lama] = (await rest(`studio_tugas?id=eq.${id}&select=produk_slug,jenis,latar,arahan,merek`)) as {
    produk_slug: string;
    jenis: "gambar" | "video";
    latar: "polos" | "ai";
    arahan: string;
    merek?: string;
  }[];
  if (!lama) throw new Error("Tugas asal tidak ditemukan.");
  await aturTayang(id, "tolak").catch(() => {});
  return buatTugas(lama);
}

// ------------------------------------------------------------ jadwal rutin jam buka (Story Opening)

const mutlakUrlMedia = (url: string, origin = "https://bakafrawi.com") =>
  /^https?:\/\//.test(url) ? url : `${origin.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;

/** Baca konfigurasi jadwal rutin jam buka satu merek beserta waktu tayang berikutnya. */
export async function bacaJadwalRutin(slugMerek = "lekkopi") {
  const daftar = await daftarMerek();
  const m = daftar.find((x) => x.slug === slugMerek) ?? daftar.find((x) => x.slug === "lekkopi") ?? daftar[0];
  if (!m) throw new Error("Merek tidak ditemukan.");
  const jadwal = normalisasiJadwalRutin(m.profil?.jadwal_rutin, m.slug);
  const berikutnya = jamBukaBerikutnya(jadwal, new Date());
  const [terjadwal] = (await rest(
    `studio_tugas?merek=eq.${encodeURIComponent(m.slug)}&produk_slug=eq.rutin-buka&status_tayang=in.(dijadwalkan,antre)&select=id,status_tayang,jadwal_tayang,hasil,naskah&order=dibuat.desc&limit=1`,
  ).catch(() => [])) as (RingkasTugas & { naskah?: { videoDipilihId?: string; videoDipilihJudul?: string } | null })[];
  return {
    merek: m.slug,
    namaMerek: m.nama,
    jadwal,
    berikutnya: berikutnya ? berikutnya.toISOString() : null,
    tugasTerjadwal: terjadwal ?? null,
    videoBerikutnya: terjadwal?.naskah?.videoDipilihJudul
      ? { id: terjadwal.naskah.videoDipilihId ?? null, judul: terjadwal.naskah.videoDipilihJudul }
      : null,
  };
}

/** Sinkronkan baris tugas `rutin-buka` di `studio_tugas` supaya pg_cron menyalakan mesin tepat pada jam buka berikutnya. */
export async function sinkronTugasJadwalRutin(
  merek: Merek,
  jadwal: JadwalRutin,
  originSitus = "https://bakafrawi.com",
  opsi?: { paksaAcakUlang?: boolean },
): Promise<RingkasTugas | null> {
  const berikutnya = jamBukaBerikutnya(jadwal, new Date());
  const antrean = (await rest(
    `studio_tugas?merek=eq.${encodeURIComponent(merek.slug)}&produk_slug=eq.rutin-buka&status_tayang=eq.dijadwalkan&select=id,jadwal_tayang,naskah,hasil&order=dibuat.desc`,
  ).catch(() => [])) as {
    id: string;
    jadwal_tayang: string | null;
    naskah?: { videoDipilihId?: string; mode?: string } | null;
    hasil?: { id?: string; url?: string; judul?: string }[];
  }[];

  if (!jadwal.aktif || !berikutnya) {
    // Matikan/hapus antrean rutin yang belum tayang bila jadwal rutin dinonaktifkan
    for (const a of antrean) {
      await rest(`studio_tugas?id=eq.${a.id}&status_tayang=eq.dijadwalkan`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
    }
    return null;
  }

  const videoSebelumnyaId = antrean[0]?.naskah?.videoDipilihId ?? null;
  const modeSebelumnya = antrean[0]?.naskah?.mode ?? null;
  let dipilih = pilihVideoBuka(jadwal, berikutnya, {
    hindariId: opsi?.paksaAcakUlang ? videoSebelumnyaId : undefined,
  });

  // Bila mode acak sudah memilih 1 video untuk antrean terjadwal saat ini dan tidak dipaksa acak ulang,
  // pertahankan pilihan itu agar tidak berubah-ubah saat detak 5 menit berjalan.
  if (
    jadwal.mode === "acak" &&
    !opsi?.paksaAcakUlang &&
    modeSebelumnya === "acak" &&
    videoSebelumnyaId
  ) {
    const cocokLama = jadwal.video.find((v) => v.aktif && v.id === videoSebelumnyaId);
    if (cocokLama) {
      dipilih = [cocokLama];
    }
  }
  if (!jadwal.aiAktif && !dipilih.length) return null;

  const daftarMenu = jadwal.aiAktif && merek.slug === "lekkopi" ? await ambilMenuLekKopi() : [];
  if (daftarMenu.length > 0) {
    // Simpan salinan menu asli ke profil merek agar mesin GitHub Actions selalu punya daftar menu & foto asli terbaru.
    await rest(`studio_merek?slug=eq.${encodeURIComponent(merek.slug)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ profil: { ...merek.profil, menu_asli: daftarMenu.slice(0, 40) }, diubah: new Date().toISOString() }),
    }).catch(() => {});
  }
  const menuFinal = daftarMenu.length > 0
    ? daftarMenu
    : (Array.isArray(merek.profil?.menu_asli) ? (merek.profil.menu_asli as typeof daftarMenu) : []);
  const aiRutin = jadwal.aiAktif
    ? {
        aktif: true,
        format: jadwal.aiFormat === "poster" ? "poster" : "video-animasi",
        gaya: jadwal.aiGaya ?? "otomatis",
        arahan: jadwal.aiArahan ?? "",
        jamBuka: jadwal.jam,
        daftarMenu: menuFinal.slice(0, 40),
      }
    : null;

  const hasil = dipilih.map((v) => ({
    id: v.id,
    jenis: v.jenis,
    rasio: "story",
    url: mutlakUrlMedia(v.url, originSitus),
    durasi: v.durasi ?? 9,
    judul: v.judul,
    sasaran: v.sasaran,
    caption: v.caption ?? "",
  }));

  const jmlTotal = dipilih.length + (aiRutin ? 1 : 0);
  const labelMode = jadwal.mode === "acak" ? "acak" : jadwal.mode === "wajib+bergilir" ? "bergilir" : "semua";
  const isiTugas = {
    merek: merek.slug,
    jenis: aiRutin?.format === "poster" && !dipilih.length ? "gambar" : "video",
    produk_slug: "rutin-buka",
    arahan: `Jadwal otomatis jam buka (${jadwal.jam} WIB · mode ${labelMode} · ${dipilih[0]?.judul ?? `${jmlTotal} konten`}${aiRutin ? ` + AI ${aiRutin.format}` : ""})`,
    latar: "polos",
    status: "selesai",
    selesai: new Date().toISOString(),
    status_tayang: "dijadwalkan",
    jadwal_tayang: berikutnya.toISOString(),
    caption: dipilih[0]?.caption || `We are OPEN! ${merek.nama} ☕`,
    naskah: {
      sumber: aiRutin ? "jadwal-rutin-ai" : "jadwal-rutin",
      judul: `Story Jam Buka (${jadwal.jam} WIB)${dipilih[0]?.judul ? ` · ${dipilih[0].judul}` : ""}`,
      sasaran: "story",
      rutin: true,
      mode: jadwal.mode,
      videoDipilihId: dipilih[0]?.id ?? null,
      videoDipilihJudul: dipilih[0]?.judul ?? null,
      ...(aiRutin ? { aiRutin } : {}),
    },
    tayang: { sasaran: "story", rutin: true },
    hasil,
    galat: null,
  };

  if (antrean.length > 0) {
    const utama = antrean[0];
    // Hapus duplikat bila ada lebih dari satu
    for (const ekstra of antrean.slice(1)) {
      await rest(`studio_tugas?id=eq.${ekstra.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
    }
    const [diperbarui] = (await rest(`studio_tugas?id=eq.${utama.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(isiTugas),
    })) as RingkasTugas[];
    return diperbarui ?? null;
  }

  const [baru] = (await rest("studio_tugas", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(isiTugas),
  })) as RingkasTugas[];
  return baru ?? null;
}

/** Simpan pengaturan jadwal rutin jam buka merek & langsung jadwalkan antrean berikutnya. */
export async function simpanJadwalRutin(
  slugMerek: string,
  masukan: Partial<JadwalRutin>,
  originSitus = "https://bakafrawi.com",
) {
  const daftar = await daftarMerek();
  const m = daftar.find((x) => x.slug === slugMerek);
  if (!m) throw new Error(`Merek "${slugMerek}" tidak ditemukan.`);
  const lama = normalisasiJadwalRutin(m.profil?.jadwal_rutin, m.slug);
  const jadwal = normalisasiJadwalRutin({ ...lama, ...masukan }, m.slug);
  const profilBaru = { ...m.profil, jadwal_rutin: jadwal };
  await rest(`studio_merek?slug=eq.${encodeURIComponent(m.slug)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ profil: profilBaru, diubah: new Date().toISOString() }),
  });
  const tugasTerjadwal = await sinkronTugasJadwalRutin({ ...m, profil: profilBaru }, jadwal, originSitus);
  const berikutnya = jamBukaBerikutnya(jadwal, new Date());
  const naskahTugas = (tugasTerjadwal as unknown as { naskah?: { videoDipilihId?: string; videoDipilihJudul?: string } } | null)?.naskah;
  return {
    merek: m.slug,
    jadwal,
    berikutnya: berikutnya ? berikutnya.toISOString() : null,
    tugasTerjadwal,
    videoBerikutnya: naskahTugas?.videoDipilihJudul
      ? { id: naskahTugas.videoDipilihId ?? null, judul: naskahTugas.videoDipilihJudul }
      : null,
  };
}

/** Undi ulang video acak untuk jadwal rutin berikutnya tanpa mengubah pengaturan jam/hari. */
export async function acakUlangJadwalRutin(slugMerek = "lekkopi", originSitus = "https://bakafrawi.com") {
  const daftar = await daftarMerek();
  const m = daftar.find((x) => x.slug === slugMerek);
  if (!m) throw new Error(`Merek "${slugMerek}" tidak ditemukan.`);
  const jadwal = normalisasiJadwalRutin(m.profil?.jadwal_rutin, m.slug);
  if (!jadwal.aktif) throw new Error("Aktifkan jadwal buka terlebih dahulu.");
  const tugasTerjadwal = await sinkronTugasJadwalRutin(m, jadwal, originSitus, { paksaAcakUlang: true });
  const berikutnya = jamBukaBerikutnya(jadwal, new Date());
  const naskahTugas = (tugasTerjadwal as unknown as { naskah?: { videoDipilihId?: string; videoDipilihJudul?: string } } | null)?.naskah;
  return {
    merek: m.slug,
    jadwal,
    berikutnya: berikutnya ? berikutnya.toISOString() : null,
    tugasTerjadwal,
    videoBerikutnya: naskahTugas?.videoDipilihJudul
      ? { id: naskahTugas.videoDipilihId ?? null, judul: naskahTugas.videoDipilihJudul }
      : null,
  };
}

/** Tayangkan Story Jam Buka sekarang juga (untuk tes atau buka kedai lebih awal). */
export async function tayangkanRutinSekarang(slugMerek = "lekkopi", originSitus = "https://bakafrawi.com") {
  const daftar = await daftarMerek();
  const m = daftar.find((x) => x.slug === slugMerek);
  if (!m) throw new Error(`Merek "${slugMerek}" tidak ditemukan.`);
  const jadwal = normalisasiJadwalRutin(m.profil?.jadwal_rutin, m.slug);
  const dipilih = pilihVideoBuka(jadwal, new Date());
  if (!jadwal.aiAktif && !dipilih.length) {
    throw new Error("Belum ada video aktif atau konten AI yang diaktifkan di jadwal buka.");
  }

  const daftarMenu = jadwal.aiAktif && m.slug === "lekkopi" ? await ambilMenuLekKopi() : [];
  const aiRutin = jadwal.aiAktif
    ? {
        aktif: true,
        format: jadwal.aiFormat === "poster" ? "poster" : "video-animasi",
        gaya: jadwal.aiGaya ?? "otomatis",
        arahan: jadwal.aiArahan ?? "",
        jamBuka: jadwal.jam,
        daftarMenu: daftarMenu.slice(0, 30),
      }
    : null;

  const hasil = dipilih.map((v) => ({
    id: v.id,
    jenis: v.jenis,
    rasio: "story",
    url: mutlakUrlMedia(v.url, originSitus),
    durasi: v.durasi ?? 9,
    judul: v.judul,
    sasaran: v.sasaran,
    caption: v.caption ?? "",
  }));

  const jmlTotal = dipilih.length + (aiRutin ? 1 : 0);
  const [tugas] = (await rest("studio_tugas", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      merek: m.slug,
      jenis: aiRutin?.format === "poster" && !dipilih.length ? "gambar" : "video",
      produk_slug: "rutin-buka",
      arahan: `Tayang langsung Story Jam Buka (${dipilih[0]?.judul ?? `${jmlTotal} konten`}${aiRutin ? ` · termasuk AI ${aiRutin.format}` : ""})`,
      latar: "polos",
      status: "selesai",
      selesai: new Date().toISOString(),
      status_tayang: "antre",
      jadwal_tayang: null,
      caption: dipilih[0]?.caption || `We are OPEN! ${m.nama} ☕`,
      naskah: {
        sumber: aiRutin ? "jadwal-rutin-ai" : "jadwal-rutin",
        judul: `Story Jam Buka (${m.nama})${dipilih[0]?.judul ? ` · ${dipilih[0].judul}` : ""}`,
        sasaran: "story",
        rutin: true,
        mode: jadwal.mode,
        videoDipilihId: dipilih[0]?.id ?? null,
        videoDipilihJudul: dipilih[0]?.judul ?? null,
        ...(aiRutin ? { aiRutin } : {}),
      },
      tayang: { sasaran: "story", rutin: true },
      hasil,
    }),
  })) as RingkasTugas[];

  // Catat video terpilih ke riwayat agar undian acak berikutnya tidak langsung mengulang video yang sama.
  if (dipilih[0]?.id && jadwal.mode === "acak") {
    const riwayatBaru = catatRiwayatVideoBuka(jadwal, dipilih[0].id);
    const jadwalBaru = { ...jadwal, ...riwayatBaru };
    await rest(`studio_merek?slug=eq.${encodeURIComponent(m.slug)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ profil: { ...m.profil, jadwal_rutin: jadwalBaru }, diubah: new Date().toISOString() }),
    }).catch(() => {});
  }

  const dipicu = await picuStudio();
  return { tugas, dipicu, jumlahVideo: jmlTotal, videoDipilih: dipilih[0]?.judul ?? null };
}

/** Buat pratinjau Story Jam Buka AI dulu (tidak langsung tayang — masuk Riwayat Studio & dikirim ke Telegram dengan tombol persetujuan). */
export async function buatPratinjauRutin(slugMerek = "lekkopi", originSitus = "https://bakafrawi.com") {
  const daftar = await daftarMerek();
  const m = daftar.find((x) => x.slug === slugMerek);
  if (!m) throw new Error(`Merek "${slugMerek}" tidak ditemukan.`);
  const jadwal = normalisasiJadwalRutin(m.profil?.jadwal_rutin, m.slug);
  const daftarMenu = m.slug === "lekkopi" ? await ambilMenuLekKopi() : [];
  const menuFinal = daftarMenu.length > 0
    ? daftarMenu
    : (Array.isArray(m.profil?.menu_asli) ? (m.profil.menu_asli as typeof daftarMenu) : []);

  const dipilih = pilihVideoBuka(jadwal, new Date());
  const hasil = dipilih.map((v) => ({
    jenis: v.jenis,
    rasio: "story",
    url: mutlakUrlMedia(v.url, originSitus),
    durasi: v.durasi ?? 9,
    judul: v.judul,
    sasaran: v.sasaran,
    caption: v.caption ?? "",
  }));

  const aiRutin = {
    aktif: true,
    format: jadwal.aiFormat === "poster" ? "poster" : "video-animasi",
    gaya: jadwal.aiGaya ?? "otomatis",
    arahan: jadwal.aiArahan ?? "",
    jamBuka: jadwal.jam,
    daftarMenu: menuFinal.slice(0, 40),
  };

  const [tugas] = (await rest("studio_tugas", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      merek: m.slug,
      jenis: aiRutin.format === "poster" ? "gambar" : "video",
      produk_slug: "rutin-buka",
      arahan: `Pratinjau Story Jam Buka AI (${jadwal.jam} WIB · cek dulu sebelum tayang)`,
      latar: "polos",
      status: "antre",
      status_tayang: "belum",
      jadwal_tayang: null,
      caption: `We are OPEN! ${m.nama} ☕`,
      naskah: {
        sumber: "jadwal-rutin-ai",
        judul: `Pratinjau Story Jam Buka (${m.nama})`,
        sasaran: "story",
        rutin: true,
        aiRutin,
      },
      tayang: { sasaran: "story", rutin: true },
      hasil,
    }),
  })) as RingkasTugas[];
  const dipicu = await picuStudio();
  return { tugas, dipicu };
}

/** Dipanggil oleh detak 5 menit untuk memastikan semua merek yang jadwal rutinnya aktif selalu memiliki antrean berikutnya. */
export async function pastikanSemuaJadwalRutin() {
  const daftar = await daftarMerek();
  for (const m of daftar) {
    const jr = m.profil?.jadwal_rutin as JadwalRutin | undefined;
    if (!jr?.aktif) continue;
    const jadwal = normalisasiJadwalRutin(jr, m.slug);
    await sinkronTugasJadwalRutin(m, jadwal).catch((e) => console.error(`Sinkron rutin ${m.slug}:`, e));
  }
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

/**
 * Dipanggil cron 5 menit (`detakAgenda`) sebagai pemicu utama penjadwalan tayang otomatis.
 * Mengatasi kasus Vault `github_studio_token` di Supabase belum diisi karena Vercel sudah menyimpan
 * `GITHUB_STUDIO_TOKEN`. Menjaga jeda minimal 8 menit supaya antrean GitHub Actions tak menumpuk.
 */
export async function picuStudioJikaAdaKerja(sekarang = new Date()): Promise<{ dipicu: boolean; alasan: string }> {
  if (!adaKunciServer() || !process.env.GITHUB_STUDIO_TOKEN) {
    return { dipicu: false, alasan: "kunci belum siap" };
  }

  let adaKerja = false;
  try {
    const resRpc = await rest("rpc/studio_ada_kerja", { method: "POST", body: "{}" });
    adaKerja = resRpc === true;
  } catch {
    const jatuhTempo = (await rest(
      `studio_tugas?or=(status.eq.antre,status_tayang.eq.antre,and(status.eq.selesai,status_tayang.eq.dijadwalkan,jadwal_tayang.lte.${encodeURIComponent(sekarang.toISOString())}))&select=id&limit=1`,
    )) as { id: string }[];
    adaKerja = Array.isArray(jatuhTempo) && jatuhTempo.length > 0;
  }
  if (!adaKerja) return { dipicu: false, alasan: "tak ada kerja" };

  const pengaturan = await bacaPengaturan().catch(() => null);
  if (pengaturan?.picu_terakhir) {
    const jedaMs = sekarang.getTime() - new Date(pengaturan.picu_terakhir).getTime();
    if (Number.isFinite(jedaMs) && jedaMs >= 0 && jedaMs < 8 * 60_000) {
      return { dipicu: false, alasan: "baru dipicu" };
    }
  }

  const dipicu = await picuStudio();
  if (!dipicu) return { dipicu: false, alasan: "GITHUB_STUDIO_TOKEN gagal/belum diisi" };

  await simpanPengaturan({ picu_terakhir: sekarang.toISOString() }).catch(() => {});
  return { dipicu: true, alasan: "dipicu" };
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

// ------------------------------------------------------------ serial kartun 2D Lek Kopi

/** Ambil daftar menu asli Lek Kopi dari pintu-bakafrawi (cadangan cache profil.menu_asli) untuk prompt Serial Kartun. */
export async function ambilMenuLekKopiUntukPrompt(): Promise<MenuRingkasSerial[]> {
  const langsung = await ambilMenuLekKopi().catch(() => []);
  let mentah: unknown[] = langsung;
  if (!mentah.length) {
    const daftar = await daftarMerek().catch(() => []);
    const lek = daftar.find((m) => m.slug === "lekkopi");
    if (Array.isArray(lek?.profil?.menu_asli)) mentah = lek.profil.menu_asli as unknown[];
  }
  return mentah
    .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object" && (x as { nama?: unknown }).nama))
    .slice(0, 35)
    .map((m) => ({
      nama: String(m.nama).trim(),
      ...(Number(m.harga) > 0 ? { harga: Number(m.harga) } : {}),
      ...(m.kategori ? { kategori: String(m.kategori).trim() } : {}),
    }));
}

/** Baca konfigurasi latar & serial kartun milik Lek Kopi dari `studio_merek.profil.serial_kartun`. */
export async function bacaKonfigSerialLekKopi(): Promise<KonfigSerialLekKopi> {
  const daftar = await daftarMerek();
  const lek = daftar.find((m) => m.slug === "lekkopi");
  return normalisasiKonfigSerial(lek?.profil?.serial_kartun);
}

/** Simpan konfigurasi serial kartun Lek Kopi tanpa menimpa key profil merek lain. */
export async function simpanKonfigSerialLekKopi(konfig: KonfigSerialLekKopi): Promise<KonfigSerialLekKopi> {
  const bersih = normalisasiKonfigSerial(konfig);
  const daftar = await daftarMerek();
  const lek = daftar.find((m) => m.slug === "lekkopi");
  if (!lek) throw new Error("Profil merek Lek Kopi belum ditemukan di database.");
  await rest("studio_merek?slug=eq.lekkopi", {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      profil: { ...(lek.profil ?? {}), serial_kartun: bersih },
      diubah: new Date().toISOString(),
    }),
  });
  return bersih;
}

/** Masukkan tugas pembuatan 1 episode Serial Kartun 2D Lek Kopi ke antrean mesin Studio. */
export async function buatTugasSerialKartun(opsi: {
  serialId?: string;
  ide?: string;
  mood?: MoodSerial;
  formatSuara?: FormatSuaraSerial;
  panjangNaskah?: PanjangSerial;
  bersambung?: boolean;
  gayaCerita?: GayaCeritaSerial;
  hasilRiset?: string;
  modeJadwal?: "persetujuan" | "prime19" | "custom";
  jadwal?: string | null;
  sasaran?: SasaranTayang | string | null;
  naskahJadi?: NaskahDrafSerial | null;
}) {
  const [konfig, daftarMenu] = await Promise.all([
    bacaKonfigSerialLekKopi(),
    ambilMenuLekKopiUntukPrompt().catch(() => [] as MenuRingkasSerial[]),
  ]);
  const serial =
    konfig.serial.find((s) => s.id === opsi.serialId) ??
    konfig.serial.find((s) => s.id === konfig.serialAktifId) ??
    konfig.serial[0];
  if (!serial) throw new Error("Serial kartun belum dikonfigurasi.");

  const nomorEpisode = episodeBerikutnya(serial);
  const mood: MoodSerial = opsi.mood ?? serial.moodBawaan ?? "komedi_ceria";
  const formatSuara: FormatSuaraSerial = opsi.formatSuara ?? serial.formatSuara ?? "dialog";
  const panjangNaskah: PanjangSerial =
    opsi.panjangNaskah === "ringkas" || opsi.panjangNaskah === "panjang" ? opsi.panjangNaskah : "sedang";
  const bersambung = Boolean(opsi.bersambung);
  const gayaCerita: GayaCeritaSerial = opsi.gayaCerita === "dokumenter" ? "dokumenter" : "kedai";
  const hasilRisetBersih = String(opsi.hasilRiset ?? "").trim().slice(0, 2500);
  const ideBersih = String(opsi.ide ?? "").trim().slice(0, 4000);
  const naskahJadi = opsi.naskahJadi && opsi.naskahJadi.adegan?.length > 0 ? opsi.naskahJadi : null;

  let jadwalIso: string | null = null;
  if (opsi.modeJadwal === "prime19") {
    jadwalIso = jamTayangBerikutnya().toISOString();
  } else if (opsi.modeJadwal === "custom" && String(opsi.jadwal ?? "").trim()) {
    const parsed = uraiJadwalCustomWIB(String(opsi.jadwal));
    if (!parsed.ok) throw new Error(parsed.pesan);
    jadwalIso = parsed.tanggal.toISOString();
  }

  const sasaran = opsi.sasaran ? normalisasiSasaran(opsi.sasaran) : undefined;
  const judulSementara = naskahJadi?.judulEpisode?.trim() || `${serial.judul} — Episode ${nomorEpisode}`;
  const arahan = [
    `[Serial: ${serial.id} · Ep ${nomorEpisode} · ${mood} · ${formatSuara} · ${panjangNaskah}${gayaCerita === "dokumenter" ? " · dokumenter" : ""}${bersambung ? " · bersambung" : ""}]`,
    ideBersih ? ideBersih.slice(0, 280) : `Lanjutkan kisah hangat dan lucu "${serial.judul}" episode ${nomorEpisode} di Lek Kopi.`,
  ].join(" ");

  const baris: Record<string, unknown> = {
    merek: "lekkopi",
    jenis: "video",
    produk_slug: "lekkopi-serial",
    arahan,
    latar: "polos",
    status: "antre",
    naskah: {
      sumber: "serial-kartun-antre",
      judul: judulSementara,
      serialKartun: {
        serialId: serial.id,
        judulSerial: serial.judul,
        nomorEpisode,
        mood,
        formatSuara,
        panjangNaskah,
        bersambung,
        gayaCerita,
        ...(hasilRisetBersih ? { hasilRiset: hasilRisetBersih } : {}),
        ide: ideBersih,
        suaraTokoh: serial.suaraTokoh ?? {},
        ...(daftarMenu.length && gayaCerita !== "dokumenter" ? { daftarMenu } : {}),
        ...(naskahJadi ? { naskahJadi } : {}),
      },
    },
    ...(jadwalIso ? { status_tayang: "dijadwalkan", jadwal_tayang: jadwalIso } : {}),
    ...(sasaran && sasaran !== "otomatis" ? { tayang: { sasaran } } : {}),
  };

  const [tugas] = (await rest("studio_tugas", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(baris),
  })) as RingkasTugas[];

  const dipicu = await picuStudio();
  return { tugas, dipicu, jadwalIso, nomorEpisode, judulSerial: serial.judul };
}
