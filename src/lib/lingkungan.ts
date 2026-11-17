// Konfigurasi dibaca di satu tempat supaya aturan "kapan pakai Supabase / mode uji lokal" tak tercecer.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const adaSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON);

/**
 * Mode uji lokal: panel admin menyimpan ke berkas `.data/` tanpa login, untuk mencoba di laptop
 * sebelum proyek Supabase ada. Hanya hidup di `next dev` DAN bila diminta eksplisit — tak mungkin
 * aktif di Vercel (build produksi selalu NODE_ENV=production).
 */
export const modeLokal = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ADMIN_MODE_LOKAL === "1";
