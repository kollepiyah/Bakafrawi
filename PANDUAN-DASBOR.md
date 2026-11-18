# Panduan Dasbor Aplikasi (Bakafrawi Studio tahap 2)

Menu **Aplikasi** (dan kartu "Aplikasi" di Beranda, juga lewat bot: "ada pembayaran Maktaba yang
menunggu?", "omzet Lek Kopi hari ini?") menampilkan ringkasan tiap aplikasi dari **pintu baca-saja**
`pintu-bakafrawi` di Supabase masing-masing. Angka disimpan ±5 menit supaya tak memanggil semua proyek
tiap kali dibuka.

| Aplikasi | Isi | Repo |
|---|---|---|
| Maktaba POS | toko per status, toko baru, langganan habis ≤7 hari, pembayaran menunggu konfirmasi, pendapatan bulan ini, MRR, transaksi 24 jam | `Maktaba POS` |
| Lek Kopi | omzet/transaksi/cup hari ini vs kemarin, terlaris, kas, bon & hutang, bahan menipis | `Lek Kopi App` (`?jenis=dasbor`) |
| Ammu Online, Waseela | **teknis saja** (data lembaga klien): akun, aktif 24 jam/7 hari, aktivitas, ukuran database | `Ammu`, `Waseela` |
| Fastabiqu | ditunda — masih Firebase | — |

Semua kartu juga memperingatkan bila database ≥ 400 MB (batas paket gratis Supabase 500 MB).

## Pasang (sekali)

Pakai **satu kode rahasia yang sama** dengan pintu Lek Kopi (`LEKKOPI_PINTU_RAHASIA` di Vercel) — tidak
perlu env baru di Vercel. Untuk tiap proyek di bawah, jalankan dari folder repo-nya (ganti KODE dengan kode
yang sama itu):

```bash
cd "D:/Aplikasi Project/Maktaba POS"
npx supabase secrets set PINTU_BAKAFRAWI_RAHASIA=KODE
npx supabase functions deploy pintu-bakafrawi --no-verify-jwt
```
Ulangi untuk `Ammu` dan `Waseela`. Untuk `Lek Kopi App` cukup deploy ulang (rahasianya sudah ada):
```bash
cd "D:/Aplikasi Project/Lek Kopi App"
npx supabase functions deploy pintu-bakafrawi --no-verify-jwt
```

Kartu yang belum tersambung menyebut sebabnya: "belum di-deploy" (404), "kode rahasia beda" (403).
Bila kelak ingin kode terpisah dari Lek Kopi, isi `PINTU_RAHASIA` di Vercel (didahulukan).
