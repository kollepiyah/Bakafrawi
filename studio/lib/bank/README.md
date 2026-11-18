# Bahan "bank media" (dari Studio Lek Kopi)

Modul di folder ini dipindah **utuh** dari `Lek Kopi App/kantor-studio/lib/` (18 Nov 2026,
penyatuan Studio gelombang 2) supaya video bergaya Lek Kopi — potongan di ketukan musik, transisi,
huruf berganti (`studio/huruf/`), gambar AI dihidupkan, suara Gemini/edge, pemeriksa "mata" Claude —
dibuat oleh mesin Studio Bakafrawi untuk merek mana pun yang memakai bahan `bank`.

Status: **render sudah jalan** (`node uji-bank.mjs "<folder bank>"`). Belum tersambung ke
`studio.mjs`: indeks bank (`bank.mjs`) dan kurasi/gaya (`mata.mjs`) masih memakai `sql` Postgres skema
`agent` milik Lek Kopi — diganti ke tabel Bakafrawi per merek di gelombang berikutnya, bersama alur
naskah dua langkah dan draf TikTok (`sosmed.mjs`).

Duplikat yang harus dilebur setelah tersambung: `gambar-ai.mjs` (versi ini lebih lengkap dari
`../gambar-ai.mjs`) dan suara (`suara.mjs` vs `../suara.mjs`).
