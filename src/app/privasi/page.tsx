import type { Metadata } from "next";
import Link from "next/link";
import { situsBawaan } from "@/content/situs";

// Kebijakan privasi bakafrawi.com — juga syarat layar izin Google (Google Calendar) dan Meta (Instagram/Facebook) untuk Bakafrawi Studio.
export const metadata: Metadata = { title: "Kebijakan Privasi", alternates: { canonical: "/privasi" } };

const BERLAKU = "22 November 2026";

export default function Privasi() {
  const { email } = situsBawaan.kontak;
  return (
    <main className="wadah max-w-3xl py-16 text-[15px] leading-relaxed text-muted-foreground [&_h2]:mb-2 [&_h2]:mt-10 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:text-foreground [&_li]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5">
      <Link href="/" className="text-sm text-emas hover:underline">← bakafrawi.com</Link>
      <h1 className="mt-6 font-heading text-3xl text-foreground sm:text-4xl">Kebijakan Privasi</h1>
      <p className="mt-2 text-sm">Berlaku sejak {BERLAKU}. Pengelola: Bakafrawi Project, Sidoarjo — {email}.</p>

      <h2>Pengunjung situs</h2>
      <ul>
        <li>Situs ini tidak meminta akun dan tidak memasang cookie iklan.</li>
        <li>Statistik pengunjung memakai Google Analytics: hanya jumlah kunjungan, halaman, dan perangkat secara umum, tanpa identitas pribadi.</li>
        <li>Formulir kontak (nama, email, nomor WhatsApp, pesan) diteruskan ke email kami lewat layanan Web3Forms, atau membuka WhatsApp Anda bila layanan itu tidak aktif. Isinya tidak disimpan di basis data situs dan hanya dipakai untuk membalas pertanyaan Anda.</li>
      </ul>

      <h2>Bakafrawi Studio dan Google Calendar</h2>
      <p>
        Bakafrawi Studio adalah alat internal pemilik Bakafrawi Project (panel di bakafrawi.com/admin dan aplikasi Android) yang
        hanya dipakai oleh pemiliknya sendiri. Bila pemilik menghubungkan Google Calendar, aplikasi meminta izin
        <code className="mx-1 text-foreground">calendar.events</code> dan email akun Google untuk:
      </p>
      <ul>
        <li>menampilkan acara kalender di menu Agenda, aplikasi Android, dan bot Telegram pribadi pemilik;</li>
        <li>menambah, mengubah, atau menghapus acara atas perintah pemilik;</li>
        <li>mengirim ringkasan agenda pagi dan pengingat 30 menit sebelum acara kepada pemilik.</li>
      </ul>
      <p className="mt-3">
        Salinan acara (judul, waktu, lokasi, catatan) disimpan di basis data Supabase milik Bakafrawi supaya bisa dibaca
        aplikasi; token akses Google hanya disimpan di server dan tidak pernah dikirim ke peramban. Data ini tidak dijual,
        tidak dibagikan ke pihak lain, tidak dipakai untuk iklan, dan tidak dipakai untuk melatih model AI. Saat pemilik
        meminta lewat bot Telegram, teks permintaan dan daftar acara yang relevan diproses oleh Claude (Anthropic) hanya untuk
        menjalankan permintaan itu.
      </p>
      <p className="mt-3">
        Penggunaan dan pemindahan informasi yang diterima dari Google API mematuhi{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener" className="text-emas hover:underline">
          Google API Services User Data Policy
        </a>
        , termasuk ketentuan Limited Use.
      </p>
      <p className="mt-3">
        Sambungan bisa diputus kapan saja lewat tombol <em>Putuskan</em> di menu Agenda atau di{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener" className="text-emas hover:underline">myaccount.google.com/permissions</a>.
        Salinan acara dihapus atas permintaan ke {email}.
      </p>

      <h2>Bakafrawi Studio dan Meta (Facebook &amp; Instagram)</h2>
      <p>
        Bakafrawi Studio juga dapat dihubungkan dengan akun Instagram profesional dan Halaman Facebook milik pengelola
        melalui Facebook Login for Business dan Meta Graph API untuk:
      </p>
      <ul>
        <li>mengenali ID dan nama pengguna akun Instagram bisnis yang terhubung;</li>
        <li>menerbitkan konten gambar dan video (Feed, Reels, dan Story) sesuai jadwal atau perintah pemilik;</li>
        <li>memperbarui token akses secara otomatis di server agar jadwal tayang berjalan lancar.</li>
      </ul>
      <p className="mt-3">
        Data yang disimpan di basis data Supabase milik Bakafrawi terbatas pada ID akun Instagram, nama pengguna, dan
        token akses. Token akses hanya disimpan di server dan tidak pernah dikirim ke peramban. Data ini tidak dijual,
        tidak dibagikan ke pihak lain, tidak dipakai untuk iklan, dan tidak dipakai untuk melatih model AI.
      </p>

      <h2 id="hapus-data">Petunjuk penghapusan data pengguna</h2>
      <p>
        Anda dapat mencabut izin dan menghapus seluruh data akun yang tersimpan di Bakafrawi Studio kapan saja melalui
        langkah berikut:
      </p>
      <ul>
        <li>
          <strong>Lewat panel Bakafrawi Studio:</strong> buka menu <em>Studio → Sambungan</em> (untuk Instagram/Meta) atau
          menu <em>Agenda</em> (untuk Google Calendar), lalu klik tombol <em>Putuskan</em>. Kredensial dan token akses
          langsung dihapus dari basis data server kami.
        </li>
        <li>
          <strong>Lewat pengaturan Facebook (Meta):</strong> buka{" "}
          <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noopener" className="text-emas hover:underline">
            Pengaturan Integrasi Bisnis Facebook
          </a>
          , pilih <strong>Bakafrawi Studio</strong>, lalu klik <em>Hapus</em> untuk mencabut akses aplikasi.
        </li>
        <li>
          <strong>Permintaan penghapusan penuh lewat email:</strong> kirim email ke {email} dengan subjek{" "}
          <em>Permintaan Penghapusan Data</em> dan sebutkan nama akun terkait. Seluruh data yang tersisa akan kami
          hapus maksimal dalam 7 hari kerja dan kami kirimkan konfirmasi balasannya.
        </li>
      </ul>

      <h2>Aplikasi produk Bakafrawi</h2>
      <p>Aplikasi seperti Maktaba POS memiliki kebijakan privasinya sendiri yang tercantum di halaman aplikasi tersebut.</p>

      <h2>Kontak</h2>
      <p>Pertanyaan tentang privasi: {email}.</p>
    </main>
  );
}
