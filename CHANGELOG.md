# CHANGELOG — bakafrawi.com

## Tahap 3, gelombang 3 — Studio lebih andal (belum tayang)

- **Tugas tak lagi tersangkut.** Bila mesin mati di tengah jalan (batas 30 menit / galat GitHub), konten
  yang masih "sedang dibuat" lebih dari 35 menit ditandai gagal (bisa *Buat ulang*), dan yang terputus saat
  tayang ditandai gagal tayang dengan pesan "cek Instagram dulu" — sengaja tidak diulang otomatis supaya
  tak ada posting ganda. Bot mengabari bila ada yang dipulihkan (`studio_pulihkan`).
- **Pemicu dari Supabase.** pg_cron tiap 5 menit (`studio_picu`) menyalakan mesin GitHub hanya bila ada
  kerja: tugas antre, tayang yang jadwalnya tiba, tugas macet, atau token Instagram yang perlu diperpanjang.
  Jadwal 19.00 kini tayang ±19.05–19.10, bukan menunggu cron GitHub yang sering telat dan dimatikan GitHub
  bila repo 60 hari tanpa commit. Butuh token GitHub di Vault (`PANDUAN-STUDIO.md`); tanpa token, cadangan
  jadwal 30 menit GitHub tetap jalan.
- **Putaran cepat.** Workflow memeriksa `studio_ada_kerja()` dulu; tanpa kerja ia selesai dalam detik tanpa
  memasang apa pun. Paket ffmpeg disimpan di cache per versi image runner (18 Nov pemasangan via apt sempat
  8,5 menit).
- **Latar AI berhenti mencoba saat kuota Gemini 0/habis (429)** dan menulis sebabnya di kartu tugas. Uji
  18 Nov: poster berlatar AI gagal 429 karena model gambar Gemini butuh **billing aktif** di Google AI Studio.
- Migrasi `20261118200000_studio_andal.sql` (pg_cron, pg_net).

## Tahap 3, gelombang 2 — Instagram, bot Telegram, latar AI (tayang 18 Nov 2026)

- **Persetujuan & tayang:** hasil Studio dikirim ke bot Telegram bertombol (Tayangkan sekarang · Jadwal
  19.00 WIB · Buat ulang · Tolak); tombol sama di admin. Mesin memposting ke Instagram — poster: feed 4:5 +
  Story, video: Reels — lalu mengabari tautannya. Postingan diambil atomik (`studio_ambil_tayang`) dan status
  `proses/tayang` tak bisa diubah lagi → tak ada posting ganda.
- **Bot Telegram** (`/api/telegram`, webhook dengan kode rahasia; hanya pemilik terdaftar `/start KODE`):
  `/poster <produk> [ai]`, `/video <produk> [ai]`, `/status`. Aturan murni di `src/lib/bot-murni.ts` + tes.
- **Chat bebas di bot** (`src/lib/bot-ai.ts`): Claude Haiku 5.5 effort rendah seperti bot Lek Kopi; bisa
  memesan konten, melihat daftar, mengganti caption, dan menayangkan/menjadwalkan lewat alat yang memakai
  aturan yang sama dengan admin. Ingatan 10 giliran terakhir (`studio_pengaturan.bot_riwayat`, migrasi
  `20261118180000`). Dijawab lewat `after()` supaya Telegram tak menunggu. Butuh `ANTHROPIC_API_KEY` di Vercel.
- **Sambungan** di admin → Studio AI: tempel token Instagram (3 jenis token seperti Lek Kopi; token tak pernah
  dikirim balik ke browser), sambungkan webhook bot. Token IG diperpanjang otomatis.
- **Latar gambar AI** (Gemini, model dipilih otomatis): poster berlatar foto suasana; video dengan kartu
  pembuka/penutup berlatar foto. Kartu pembuka & penutup kini bergerak pelan (zoom) di semua video.
- Poster kini JPEG (syarat Instagram). Naskah memakai `claude-sonnet-5-5` medium seperti Lek Kopi.
- Migrasi `20261118150000_studio_tayang.sql`. Panduan: `PANDUAN-STUDIO.md`.

## Tahap 3 — Studio AI (tayang 18 Nov 2026)

- **/admin → Studio AI**: buat poster (1:1, 4:5, 9:16) atau video Reels/TikTok per produk, dengan
  arahan opsional; riwayat bergambar, unduh, salin caption, hapus.
- Mesin di `studio/` dijalankan **GitHub Actions** (`.github/workflows/studio.yml`) — dipicu
  `/api/studio/jalankan` (token GitHub opsional) + jadwal 30 menit. Tugas diambil atomik
  (`studio_ambil_tugas`), hasil ke bucket publik `studio`.
- Naskah oleh Claude (`claude-opus-5-5`, keluaran JSON tervalidasi zod); tanpa kunci → naskah templat.
- Video: rekaman aplikasi di layar HP (Playwright) mengikuti **Skenario rekaman** per produk (baru di
  editor produk; kata sandi demo lewat `{{RAHASIA:NAMA}}` → rahasia GitHub), narasi edge-tts,
  subtitle, kartu pembuka/penutup, dirakit ffmpeg 1080×1920.
- Migrasi `20261118120000_studio.sql`. Panduan: `PANDUAN-STUDIO.md`.

## Tahap 2 — Panel admin tanpa coding (tayang 18 Nov 2026)

- **/admin**: login (Supabase Auth, email + kata sandi, lupa sandi), lalu editor bertab
  Umum · Layanan · Produk · Proses & Tentang · Kontak. Produk bisa ditambah, dihapus, diurutkan,
  disembunyikan, diberi logo & tangkapan layar (unggah gambar ke Supabase Storage).
- Bentuk isi didefinisikan sekali di `src/content/skema.ts` (zod): tipe TypeScript diturunkan
  darinya dan isi divalidasi sebelum disimpan — mis. nomor WA cukup diketik biasa, tautan wa.me
  dibentuk otomatis.
- Situs membaca isi dari tabel `konten` (cache + tag); setelah simpan, `/api/segarkan` (hanya
  admin, diperiksa via `is_admin()` di database) membuang cache sehingga perubahan langsung tayang.
  Database kosong/mati/isi rusak → kembali ke isi bawaan.
- Migrasi `20261118090000_konten_admin.sql`: tabel `admin`, `konten`, `konten_riwayat` (arsip
  otomatis tiap ubah), RLS, bucket `media`.
- **Mode uji lokal** untuk mencoba panel tanpa database (hanya `next dev`).
- Langkah pemasangan: `PANDUAN-ADMIN.md`.

## Tahap 1 — Pindah ke Next.js (tayang 18 Nov 2026)

- Situs satu berkas `index.html` diganti **Next.js 16 + Tailwind 4 + shadcn/ui + Motion**.
  Tampilan gelap-emas dipertahankan. Deploy tetap Vercel; `vercel.json` memaksa preset
  `nextjs` karena proyek Vercel lama dibuat sebagai situs statis.
- **Seluruh isi situs pindah ke satu sumber**: `src/content/situs.ts`. Bentuknya disiapkan
  untuk dipindah ke Supabase di Tahap 2 (panel admin).
- **Susunan produk baru:**
  - *Aplikasi siap pakai*: Maktaba POS (SaaS) dan Fastabiqu.
  - *Karya pesanan* (milik lembaga/klien, bukan SaaS): Ammu Online, Waseela, Lek Kopi POS.
    Kata "SaaS/white-label" pada Waseela dihapus.
  - Layanan pembuatan custom tetap ditonjolkan; tombol utama jadi "Konsultasi Gratis".
- **Diperbaiki dari situs lama:**
  - Penghitung kunjungan (countapi.xyz, layanannya sudah mati → selalu menampilkan "125+")
    dan "Pengunjung Live" (sebenarnya hanya negara si pembaca) dihapus. Diganti tautan ke
    statistik publik Umami.
  - Skrip Umami sebelumnya dimuat dua kali (kunjungan bisa tercatat ganda) → kini sekali.
  - Font Awesome (CDN ±100 KB) tak dipakai lagi; ikon dari lucide + SVG merek sendiri.
  - Menghormati `prefers-reduced-motion`, gambar memakai `next/image`, ada `robots.txt` &
    `sitemap.xml`.
- Formulir kontak: kirim via Web3Forms bila `NEXT_PUBLIC_WEB3FORMS_KEY` diisi di Vercel;
  bila kosong otomatis membuka WhatsApp berisi pesan pengunjung.
- Bahan mentah (`assets/_raw`, logo asli, `index.html` lama) dipindah ke `_bahan/`.
- **Revisi Kyai (gelombang 2):** WA jadi 0878-9266-3748; Fastabiqu disembunyikan sementara;
  klien Waseela = Damu Foundation, Lombok; pengalaman 2+ tahun; Maktaba diberi label
  "segera di Google Play" (masih uji tertutup).
- **Harga paket Maktaba POS** tampil di bawah kartunya, dibaca langsung dari tabel `plans`
  database Maktaba (kunci anon publik, cache per jam) — harga tak perlu disalin manual dan
  otomatis ikut bila diubah di Maktaba. Bila database tak terjangkau, bagian harga
  disembunyikan.
