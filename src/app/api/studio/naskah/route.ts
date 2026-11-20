import { after } from "next/server";
import { permintaanDariAdmin } from "@/lib/admin-server";
import { isiNaskah, pesanNaskah, putuskanNaskah } from "@/lib/studio-naskah";

export const maxDuration = 120;

// Alur naskah merek bank media (Lek Kopi) dari layar Konten. Penulisan naskah (±30–60 dtk Claude)
// dikerjakan sesudah respons dikirim; hasilnya muncul di daftar dan di bot Telegram.
type Isi = {
  aksi?: "buat" | "setujui" | "tolak" | "revisi";
  id?: string;
  merek?: string;
  permintaan?: string;
  catatan?: string;
  jadwal_tayang?: string | null;
  sasaran?: string | null;
};

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  const isi = (await req.json()) as Isi;
  try {
    if (isi.aksi === "buat") {
      const { id, merek } = await pesanNaskah({
        merek: isi.merek ?? "",
        permintaan: isi.permintaan ?? "",
        jadwal_tayang: isi.jadwal_tayang,
        sasaran: isi.sasaran,
      });
      after(() => isiNaskah(id).catch((e) => console.error("Naskah:", e)));
      return Response.json({ ok: true, id, pesan: `Naskah ${merek.nama} sedang ditulis (±1 menit). Hasilnya muncul di sini dan di bot Telegram.` });
    }
    if ((isi.aksi === "setujui" || isi.aksi === "tolak") && isi.id) {
      const { dipicu } = await putuskanNaskah(isi.id, isi.aksi);
      return Response.json({
        ok: true,
        pesan: isi.aksi === "tolak" ? "Naskah ditolak." : `Naskah disetujui — video dibuat ${dipicu ? "sekarang (±5–10 menit)" : "pada putaran mesin berikutnya"}.`,
      });
    }
    if (isi.aksi === "revisi" && isi.id && isi.catatan?.trim()) {
      const id = isi.id;
      const catatan = isi.catatan.trim();
      after(() => isiNaskah(id, catatan).catch((e) => console.error("Revisi naskah:", e)));
      return Response.json({ ok: true, pesan: "Naskah sedang direvisi (±1 menit)." });
    }
    return Response.json({ ok: false, pesan: "Aksi tidak dikenal." }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, pesan: e instanceof Error ? e.message : "Gagal." }, { status: 400 });
  }
}
