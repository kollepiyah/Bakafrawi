# Panduan Agenda & APK Bakafrawi Studio

Bakafrawi Studio (bakafrawi.com/admin, juga APK Android) punya menu **Beranda · Agenda · Konten · Situs**.
Agenda tersinkron **dua arah** dengan Google Calendar akun Kyai:

- Acara dari layar Agenda, APK, atau bot Telegram langsung masuk Google Calendar.
- Acara yang dibuat langsung di Google Calendar (mis. dari HP utama) ikut tampil di Studio dalam ≤5 menit.
- Bot Telegram mengirim **agenda hari ini pukul 05.30 WIB** dan **pengingat 30 menit** sebelum tiap acara.
- APK juga memberi notifikasi 30 menit sebelum acara (bisa dimatikan di menu Lainnya).
- Di bot cukup chat biasa: "besok jam 9 rapat di MU", "geser rapat MU ke jam 10", "agenda Jumat apa saja?",
  atau perintah `/agenda` dan `/agenda besok`.

## Pemasangan (sekali)

### 1. Google Cloud — izin Google Calendar
1. console.cloud.google.com → buat proyek baru, mis. **Bakafrawi Studio**.
2. *APIs & Services → Library* → cari **Google Calendar API** → **Enable**.
3. *APIs & Services → OAuth consent screen* (Google Auth Platform):
   - User type **External**, nama aplikasi "Bakafrawi Studio", email dukungan = email Kyai.
   - *Data access / Scopes*: tambahkan `.../auth/calendar.events`.
   - *Audience*: tekan **Publish app** sehingga status **In production**.
     **Penting:** bila dibiarkan "Testing", Google memutus sambungan tiap 7 hari. Aplikasi tidak perlu
     diverifikasi Google karena hanya Kyai yang memakai; saat menyambung nanti muncul layar
     "Google hasn't verified this app" → *Advanced* → *Go to Bakafrawi Studio (unsafe)* — aman, itu aplikasi Kyai sendiri.
4. *Credentials → Create credentials → OAuth client ID* → jenis **Web application**:
   - Authorized redirect URI: `https://bakafrawi.com/api/agenda/google/kembali`
   - Salin **Client ID** dan **Client secret**.

### 2. Vercel → Environment Variables (jenis Secret, Production + Preview), lalu redeploy
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — dari langkah 1.
- `AGENDA_DETAK_RAHASIA` — kode acak: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

### 3. Database
```bash
npx supabase db push --remote
```
(migrasi `20261118210000_agenda.sql`: tabel `agenda`, kolom Google di `studio_pengaturan`, detak 5 menit.)

Lalu Supabase → SQL Editor, jalankan sekali dengan kode **yang sama** dengan `AGENDA_DETAK_RAHASIA`:
```sql
select vault.create_secret('KODE-ACAK-TADI', 'agenda_detak_rahasia');
```
Tanpa langkah ini sinkron otomatis, pengingat, dan ringkasan pagi tidak berjalan (tambah/ubah dari Studio
tetap langsung masuk Google).

### 4. Sambungkan
1. bakafrawi.com/admin → **Agenda** → **Hubungkan Google Calendar** → pilih akun Google Kyai → izinkan.
2. Supaya perintah `/agenda` muncul di menu bot: **Konten → Sambungan → Sambungkan webhook bot** sekali lagi.

## APK Android (Kotlin, folder `aplikasi-android/`)

APK hanya menanam alamat `https://bakafrawi.com`; URL & kunci publik Supabase diambil dari situs saat
masuk. Masuk memakai email + kata sandi admin yang sama dengan bakafrawi.com/admin. Menu **Konten** membuka
Studio konten di browser (versi native menyusul).

### Kunci tanda tangan (sekali, simpan baik-baik — hilang = tak bisa memperbarui aplikasi)
```bash
cd "D:/Aplikasi Project/Bakafrawi Site/aplikasi-android"
keytool -genkeypair -v -keystore bakafrawi-studio.jks -alias bakafrawi-studio -keyalg RSA -keysize 2048 -validity 10000
```
Buat `aplikasi-android/keystore.properties` (tidak ikut git):
```
storeFile=bakafrawi-studio.jks
storePassword=…
keyAlias=bakafrawi-studio
keyPassword=…
```
Simpan salinan `.jks` + sandinya di tempat aman di luar laptop. Kunci ini **baru**, bukan kunci Ammu/Maktaba.

### Build APK rilis
```bash
cd "D:/Aplikasi Project/Bakafrawi Site/aplikasi-android"
./gradlew assembleRelease
```
Hasil: `aplikasi-android/app/build/outputs/apk/release/app-release.apk` → kirim ke HP, pasang
(izinkan "pasang dari sumber ini"), izinkan notifikasi saat diminta.

Sebelum build pertama, `aplikasi-android/local.properties` harus berisi lokasi Android SDK:
`sdk.dir=C\:\\Users\\Lenovo\\AppData\\Local\\Android\\Sdk`
