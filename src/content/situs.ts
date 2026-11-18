// Isi bawaan situs. Dipakai sebagai isi awal database (seed) dan cadangan bila database belum
// tersambung / tak terjangkau. Setelah panel admin aktif, sumber utama ada di tabel `konten`.
import type { Gambar, KategoriProduk, Situs } from "./skema";

export type { Gambar, KategoriProduk, Layanan, Produk, Situs, Tautan } from "./skema";

const hp = (src: string, alt: string, keterangan: string): Gambar => ({ src, alt, lebar: 540, tinggi: 1140, keterangan });

export const situsBawaan: Situs = {
  nama: "Bakafrawi",
  tagline: "Software Developer",
  deskripsi:
    "Bakafrawi Project membangun website, aplikasi, dan sistem manajemen yang rapi, cepat, dan andal — juga menyediakan aplikasi siap pakai seperti Maktaba POS.",
  urlSitus: "https://bakafrawi.com",
  statusProyek: "Menerima proyek baru",
  hero: {
    label: "Software Developer",
    judul: "Ubah ide jadi produk digital yang",
    sorot: ["rapi", "andal"],
    isi: "Bakafrawi Project membantu bisnis dan lembaga membangun website, aplikasi, dan sistem manajemen sesuai pesanan — dan menyediakan aplikasi siap pakai yang bisa langsung Anda langgani.",
  },
  statistik: [
    { angka: "2+", label: "Tahun pengalaman" },
    { angka: "30+", label: "Proyek selesai" },
    { angka: "15+", label: "Klien puas" },
    { angka: "100%", label: "Komitmen kualitas" },
  ],
  layanan: [
    {
      ikon: "web",
      judul: "Website & Landing Page",
      isi: "Company profile, landing page produk, dan situs yang cepat serta siap SEO untuk membangun kepercayaan.",
      tag: ["Company Profile", "Landing Page", "SEO", "Responsif"],
    },
    {
      ikon: "aplikasi",
      judul: "Aplikasi Custom",
      isi: "Aplikasi web, Android, dan desktop yang dirancang mengikuti alur kerja Anda — bukan sebaliknya.",
      tag: ["Web App", "Android", "Desktop", "Integrasi API"],
    },
    {
      ikon: "lembaga",
      judul: "Sistem Manajemen Lembaga",
      isi: "Sistem data, pendidikan, dan keuangan untuk pesantren, sekolah, dan organisasi — transparan dan akuntabel.",
      tag: ["Data & Keuangan", "Pendidikan", "Multi-peran", "Laporan"],
    },
    {
      ikon: "saas",
      judul: "Aplikasi Siap Pakai (SaaS)",
      isi: "Tak perlu membangun dari nol: langgani aplikasi buatan kami yang sudah teruji, mulai dari kasir untuk UMKM.",
      tag: ["Berlangganan", "Multi-toko", "Android & Web"],
    },
  ],
  produk: [
    {
      slug: "maktaba-pos",
      nama: "Maktaba POS",
      kategori: "saas",
      label: "SaaS · Kasir & Stok untuk UMKM",
      judul: "Kasir modern untuk toko, kedai & UMKM",
      deskripsi:
        "Maktaba POS adalah aplikasi kasir berlangganan: satu pemilik mengelola toko dengan banyak kasir, dari penjualan, stok, sampai keuangan dan gaji pegawai — cukup dengan HP Android atau browser.",
      platform: ["Web", "Android · segera di Google Play"],
      fitur: [
        { judul: "Kasir cepat", isi: "barcode, diskon, pajak, nomor antrian, Tunai/QRIS/GoFood/ShopeeFood/Hutang." },
        { judul: "Printer & struk", isi: "printer thermal Bluetooth, laci kasir otomatis, struk digital ke WhatsApp." },
        { judul: "Stok & HPP", isi: "produk berfoto, bahan baku, resep, dan kalkulator HPP." },
        { judul: "Keuangan", isi: "buku kas ber-PIN, hutang-piutang, laporan laba & export Excel/PDF." },
        { judul: "Shift, absensi & gaji", isi: "absen berfoto, rekap, slip gaji PDF, notifikasi Telegram." },
        { judul: "Aman", isi: "data tiap toko terisolasi, harga modal tersembunyi dari kasir, audit log." },
      ],
      tautan: [
        { label: "Coba Maktaba POS", url: "https://maktabapos.web.app", utama: true },
      ],
      tampilHarga: true,
      logo: { src: "/produk/maktaba-logo.png", alt: "Logo Maktaba POS", lebar: 1024, tinggi: 1024 },
      tampil: true,
    },
    {
      slug: "fastabiqu",
      nama: "Fastabiqu",
      kategori: "aplikasi",
      label: "Aplikasi · Rutinitas Pasangan",
      judul: "Berlomba dalam kebaikan, berdua",
      deskripsi:
        "Fastabiqu (فاستبقوا) membantu pasangan menjaga rutinitas bersama dan mengelola keuangan pribadi masing-masing — dalam satu aplikasi web & Android.",
      platform: ["Web", "Android"],
      fitur: [
        { judul: "Rutinitas bersama", isi: "data dibagi berdua, saling menyemangati." },
        { judul: "Keuangan pribadi", isi: "catatan privat per pengguna, tidak dibagikan." },
        { judul: "Statistik", isi: "dasbor perkembangan dan grafik." },
      ],
      tautan: [{ label: "Buka Fastabiqu", url: "https://fastabiquu.web.app", utama: true }],
      logo: { src: "/produk/fastabiqu-logo.png", alt: "Logo Fastabiqu", lebar: 360, tinggi: 295 },
      // Disembunyikan sementara atas permintaan Kyai (18 Nov 2026).
      tampil: false,
    },
    {
      slug: "ammu-online",
      nama: "Ammu Online",
      kategori: "pesanan",
      label: "Karya Pesanan · Sistem Pesantren",
      judul: "Satu sistem untuk data, pendidikan & keuangan pondok",
      klien: "Pondok Pesantren Mambaul Ulum, Sidoarjo",
      deskripsi:
        "Dibangun khusus untuk pondok: mencatat data santri, prestasi tahfizh & Qiraati, kehadiran (termasuk mesin sidik jari), rapor digital, hingga keuangan — dengan hak akses berjenjang dan jejak audit.",
      platform: ["Web", "Android", "Desktop"],
      fitur: [
        { judul: "Pendataan", isi: "santri, guru & kelas, lengkap dengan kartu santri digital." },
        { judul: "Pendidikan & tahfizh", isi: "prestasi, kehadiran, dan rapor semester berkop lembaga." },
        { judul: "Keuangan", isi: "pembayaran berstruk, tabungan santri, bisyaroh guru & buku kas." },
        { judul: "Komunikasi", isi: "kanal berita, notifikasi ponsel & halaman wali santri." },
      ],
      tautan: [],
      layarDesktop: [
        { src: "/produk/ammu-desktop-dashboard.jpg", alt: "Ammu Online desktop — dashboard statistik", lebar: 1600, tinggi: 839, keterangan: "Dashboard statistik (desktop)" },
      ],
      layarHp: [
        hp("/produk/ammu-statistik.jpg", "Ammu Online Android — statistik pondok", "Statistik pondok"),
        hp("/produk/ammu-keuangan.jpg", "Ammu Online Android — keuangan", "Keuangan pondok"),
        hp("/produk/ammu-kalender.jpg", "Ammu Online Android — kalender kegiatan", "Kalender kegiatan"),
      ],
      tampil: true,
    },
    {
      slug: "waseela",
      nama: "Waseela",
      kategori: "pesanan",
      label: "Karya Pesanan · Portal Lembaga Pendidikan",
      judul: "Portal manajemen pesantren & sekolah",
      klien: "Damu Foundation, Lombok",
      deskripsi:
        "Waseela dipasang khusus untuk lembaga pemesannya — satu pemasangan untuk satu lembaga, dengan data terpisah penuh: santri, guru, absensi, rapor, keuangan, kegiatan, dan kanal informasi.",
      platform: ["Web", "Android", "Desktop"],
      fitur: [
        { judul: "Identitas lembaga", isi: "logo, nama, warna & kop dokumen mengikuti lembaga." },
        { judul: "Data terpisah", isi: "satu lembaga satu basis data — tak bisa bocor antar-lembaga." },
        { judul: "Keuangan lengkap", isi: "syahriyah, kasir, tabungan, dan bisyaroh." },
      ],
      tautan: [{ label: "Lihat demo", url: "https://waseela.web.app" }],
      logo: { src: "/produk/waseela-logo.png", alt: "Logo Waseela", lebar: 560, tinggi: 312 },
      tampil: true,
    },
    {
      slug: "lek-kopi",
      nama: "Lek Kopi POS",
      kategori: "pesanan",
      label: "Karya Pesanan · Kasir Kedai Kopi",
      judul: "Kasir kedai kopi yang ringkas & rapi",
      klien: "Kedai Lek Kopi",
      deskripsi:
        "Dibuat untuk kedai Lek Kopi: katalog menu berfoto, mode online/offline, shift, stok & bahan baku, laporan omzet — plus Kantor AI yang membantu laporan dan konten promosi.",
      platform: ["Android", "Web"],
      fitur: [
        { judul: "Kasir cepat", isi: "katalog menu berfoto, kategori, keranjang & harga online/offline." },
        { judul: "Shift & laporan", isi: "buka/tutup shift, produk terlaris & grafik omzet." },
        { judul: "Kantor AI", isi: "laporan otomatis via Telegram dan studio konten promosi." },
      ],
      tautan: [],
      layarHp: [
        hp("/produk/lek-pos.jpg", "Lek Kopi POS — kasir & menu", "Kasir & menu"),
        hp("/produk/lek-laris.jpg", "Lek Kopi POS — produk terlaris & omzet", "Terlaris & omzet"),
        hp("/produk/lek-ringkasan.jpg", "Lek Kopi POS — ringkasan penjualan", "Ringkasan penjualan"),
      ],
      tampil: true,
    },
  ],
  proses: [
    { judul: "Diskusi & Rencana", isi: "Kami pahami kebutuhan, tujuan, dan anggaran Anda lebih dulu." },
    { judul: "Desain", isi: "Rancang alur dan tampilan yang jelas serta mudah dipakai." },
    { judul: "Bangun & Uji", isi: "Kembangkan dengan rapi, uji menyeluruh, dan iterasi cepat." },
    { judul: "Rilis & Rawat", isi: "Luncurkan ke domain Anda, lalu dukungan berkelanjutan." },
  ],
  tentang: {
    judul: "Detail kecil, dampak besar.",
    paragraf: [
      "Bakafrawi Project adalah software developer yang membantu bisnis, UMKM, dan lembaga menghadirkan produk digital yang bersih, cepat, dan stabil di setiap perangkat.",
      "Pendekatan kami sederhana: pahami masalahnya dulu, lalu bangun solusi yang tepat — bukan yang paling rumit. Sistem yang baik adalah yang mudah dirawat, cepat, dan jelas.",
      "Selain mengerjakan pesanan, kami membangun aplikasi sendiri yang bisa langsung Anda pakai.",
    ],
    fakta: [
      { label: "Nama", isi: "Bakafrawi Project" },
      { label: "Bidang", isi: "Software Developer" },
      { label: "Lokasi", isi: "Sidoarjo, Indonesia" },
      { label: "Fokus", isi: "Web · Aplikasi · Sistem" },
    ],
  },
  kontak: {
    email: "kollepiyah@gmail.com",
    whatsappTampil: "0878-9266-3748",
    whatsappNomor: "6287892663748",
    lokasi: "Sidoarjo, Jawa Timur",
    sosial: [
      { jenis: "instagram", url: "https://www.instagram.com/bakafrawi.project" },
      { jenis: "facebook", url: "https://www.facebook.com/share/17iGDfCWJu/" },
      { jenis: "playstore", url: "https://play.google.com/store/apps/dev?id=6326912762974851134" },
    ],
  },
  analitik: {
    gaId: "G-RX55M0WHS4",
  },
};

export const produkTampil = (situs: Situs, kategori: KategoriProduk) =>
  situs.produk.filter((p) => p.tampil && p.kategori === kategori);
