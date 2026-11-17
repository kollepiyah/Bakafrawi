# Panduan Panel Admin bakafrawi.com

Panel admin ada di **bakafrawi.com/admin**. Semua teks, produk, gambar, kontak, dan media sosial
bisa diubah dari sana tanpa coding. Setelah **Simpan**, situs langsung berubah.

## Pemasangan (sekali saja)

1. **Buat proyek Supabase** baru bernama `bakafrawi` (region Singapore) di supabase.com.
2. **Jalankan migrasi** dari folder ini:
   ```
   npx supabase link --project-ref <REF-PROYEK>
   npx supabase db push
   ```
3. **Buat akun admin:** Supabase → Authentication → Users → *Add user* → email & kata sandi
   (centang *Auto Confirm User*). Lalu di **SQL Editor**:
   ```sql
   insert into public.admin (user_id) select id from auth.users where email = 'kollepiyah@gmail.com';
   ```
4. **Matikan pendaftaran umum:** Authentication → Sign In / Providers → matikan *Allow new users to sign up*.
5. **Sambungkan ke Vercel:** Vercel → proyek `bakafrawi` → Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL (Supabase → Settings → API)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = kunci *anon / publishable*
   - (opsional) `NEXT_PUBLIC_WEB3FORMS_KEY` = kunci Web3Forms untuk formulir kontak

   Lalu deploy ulang.
6. Buka **/admin**, masuk, dan tekan **Simpan** sekali untuk memindahkan isi bawaan ke database.

## Catatan

- Sebelum database terisi, situs menampilkan isi bawaan dari `src/content/situs.ts`. Bila
  database tak terjangkau atau isinya rusak, situs juga kembali ke isi bawaan — tak pernah kosong.
- Setiap simpan mengarsipkan versi sebelumnya di tabel `konten_riwayat` (bisa dipulihkan lewat SQL).
- Gambar maksimal 5 MB (PNG/JPG/WebP/SVG), disimpan di Supabase Storage bucket `media`.
- **Mode uji lokal** (tanpa Supabase, untuk mencoba di laptop): buat `.env.development.local` berisi
  `NEXT_PUBLIC_ADMIN_MODE_LOKAL=1`, lalu `npm run dev`. Data tersimpan di `.data/` dan tidak pernah
  menyentuh database. Mode ini mustahil aktif di Vercel.
