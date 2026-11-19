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
  const isi = (await req.json().catch(() => ({}))) as { produk?: string; topik?: string };
  try {
    if (isi.produk === "lek-kopi") {
      return Response.json(
        { ok: false, pesan: "Riset Reels AI saat ini difokuskan untuk produk resmi Bakafrawi (Maktaba POS, Ammu Online, Waseela)." },
        { status: 400 },
      );
    }
    const konten = await ambilKonten();
    const produk = konten.produk.find((p) => p.slug === (isi.produk || "maktaba-pos"));
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
