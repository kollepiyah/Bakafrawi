# CHANGELOG — bakafrawi.com

## Jadwal Otomatis Jam Buka (Story Opening Lek Kopi) & Jadwal Tayang Custom (20 Nov)

- **Jadwal Otomatis Setiap Jam Buka (Story & Opening):** panel baru **Story Jam Buka** di Studio
  (`/api/studio/rutin`, `src/lib/jadwal-tayang-murni.ts`). Video contoh *We Are Open (9AM - 11PM)*
  dari Kyai sudah dipasang sebagai video bawaan (`public/lekkopi-opening-story.mp4` + sampul).
  Mendukung banyak video opening sekaligus (mode *upload semua video aktif* atau *video wajib +
  1 video pendamping bergilir per hari*), pilihan hari buka (default Senin–Sabtu), jam buka WIB
  (tombol cepat `09:00` & `14:00`), serta unggah video `.mp4`/`.mov` baru langsung ke Supabase
  Storage bucket `studio`.
- **Mesin otomatis menjadwalkan hari buka berikutnya:** saat diaktifkan, tugas `rutin-buka`
  dijadwalkan di `studio_tugas` sehingga `pg_cron` Supabase (`studio_picu`) menyalakan GitHub
  Actions tepat saat jam buka tiba; selesai tayang, mesin otomatis menjadwalkan hari buka berikutnya.
  `studio/lib/instagram.mjs` kini mendukung upload **video Story** (`media_type: 'STORIES'`,
  `video_url`) selain gambar Story.
- **Jadwal Tayang Custom & Pilihan Sasaran untuk Semua Konten:** di formulir pembuatan konten,
  tiap kartu riwayat tugas (`KartuTugas`), dan bot Telegram (`atur_tayang`, `atur_jadwal_rutin`),
  penjadwalan tidak lagi terkunci di pukul 19.00 WIB — bisa memilih tanggal & jam WIB bebas,
  tombol slot cepat (`09.00`, `12.00`, `14.00`, `19.00`, `20.30`), serta sasaran tayang (`Reels`,
  `Story saja`, `Reels + Story`, `Feed + Story`, `Feed saja`).
- **Konten Jam Buka Generated AI (Otomatis Baru Tiap Hari — Tanpa Bank Video):** di panel **Story Jam Buka**,
  kini ada opsi **Buat Konten Opening Baru oleh AI Setiap Jam Buka** dengan 2 pilihan format simpel:
  1) **Video Animasi Simpel (Remotion 8 dtk ala Bakafrawi)** — komposisi `OpeningStory`
     (`studio/remotion/src/OpeningStory.tsx`) dengan animasi pegas, latar foto kopi AI gratis (Cloudflare),
     headline sapaan harian, kartu rekomendasi menu hari ini, jam buka, & musik santai;
  2) **Poster Story AI (9:16)** — cepat & ringan (`studio/lib/opening-ai.mjs`).
  Tersedia 3 tema visual (`hangat-kafe`, `terang-modern`, `minimalis-gelap`, atau otomatis berganti tiap hari).
- **Polesan Story Jam Buka AI, Audio Adaptif, Pratinjau dulu, & UI Mobile (21 Nov):**
  - **3 Menu Terlaris Hari Sebelumnya (15 dtk):** `ambilMenuLekKopi()` (`src/lib/naskah-bank.ts`) kini
    mengurutkan 3 menu terlaris (`terlaris` dari `pintu-bakafrawi`) lengkap dengan harga & foto produk
    asli; `OpeningStory` merender 5 adegan (Pembuka → `#1`, `#2`, `#3` Terlaris → Penutup estetik).
  - **Musik Kafe Adaptif + Efek Suara (SFX):** `studio/lib/opening-audio.mjs` menghasilkan musik kafe
    berbeda tiap hari mengikuti tema visual (Lo-Fi Jazz / Morning Bossa / Chill Lounge + geser nada
    harian) serta efek suara transisi (`whoosh`, `pop`, `chime`).
  - **Mode Pratinjau Dulu & Kirim Video ke Telegram:** tombol baru **Buat Pratinjau Dulu (Cek di Studio
    & Telegram)** membuat Story Buka masuk ke Riwayat Studio + mengirim video aslinya beserta tombol
    persetujuan ke Telegram tanpa langsung tayang; kabar tayang otomatis juga mengirim video aslinya
    (`kirimMediaTayang`).
  - **Perbaikan UI Mobile Studio:** bar tombol pill di panel atas (`Jam Terbaik`, `Riset Tren Viral`,
    `Pelajari Link Video`, `Story Jam Buka`) dan baris Jam Buka kini `flex-wrap` + `whitespace-nowrap`
    sehingga tidak lagi meluber keluar kartu di layar HP.
- Diuji: 32/32 unit test murni (`npm run uji`), pemeriksaan tipe TypeScript situs & Remotion (`tsc --noEmit`).

## Tombol "Usulkan arahan" di formulir Studio (19 Nov)

- Kyai: "apakah ada arahan AI?" — formulir Studio kini punya tombol **Usulkan arahan**: Claude Sonnet
  5.5 (effort rendah) memberi 3 sudut iklan berbeda untuk produk & jenis yang dipilih (sasaran,
  masalah, fitur, ajakan); diklik → mengisi kolom arahan. Rute admin `/api/studio/arahan`, aturan &
  prompt di `src/lib/usul-arahan-murni.ts` + tes.
- Keterangan formulir disesuaikan dengan mesin Remotion (video = animasi aplikasi + karakter; latar
  AI khusus poster).
- Diuji: tes murni, tipe, lint, build produksi. **Belum**: dicoba sungguhan (kunci Claude hanya di Vercel).

## Satu video karakter 8 detik cukup untuk satu iklan (19 Nov, gelombang 4)

- Kyai hanya sanggup membuat 1 video Veo 8 dtk per karakter. Bila karakter punya video, video itu
  kini dipakai di **semua adegan** (dulu hanya pose yang namanya cocok; sisanya gambar diam → tak
  konsisten). Video diubah jadi **bolak-balik** (maju lalu mundur, 16 dtk) supaya berulang tanpa
  lompatan, dan Remotion memutarnya mengikuti waktu global sehingga **berlanjut antar-adegan**.
- Diuji di PC: satu video hijau 8 dtk → lima adegan memakai berkas yang sama, bingkai sebelum/sesudah
  pergantian adegan nyaris identik. Tes 14/14.

## Zoom layar pas satu kartu & karakter video dari Veo (19 Nov, gelombang 3)

- Kyai: kotak perbesaran memotong "Laporan & Grafik" dan gerak karakter kurang bagus. Kotak kini
  menampilkan pita **selebar layar** (satu kartu UI utuh) dengan bingkai sorot di HP pada baris yang
  sama; titik fokus mendatar dari Claude tak dipakai lagi.
- **Video karakter Veo** (mp4/mov latar hijau): mesin mencari kotak karakter dengan MODNet di 3 bingkai,
  membuang latar dengan chromakey + despill, dan membuat WebM VP9 transparan terpangkas
  (`latar.mjs` `videoTransparan`); Remotion memutarnya berulang setengah badan.
- Gambar diam: gerak dibuat halus (tanpa memutar badan, anggukan kecil).
- Diuji di PC: video hijau buatan → WebM transparan bersih, render karakter bapak-kopiah. Tes 14/14.

## Maskot: latar dihapus AI, setengah badan, bergerak, suara ikut karakter (19 Nov, gelombang 2)

- Keluhan Kyai pada putaran sungguhan pertama: karakter kecil, diam, sweter krem bolong di latar biru
  (colorkey ffmpeg ikut menghapus warna mirip latar abu-abu Flow), dan suara pria untuk ibu hijab.
- `studio/lib/latar.mjs`: latar dihapus model segmentasi **MODNet** (transformers.js, Apache-2.0,
  ±2 dtk/gambar, gratis) + pembersih tepi hijau + pangkas ke tubuh. Model di-cache di Actions.
- Remotion: karakter dibingkai **setengah badan** (kepala–pinggang), bergoyang & bernapas, dan
  **mengangguk kecil tiap kata diucapkan** (dari waktu kata edge-tts).
- **Suara mengikuti karakter**: nama folder berisi ibu/mbak/hijab/wanita/… → `id-ID-GadisNeural`,
  lainnya `id-ID-ArdiNeural`.
- Diuji di PC dengan karakter asli Kyai dari Drive (ibu-hijab, bapak-kopiah). Tes 13/13.

## Maskot karakter 3D dari Google Drive: banyak karakter & pose per adegan (19 Nov, belum tayang)

- Aset video dikelola Kyai di Drive `Bakafrawi Studio/Aset` (bukan di laptop): `maskot/` dan `musik/`
  disalin rclone sekali per putaran. Musik: satu lagu acak per video.
- **Banyak karakter**: satu subfolder per karakter; Claude menerima daftar nama karakter dan memilih
  yang cocok dengan sasaran produk (cadangan: karakter bernama slug merek, lalu acak). Satu karakter
  dipakai konsisten di seluruh video.
- **Pose per adegan** (kaget/tunjuk/hp/jempol/lambai; Claude boleh memilih per adegan): pose baru
  muncul dengan pegas, pose sama tak berkedip. JPG diterima — latar polos (warna pojok) dibuang
  otomatis; hijau #00FF00 paling bersih. Subtitle penutup dipindah ke atas maskot.
- Aturan murni `kelompokKarakter`, `pilihKarakter`, `maskotAdegan`, `pilihMusik` + tes (11/11).
- Diuji di PC: pose hijau buatan, pergantian pose antar-adegan, dua karakter. **Belum**: karakter asli
  Kyai dari Google Flow (folder Drive masih kosong), putaran di GitHub Actions.

## Mesin Studio memakai Remotion untuk video iklan produk (19 Nov, gelombang 2, belum tayang)

- Pilihan Kyai: gaya Remotion. Mesin (`studio.mjs`) kini: tangkapan layar tajam → **Claude melihat
  layar** dan menulis 5–6 adegan datar (`SkemaVideo` di `naskah.mjs`) → `studio/lib/video.mjs`
  `keNaskah` merapikan jadi props Remotion (adegan berdata kurang diganti daftar fitur; penutup selalu
  ada dengan kontak dari situs, tak pernah dikarang) → narasi edge-tts + waktu kata → `remotion render`
  dengan `--public-dir` folder tugas → video + sampul.
- Adegan Remotion diumumkan untuk semua produk: **layar** (baru — tampilan asli aplikasi di HP, layar
  bergulir ke titik sorot, cincin berdenyut, kotak perbesaran berlabel), **kasir** (khusus aplikasi
  kasir), **alur** (dulu "stok"; penghitung opsional), **daftar** (dulu "laporan"; angka & lencana dari
  naskah, "▲ 18%" karangan dihapus). Pembuka gaya karosel #claudecode; subtitle dipotong per kalimat.
- Jalur ffmpeg gaya layar terbagi (kartu HTML, subtitle ASS, zoompan, `uji-iklan.mjs`) dihapus —
  satu jalur video saja. `iklan.mjs` tinggal narasi berwaktu kata + musik contoh.
- Workflow: `npm ci --prefix remotion` + `remotion browser ensure`; perekam ffmpeg Playwright tak
  dipakai lagi.
- Diuji: tes 6/6, tipe Remotion, `studio.mjs --lokal contoh-tugas-video.json` sampai video jadi (naskah
  templat — kunci Claude tak ada di laptop; layar dari maktabapos.web.app halaman depan). **Belum**:
  putaran sungguhan di GitHub Actions (naskah Claude dengan gambar, unduh Chrome Remotion di runner).

## Video iklan Studio gaya Reels + Remotion; footer HP; Umami dilepas; ikon APK (19 Nov, belum tayang)

- **Keluhan Kyai**: video Studio monoton, subtitle tak sinkron, "bukan seperti video iklan pada
  umumnya". Akar subtitle: `rakit.mjs` lama membagi waktu kalimat menurut jumlah huruf.
- **Mesin Studio (produk, non-bank)** kini memakai `studio/lib/iklan.mjs`: narasi per adegan dari
  edge-tts **dengan waktu tiap kata**, layar terbagi ala Reels teknologi (kartu judul besar / potongan
  layar aplikasi / kolase HP di atas, subtitle 1–2 kata di tengah dengan kata sorot serif miring, foto
  orang AI di bawah), transisi + whoosh, musik yang mengecil saat narasi. Layar aplikasi dipotret
  tajam (`potretLayar`, dpr 3) dan **dilihat Claude** saat menulis naskah (`buatNaskahVideo`,
  `SkemaVideo`). `rakit.mjs`, `suara.mjs`, rekaman webm dan kartu video lama dihapus.
- **Prototipe Remotion** `studio/remotion/` (dari prompt Kyai): latar kisi putih, bilah progres kiri,
  lencana langkah, UI kasir/stok/laporan beranimasi pegas, caption kata-per-kata sinkron suara dengan
  stabilo, penutup warna merek, slot `<MascotOverlay />`. Semua teks/waktu/warna di
  `src/data/script.ts`; `npm run siapkan` membuat narasi + waktu kata, `npm run studio` / `render`.
  **Belum** tersambung ke mesin Studio — menunggu penilaian Kyai antara gaya ini dan gaya layar terbagi.
- **Situs**: footer di HP ditumpuk rapi di tengah, celah kosong di bawah tombol "Kirim Pesan"
  dirapatkan. **Umami dilepas** (statistiknya tak bisa tampil langsung): skrip, tautan footer, isian
  admin, kalimat privasi; skema `analitik` tinggal `gaId`.
- **APK Bakafrawi Studio**: ikon aplikasi = logo kaligrafi Bakafrawi (ikon adaptif + monokrom);
  sebelumnya ikon sementara kalender. Ikon notifikasi pengingat tetap kalender.
- Diuji: tes `iklan.test.mjs` 7/7, tipe situs & Remotion, render video contoh di PC (data pratinjau
  rekaan, foto pengganti dari Unsplash karena kunci gambar AI tak ada di laptop), footer di layar 375 px,
  kompilasi sumber daya Android. **Belum**: mesin Studio di GitHub Actions dengan naskah Claude & foto AI
  sungguhan, APK baru belum dibangun ulang.

## Bakafrawi Studio tahap 2 — Dasbor semua aplikasi (belum tayang)

- **Menu Aplikasi** + kartu di Beranda: satu kartu per aplikasi dengan angka utama dan hal yang perlu
  perhatian (pembayaran menunggu, langganan habis ≤7 hari, bahan menipis, tak ada pengguna aktif,
  database ≥ 400 MB). Bot: alat `ringkasan_aplikasi`.
- Data dari **pintu baca-saja** `pintu-bakafrawi` di tiap proyek Supabase (transaksi read only, header
  rahasia), disimpan ±5 menit di cache data Next. Maktaba: angka SaaS; Lek Kopi: ringkasan hari ini
  (`?jenis=dasbor`, fungsi agent yang sama dengan Lek AI); **Ammu & Waseela: teknis saja** (data
  lembaga klien — keputusan Kyai 18 Nov); **Fastabiqu: teknis saja** (data pribadi Kyai & istri).
- Aturan penilaian & tampilan angka di `src/lib/aplikasi-murni.ts` + tes. Panduan: `PANDUAN-DASBOR.md`.
- Diuji: tes murni, tipe, lint, build, layar dengan data rekaan. **Belum**: pintu sungguhan
  (belum di-deploy), APK belum menampilkan kartu aplikasi.

## Bakafrawi Studio tahap 3, gelombang 2 — Lek Kopi masuk Studio (belum tayang)

- **2a — mesin video bank media**: modul Studio Lek Kopi (potong di ketukan musik, transisi, 26 huruf,
  gambar AI, suara Gemini, mata Claude, poster bank, draf TikTok) dipindah utuh ke `studio/lib/bank/`.
- **2b — alur Lek Kopi**: ide → **naskah** ditulis Claude Sonnet 5.5 dari data kedai (pintu baca-saja
  `pintu-bakafrawi` di repo Lek Kopi: menu, terlaris/turun, jam sepi, promo, info toko, ingatan Lek AI)
  + isi bank → tombol Setujui/Tolak di bot dan layar Konten (revisi lewat chat atau tombol) → mesin
  membuat video → persetujuan & tayang seperti biasa. Status tugas baru `naskah`.
- Aturan naskah Lek Kopi disalin dari `konten_murni.ts` ke `src/lib/lekkopi/konten-murni.ts`
  (salinan Lek Kopi dipensiunkan setelah merek aktif di sini).
- Bank media diindeks dari Google Drive (rclone) ke `studio_bank` per merek — hanya berkas baru/berubah
  yang diunduh; mesin dinyalakan juga untuk mengindeks ulang tiap 6 jam (`studio_ada_kerja`).
  `studio_gaya` menyiapkan profil gaya per merek. Merek bisa diaktifkan dari Konten → Sambungan.
- Uji: render video Lek Kopi dari bank di PC (`uji-bank.mjs`), alur mesin ujung-ke-ujung dengan
  Supabase tiruan (indeks 66 berkas → render → unggah → status selesai), migrasi di PGlite.
  **Belum diuji sungguhan**: pintu Lek Kopi, naskah Claude, rclone di GitHub Actions, tayang IG Lek Kopi.
- Migrasi `20261118230000_studio_bank.sql`. Panduan: bagian atas `PANDUAN-STUDIO.md`.
- **2c — pelengkap**: modul gambar AI ganda dilebur (satu modul untuk semua merek); bot bisa
  **mengusulkan ide** dari data kedai (`usul_ide_merek`); **mata Claude** per merek (kurasi bank →
  `studio_bank.kurasi`, belajar gaya dari Reels IG + folder referensi → `studio_referensi`,
  `studio_gaya`); **draf TikTok** per merek sesudah tayang IG (OAuth di Konten → Sambungan,
  `/api/studio/tiktok/kembali`, refresh token disimpan ulang tiap dipakai). Diuji dengan layanan
  tiruan: kurasi/referensi/gaya tersimpan, Reels + draf TikTok tercatat (`tayang.tiktok.publish_id`).
- **Belum**: memensiunkan Studio lama di repo Lek Kopi (workflow `studio.yml`, `kantor-studio/`,
  perintah konten Lek AI) — sengaja ditunda sampai alur baru terbukti jalan sungguhan.

## Bakafrawi Studio tahap 3, gelombang 1 — Studio multi-merek (belum tayang)

Awal penyatuan Studio Bakafrawi + Studio Lek Kopi menjadi satu mesin di repo ini.

- **Tabel `studio_merek`**: Bakafrawi (aktif) dan Lek Kopi (terdaftar, belum aktif — bahan "bank media"
  menyusul di gelombang 2). Profil merek berisi nama, warna aksen, situs, WA, logo, gaya copywriter,
  hashtag, alur persetujuan (`langsung` / `naskah`), dan jenis bahan.
- **Tugas milik satu merek** (`studio_tugas.merek`). Poster & video memakai identitas merek itu: warna,
  nama di kepala, situs & WA di kaki/kartu penutup; naskah memakai gaya copywriter dan hashtag merek.
  Tampilan Bakafrawi tidak berubah (diuji ulang lewat `--lokal`).
- **Token Instagram per merek** di `studio_kredensial` (tanpa policy, hanya server & mesin). Token lama
  dari `studio_pengaturan` dipindah otomatis lalu kolom lamanya dihapus — satu sumber. Konten →
  Sambungan kini menampilkan status Instagram tiap merek dan bisa menyambung per merek. Perpanjangan
  token & pemicu mesin (`studio_ada_kerja`) berlaku untuk semua merek.
- Pilihan merek di formulir Konten muncul otomatis begitu ada lebih dari satu merek aktif.
- Migrasi `20261118220000_studio_merek.sql` (diuji di PGlite dengan data rekaan). **Jalankan migrasi
  bersamaan dengan deploy**: kode lama membaca kolom token yang dihapus migrasi ini.

## Bakafrawi Studio tahap 1 — Beranda, Agenda, APK (belum tayang)

- **Admin jadi Bakafrawi Studio**: menu Beranda · Agenda · Konten (Studio AI) · Situs (editor). Beranda
  merangkum agenda hari ini, 7 hari ke depan, dan konten yang menunggu persetujuan/terjadwal/gagal.
- **Agenda tersinkron dua arah dengan Google Calendar** (`calendar.events`, OAuth sekali dari menu Agenda).
  Tambah/ubah/hapus dari layar, APK, atau bot langsung didorong ke Google; isi Google 1 hari lalu–60 hari
  ke depan ditarik tiap 5 menit. Perubahan lokal yang belum terkirim menang dan dicoba ulang tiap detak.
  Acara yang hilang dari jendela dicek satu per satu (dihapus di Google → batal; digeser → diperbarui).
- **Detak 5 menit dari Supabase** (`agenda_detak` → `/api/agenda/detak`, kode di Vault) karena cron Vercel
  gratis hanya sekali sehari: sinkron, pengingat Telegram 30 menit sebelum acara, ringkasan pagi 05.30 WIB.
- **Bot Telegram**: `/agenda`, `/agenda besok`, dan chat bebas ("besok jam 9 rapat di MU", "geser ke jam 10")
  lewat alat lihat/tambah/ubah/hapus acara yang memakai aturan server yang sama.
- **APK Android native (Kotlin + Jetpack Compose)** di `aplikasi-android/`: masuk akun admin, Beranda,
  Agenda (tambah/ubah/hapus), notifikasi 30 menit sebelum acara (alarm disegarkan tiap jam oleh WorkManager,
  bertahan setelah HP restart). Konten masih membuka Studio web.
- Aturan tanggal WIB, acara seharian (selesai inklusif di formulir, eksklusif di simpanan seperti Google),
  konversi Google, rencana sinkron, dan teks pesan ada di `src/lib/agenda-murni.ts` + tes (`npm run uji`).
- Migrasi `20261118210000_agenda.sql`. Panduan: `PANDUAN-AGENDA.md`.

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
- **Latar AI lewat Cloudflare dulu.** Penyedia gambar kini dicoba berurutan: Cloudflare Workers AI (FLUX.2
  klein, 10.000 Neuron gratis/hari ≈ 60 gambar) lalu Gemini (butuh billing). Penyedia yang kuotanya habis
  dilewati sampai putaran selesai; FLUX.2 yang menolak permintaan jatuh ke schnell persegi. Rahasia GitHub
  baru `CF_ACCOUNT_ID` + `CF_API_TOKEN` (izin *Workers AI Edit* saja). Pola sama dengan Studio Lek Kopi.

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
