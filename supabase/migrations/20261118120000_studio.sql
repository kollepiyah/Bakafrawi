-- Studio AI: admin membuat tugas (gambar/video promosi) → GitHub Actions mengerjakannya →
-- hasil diunggah ke bucket `studio` dan dicatat di tugas yang sama.

create table public.studio_tugas (
  id uuid primary key default gen_random_uuid(),
  dibuat timestamptz not null default now(),
  dibuat_oleh uuid references auth.users (id) on delete set null default auth.uid(),
  jenis text not null check (jenis in ('gambar', 'video')),
  produk_slug text not null,
  arahan text not null default '',
  status text not null default 'antre' check (status in ('antre', 'proses', 'selesai', 'gagal')),
  mulai timestamptz,
  selesai timestamptz,
  naskah jsonb,
  caption text,
  hasil jsonb not null default '[]'::jsonb,
  galat text
);
create index studio_tugas_antre on public.studio_tugas (dibuat) where status = 'antre';

alter table public.studio_tugas enable row level security;
create policy "tugas dibaca admin" on public.studio_tugas
  for select to authenticated using ((select public.is_admin()));
create policy "tugas dibuat admin" on public.studio_tugas
  for insert to authenticated with check ((select public.is_admin()));
create policy "tugas dihapus admin" on public.studio_tugas
  for delete to authenticated using ((select public.is_admin()));
-- Pembaruan status/hasil hanya oleh mesin Studio (service role, melewati RLS).

-- Mesin Studio mengambil satu tugas antre secara atomik, supaya dua putaran tak mengerjakan
-- tugas yang sama.
create or replace function public.studio_ambil_tugas()
returns setof public.studio_tugas
language sql
security definer
set search_path = ''
as $$
  update public.studio_tugas
     set status = 'proses', mulai = now()
   where id = (
     select id from public.studio_tugas
      where status = 'antre'
      order by dibuat
      limit 1
      for update skip locked
   )
  returning *;
$$;
revoke all on function public.studio_ambil_tugas() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio', 'studio', true, 104857600, array['image/png', 'image/jpeg', 'video/mp4'])
on conflict (id) do nothing;
create policy "hasil studio dihapus admin" on storage.objects
  for delete to authenticated using (bucket_id = 'studio' and (select public.is_admin()));
