import "server-only";
import {
  idGoogle,
  keGoogle,
  masukanDariAcara,
  normalisasiAcara,
  perluDiingatkan,
  pesanPengingat,
  pesanRingkasanPagi,
  rencanaSinkron,
  rentangHariWIB,
  tanggalWIB,
  waktunyaRingkasanPagi,
  type Acara,
  type AcaraGoogle,
  type MasukanAcara,
} from "./agenda-murni";
import { rest } from "./db-server";
import { aksesToken, adaGoogle, GoogleTerputus, kalender } from "./google-server";
import { bacaPengaturan, simpanPengaturan } from "./studio-server";
import { adaBot, kirim } from "./telegram-server";

// Aksi agenda di sisi server — satu-satunya jalan menulis agenda (layar Studio, APK, bot Telegram),
// supaya aturan & pengiriman ke Google Calendar tak tercecer.

type Baris = Acara & { diubah: string };
const KOLOM = "id,judul,mulai,selesai,seharian,lokasi,catatan,google_id,berulang,status,perlu_sinkron,diingatkan,diubah";
const iso = (d: Date) => encodeURIComponent(d.toISOString());
const JENDELA_LALU = 24 * 3600_000;
const JENDELA_DEPAN = 60 * 24 * 3600_000;

export async function daftarAcara(dari: Date, sampai: Date): Promise<Baris[]> {
  return rest(`agenda?select=${KOLOM}&status=eq.aktif&mulai=lt.${iso(sampai)}&selesai=gt.${iso(dari)}&order=mulai.asc&limit=500`);
}

async function ambil(id: string): Promise<Baris> {
  const [a] = (await rest(`agenda?select=${KOLOM}&id=eq.${encodeURIComponent(id)}`)) as Baris[];
  if (!a) throw new Error("Acara tidak ditemukan.");
  return a;
}

/** Token akses Google bila tersambung; null bila belum. Putus → dicatat & Kyai dikabari sekali. */
async function aksesGoogle(): Promise<string | null> {
  if (!adaGoogle()) return null;
  const p = await bacaPengaturan();
  if (!p.google_refresh_token) return null;
  try {
    return await aksesToken(p.google_refresh_token);
  } catch (e) {
    if (e instanceof GoogleTerputus) await catatPutus(e.message, p.google_galat, p.telegram_chat_id);
    throw e;
  }
}

async function catatPutus(pesan: string, galatLama: string | null, chat: number | null) {
  await simpanPengaturan({ google_galat: pesan });
  if (!galatLama && chat && adaBot()) await kirim(chat, `⚠️ ${pesan}`).catch(() => {});
}

/**
 * Kirim satu acara ke Google. Berhasil → perlu_sinkron dimatikan, kecuali acara sempat diubah lagi
 * selama pengiriman (diubah berbeda) — maka ia dikirim ulang pada detak berikutnya.
 */
async function dorong(a: Baris, akses: string): Promise<void> {
  let google_id = a.google_id;
  if (a.status === "batal") {
    if (google_id) await kalender(akses, `events/${encodeURIComponent(google_id)}`, { method: "DELETE" });
  } else {
    const isi = JSON.stringify(keGoogle(a));
    let r = google_id ? await kalender(akses, `events/${encodeURIComponent(google_id)}`, { method: "PATCH", body: isi }) : null;
    if (!r || r.status === 404 || r.status === 410) {
      // Acara baru (atau yang sudah dihapus di Google tapi diubah di Studio): buat dengan id tetap
      // supaya percobaan ulang tak membuat acara ganda.
      const id = google_id && r ? undefined : idGoogle(a.id);
      r = await kalender(akses, "events", { method: "POST", body: JSON.stringify({ ...JSON.parse(isi), ...(id ? { id } : {}) }) });
      if (r.status === 409 && id) r = await kalender(akses, `events/${id}`, { method: "PATCH", body: isi });
      if (r.status >= 400) throw new Error(`Google menolak acara (${r.status}).`);
    }
    google_id = r.isi.id;
  }
  await rest(`agenda?id=eq.${a.id}&diubah=eq.${encodeURIComponent(a.diubah)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ perlu_sinkron: false, google_id }),
  });
}

/** Coba kirim langsung; gagal tak apa — acara tetap perlu_sinkron dan dicoba ulang tiap detak. */
async function cobaDorong(a: Baris): Promise<boolean> {
  try {
    const akses = await aksesGoogle();
    if (!akses) return false;
    await dorong(a, akses);
    return true;
  } catch (e) {
    console.error("Dorong agenda:", e);
    return false;
  }
}

export async function tambahAcara(m: MasukanAcara) {
  const h = normalisasiAcara(m);
  if (!h.ok) throw new Error(h.galat);
  const [a] = (await rest(`agenda?select=${KOLOM}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(h.data) })) as Baris[];
  return { acara: a, keGoogle: await cobaDorong(a) };
}

/** Ubah sebagian kolom; kolom yang tak dikirim tetap. */
export async function ubahAcara(id: string, m: MasukanAcara) {
  const lama = await ambil(id);
  if (lama.status === "batal") throw new Error("Acara sudah dihapus.");
  const isi = Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined));
  const h = normalisasiAcara({ ...masukanDariAcara(lama), ...isi });
  if (!h.ok) throw new Error(h.galat);
  const geser = new Date(h.data.mulai).getTime() !== new Date(lama.mulai).getTime();
  const [a] = (await rest(`agenda?id=eq.${lama.id}&select=${KOLOM}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...h.data, perlu_sinkron: true, diubah: new Date().toISOString(), ...(geser ? { diingatkan: null } : {}) }),
  })) as Baris[];
  return { acara: a, keGoogle: await cobaDorong(a) };
}

export async function hapusAcara(id: string) {
  const lama = await ambil(id);
  const [a] = (await rest(`agenda?id=eq.${lama.id}&select=${KOLOM}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "batal", perlu_sinkron: true, diubah: new Date().toISOString() }),
  })) as Baris[];
  return { acara: a, keGoogle: await cobaDorong(a) };
}

/** Sinkron dua arah: dorong perubahan lokal yang tertunda, lalu tarik isi Google 1 hari lalu–60 hari ke depan. */
export async function sinkronGoogle(sekarang = new Date()): Promise<string> {
  const akses = await aksesGoogle();
  if (!akses) return "Google belum tersambung.";

  const tertunda = (await rest(`agenda?select=${KOLOM}&perlu_sinkron=is.true&order=diubah.asc&limit=50`)) as Baris[];
  let gagalDorong = 0;
  for (const a of tertunda) await dorong(a, akses).catch((e) => (gagalDorong++, console.error("Dorong agenda:", e)));

  const dari = new Date(sekarang.getTime() - JENDELA_LALU);
  const sampai = new Date(sekarang.getTime() + JENDELA_DEPAN);
  const google: AcaraGoogle[] = [];
  let halaman: string | undefined;
  do {
    const q = new URLSearchParams({ singleEvents: "true", timeMin: dari.toISOString(), timeMax: sampai.toISOString(), maxResults: "2500", ...(halaman ? { pageToken: halaman } : {}) });
    const { isi } = await kalender(akses, `events?${q}`);
    google.push(...((isi?.items ?? []) as AcaraGoogle[]));
    halaman = isi?.nextPageToken;
  } while (halaman);

  const lokal = (await rest(`agenda?select=${KOLOM}&google_id=not.is.null&mulai=lt.${iso(sampai)}&selesai=gt.${iso(dari)}`)) as Baris[];
  const { simpan, hilang } = rencanaSinkron(lokal, google);
  if (simpan.length) {
    const kini = sekarang.toISOString();
    await rest("agenda?on_conflict=google_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(simpan.map((s) => ({ ...s, perlu_sinkron: false, diubah: kini }))),
    });
  }
  // Yang hilang dari jendela dicek satu per satu: dihapus di Google → batal; digeser → diperbarui.
  for (const id of hilang) {
    const l = lokal.find((x) => x.id === id)!;
    const r = await kalender(akses, `events/${encodeURIComponent(l.google_id!)}`);
    const ev = r.status === 200 ? (r.isi as AcaraGoogle) : null;
    const baru = ev && ev.status !== "cancelled" ? rencanaSinkron([], [ev]).simpan[0] : null;
    await rest(`agenda?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(baru ? { ...baru, perlu_sinkron: false, diubah: sekarang.toISOString() } : { status: "batal", perlu_sinkron: false, diubah: sekarang.toISOString() }),
    });
  }
  await simpanPengaturan({ google_disinkron: sekarang.toISOString(), google_galat: null });
  return `Sinkron: ${tertunda.length - gagalDorong} terkirim, ${simpan.length} diperbarui dari Google, ${hilang.length} dicek.`;
}

/** Detak 5 menit (dipanggil pg_cron Supabase): sinkron, pengingat 30 menit, ringkasan pagi. */
export async function detakAgenda(sekarang = new Date()) {
  const laporan: string[] = [];
  try {
    laporan.push(await sinkronGoogle(sekarang));
  } catch (e) {
    laporan.push(`Sinkron gagal: ${e instanceof Error ? e.message : e}`);
  }

  const p = await bacaPengaturan();
  const chat = p.telegram_chat_id;
  if (!chat || !adaBot()) return [...laporan, "Bot Telegram belum terdaftar — pengingat dilewati."];

  const dekat = await daftarAcara(sekarang, new Date(sekarang.getTime() + 31 * 60_000));
  for (const a of perluDiingatkan(dekat, sekarang)) {
    // Tandai dulu, baru kirim: lebih baik satu pengingat terlewat daripada terkirim dua kali.
    await rest(`agenda?id=eq.${a.id}&diingatkan=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ diingatkan: sekarang.toISOString() }) });
    await kirim(chat, pesanPengingat(a, sekarang)).catch((e) => laporan.push(`Pengingat gagal: ${e.message}`));
  }

  if (waktunyaRingkasanPagi(sekarang, p.ringkasan_terakhir)) {
    const hari = tanggalWIB(sekarang);
    await simpanPengaturan({ ringkasan_terakhir: hari });
    const { dari, sampai } = rentangHariWIB(sekarang);
    await kirim(chat, pesanRingkasanPagi(await daftarAcara(dari, sampai), hari));
    laporan.push("Ringkasan pagi terkirim.");
  }
  return laporan;
}

export async function statusGoogle() {
  const p = await bacaPengaturan();
  return { siap: adaGoogle(), tersambung: Boolean(p.google_refresh_token), email: p.google_email, galat: p.google_galat, disinkron: p.google_disinkron };
}

/** Ringkasan untuk Beranda (layar Studio & APK). */
export async function ringkasanBeranda(sekarang = new Date()) {
  const hariIni = rentangHariWIB(sekarang);
  const pekan = rentangHariWIB(sekarang, 1, 7);
  const [acaraHariIni, acaraPekan, konten, google] = await Promise.all([
    daftarAcara(hariIni.dari, hariIni.sampai),
    daftarAcara(pekan.dari, pekan.sampai),
    rest("studio_tugas?select=status,status_tayang&dibuat=gte." + iso(new Date(sekarang.getTime() - 30 * 24 * 3600_000))) as Promise<{ status: string; status_tayang: string }[]>,
    statusGoogle(),
  ]);
  return {
    tanggal: tanggalWIB(sekarang),
    acaraHariIni,
    acaraPekan,
    konten: {
      menungguPersetujuan: konten.filter((k) => k.status === "selesai" && k.status_tayang === "belum").length,
      sedangDibuat: konten.filter((k) => k.status === "antre" || k.status === "proses").length,
      terjadwal: konten.filter((k) => k.status_tayang === "dijadwalkan" || k.status_tayang === "antre").length,
      gagal: konten.filter((k) => k.status === "gagal" || k.status_tayang === "gagal").length,
    },
    google,
  };
}
