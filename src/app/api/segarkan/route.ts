import { revalidateTag } from "next/cache";
import { permintaanDariAdmin } from "@/lib/admin-server";
import { TAG_KONTEN } from "@/lib/konten";

// Dipanggil panel admin setelah menyimpan: buang cache isi situs supaya perubahan langsung tayang.
export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  revalidateTag(TAG_KONTEN, { expire: 0 });
  return Response.json({ ok: true });
}
