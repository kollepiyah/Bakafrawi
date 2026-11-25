// Fungsi murni kalender konten Studio (tanpa server-only / alias) agar dapat diuji langsung oleh node --test.

export const NAMA_HARI_KALENDER = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;

export const NAMA_BULAN_INDONESIA = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export type StatusVisualKalender = "tayang" | "terjadwal" | "proses" | "cek" | "gagal";

export type SelKalenderBulan = {
  tanggal: string; // YYYY-MM-DD (WIB)
  hari: number;
  dalamBulan: boolean;
  hariIni: boolean;
};

/** Konversi stempel waktu ke kunci tanggal YYYY-MM-DD zona WIB (+07:00). */
export function tanggalKunciWib(masukan: string | Date): string {
  const d = masukan instanceof Date ? masukan : new Date(masukan);
  if (Number.isNaN(d.getTime())) return "";
  const wib = new Date(d.getTime() + 7 * 3600_000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const h = String(wib.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${h}`;
}

/** Tahun dan bulan (1..12) saat ini di zona WIB. */
export function bulanSekarangWib(sekarang: Date = new Date()): { tahun: number; bulan: number } {
  const wib = new Date(sekarang.getTime() + 7 * 3600_000);
  return { tahun: wib.getUTCFullYear(), bulan: wib.getUTCMonth() + 1 };
}

/** Bangun grid kalender bulanan dimulai Senin (sel kelipatan 7: 28/35/42 sel). */
export function bangunGridBulan(
  tahun: number,
  bulan: number,
  hariIniIso?: string,
): SelKalenderBulan[] {
  const kunciHariIni = tanggalKunciWib(hariIniIso ?? new Date());
  const awalUtc = new Date(Date.UTC(tahun, bulan - 1, 1));
  // getUTCDay(): 0 = Minggu, 1 = Senin .. 6 = Sabtu → geser agar Senin = 0 .. Minggu = 6
  const indeksSenin = (awalUtc.getUTCDay() + 6) % 7;
  const jumlahHariBulan = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  const totalSel = Math.ceil((indeksSenin + jumlahHariBulan) / 7) * 7;

  const sel: SelKalenderBulan[] = [];
  for (let i = 0; i < totalSel; i++) {
    const tglUtc = new Date(Date.UTC(tahun, bulan - 1, 1 - indeksSenin + i));
    const y = tglUtc.getUTCFullYear();
    const m = tglUtc.getUTCMonth() + 1;
    const h = tglUtc.getUTCDate();
    const kunci = `${y}-${String(m).padStart(2, "0")}-${String(h).padStart(2, "0")}`;
    sel.push({
      tanggal: kunci,
      hari: h,
      dalamBulan: y === tahun && m === bulan,
      hariIni: kunci === kunciHariIni,
    });
  }
  return sel;
}

/** Peta status render/tayang ke kategori warna kalender. */
export function statusVisualTugas(t: {
  status: string;
  status_tayang: string;
}): StatusVisualKalender {
  if (t.status === "gagal" || t.status_tayang === "gagal") return "gagal";
  if (t.status_tayang === "tayang") return "tayang";
  if (t.status_tayang === "dijadwalkan" || t.status_tayang === "antre") return "terjadwal";
  if (
    (t.status === "naskah" && !t.status_tayang) ||
    t.status === "antre" ||
    t.status === "proses" ||
    t.status_tayang === "proses"
  ) {
    return "proses";
  }
  return "cek";
}

/** Kelompokkan daftar tugas menurut tanggal WIB (jadwal → waktu tayang → dibuat). */
export function kelompokkanTugasKalender<
  T extends {
    id: string;
    dibuat: string;
    jadwal_tayang?: string | null;
    tayang?: { waktu?: string } | null;
  },
>(daftar: T[]): Record<string, T[]> {
  const peta: Record<string, T[]> = {};
  for (const item of daftar) {
    const sumberTanggal = item.jadwal_tayang || item.tayang?.waktu || item.dibuat;
    const kunci = tanggalKunciWib(sumberTanggal);
    if (!kunci) continue;
    if (!peta[kunci]) peta[kunci] = [];
    peta[kunci].push(item);
  }
  return peta;
}
