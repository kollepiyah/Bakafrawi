import { revalidateTag } from "next/cache";
import { skemaSitus } from "@/content/skema";
import { TAG_KONTEN } from "@/lib/konten";
import { modeLokal } from "@/lib/lingkungan";

// Pengganti Supabase khusus mode uji lokal (next dev + NEXT_PUBLIC_ADMIN_MODE_LOKAL=1). Di luar itu 404.
const tidakAda = () => new Response("Not found", { status: 404 });

export async function GET() {
  if (!modeLokal) return tidakAda();
  const { bacaKontenLokal } = await import("@/lib/penyimpanan-lokal");
  return Response.json({ data: await bacaKontenLokal() });
}

export async function PUT(req: Request) {
  if (!modeLokal) return tidakAda();
  const hasil = skemaSitus.safeParse(await req.json());
  if (!hasil.success) return Response.json({ ok: false, masalah: hasil.error.issues }, { status: 400 });
  const { tulisKontenLokal } = await import("@/lib/penyimpanan-lokal");
  await tulisKontenLokal(hasil.data);
  revalidateTag(TAG_KONTEN, { expire: 0 });
  return Response.json({ ok: true });
}

export async function POST(req: Request) {
  if (!modeLokal) return tidakAda();
  const form = await req.formData();
  const berkas = form.get("berkas");
  if (!(berkas instanceof File)) return Response.json({ ok: false }, { status: 400 });
  const { simpanMediaLokal } = await import("@/lib/penyimpanan-lokal");
  return Response.json({ ok: true, url: await simpanMediaLokal(berkas.name, await berkas.arrayBuffer()) });
}
