import "server-only";
import { createHash } from "crypto";
import { tanggalWIB } from "./agenda-murni";
import { rest } from "./db-server";
import { adaKunciServer } from "./studio-server";
import {
  adalahBot,
  adalahPerangkatHp,
  normalisasiJalur,
  sumberDariPerujuk,
  type RingkasanPengunjung,
} from "./kunjungan-murni";

type BarisHarian = {
  tanggal: string;
  pengunjung_unik: number;
  tayangan: number;
  perangkat_hp: number;
  perangkat_desktop: number;
};

type BarisDetail = {
  jalur: string;
  sumber: string;
  tayangan: number;
};

function geserHariWIB(sekarang: Date, hari: number): string {
  return tanggalWIB(new Date(sekarang.getTime() + hari * 864e5));
}

function sidikHarian(tanggal: string, ip: string, ua: string): string {
  const garam = process.env.SUPABASE_SERVICE_KEY?.slice(0, 16) || "bakafrawi-salt";
  return createHash("sha256").update(`${tanggal}|${ip}|${ua}|${garam}`).digest("hex").slice(0, 32);
}

/** Catat satu kunjungan manusia asli ke Supabase lewat RPC atomik `catat_kunjungan`. */
export async function catatKunjungan(masukan: {
  ip: string;
  ua: string;
  jalur: string;
  perujuk?: string;
}): Promise<{ dicatat: boolean; unikBaru?: boolean }> {
  if (!adaKunciServer()) return { dicatat: false };
  if (adalahBot(masukan.ua)) return { dicatat: false };
  const jalur = normalisasiJalur(masukan.jalur);
  if (!jalur) return { dicatat: false };

  const tanggal = tanggalWIB(new Date());
  const sidik = sidikHarian(tanggal, masukan.ip || "0.0.0.0", masukan.ua);
  const sumber = sumberDariPerujuk(masukan.perujuk ?? "");
  const hp = adalahPerangkatHp(masukan.ua);

  const unikBaru = await rest("rpc/catat_kunjungan", {
    method: "POST",
    body: JSON.stringify({
      p_tanggal: tanggal,
      p_sidik: sidik,
      p_jalur: jalur,
      p_sumber: sumber,
      p_hp: hp,
    }),
  });
  return { dicatat: true, unikBaru: Boolean(unikBaru) };
}

/** Angka ringkas publik untuk ditampilkan di footer situs (hari ini & total). */
export async function ringkasanKunjunganPublik(sekarang = new Date()): Promise<{ hariIni: number; total: number }> {
  if (!adaKunciServer()) return { hariIni: 0, total: 0 };
  const hariIniTgl = tanggalWIB(sekarang);
  const baris = (await rest("kunjungan_harian?select=tanggal,pengunjung_unik&order=tanggal.desc&limit=3650")) as Pick<
    BarisHarian,
    "tanggal" | "pengunjung_unik"
  >[];
  let hariIni = 0;
  let total = 0;
  for (const b of baris) {
    const u = Number(b.pengunjung_unik) || 0;
    total += u;
    if (b.tanggal === hariIniTgl) hariIni = u;
  }
  return { hariIni, total };
}

/** Statistik lengkap untuk Beranda Admin Web & APK. */
export async function ringkasanKunjunganAdmin(sekarang = new Date()): Promise<RingkasanPengunjung | null> {
  if (!adaKunciServer()) return null;
  const tglHariIni = tanggalWIB(sekarang);
  const tglPekan = geserHariWIB(sekarang, -6);
  const tglBulan = geserHariWIB(sekarang, -29);

  const [harian, detail] = await Promise.all([
    rest("kunjungan_harian?select=tanggal,pengunjung_unik,tayangan,perangkat_hp,perangkat_desktop&order=tanggal.desc&limit=3650") as Promise<BarisHarian[]>,
    rest(`kunjungan_detail?select=jalur,sumber,tayangan&tanggal=gte.${tglBulan}&limit=1000`) as Promise<BarisDetail[]>,
  ]);

  let hariIniUnik = 0, hariIniTayangan = 0;
  let pekanUnik = 0, pekanTayangan = 0;
  let bulanUnik = 0, bulanTayangan = 0;
  let totalUnik = 0, totalTayangan = 0;
  let hp30 = 0, desk30 = 0;

  for (const b of harian) {
    const u = Number(b.pengunjung_unik) || 0;
    const t = Number(b.tayangan) || 0;
    totalUnik += u;
    totalTayangan += t;
    if (b.tanggal >= tglBulan) {
      bulanUnik += u;
      bulanTayangan += t;
      hp30 += Number(b.perangkat_hp) || 0;
      desk30 += Number(b.perangkat_desktop) || 0;
    }
    if (b.tanggal >= tglPekan) {
      pekanUnik += u;
      pekanTayangan += t;
    }
    if (b.tanggal === tglHariIni) {
      hariIniUnik = u;
      hariIniTayangan = t;
    }
  }

  const petaJalur = new Map<string, number>();
  const petaSumber = new Map<string, number>();
  for (const d of detail) {
    const t = Number(d.tayangan) || 0;
    petaJalur.set(d.jalur, (petaJalur.get(d.jalur) ?? 0) + t);
    petaSumber.set(d.sumber, (petaSumber.get(d.sumber) ?? 0) + t);
  }

  const halamanTeratas = [...petaJalur.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([jalur, tayangan]) => ({ jalur, tayangan }));

  const sumberTeratas = [...petaSumber.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sumber, tayangan]) => ({ sumber, tayangan }));

  const totalPerangkat = hp30 + desk30;
  const persenHp = totalPerangkat > 0 ? Math.round((hp30 / totalPerangkat) * 100) : 0;

  return {
    hariIniUnik,
    hariIniTayangan,
    pekanUnik,
    pekanTayangan,
    bulanUnik,
    bulanTayangan,
    totalUnik,
    totalTayangan,
    persenHp,
    halamanTeratas,
    sumberTeratas,
  };
}
