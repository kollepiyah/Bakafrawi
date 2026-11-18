# Panduan Studio AI bakafrawi.com

Studio ada di **/admin → Studio AI**. Pilih produk + jenis (poster atau video), tekan **Buat**.
Mesinnya berjalan di **GitHub Actions** (repo `kollepiyah/Bakafrawi`, workflow *Studio AI*) — PC
tidak perlu menyala. Repo publik → menit Actions gratis.

- **Poster:** 3 ukuran (1:1 feed, 4:5 potret, 9:16 story) dengan tangkapan layar produk dalam bingkai HP.
- **Video:** robot membuka aplikasi di layar HP, menjalankan *Skenario rekaman* produk itu sambil
  merekam, lalu dirakit jadi video 9:16: kartu pembuka → rekaman dalam bingkai HP + subtitle →
  kartu penutup (WA & bakafrawi.com), dengan narasi suara AI (edge-tts, id-ID).
- **Naskah & caption** ditulis Claude (`claude-sonnet-5-5`, effort medium — sama dengan konten Lek Kopi). Tanpa kunci API, Studio memakai naskah
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

## Tayang ke Instagram & bot Telegram (gelombang 2)

Alur: Studio selesai → hasil dikirim ke **bot Telegram** dengan tombol **Tayangkan sekarang · Jadwal 19.00 ·
Buat ulang · Tolak** (tombol yang sama ada di admin → Studio AI) → mesin memposting ke Instagram
(poster: feed 4:5 + Story 9:16; video: Reels) → bot mengabari tautannya. **Tak ada yang tayang tanpa
persetujuan.** Dari Telegram juga bisa memesan: `/poster maktaba ai`, `/video maktaba`, `/status` — atau
**chat biasa** ("buatkan poster Maktaba untuk pemilik warung pakai latar AI", "kasih 5 ide konten", "ganti
caption yang terakhir jadi lebih santai"). Chat bebas memakai Claude Haiku 5.5 (± Rp10/pesan) dan butuh
`ANTHROPIC_API_KEY` di Vercel.

### Pasang (sekali)
1. Migrasi: `npx supabase db push` (tabel `studio_pengaturan`, kolom tayang).
2. **Bot Telegram baru:** Telegram → @BotFather → `/newbot` → nama "Bakafrawi Studio" → salin token.
   Buat dua kode acak (jalankan dua kali): `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
   — pertama = rahasia webhook, kedua = kode daftar.
3. **Vercel → Environment Variables** (jenis **Secret**, Production + Preview), lalu redeploy:
   - `SUPABASE_SERVICE_KEY` — service_role Supabase. Aman di sini karena **tanpa** awalan `NEXT_PUBLIC_`:
     hanya dibaca server, tak pernah dikirim ke browser.
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_KODE_DAFTAR`
4. **Rahasia GitHub** (Actions): `TELEGRAM_BOT_TOKEN` (sama), `GEMINI_API_KEY` (untuk latar AI; boleh kunci Lek Kopi).
5. Admin → Studio AI → **Sambungan** → *Sambungkan webhook bot*; lalu kirim `/start KODE-DAFTAR` ke bot.
6. **Instagram:** @bakafrawi.project harus akun **Profesional**. Di aplikasi Meta (boleh aplikasi Lek Kopi):
   Instagram → API setup with Instagram login → tambahkan @bakafrawi.project sebagai **Instagram Tester**
   (terima undangan di aplikasi Instagram) → *Generate token* di samping akun → tempel di
   admin → Studio AI → Sambungan → **Sambungkan**. Token ±60 hari, diperpanjang otomatis.

### Latar gambar AI
Centang **Latar gambar AI** saat membuat konten. Claude menulis 2 adegan suasana, model gambar Gemini
membuatnya (± Rp650/gambar; model dipilih otomatis, bisa dipaksa lewat rahasia `STUDIO_GEMINI_GAMBAR`).
Poster: foto jadi latar; video: kartu pembuka & penutup berlatar foto dan bergerak pelan (zoom).
Tanpa `GEMINI_API_KEY` → latar polos, dengan catatan di kartu tugas.

## Pemicu dari Supabase (gelombang 3)

Supabase memeriksa tiap 5 menit dan menyalakan mesin hanya bila ada kerja — jadwal 19.00 jadi tepat waktu.
1. `npx supabase db push` (migrasi `20261118200000_studio_andal.sql`).
2. Buat token GitHub *Fine-grained* (repo `Bakafrawi` saja, **Actions: Read and write**) — token yang sama
   boleh dipakai untuk `GITHUB_STUDIO_TOKEN` di Vercel.
3. Supabase → SQL Editor, jalankan sekali (ganti isinya dengan token):
   ```sql
   select vault.create_secret('github_pat_…', 'github_studio_token');
   ```
   Tanpa langkah ini semuanya tetap jalan lewat jadwal 30 menit GitHub, hanya lebih lambat.

**Latar gambar AI — Cloudflare (gratis) dulu.** Buat token di dash.cloudflare.com → Manage account →
Account API tokens → *Create Token* → *Custom token* → Permissions: **Account · Workers AI · Edit** saja
(jangan token berizin luas). Simpan di GitHub → Secrets → Actions: `CF_ACCOUNT_ID` (Account ID) dan
`CF_API_TOKEN`. Jatah gratis 10.000 Neuron/hari ≈ 60 gambar; habis → Gemini.

**Cadangan Gemini butuh billing Google.** Model gambar Gemini tidak punya kuota gratis (galat 429).
Buka aistudio.google.com → proyek pemilik `GEMINI_API_KEY` → *Set up billing*. Biaya ± Rp650/gambar.
