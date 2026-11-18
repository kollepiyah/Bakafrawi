import { SUPABASE_ANON, SUPABASE_URL } from "@/lib/lingkungan";

// Konfigurasi publik untuk APK Bakafrawi Studio: URL Supabase & kunci anon (keduanya memang publik,
// sudah ada di JavaScript panel admin). APK cukup menanam alamat situs; ganti proyek tak perlu build ulang.
export function GET() {
  return Response.json({ ok: Boolean(SUPABASE_URL && SUPABASE_ANON), supabaseUrl: SUPABASE_URL, supabaseAnon: SUPABASE_ANON });
}
