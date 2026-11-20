import { permintaanDariAdmin } from "@/lib/admin-server";
import { ambilKonten } from "@/lib/konten";
import { risetKonsepReels } from "@/lib/riset-reels";
import {
  FORMULA_VIRAL,
  JADWAL_OPTIMAL,
  statusWaktuSekarang,
} from "@/lib/riset-reels-murni";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const isi = (await req.json().catch(() => ({}))) as { merek?: string; produk?: string; topik?: string };
  try {
    const konten = await ambilKonten();
    const adalahLekKopi = isi.merek === "lekkopi" || isi.produk === "lek-kopi" || isi.produk === "lekkopi";
    const produk = adalahLekKopi
      ? {
          slug: "lekkopi",
          nama: "Lek Kopi",
          label: "Kedai Kopi & Nongkrong Waru",
          kategori: "sendiri" as const,
          judul: "Kedai Kopi Nyaman & Es Kopi Susu Gula Aren di Waru, Sidoarjo",
          ringkas: "Tempat nongkrong malam santai, kopi racikan barista, dan cemilan hangat.",
          deskripsi: "Lek Kopi menghadirkan suasana nongkrong hangat di Waru dengan menu andalan Es Kopi Susu Lek, latte art, kopi tubruk, dan cemilan sore/malam.",
          platform: ["Kedai Offline", "Instagram Reels"],
          fitur: [
            { judul: "Suasana Nyaman", isi: "Tempat nongkrong malam temaram dan santai bareng teman" },
            { judul: "Es Kopi Susu Lek", isi: "Racikan kopi susu gula aren creamy favorit pelanggan" },
            { judul: "Barista & Latte Art", isi: "Seduhan kopi segar dari biji pilihan tiap hari" },
          ],
          layarHp: [],
          layarDesktop: [],
        }
      : konten.produk.find((p) => p.slug === (isi.produk || "maktaba-pos"));
    if (!produk) return Response.json({ ok: false, pesan: "Produk tidak ditemukan." }, { status: 400 });

    const konsep = await risetKonsepReels(produk, isi.topik);

    // Ambil jam WIB saat ini (0-23)
    const jamWIB = Number(
      new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23" }).format(new Date()),
    );
    const statusJadwal = statusWaktuSekarang(jamWIB);

    return Response.json({
      ok: true,
      konsep,
      formula: FORMULA_VIRAL,
      jadwal: JADWAL_OPTIMAL,
      statusJadwal,
    });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal meriset konsep Reels." }, { status: 400 });
  }
}

export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const jamWIB = Number(
    new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23" }).format(new Date()),
  );
  return Response.json({
    ok: true,
    formula: FORMULA_VIRAL,
    jadwal: JADWAL_OPTIMAL,
    statusJadwal: statusWaktuSekarang(jamWIB),
  });
}
