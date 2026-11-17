import { cacheLife } from "next/cache";

// Harga dibaca langsung dari database Maktaba POS (tabel `plans`, terbuka untuk publik lewat
// kunci anon yang memang sudah tertanam di web Maktaba) — supaya harga di bakafrawi.com tak
// pernah berbeda dari harga di aplikasinya.
const MAKTABA_URL = "https://zxwjirxgijdrvysdaipb.supabase.co";
const MAKTABA_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4d2ppcnhnaWpkcnZ5c2RhaXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MDY1MDMsImV4cCI6MjEwMDk4MjUwM30.IbswdRwwoocvVCpDZRIPlPKehE0q3vt5Ep3NmOqNWyI";

// Label fitur berbayar — salinan dari Maktaba POS `src/utils/fiturPaket.js` (FITUR). Kunci yang
// tak dikenal di sini tetap tampil apa adanya, jadi fitur baru di Maktaba tidak hilang diam-diam.
const LABEL_FITUR: Record<string, string> = {
  buku_kas: "Buku Kas",
  hutang_piutang: "Hutang, Piutang & Bon Pelanggan",
  bahan_hpp: "Bahan Baku, Resep & HPP",
  ekspor: "Ekspor Excel & PDF",
  absensi_gaji: "Absensi & Gaji",
  telegram: "Notifikasi Telegram",
  audit_log: "Log Aktivitas",
};

export type PaketMaktaba = {
  nama: string;
  bulanan: number;
  tahunan: number;
  trialHari: number;
  poin: string[];
};

type BarisPlan = {
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_employees: number;
  max_products: number;
  trial_days: number;
  fitur: string[] | null;
  features: string[] | null;
};

export async function ambilPaketMaktaba(): Promise<PaketMaktaba[]> {
  "use cache";
  cacheLife("hours");
  try {
    const res = await fetch(
      `${MAKTABA_URL}/rest/v1/plans?select=name,price_monthly,price_yearly,max_employees,max_products,trial_days,fitur,features&is_active=eq.true&order=sort_order`,
      { headers: { apikey: MAKTABA_ANON, Authorization: `Bearer ${MAKTABA_ANON}` } },
    );
    if (!res.ok) return [];
    const baris = (await res.json()) as BarisPlan[];
    return baris.map((p) => ({
      nama: p.name,
      bulanan: Number(p.price_monthly) || 0,
      tahunan: Number(p.price_yearly) || 0,
      trialHari: Number(p.trial_days) || 0,
      poin: [
        `${p.max_employees} akun kasir`,
        p.max_products >= 100000 ? "Produk tanpa batas" : `${p.max_products} produk aktif`,
        "Kasir, struk, printer, stok & laporan",
        ...(p.fitur ?? []).map((k) => LABEL_FITUR[k] ?? k),
        ...(p.features ?? []),
      ],
    }));
  } catch {
    // Database Maktaba tak terjangkau → bagian harga disembunyikan, halaman tetap tayang.
    return [];
  }
}

export const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");
