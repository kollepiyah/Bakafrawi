# CHANGELOG — bakafrawi.com

## Perbaikan Daftar Model AI Aktif, JSON Mode Native & Parser JSON Toleran (26 Nov)
- Memperbarui daftar model aktif di `src/lib/llm-router.ts` dan `studio/lib/router-worker.mjs` sesuai status terbaru: menaikkan Gemini ke `gemini-3.8-flash` & `gemini-3.8-flash-lite` (menghapus `gemini-2.0-flash` yang 404), menghapus `meta-llama/llama-4-scout-17b-16e-instruct` (404) di jalur teks Groq dan memakai `llama-3.3-70b-versatile` + `llama-3.1-8b-instant`, menghapus `mistralai/mistral-large-2-instruct` (410 EOL) di `llm-router.ts`, serta mengganti `google/gemini-2.0-flash-exp:free` (404) di OpenRouter dengan auto-router resmi `openrouter/free`.
- Mengaktifkan `response_format: { type: "json_object" }` pada Groq, NVIDIA, dan OpenRouter (dengan fallback otomatis bila model tertentu menolak `400`), menaikkan batas token Cloudflare/Claude untuk naskah panjang, menambahkan `parseJsonToleran` (tahan trailing comma & baris baru mentah di dalam string), serta menjaga pesan galat model pertama agar tidak tertutup galat fallback terakhir.

## CeritaMotion (Malam Sinematik & Perkamen Sejarah), Tulis Manual per Bagian, & Perbaikan Suara (26 Nov)
- Menambahkan komposisi Remotion baru `CeritaMotion` (`studio/remotion/src/CeritaMotion.tsx` & `studio/remotion/src/data/cerita-motion.ts`) yang mendukung 2 tema visual: **Malam Sinematik** (ala `@waktunya.malam`) dan **Perkamen Sejarah** dengan gulungan perkamen animasi, pita era, peta kuno SVG rute bercahaya, serta subtitle kinetik sorot kata kunci (ala `@motionformat`).
- Menambahkan tombol **Tulis Manual per Bagian** di [studio-serial.tsx](src/components/admin/studio-serial.tsx) + helper `buatDrafManualSerial` di `src/lib/serial-kartun-murni.ts` agar narasi, tampilan bagian (`pembuka`/`ilustrasi`/`perkamen`/`peta`/`penutup`), judul kartu, pita era, kata kunci sorot emas/kuning, dan prompt visual bisa ditulis manual tanpa diubah AI.
- Menghubungkan worker `studio/lib/serial-kartun.mjs` untuk merender mode `dokumenter` melalui `CeritaMotion` dengan prompt gambar AI seragam per tema, melewati generate gambar untuk adegan `peta`, serta melarang mode dokumenter jatuh ke templat komedi kedai saat LLM gagal.
- Memperbaiki bug gender & fallback suara di `studio/lib/bank/suara.mjs`: narator pria tidak lagi mengambil suara wanita saat otomatis (`objekFav[0]`) maupun saat jatuh ke Gemini/Edge (`Charon`/`id-ID-ArdiNeural`), menambahkan cadangan otomatis ke voice bawaan ElevenLabs sesuai gender saat Voice Library ditolak API (`400`/`402`), dan memperluas catatan galat hingga 260–320 karakter.
- Menghapus model NVIDIA yang sudah pensiun (`mistralai/mistral-large-2-instruct`, `410 Gone`) dari `studio/lib/router-worker.mjs`.

## Mode Dokumenter Murni & Riset Google Otomatis Serial Konten (25 Nov)
- Menambahkan pilihan **Gaya Cerita: Dokumenter Murni (Riset Google)** di panel Admin [studio-serial.tsx](src/components/admin/studio-serial.tsx), terpisah dari mode **Komedi / Cerita Kedai** agar cerita sejarah/edukasi tidak lagi dipaksakan memakai tokoh barista Panjunan, logat gaul, atau daftar harga menu kedai.
- Menambahkan tombol **Riset Fakta di Google Dulu**, opsi riset Google otomatis sebelum menyusun naskah, kotak sunting **Hasil Riset Fakta & Sumber**, serta kolom **Prompt Visual Ilustrasi AI (Inggris)** per adegan.
- Memperbaiki router Gemini di `src/lib/llm-router.ts`: saat model utama terkena `503`/`429`/timeout, fallback ke model Gemini berikutnya tetap membawa `google_search` aktif (tidak langsung dimatikan pada percobaan pertama).
- Menambahkan aksi API `"riset-cerita"` dan integrasi riset otomatis pada `"saran-ide"`, `"buat-naskah"`, dan `"buat-episode"` di `src/app/api/studio/serial/route.ts` serta penyimpanan `gayaCerita` + `hasilRiset` pada antrean tugas di `src/lib/studio-server.ts`.
- Menyesuaikan worker `studio/lib/serial-kartun.mjs` dan komposisi Remotion `studio/remotion/src/SerialKartun.tsx`: mendukung mode `dokumenter` tanpa panggung tokoh (`tokohKiri: null`, `tokohKanan: null`), aksen emas dokumenter `#E3C989`, dan pembuatan ilustrasi AI 9:16 otomatis per adegan via `buatGambarAi` (maksimal 12 adegan).

## Perbaikan Ketahanan Router AI & Parser Naskah Serial (25 Nov)

- **Atasi Galat Serentak NVIDIA 410 / Gemini 503 / Cloudflare Timeout / Claude Format (`src/lib/llm-router.ts`, `studio/lib/router-worker.mjs`):**
  - Menghapus model NVIDIA EOL `meta/llama-3.1-70b-instruct` dan memprioritaskan `meta/llama-3.3-70b-instruct`, `nvidia/llama-3.3-nemotron-super-49b-v1`, `qwen/qwen2.5-72b-instruct`, dan `mistralai/mistral-large-2-instruct`, dengan rotasi penuh untuk status `404/410/429/5xx`, timeout, maupun gagal parse JSON.
  - Memprioritaskan `gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-flash-latest` → `gemini-2.0-flash` serta memperbolehkan pindah model saat `503` (high demand), `429`, atau timeout (sebelumnya hanya pindah di `404`).
  - Menambahkan fallback model cepat di Cloudflare (`@cf/meta/llama-3.3-70b-instruct-fp8-fast` → `@cf/meta/llama-4-scout-17b-16e-instruct` → `@cf/meta/llama-3.1-8b-instruct-fast`) agar tidak langsung gugur saat 1 model timeout.
  - Memperbaiki `panggilClaude` agar tidak lagi diam-diam mengubah respons tanpa teks menjadi `"{}"`, otomatis fallback sekali dari constrained `output_config.json_schema` ke mode prompt JSON standar bila gagal atau tidak valid, serta menambahkan info `keys` pada pesan galat validasi.
- **Toleransi Pembungkus JSON & Timeout API (`src/lib/serial-kartun-murni.ts`, `src/app/api/studio/serial/route.ts`):**
  - Menaikkan `maxDuration` rute `/api/studio/serial` dari `60` ke `120` detik, memperluas `kataKunci` menjadi `1.200` karakter, serta membuat `normalisasiSaranCeritaSerial` & `normalisasiNaskahDrafSerial` toleran terhadap variasi key pembungkus JSON dari LLM (`ide`, `title`, `naskah`, `scenes`, `narasi`).

## Dukungan Dialog Panjang, Narator + Dialog & Episode Bersambung Serial Kartun (25 Nov)

- **Cerita Naratif Panjang, Campuran Narator + Dialog Tokoh & Mode Bersambung (`src/lib/serial-kartun-murni.ts`, `src/app/api/studio/serial/route.ts`, `src/lib/studio-server.ts`, `studio/lib/serial-kartun.mjs`):**
  - Menambahkan pilihan **Panjang Cerita & Kedalaman Dialog** (`ringkas`: 45–60 dtk, `sedang`: 1–1,5 mnt, `panjang`: 1,5–2,5 mnt; hingga 14–16 adegan dan 22–48 kata per adegan) agar narasi dan dialog terasa bernyawa, tidak pendek kaku.
  - Menambahkan mode **Narator + Dialog Tokoh** (`formatSuara: "campuran"`) dan opsi **Cerita panjang / bersambung** (`bersambung`) sehingga materi cerita besar (mis. kisah sejarah kopi atau dongeng edukatif) dapat diolah mendalam dan diteruskan ke episode berikutnya lewat memori `ringkasanEpisode` (diperluas ke 450 karakter) dan bahan ide hingga 4.000 karakter.
  - Menaikkan batas normalisasi draf & props worker (`maks. 16 adegan`, `dialog 650 karakter`, batas audio per adegan dari `9,5` detik ke `28` detik agar narasi panjang tidak terpotong).
- **Subtitle Rolling Window & Kontrol Editor Draf (`studio/remotion/src/SerialKartun.tsx`, `src/components/admin/studio-serial.tsx`):**
  - Menambahkan jendela gulir subtitle maks 12 kata per tampilan pada `AdeganPanggung` (baik mode timestamp ElevenLabs maupun fallback teks) agar narasi panjang tetap rapi di zona aman tanpa menabrak karakter.
  - Memperluas textarea bahan cerita (`rows={4}`), menambahkan pemilih panjang cerita, toggle bersambung, estimasi durasi & jumlah kata realtime di Editor Draf, ubah peran pembicara (`Narator`/`Kiri`/`Kanan`/`Tanpa`), serta tombol tambah/hapus adegan.

## Asisten Saran Cerita & Editor Draf Serial Kartun + Pemangkasan Biaya Claude Studio (25 Nov)

- **Asisten Kata Kunci, Saran Cerita & Editor Draf Naskah Serial Kartun (`src/lib/serial-kartun-murni.ts`, `src/app/api/studio/serial/route.ts`, `src/lib/studio-server.ts`, `src/components/admin/studio-serial.tsx`, `studio/lib/serial-kartun.mjs`):**
  - Menambahkan kolom kata kunci cerita + tombol **Minta 3 Saran Cerita (AI)** (`aksi: "saran-ide"`) di tab **Serial Kartun** untuk menghasilkan 3 variasi ide (judul, premis, punchline, mood) yang menyambung dengan memori episode sebelumnya dan bisa langsung dipasang ke formulir atau dibuatkan draf naskahnya.
  - Menambahkan tombol **Buatkan Draf Naskah Cerita (AI)** (`aksi: "buat-naskah"`) dan **Editor Draf Naskah Cerita** di panel admin agar judul episode, tema, nama pembicara, latar per adegan, dialog ElevenLabs, pertanyaan penutup, serta caption Instagram bisa ditinjau dan disunting sebelum dirender.
  - Memperbarui `buatTugasSerialKartun()` dan `renderSerialKartun()` agar saat merender dari draf yang disetujui (`metaTugas.naskahJadi`), worker GitHub Actions langsung memakainya (`sumber: 'draf-disetujui'`) tanpa panggilan AI ulang.
- **Pemangkasan Biaya Claude & Router AI Multi-Penyedia Terpusat (`src/lib/llm-router.ts`, `studio/lib/router-worker.mjs`, `studio/lib/opening-ai.mjs`, `studio/lib/naskah.mjs`, `.github/workflows/studio.yml`, `src/app/api/studio/sambungan/route.ts`, `src/components/admin/studio-sambungan.tsx`):**
  - Menghapus pemakaian langsung `new Anthropic()` di `studio/lib/opening-ai.mjs` (yang sebelumnya selalu memanggil Claude untuk poster Story buka harian) dan menyatukan `opening-ai.mjs`, `naskah.mjs`, serta `serial-kartun.mjs` ke `studio/lib/router-worker.mjs`.
  - Menambahkan penyedia gratis **Groq** (teks & Vision Llama 4 Scout) serta **OpenRouter** (`:free`), memperbaiki fallback model NVIDIA NIM, menurunkan cadangan Claude Studio ke `claude-haiku-5-5` dan menaruhnya di urutan paling akhir (`groq → nvidia → gemini → openrouter → cloudflare → claude`), serta menambahkan sakelar keras `STUDIO_TANPA_CLAUDE=1` (`claudeDimatikan()` / `claudeWorkerDimatikan()`) untuk menonaktifkan Claude Studio sepenuhnya.
  - Meneruskan secret `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `STUDIO_TANPA_CLAUDE`, dan `STUDIO_AI_PROVIDER` di `.github/workflows/studio.yml`, serta menampilkan kartu **Urutan Penyedia AI Naskah (Hemat Biaya)** (`penyediaAi` dari `statusPenyediaLlm()`) pada tab **Sambungan** agar status kunci API terbaca jelas di `/admin`.
- **Penyelarasan Menu Asli Lek Kopi (`lek-kopi.web.app`) & Pembersihan Contoh Menu Non-Aktif (`src/lib/serial-kartun-murni.ts`, `src/lib/studio-server.ts`, `src/app/api/studio/serial/route.ts`, `studio/lib/serial-kartun.mjs`, `studio/remotion/src/components/KarakterKartun.tsx`, `studio/remotion/src/components/LatarKartunBawaan.tsx`):**
  - Menghapus seluruh contoh menu non-aktif yang tidak ada di kedai dari prompt, placeholder UI, properti SVG Remotion (`matcha_latte`), papan menu kedai (`Kopi Lek`, `Butterscoth Latte`, `Matcha Latte`), tes unit, catatan `CHANGELOG.md`, serta berkas memori lokal/global (`GEMINI.md`, `kyai-memory.md`).
  - Menambahkan `ambilMenuLekKopiUntukPrompt()` dan `formatMenuSerialUntukPrompt()` agar asisten ide cerita AI, draf naskah AI, dan worker `renderSerialKartun()` langsung menyuntikkan daftar menu asli dari `ambilMenuLekKopi()` / `profil.menu_asli` (dengan cadangan terverifikasi dari `https://lek-kopi.web.app`) beserta aturan ketat dilarang mengarang menu di luar daftar resmi.
- **Diuji:** Pemindaian kata kunci menu non-aktif = `0` kecocokan di repo & berkas memori global, 54/54 unit test web (`npm run uji`), 32/32 unit test worker (`node --test studio/lib/iklan.test.mjs studio/lib/serial-kartun.test.mjs`), `node --check` pada `studio.mjs`, `router-worker.mjs`, `naskah.mjs`, `opening-ai.mjs`, dan `serial-kartun.mjs` (exit 0), `tsc --noEmit` Remotion (`studio/remotion/tsconfig.json`, 0 error), ESLint `--max-warnings=0` pada 11 berkas `src/` terkait (0 error, 0 warning), dan build produksi Next.js 16.4.6 (`npm run build`, compile 2,6 menit, TypeScript 57 detik, 37/37 rute). **Belum:** commit/push ke GitHub, deploy ke Vercel, penambahan `GROQ_API_KEY`/`OPENROUTER_API_KEY`/`STUDIO_TANPA_CLAUDE=1` di Vercel & GitHub Secrets, serta uji panggil live ke endpoint `saran-ide`/`buat-naskah` dan worker GitHub Actions di produksi.

## Serial Kartun 2D Lek Kopi (Foto Tempat → Kartun 2D, Suara ElevenLabs Multi-Tokoh & Memori Episode) (25 Nov)

- **Tab Baru Serial Kartun & Konversi Foto Asli Kedai ke Kartun 2D (`src/lib/serial-kartun-murni.ts`, `src/lib/studio-server.ts`, `src/app/api/studio/serial/route.ts`, `src/app/api/studio/serial/kartunkan/route.ts`, `src/components/admin/studio-serial.tsx`, `src/components/admin/studio.tsx`):**
  - Menambahkan sub-tab **Serial Kartun** di panel Studio Admin (`/admin`) khusus membuat konten episode bersambung Lek Kopi bertema komedi ceria, kehidupan santai, maupun cerita kopi (0 kredit Google Flow).
  - Menambahkan fitur unggah foto asli tempat Lek Kopi (Meja Bar, Area Outdoor, Meja Kopi, Depan Kedai, maupun lokasi custom) yang otomatis dikecilkan di browser lalu disulap menjadi latar kartun 2D vertikal 9:16 lewat **Cloudflare Workers AI `@cf/black-forest-labs/flux-2-klein-4b`** (*image-to-image* gratis) dengan fallback **Gemini Image**, filter kartun Canvas langsung di browser, atau unggah langsung; dilengkapi pratinjau Before/After dan penyimpanan ke bucket Storage `studio`.
  - Menyimpan konfigurasi serial, daftar latar kartun, pemetaan Voice ID ElevenLabs per tokoh, serta riwayat ringkasan tiap episode secara otomatis pada `studio_merek.profil.serial_kartun` tanpa migrasi tabel baru.
- **Mesin Animasi Kartun 2D Ceria & Santai di Remotion (`studio/remotion/src/components/KarakterKartun.tsx`, `studio/remotion/src/components/LatarKartunBawaan.tsx`, `studio/remotion/src/data/serial-waktu.ts`, `studio/remotion/src/SerialKartun.tsx`, `studio/remotion/src/Root.tsx`):**
  - Membangun komposisi baru `SerialKartun` (1080×1920, 30 FPS) berisi kartu Intro berikon cangkir kopi SVG, panggung adegan 1–2 karakter dengan gerak kamera 2D, header & subtitle zona aman Reels, serta Penutup pemicu komentar.
  - Membuat 5 tokoh tetap khas Lek Kopi (`Mas Lek` barista apron hitam berlogo `LK`, `Mas Danu`, `Mbak Rara`, `Pak Budi` berkopiah, dan `Cimol` kucing oren kedai) lengkap dengan kedipan mata otomatis, 8 ekspresi wajah, **lip-sync mulut mengikuti alignment kata ElevenLabs**, properti tangan (es kopi, kopi panas, *Matcha Latte*, HP, uang, jempol, tunjuk), reaksi komik (`?`, `!`, keringat, hati, lampu ide, `HAHA!`), serta 4 latar kartun SVG bawaan bila foto asli kedai belum diunggah.
- **Suara Multi-Tokoh ElevenLabs & Orkestrasi Worker (`studio/lib/bank/suara.mjs`, `studio/lib/serial-kartun.mjs`, `studio/studio.mjs`):**
  - Menambahkan `pilihVoicePerTokoh()` dan `suaraDialogSerial()` agar tiap tokoh memakai Voice ID ElevenLabs berbeda (serta mendukung alignment kata `/with-timestamps` dan fallback berjenjang ke Gemini TTS / Edge TTS sesuai gender; adegan bisu/kucing dilewati otomatis).
  - Menyambungkan `renderSerialKartun()` dan `gabungRiwayatEpisode()` di `studio/studio.mjs` untuk membuat naskah bersambung via router hemat AI (`NVIDIA NIM → Gemini → Cloudflare → Claude`), mengunduh latar kartun tersimpan, merender MP4 via Remotion CLI + musik kafe adaptif + SFX, membuat caption konsisten `@lekkopi.id`, dan mencatat memori episode otomatis untuk lanjutan Episode berikutnya.
- **Diuji:** 52/52 unit test web (`npm run uji`, termasuk `src/lib/serial-kartun-murni.test.ts`), 31/31 unit test worker (`node --test studio/lib/iklan.test.mjs studio/lib/serial-kartun.test.mjs`), `node --check` pada `studio.mjs`, `serial-kartun.mjs`, dan `suara.mjs`, `tsc --noEmit` web & Remotion (`studio/remotion/tsconfig.json`), ESLint pada 7 berkas terkait (0 error, 0 warning), build produksi Next.js 16.4.6 (`npm run build`, 37/37 rute), serta inspeksi visual 3 bingkai still Remotion lokal (`Intro`, `Adegan 1`, `Adegan 2`). **Belum:** commit/push ke GitHub, deploy ke Vercel, serta uji langsung di produksi dengan foto asli kedai, kunci Cloudflare/ElevenLabs aktif, dan render MP4 penuh di GitHub Actions.

## Kalender Konten Realtime, Pustaka Aset Admin & Evaluasi Gaya Mingguan Otomatis (25 Nov)

- **Tampilan Kalender Konten + Update Status Realtime (`supabase/migrations/20261125133000_studio_realtime.sql`, `src/lib/kalender-studio-murni.ts`, `src/components/admin/studio-kalender.tsx`, `src/components/admin/studio.tsx`):**
  - Mengaktifkan publikasi **Supabase Realtime** untuk tabel `studio_tugas` dan memasang langganan perubahan baris langsung di panel Studio (`/admin`), dilengkapi lencana status **Live** agar progres render maupun jadwal tayang muncul otomatis tanpa reload halaman.
  - Menambahkan mode tampilan **Kalender** di samping **Daftar** pada tab **Riwayat**, lengkap dengan navigasi bulan, indikator status per tanggal (`Tayang`, `Terjadwal`, `Perlu Cek`, `Proses`, `Gagal`), panel pratinjau harian, serta aksi cepat Tayangkan / Hapus / Buka Detail.
- **Pustaka Aset & Karakter Maskot langsung di `/admin` (`src/app/api/studio/aset/route.ts`, `src/components/admin/studio-aset.tsx`, `src/lib/studio-server.ts`, `studio/lib/video.mjs`, `studio/studio.mjs`):**
  - Menambahkan sub-tab **Aset & Karakter** untuk mengunggah gambar/video karakter maskot (`ibu-hijab`, `bapak-kopiah`, maupun karakter custom baru per pose) dan musik latar langsung ke bucket Storage `studio`, tersimpan di `studio_merek.profil.aset_studio`.
  - Worker `studio.mjs` otomatis menarik aset Supabase lewat `salinAsetSupabase()` (melengkapi aset Google Drive), dan dropdown **Karakter Maskot** di tab Buat AI menampilkan karakter custom tambahan secara dinamis.
- **Evaluasi & Penyesuaian Gaya Mingguan Otomatis (`src/lib/evaluasi-mingguan-murni.ts`, `src/lib/evaluasi-mingguan-server.ts`, `src/app/api/studio/evaluasi/route.ts`, `src/lib/agenda-server.ts`, `studio/lib/video.mjs`, `studio/studio.mjs`):**
  - Menambahkan *weekly feedback loop* yang berjalan otomatis setiap **Senin pukul 06.00 WIB** lewat cron `detakAgenda()` (serta bisa dijalankan manual lewat tombol di tab **Riset & Gaya**) menggunakan data cache Insight IG + distribusi gaya dari `studio_tugas` tanpa memakan kuota ekstra Meta Graph API.
  - Hasil evaluasi (`gayaPrioritas`, `gayaKurangi`, `saranHook`) tersimpan di `studio_merek.profil.evaluasi_mingguan`, dikirim ke Telegram bila terhubung, dan dipakai worker lewat `pilihKolamGayaDenganEvaluasi()` untuk memprioritaskan gaya video pemenang minggu berikutnya.

## Perbaikan Penguncian Karakter Wanita/Pria, Penyelarasan Suara & Rotasi Gaya Bakafrawi (25 Nov)

- **Kunci Karakter Maskot & Penyelarasan Suara (`studio/lib/video.mjs`, `studio/lib/bank/suara.mjs`, `studio/studio.mjs`):**
  - Menemukan penyebab video Bakafrawi mengabaikan permintaan *"karakter wanita"*: rotasi `otomatis` melempar tugas ke gaya laptop `editorial-scroll` yang mematikan maskot total, belum ada pemilih Karakter Maskot di form Web/Android, dan `pilihKarakter()` tidak membaca arahan maupun nama suara favorit.
  - Menambahkan `uraiPilihanKarakter()` dan `deteksiGenderKarakter()` agar pilihan dropdown/chip `[Karakter: wanita/pria/tanpa]`, kata kunci arahan bebas (seperti *"karakter wanita"*), maupun nama suara favorit (`Mbak Indah`, `Mbak Siti`, `Mas Jowo`) otomatis dikenali.
  - Apabila karakter atau suara bergender diminta saat gaya `otomatis`, `studio.mjs` membatasi pilihan hanya pada gaya bermaskot (`dark-keynote`, `split-hook`, `pov-chat`) sehingga karakter selalu tampil, serta meneruskan `gender` ke `pilihVoiceElevenLabs()` dan profil cadangan `suaraAdegan()` agar gender suara & karakter tidak berlawanan.
- **Keluarkan `editorial-scroll` dari Rotasi Otomatis & Gelapkan Tema Laptop (`studio/studio.mjs`, `studio/remotion/src/Sinematik.tsx`):**
  - Mengeluarkan `editorial-scroll` dari rotasi otomatis Bakafrawi (tetap tersedia bila dipilih manual).
  - Memperbarui `HalamanEditorialScroll` untuk produk digital/software ke palet gelap Bakafrawi (`#0B0E14`, aksen `#18B4A8`/`#34E0CD`), memakai `objectFit: 'contain'` agar tangkapan layar aplikasi tidak terpotong, dan mengisi sub-teks dari ringkasan narasi.
- **Perbaikan Fallback NVIDIA EOL (`studio/lib/naskah.mjs`):**
  - Menghapus `meta/llama-3.3-70b-instruct` (yang mengembalikan HTTP `410 Gone`) dari kandidat bawaan dan membuat `panggilNvidiaWorker()` lanjut mencoba model berikutnya pada HTTP `404` maupun `410`.
- **Pemilih Karakter Maskot di Web & Android (`src/components/admin/studio.tsx`, `aplikasi-android/.../LayarStudio.kt`):**
  - Menambahkan dropdown/chip **Karakter Maskot** (*Otomatis*, *Wanita (Ibu Hijab)*, *Pria (Bapak Kopiah)*, *Tanpa Karakter*) khusus saat membuat Video Bakafrawi dan mengirimkannya melalui tag `[Karakter: ...]`.

## Perbaikan Penjadwalan Otomatis & Perombakan 5 Gaya Video Bakafrawi (25 Nov)

- **Perbaikan Pemicu Jadwal Tayang Otomatis (`src/lib/studio-server.ts`, `src/lib/agenda-server.ts`):**
  - Menemukan akar masalah konten terjadwal telat tayang: `studio_picu()` di Supabase mengembalikan `'tanpa token'` karena secret Vault `github_studio_token` kosong, sehingga cron 5 menit hanya menunggu cron cadangan 30 menit GitHub Actions.
  - Menambahkan `picuStudioJikaAdaKerja()` yang dipanggil setiap 5 menit oleh `detakAgenda()` (Vercel sudah memiliki `GITHUB_STUDIO_TOKEN`), dengan pengaman jeda 8 menit lewat `studio_pengaturan.picu_terakhir`.
- **Rombak Desain Video Bakafrawi agar Tidak Monoton Putih & Sambung ke `studio_referensi` (`studio/studio.mjs`, `studio/lib/video.mjs`, `studio/lib/naskah.mjs`, `studio/remotion/src/`):**
  - Menghapus dominasi warna putih (`clean-ui` tidak lagi masuk rotasi otomatis; 75% rotasi sebelumnya selalu berakhir putih dan kartu di scene masih ter-hardcode `#fff`).
  - Membuka 5 gaya berbeda untuk rotasi & pilihan Bakafrawi: **Dark Tech Bakafrawi** (`dark-keynote` dengan latar `#0A0C10`, aksen teal `#18B4A8`/`#34E0CD`, & kartu gelap transparan di `dasar.tsx`, `Hook.tsx`, `Daftar.tsx`, `Alur.tsx`, `Kasir.tsx`), **Storytelling Full AI 5 Adegan** (`sinematik-ai`), **Laptop Scroll Website/Aplikasi** (`editorial-scroll` di `Sinematik.tsx` adaptif untuk produk digital + audio narasi), **Bold Editorial Gelap** (`split-hook`), serta **POV / Chat Gelap Modern** (`pov-chat`).
  - Menaikkan transparansi & visibilitas foto suasana AI di `Bingkai.tsx` (`0.36` gelap, `0.26` terang).
  - Menyambungkan `semuaReferensi()` ke `buatNaskahVideo()`, `buatNaskahVideoFullAi()`, dan penentuan gaya di `studio/studio.mjs`, serta memperbarui `referensi-video.ts`, `studio.tsx`, dan `LayarStudio.kt` agar pembedah referensi memetakan ke preset gelap/sinematik/editorial yang sesuai.
- Diuji: 21/21 unit test worker (`iklan.test.mjs`), 42/42 unit test web (`npm run uji`), `node --check`, `npx tsc --noEmit`, `eslint` pada file terkait, build Next.js, kompilasi Kotlin Android, dan langsung memicu workflow tayang `studio.yml` untuk konten jadwal jam 09.00 WIB hari ini. **Belum:** inspeksi visual render video Bakafrawi gaya baru secara langsung & build berkas `.apk` rilis ke HP Kyai.

## Perjelas Prompt 6-Blok Google Flow & Auto-Caption Visual Multi-Bingkai Video (25 Nov)

- **Struktur Prompt Google Flow 6-Blok & Panduan 3 Langkah (`src/lib/google-flow-murni.ts`, `/api/studio/google-flow`, `studio-google-flow.tsx`, `LayarStudio.kt`):**
  - Merombak `SKEMA_GOOGLE_FLOW` & `buatPromptGoogleFlow()` agar tiap klip wajib mengikuti format 6 baris terstruktur siap-paste (`SHOT & CAMERA`, `SUBJECT & CONTINUITY`, `SETTING & LIGHTING`, `ACTION TIMELINE (0-8s)` per ketukan detik, `AUDIO & DIALOGUE`/`AUDIO & SFX` dengan identitas fisik pembicara agar suara 2 tokoh tidak tertukar, dan `CONSTRAINTS`).
  - Menambahkan kotak **Panduan Pakai Cepat 3 Langkah di Google Flow**, menaikkan batas token respons LLM (`6500`), menambah tombol **Buat Caption dari Isi Video** di Langkah 2, dan memperbaiki bug pengiriman upload jadwal dari tab Google Flow (`aksi: "buat"`, `jadwal`).
- **Auto-Caption Otomatis Berbasis Isi Video Multi-Bingkai (`src/lib/caption-konsisten.ts`, `/api/studio/caption`, `studio-unggah.tsx`, `Api.kt`, `LayarStudio.kt`):**
  - Begitu video dipilih di **Unggah Manual** (saat sasaran Reels/Feed), browser (`ekstrakBingkaiVideoManual`, 5 bingkai merata 8%–90%) maupun APK Android (`MediaMetadataRetriever`, 4 bingkai merata 10%–88%) langsung menonton isi video dan mengisi caption + hashtag + judul saran secara otomatis.
  - Menambahkan `apakahNamaFileAcak()` agar nama file kamera generik (`VID_...`, `lv_0_...`, `ScreenRecording_...`) tidak dianggap topik dan otomatis diganti dengan `judulSaran` dari AI bila judul masih kosong.
  - Memperbarui `/api/studio/caption` (mendukung hingga 5 bingkai Vision + fallback teks jujur bila penyedia Vision limit) serta menampilkan lencana ringkasan visual yang terbaca AI dari video.
- Diuji: 42/42 unit test (`npm run uji`), `tsc --noEmit`, `eslint` pada 7 berkas terkait (0 error/0 warning), `npm run build` (Next.js 16.4.6), dan `gradlew.bat compileDebugKotlin` (Android). **Belum:** uji langsung unggah video nyata/Google Flow di browser & HP produksi, serta build & install berkas APK Android baru ke HP.

## Multi-Voice ID ElevenLabs & Pemilih Suara Favorit di Studio (24 Nov)

- **Daftar Suara Favorit di Sambungan Studio (`src/lib/studio-server.ts`, `/api/studio/sambungan`, `studio-sambungan.tsx`, `Api.kt`, `LayarStudio.kt`):**
  - Menambahkan penyimpanan **Daftar Suara Favorit ElevenLabs** (maks 20 Voice ID dengan nama & catatan) di `studio_merek.profil.suara_elevenlabs` milik `bakafrawi` tanpa migrasi tabel baru.
  - Kyai kini bisa menambah/menamai beberapa Voice ID favorit atau menghapusnya dari Web Admin maupun APK Android, sementara `ELEVENLABS_API_KEY` tetap disimpan aman sekali saja di GitHub Secrets.
- **Pemilih Suara Saat Buat Video (`studio.tsx`, `LayarStudio.kt`):**
  - Saat memilih jenis **Video**, muncul pilihan **Suara Narasi (ElevenLabs / AI)** berisi mode **Otomatis (Rotasi)**, seluruh **Suara Favorit ElevenLabs**, dan **6 profil gaya bawaan**, dikirim lewat tag `[Suara: ...]`.
- **Dukungan Multi-ID & Rotasi Otomatis di Worker (`studio/lib/bank/suara.mjs`, `studio/lib/video.mjs`, `studio/studio.mjs`):**
  - `daftarVoiceElevenLabs()`, `pilihVoiceElevenLabs()`, dan `uraiPilihanSuara()` mendukung daftar suara favorit DB + banyak ID dipisah koma pada secret `ELEVENLABS_VOICE_ID` (case-sensitive), melakukan rotasi deterministik per video bila mode `otomatis`, membersihkan tag `[Suara: ...]` sebelum dikirim ke LLM naskah, dan meneruskan pilihan suara untuk Bakafrawi (`renderIklan`) maupun Lek Kopi (`suaraAdegan`).
- Diuji: 20/20 unit test worker (`node --test studio/lib/iklan.test.mjs`), 40/40 unit test web (`npm run uji`), `node --check` worker, `npx tsc --noEmit`, `eslint` pada berkas terkait, `npm run build` (Next.js 16.4.6), dan `gradlew.bat compileDebugKotlin` (Android). **Belum:** uji render video ElevenLabs langsung dengan `ELEVENLABS_API_KEY` aktif di GitHub Secrets, uji tampilan/form langsung di HP/browser produksi, serta build & rilis berkas APK Android baru ke HP.

## Integrasi Jalur Suara ElevenLabs + Timestamps Remotion (24 Nov)

- **ElevenLabs TTS Prioritas Utama + Fallback Berjenjang (`studio/lib/bank/suara.mjs`, `studio/lib/video.mjs`, `.github/workflows/studio.yml`):**
  - Menambahkan jalur `elevenlabs` dengan endpoint `/with-timestamps` + `kataDariAlignmentElevenLabs()` sehingga narasi Bahasa Indonesia jauh lebih natural dan subtitle kata-per-kata di Remotion (`renderIklan`) memakai waktu bicara asli.
  - Memasang rantai fallback otomatis `ElevenLabs → Gemini TTS → Edge TTS` apabila kuota bulanan ElevenLabs habis atau belum diisi.
  - Mendaftarkan `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, dan `ELEVENLABS_MODEL` di workflow GitHub Actions serta menambahkan 3 unit test baru di `studio/lib/iklan.test.mjs`.

## Audit Performa IG Hemat AI & 3 Preset Gaya Google Flow Baru (24 Nov)

- **Audit Performa Instagram Tanpa Claude / Tanpa Porter Metrics (`src/lib/audit-ig-murni.ts`, `src/lib/audit-ig-server.ts`, `/api/studio/audit-ig`, `deck.tsx`, `bot-ai.ts`):**
  - Menambahkan tombol **Audit Performa AI** di tab **Insight Instagram** pada panel Deck Admin dan tool `audit_performa_ig` di Bot Telegram.
  - Membaca 100% dari cache Insight Supabase (**0 request tambahan ke Meta Graph API**), lalu menganalisis penyebab postingan terakhir sepi/ramai, pola menang, perbaikan prioritas, dan 2–3 ide konten siap eksekusi memakai router AI hemat (**NVIDIA NIM → Gemini → Cloudflare**).
- **3 Preset Gaya Google Flow Baru & Mode Tanpa Dialog (`google-flow-murni.ts`, `studio-google-flow.tsx`, `LayarStudio.kt`):**
  - Menambahkan gaya **FOOH 3D Billboard / Objek Raksasa** (default 1 klip), **Iklan Komersial Fast-Cut** (default 4 klip), **Sketsa Komedi Visual** (default 2 klip), serta format **Tanpa Dialog (Visual + SFX)** dan opsi 1–2 klip di Web Admin & Android APK.

## Penyatuan Fitur Studio AI Lek Kopi = Bakafrawi (Full AI Tanpa Bank Drive) (24 Nov)

- **Lepas Penguncian Bank Media di Web Admin & APK Android (`studio.tsx`, `LayarStudio.kt`, `Api.kt`):**
  - Merek **Lek Kopi** di tab **Buat AI** tidak lagi disembunyikan ke alur 2 langkah *Bank Media Google Drive*. Kini pilihan **Jenis (`Poster 1:1, 4:5, 9:16` vs `Video Reels`)**, **Fokus Konten** (*Promo & Hari Spesial*, *Menu Minuman*, *Suasana Kedai*, *Cerita Kopi*), **Gaya Desain Poster/Video**, **Mode Visual Full AI**, **Jadwal Tayang**, dan **Sasaran Instagram** tampil seragam seperti Bakafrawi dan langsung dieksekusi 1 langkah.
- **Dukungan Poster & Video Full AI Lek Kopi di Worker (`studio/studio.mjs`, `studio/lib/naskah.mjs`, `studio/lib/templat.mjs`):**
  - Worker kini membangun profil kedai Lek Kopi secara dinamis (`bangunProdukMerek`), berhenti mengindeks Bank Drive `lekkopi`, dan merender poster 3 rasio (`feed`, `potret`, `story`) 100% Full AI tanpa mockup HP (`htmlPoster` adaptif untuk kategori `kedai`) serta video storytelling Full AI (`buatNaskahVideoFullAi` + TTS + `renderSinematikRemotion`) dengan kontak/CTA & hashtag konsisten `@lekkopi.id`.
- **Usulan Arahan & Bot Telegram (`src/lib/usul-arahan.ts`, `src/app/api/studio/arahan/route.ts`, `src/lib/bot-ai.ts`):**
  - Memperbarui endpoint `/api/studio/arahan` dan bot Telegram (`buat_konten`, `usul_arahan_konten`) agar mendukung pembuatan Poster maupun Video Full AI untuk Lek Kopi langsung tanpa melewati alat Bank Media lama.
- **Migrasi Profil Database (`supabase/migrations/20261124153435_lekkopi_full_ai.sql`):**
  - Mencabut `'bank'` dari `studio_merek.profil.bahan` milik `lekkopi`, menyetel `alur: 'langsung'`, dan melengkapi identitas WA, alamat, warna aksen, hashtag, serta gaya copywriter Lek Kopi.
- Diuji: 40/40 unit test (`npm run uji`), `tsc --noEmit`, `eslint` pada file terkait (0 error), `node --check` worker (`studio.mjs`, `naskah.mjs`, `templat.mjs`), smoke test 12 kombinasi poster Lek Kopi di `htmlPoster`, `npm run build` (Next.js 16.4.6), `gradlew.bat compileDebugKotlin` (Android), serta verifikasi migrasi SQL langsung di Supabase produksi (`sapxamvhfuecruqxmulf`). **Belum:** uji render gambar/video Lek Kopi sungguhan, uji Audit Performa IG & preset Google Flow baru di produksi/HP, serta build & rilis berkas APK Android terbaru.

## Upgrade Studio Full AI: NVIDIA NIM, Google Flow Bridge, Caption Konsisten, Variasi Suara, & Perbaikan HP/Insight IG (24 Nov)

- **Perbaikan Layout Overlap Layar HP (`deck.tsx`, `beranda.tsx`, `aplikasi-admin.tsx`, `studio.tsx`):**
  - Menambahkan pengunci lebar (`min-w-0`, `overflow-hidden`, `overflow-x-clip`) pada kartu tugas grid Deck, wrapper Beranda, Studio, dan navigasi atas sehingga judul file video panjang tanpa spasi tidak lagi meluber dan memotong sisi kiri layar HP.
- **Perbaikan Kelengkapan Insight Instagram (`src/lib/instagram-insight.ts`, `Api.kt`):**
  - Menaikkan query lokal Supabase (`studio_tugas` 10 → 40, `studio_referensi` 15 → 50) dan selalu menggabungkannya tanpa menambah request ke Meta.
  - Tarikan manual **Tarik dari IG** kini mengambil `limit=15` dalam 1 request (metrik `views,reach` tetap dibatasi aman maks 6 post terbaru + 2 Story aktif) dan **menggabungkan (`merge`, maks 40 post/merek)** ke cache lama agar postingan sebelumnya tidak terhapus saat penyegaran. Di APK Android (`Api.kt`), tampilan post Insight dinaikkan dari 6 → 30.
- **Integrasi NVIDIA NIM Hemat Budget API (`llm-router.ts`, `studio/lib/naskah.mjs`, `studio/lib/bank/gambar-ai.mjs`, `.github/workflows/studio.yml`):**
  - Menambahkan penyedia **NVIDIA NIM** (Qwen 2.5 72B → DeepSeek V3.2 → Llama 3.3 70B untuk teks/agent, serta **FLUX.1** untuk gambar AI) di urutan prioritas hemat: `NVIDIA NIM → Gemini → Cloudflare → Claude (cadangan terakhir)`.
  - Worker `studio/lib/naskah.mjs` tidak lagi terkunci ke Claude dan kini ikut memakai router hemat multi-provider.
- **Standar Caption & Hashtag Konsisten + Auto-Caption Unggah Manual (`caption-konsisten.ts`, `/api/studio/caption`, `studio-unggah.tsx`, `LayarStudio.kt`):**
  - Standar CTA & blok hashtag inti konsisten per merek (`@lekkopi.id` & `@bakafrawi.project`, anti-duplikat, maks 10 hashtag).
  - Tombol **Buat Caption & Hashtag Otomatis (AI)** di tab Unggah Manual Web/PWA (termasuk analisis bingkai foto/video) maupun APK Android.
- **Agen Riset Viral Anti-Monoton & 6 Profil Suara (`riset-reels.ts`, `/api/studio/arahan`, `studio/lib/bank/suara.mjs`):**
  - Riset tren & usulan arahan kini membaca 12–18 riwayat konten terakhir per merek agar tidak mengulang ide/hook yang sama.
  - `suara.mjs` kini memiliki 6 profil suara & gaya bicara (`santai_indo`, `jawa_timur`, `storytelling_hangat`, `iklan_energik`, `narator_sinematik`, `jawa_krama_ngoko`) yang berotasi otomatis per video.
- **Mode Full AI & Google Flow Bridge (`google-flow-murni.ts`, `/api/studio/google-flow`, `studio-google-flow.tsx`, `studio.tsx`, APK Android v2.3.0):**
  - Tab baru **Google Flow** di Web/PWA dan APK Android (`versionCode 7`, `versionName 2.3.0`): menyusun storyboard + panduan karakter konsisten + prompt Veo 3 siap-copy per klip (dialog Indonesia/Jawa Timur/campuran natural) + caption konsisten, dilengkapi slot **Upload Balik Video Hasil Google Flow** untuk langsung tayang/dijadwalkan ke Instagram.
- Diuji: 37/37 unit test (`npm run uji`), `tsc --noEmit`, `node --check studio/lib/naskah.mjs studio/lib/bank/gambar-ai.mjs studio/lib/bank/suara.mjs`, `npm run build` (Web/PWA), dan `gradlew compileDebugKotlin` (Android v2.3.0). **Belum:** uji langsung di layar HP produksi, uji dengan token Instagram & kunci `NVIDIA_API_KEY` sungguhan, serta rilis berkas APK v2.3.0 di GitHub Releases.

## Rem Keras & Pengamanan Meta/Instagram API (23 Nov)

- **Mode Cache-First (0 Request Meta Otomatis):** `ambilInsightInstagram()` (`src/lib/instagram-insight.ts`) kini hanya membaca cache persisten dari Supabase (`studio_merek.profil.insight_cache`, `studio_tugas`, `studio_referensi`) saat Beranda dibuka. Meta Graph API hanya dihubungi saat tombol **Tarik dari IG** ditekan manual (`?segar=1`).
- **Cooldown 15 Menit & Circuit Breaker 6 Jam:** penyegaran manual dibatasi maksimal 1× per 15 menit per merek aktif; bila Meta mengembalikan galat rate-limit/OAuth/checkpoint/pembatasan akun (`429/401/403`, kode `4/10/17/32/190/200/368`), akun tersebut langsung dijeda otomatis 6 jam tanpa mencoba ulang.
- **Anti-Burst & 0 Request Story >24 Jam:** menghapus `Promise.all` serentak & loop 6× percobaan metrik — diganti maksimal 1 panggilan ringan (`views,reach`) secara berurutan dengan jeda 250ms untuk maks 2 Story aktif `< 24 jam` dan 4 postingan terbaru.
- **Matikan Auto-Refresh 30 Detik (`src/components/admin/deck.tsx`):** menghapus `setInterval(..., 30_000)` di panel Deck agar tab Admin yang dibiarkan terbuka tidak pernah melakukan polling berulang ke server/Meta.

## Unggah Video Manual Terjadwal, Story Acak Anti-Ulang, Insight Penonton Story & Tata Ulang UI Studio (23 Nov)

- **Unggah Video / Foto Manual & Jadwal Otomatis (Story maupun Reels):**
  - Rute baru `/api/studio/unggah` (`src/app/api/studio/unggah/route.ts` & `buatTugasUnggahManual` di `src/lib/studio-server.ts`) untuk unggah langsung ke Supabase Storage bucket `studio` (maks 95 MB), membuat sampul otomatis, lalu memilih **Jadwalkan Otomatis (tanggal & jam WIB + tombol cepat)**, **Tayangkan Sekarang**, atau **Simpan Draf** ke sasaran `Reels`, `Story saja`, `Reels + Story`, `Feed + Story`, atau `Feed saja`.
  - Tersedia di tab **Unggah & Jadwal** pada Web/PWA (`src/components/admin/studio-unggah.tsx`) maupun tab **Unggah** di APK Android (`LayarStudio.kt` & `Api.kt`).
- **Story Otomatis Harian — Mode Acak 1 Video/Hari (Anti-Ulang):**
  - Menambahkan mode `"acak"` + pencatatan riwayat (`riwayatVideo`, `terakhirVideoId`) di `src/lib/jadwal-tayang-murni.ts`, `src/lib/studio-server.ts`, dan mesin worker `studio/studio.mjs`. Setiap hari sistem mengundi 1 video aktif tanpa mengulang video kemarin sampai seluruh koleksi kebagian giliran; dilengkapi info **video pilihan acak berikutnya** dan tombol **Acak Ulang** (`aksi: "acak-ulang"` di `/api/studio/rutin`), serta dukungan unggah banyak video sekaligus.
  - Memperbaiki bug di APK Android (`Api.kt`) yang sebelumnya mengirim nama kolom tidak cocok (`jamWib`/`modeKonten`) sehingga pengaturan Story Otomatis dari HP sebelumnya tidak tersimpan sempurna; juga memperbaiki `"reels_story"` → `"reels+story"` & `"feed_story"` → `"feed+story"`.
- **Perbaikan Insight Penonton Story Instagram (`src/lib/instagram-insight.ts`, `deck.tsx`, `Layar.kt`):**
  - Menemukan 4 akar penyebab penonton Story tidak muncul: (1) `infoIg.story`/`stories` sebelumnya tidak dibaca, (2) endpoint `/{user}/media` tidak mengembalikan Story — kini ikut menarik Story aktif `< 24 jam` dari `/{user}/stories`, (3) metrik `saved` ditolak Meta API untuk Story — kini memakai paket metrik khusus Story (`views,reach,replies,shares` + fallback `impressions,reach`), dan (4) menyimpan snapshot penonton Story ke `studio_tugas.tayang.instagram.story.insight` agar angka terakhir tetap terbaca meski Story sudah lewat 24 jam.
  - Kartu Insight di Web (`deck.tsx`) dan Android (`Layar.kt`) kini menampilkan lencana **STORY** / **REELS** / **FEED**, jumlah penonton Story, jangkauan akun unik, balasan Story, serta status arsip `>24 jam`.
- **Penataan Ulang Tampilan Menu Studio (Web/PWA & Android APK v2.2.0):**
  - Menu Studio Web/PWA (`src/components/admin/studio.tsx`) kini memakai navigasi **6 sub-tab seragam** dengan Android (`Unggah & Jadwal`, `Story Otomatis`, `Buat AI`, `Riwayat`, `Riset & Gaya`, `Sambungan`), header ringkasan status cepat, serta filter Riwayat (`Semua`, `Terjadwal`, `Perlu Cek`, `Tayang`).
  - APK Android (`v2.2.0`, `versionCode 6`) juga dilengkapi tab Unggah Manual dari galeri HP, daftar & pengelola koleksi video Story Otomatis, filter Riwayat, dan dialog Jadwal Custom (tanggal, jam WIB, & sasaran).
- Diuji: 33/33 unit test (`npm run uji`), `tsc --noEmit`, `node --check studio/studio.mjs studio/lib/instagram.mjs`, `npm run build` (Web/PWA), dan `gradlew compileDebugKotlin` (Android). **Belum:** commit/push ke GitHub, deploy Vercel, build/rilis APK v2.2.0 ke GitHub Releases, serta uji langsung di HP dengan token Instagram asli.

## Pembaruan Tampilan Situs Utama — Paket WebGL 3D & Komponen Interaktif (21 Nov)

- **Lanyard 3D Fisika Tali Asli (`lanyard-3d-canvas.tsx` & `kartu-lanyard.tsx`):** ditenagai
  `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, dan `meshline`. Tali
  lanyard melengkung & mengayun dengan simulasi fisika nyata, kartu bisa ditarik/dilempar/berputar
  360° (sisi depan menampilkan **foto portrait dari Admin → Situs → Hero** atau emblem bawaan; sisi
  belakang menampilkan segel kaligrafi Bakafrawi), dimuat lazy client-only dengan pengaman fallback WebGL.
- **Latar WebGL Aurora Shader (`aurora-bg.tsx`) & Smooth Scroll (`smooth-scroll.tsx`):** shader GLSL
  real-time via `ogl` bernuansa teal-emas-gelap di belakang Hero serta gulir halaman mulus berbasis `lenis`.
- **Komponen Interaktif Ala React Bits & Magic UI (`efek-teks.tsx`):** *BlurText* judul Hero,
  *ShinyText* kilau lencana status, *CountUp* angka statistik, *PitaBerjalan* (Scroll Velocity Marquee),
  *BorderBeam* cahaya mengalir di tepian kartu produk, *KartuMiring3D* pada mockup produk, dan
  *TombolMagnet* di CTA utama.
- **Animasi Logo Kaligrafi Bakafrawi (`intro-splash.tsx` & `segel-logo.tsx`):**
  - *Splash Intro* singkat (±0,9 detik, sekali per sesi tab) dengan pendar emas logo kaligrafi lalu tirai
    terangkat halus membuka halaman utama.
  - *Segel Kaligrafi Orbital* interaktif di bagian **Tentang** (`tentang-proses.tsx`): teks melingkar
    dan cincin orbit berputar pelan; medali logo bisa diklik untuk berputar 360°.
- **Optimasi Performa WebGL & Mobile:** *IntersectionObserver* otomatis mem-pause `AuroraBg` dan
  `Lanyard3DCanvas` (`frameloop="demand"` + `Physics paused`) saat Hero keluar layar (0% beban GPU
  saat scroll ke bawah), menurunkan DPR & resolusi tekstur kartu (hemat ~60% VRAM), mengganti
  `<Environment blur>` & `MeshPhysicalMaterial` ke pencahayaan studio ringan, mengganti marquee
  `PitaBerjalan` ke pure CSS compositor, dan menonaktifkan Lenis di layar sentuh HP.
- **Floating Glass Pill Navbar & Garis Progres Baca (`navbar.tsx`)** serta **Kartu Bento Spotlight**
  (`kartu-spotlight.tsx`) di Layanan & Produk.

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
