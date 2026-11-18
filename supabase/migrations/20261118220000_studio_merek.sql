-- Studio multi-merek (penyatuan Studio Bakafrawi + Lek Kopi, gelombang 1).
-- Satu mesin, banyak merek: tiap tugas milik satu merek; identitas tampilan & gaya naskah ada di
-- profil merek; akun Instagram/TikTok disimpan per merek (bukan lagi satu di studio_pengaturan).

create table public.studio_merek (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  nama text not null,
  aktif boolean not null default false,
  urutan int not null default 0,
  -- profil: situs, whatsapp, aksen (#hex), aksen_muda, logo (URL), gaya (arahan copywriter),
  -- hashtag (array), alur ('langsung' | 'naskah'), bahan (array: 'rekaman' | 'poster' | 'bank').
  profil jsonb not null default '{}'::jsonb,
  diubah timestamptz not null default now()
);
alter table public.studio_merek enable row level security;
create policy "merek dibaca admin" on public.studio_merek
  for select to authenticated using ((select public.is_admin()));
create policy "merek diubah admin" on public.studio_merek
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.studio_merek (slug, nama, aktif, urutan, profil) values
  ('bakafrawi', 'Bakafrawi', true, 0, jsonb_build_object(
     'situs', 'bakafrawi.com',
     'aksen', '#c9a24b', 'aksen_muda', '#e3c989',
     'alur', 'langsung',
     'bahan', jsonb_build_array('rekaman', 'poster'),
     'hashtag', jsonb_build_array('bakafrawi', 'jasapembuatanaplikasi', 'aplikasiandroid', 'websitebisnis', 'umkm'),
     'gaya', 'Kamu copywriter iklan media sosial untuk Bakafrawi Project, software developer di Sidoarjo yang membuat website & aplikasi custom serta menjual aplikasi siap pakai. Tulis dalam Bahasa Indonesia yang hangat, jelas, dan meyakinkan — bukan bahasa robot, tanpa klaim berlebihan atau angka yang tidak diberikan. Untuk karya pesanan, posisikan sebagai bukti kemampuan: "kami bisa membuatkan yang serupa untuk Anda". Jangan menyebut harga kecuali diberikan.')),
  -- Belum aktif: bahan "bank media" (video dari foto/video kafe di Google Drive) menyusul di gelombang 2.
  ('lekkopi', 'Lek Kopi', false, 1, jsonb_build_object(
     'alur', 'naskah',
     'bahan', jsonb_build_array('bank', 'poster')))
on conflict (slug) do nothing;

alter table public.studio_tugas
  add column merek text not null default 'bakafrawi' references public.studio_merek (slug) on update cascade;

-- Kredensial sosmed per merek. data = bentuk yang dipakai mesin apa adanya
-- (Instagram: ig_token, ig_host, ig_user_id, ig_akun, ig_dibuat, ig_kedaluwarsa).
-- Tanpa policy: hanya service role (server situs & mesin Studio) yang bisa membaca token.
create table public.studio_kredensial (
  merek text not null references public.studio_merek (slug) on update cascade on delete cascade,
  layanan text not null check (layanan in ('instagram', 'tiktok')),
  data jsonb not null,
  dicek timestamptz,
  diubah timestamptz not null default now(),
  primary key (merek, layanan)
);
alter table public.studio_kredensial enable row level security;

insert into public.studio_kredensial (merek, layanan, data, dicek)
select 'bakafrawi', 'instagram',
       jsonb_strip_nulls(jsonb_build_object(
         'ig_token', ig_token, 'ig_host', ig_host, 'ig_user_id', ig_user_id, 'ig_akun', ig_akun,
         'ig_dibuat', ig_dibuat, 'ig_kedaluwarsa', ig_kedaluwarsa)),
       token_dicek
  from public.studio_pengaturan
 where id = 1 and ig_token is not null
on conflict do nothing;

-- Pemicu mesin: token Instagram Login merek mana pun yang hampir habis (dicek paling sering sehari sekali).
create or replace function public.studio_ada_kerja()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.studio_tugas
            where status = 'antre'
               or (status = 'proses' and mulai < now() - interval '35 minutes')
               or (status = 'selesai' and (status_tayang = 'antre'
                    or (status_tayang = 'dijadwalkan' and jadwal_tayang <= now())))
               or (status_tayang = 'proses' and coalesce(tayang_mulai, dibuat) < now() - interval '35 minutes'))
      or exists (
           select 1 from public.studio_kredensial
            where layanan = 'instagram' and data->>'ig_host' = 'instagram'
              and (data->>'ig_kedaluwarsa')::timestamptz < now() + interval '10 days'
              and coalesce(dicek, '-infinity') < now() - interval '1 day');
$$;
revoke all on function public.studio_ada_kerja() from public, anon, authenticated;

alter table public.studio_pengaturan
  drop column ig_token, drop column ig_user_id, drop column ig_akun, drop column ig_host,
  drop column ig_dibuat, drop column ig_kedaluwarsa, drop column token_dicek;
