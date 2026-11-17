-- Studio AI gelombang 2: latar gambar AI, persetujuan tayang, posting Instagram, bot Telegram.

alter table public.studio_tugas
  add column latar text not null default 'polos' check (latar in ('polos', 'ai')),
  add column status_tayang text not null default 'belum'
    check (status_tayang in ('belum', 'antre', 'dijadwalkan', 'proses', 'tayang', 'gagal', 'ditolak')),
  add column jadwal_tayang timestamptz,
  add column tayang jsonb not null default '{}'::jsonb;

create index studio_tugas_tayang on public.studio_tugas (jadwal_tayang)
  where status_tayang in ('antre', 'dijadwalkan');

-- Satu baris pengaturan berisi kredensial (token Instagram, chat Telegram pemilik). Tanpa policy
-- RLS sama sekali: hanya service role (mesin Studio & server situs) yang bisa membaca/menulis.
create table public.studio_pengaturan (
  id int primary key default 1 check (id = 1),
  telegram_chat_id bigint,
  ig_token text,
  ig_user_id text,
  ig_akun text,
  ig_host text not null default 'instagram' check (ig_host in ('instagram', 'facebook')),
  ig_dibuat timestamptz,
  ig_kedaluwarsa timestamptz,
  diubah timestamptz not null default now()
);
alter table public.studio_pengaturan enable row level security;
insert into public.studio_pengaturan (id) values (1) on conflict do nothing;

-- Mesin mengambil postingan yang waktunya tiba secara atomik (sama seperti studio_ambil_tugas).
create or replace function public.studio_ambil_tayang()
returns setof public.studio_tugas
language sql
security definer
set search_path = ''
as $$
  update public.studio_tugas
     set status_tayang = 'proses'
   where id = (
     select id from public.studio_tugas
      where status = 'selesai'
        and (status_tayang = 'antre' or (status_tayang = 'dijadwalkan' and jadwal_tayang <= now()))
      order by coalesce(jadwal_tayang, dibuat)
      limit 1
      for update skip locked
   )
  returning *;
$$;
revoke all on function public.studio_ambil_tayang() from public, anon, authenticated;
