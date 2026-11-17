# CHANGELOG — bakafrawi.com

## Tahap 1 — Pindah ke Next.js (18 Nov 2026, branch `situs-nextjs`, belum tayang)

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
