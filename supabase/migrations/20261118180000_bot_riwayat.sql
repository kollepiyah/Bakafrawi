-- Ingatan pendek bot Telegram untuk chat bebas: beberapa giliran terakhir (teks saja), supaya
-- Kyai bisa menyambung ("yang nomor 2 jadikan poster"). Tetap di tabel tanpa policy RLS.
alter table public.studio_pengaturan
  add column bot_riwayat jsonb not null default '[]'::jsonb;
