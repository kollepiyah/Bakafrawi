# Panduan Studio AI bakafrawi.com

Studio ada di **/admin → Studio AI**. Pilih produk + jenis (poster atau video), tekan **Buat**.
Mesinnya berjalan di **GitHub Actions** (repo `kollepiyah/Bakafrawi`, workflow *Studio AI*) — PC
tidak perlu menyala. Repo publik → menit Actions gratis.

- **Poster:** 3 ukuran (1:1 feed, 4:5 potret, 9:16 story) dengan tangkapan layar produk dalam bingkai HP.
- **Video:** robot membuka aplikasi di layar HP, menjalankan *Skenario rekaman* produk itu sambil
  merekam, lalu dirakit jadi video 9:16: kartu pembuka → rekaman dalam bingkai HP + subtitle →
  kartu penutup (WA & bakafrawi.com), dengan narasi suara AI (edge-tts, id-ID).
- **Naskah & caption** ditulis Claude (`claude-opus-5-5`). Tanpa kunci API, Studio memakai naskah
  templat dari data produk — tetap jadi, hanya kurang luwes.

## Pemasangan (sekali)

1. **Migrasi database** (tabel `studio_tugas` + bucket `studio`):
   ```
   npx supabase db push
   ```
2. **Rahasia GitHub** — github.com/kollepiyah/Bakafrawi → Settings → Secrets and variables → Actions:
   - `SUPABASE_URL` — sama dengan di Vercel
   - `SUPABASE_SERVICE_KEY` — Supabase → Settings → API → **service_role** (rahasia; hanya di sini, jangan di Vercel)
   - `ANTHROPIC_API_KEY` — kunci baru `bakafrawi-studio` dari console.anthropic.com (akun yang sama boleh)
   - Akun demo untuk rekaman, mis. `DEMO_WASEELA_SANDI` (dipakai di skenario sebagai `{{RAHASIA:WASEELA_SANDI}}`).
     Setiap rahasia demo juga harus didaftarkan satu baris di `env:` workflow `studio.yml`.
3. **Pemicu langsung (disarankan):** github.com → Settings → Developer settings → *Fine-grained tokens* →
   Repository access: hanya `Bakafrawi` → Permissions → **Actions: Read and write** → salin token →
   Vercel → Environment Variables → `GITHUB_STUDIO_TOKEN` (jenis **Secret**, Production + Preview) → redeploy.
   Tanpa token ini tugas tetap dikerjakan oleh jadwal 30 menit.

## Skenario rekaman

Di **Konten → Produk → Edit rincian → Skenario rekaman video**: alamat awal + langkah
(Klik tulisan tombol/menu, Ketik ke kolom, Gulir, Tunggu, Buka alamat). Pakai **akun demo berisi data
rekaan** — jangan pernah merekam data santri/pelanggan asli. Kosong = robot membuka tombol tautan
utama produk lalu menggulir pelan.

## Uji di laptop (tanpa database)

```
cd studio
npm install
npx playwright-core install ffmpeg
node studio.mjs --lokal contoh-tugas.json
```
Berkas `contoh-tugas.json` berisi `{ "tugas": {jenis, produk_slug, arahan}, "situs": <isi konten> }`;
hasil ada di `studio/keluaran/`.
