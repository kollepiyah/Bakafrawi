-- Studio multi-merek gelombang 2b: bahan "bank media" (video dari foto/video di Google Drive merek)
-- dan alur naskah dua langkah (naskah disetujui → video dibuat → video disetujui → tayang).

-- 'naskah' = naskah sudah ditulis, menunggu persetujuan Kyai; mesin hanya mengambil 'antre'.
alter table public.studio_tugas drop constraint if exists studio_tugas_status_check;
alter table public.studio_tugas
  add constraint studio_tugas_status_check check (status in ('naskah', 'antre', 'proses', 'selesai', 'gagal'));

-- Indeks isi bank media per merek. path relatif terhadap akar bank (subfolder = tag), sama dengan
-- susunan folder Drive: racik/…, suasana/…, menu/<nama menu>/…, logo/…, musik/….
create table public.studio_bank (
  merek text not null references public.studio_merek (slug) on update cascade on delete cascade,
  path text not null,
  tag text not null,
  jenis text not null check (jenis in ('foto', 'video', 'logo', 'musik')),
  durasi numeric,
  lebar int,
  tinggi int,
  -- versi = "ukuran:waktu ubah" dari Drive: hanya berkas baru/berubah yang diunduh & diperiksa ulang.
  versi text,
  -- kurasi = penilaian "mata" Claude (deskripsi, kualitas, bagian terbaik) — diisi mesin.
  kurasi jsonb,
  diperbarui timestamptz not null default now(),
  primary key (merek, path)
);
alter table public.studio_bank enable row level security;
create policy "bank dibaca admin" on public.studio_bank
  for select to authenticated using ((select public.is_admin()));

-- Profil gaya video hasil belajar dari video referensi merek (tempo, transisi, filter, teks).
create table public.studio_gaya (
  merek text primary key references public.studio_merek (slug) on update cascade on delete cascade,
  profil jsonb not null default '{}'::jsonb,
  minta_ulang boolean not null default false,
  diubah timestamptz not null default now()
);
alter table public.studio_gaya enable row level security;
create policy "gaya dibaca admin" on public.studio_gaya
  for select to authenticated using ((select public.is_admin()));

-- Kapan bank merek terakhir diindeks mesin. Naskah butuh daftar isi bank, jadi mesin juga
-- dinyalakan untuk mengindeks ulang tiap 6 jam walau tak ada tugas (lihat studio_ada_kerja).
alter table public.studio_merek add column bank_diindeks timestamptz;

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
              and coalesce(dicek, '-infinity') < now() - interval '1 day')
      or exists (
           select 1 from public.studio_merek
            where aktif and profil->'bahan' ? 'bank'
              and coalesce(bank_diindeks, '-infinity') < now() - interval '6 hours');
$$;
revoke all on function public.studio_ada_kerja() from public, anon, authenticated;

-- Lek Kopi: bank di Google Drive Kyai (remote rclone "gdrive"), naskah dari data kedai lewat
-- pintu-bakafrawi. gambar_ai_maks = batas adegan gambar AI per video (0 = tanpa).
update public.studio_merek
   set profil = profil || jsonb_build_object(
         'drive', 'gdrive:Lek Kopi Konten',
         'naskah', 'lekkopi',
         'gambar_ai_maks', 2,
         'situs', 'Lek Kopi Waru',
         'hashtag', jsonb_build_array('lekkopi', 'ngopisidoarjo', 'waru', 'sidoarjo', 'kopisusu')),
       diubah = now()
 where slug = 'lekkopi';
