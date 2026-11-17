-- Panel admin bakafrawi.com: isi situs disimpan sebagai satu dokumen JSON (bentuknya divalidasi
-- skema zod di aplikasi), hanya admin yang boleh mengubah, semua orang boleh membaca.

-- Daftar admin. Tanpa policy RLS → tak bisa dibaca/diubah lewat API; diisi dari SQL Editor.
create table public.admin (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dibuat timestamptz not null default now()
);
alter table public.admin enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Isi situs. Satu baris per dokumen (saat ini hanya id = 'situs').
create table public.konten (
  id text primary key,
  data jsonb not null,
  diubah timestamptz not null default now(),
  diubah_oleh uuid references auth.users (id) on delete set null
);
alter table public.konten enable row level security;

create policy "konten dibaca publik" on public.konten
  for select to anon, authenticated using (true);
create policy "konten ditambah admin" on public.konten
  for insert to authenticated with check ((select public.is_admin()));
create policy "konten diubah admin" on public.konten
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Riwayat: setiap kali isi diubah, versi lamanya disimpan — jaring pengaman bila salah edit.
create table public.konten_riwayat (
  id bigint generated always as identity primary key,
  konten_id text not null,
  data jsonb not null,
  diubah timestamptz not null,
  diubah_oleh uuid,
  diarsipkan timestamptz not null default now()
);
alter table public.konten_riwayat enable row level security;
create policy "riwayat dibaca admin" on public.konten_riwayat
  for select to authenticated using ((select public.is_admin()));

create or replace function public.arsipkan_konten()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.konten_riwayat (konten_id, data, diubah, diubah_oleh)
  values (old.id, old.data, old.diubah, old.diubah_oleh);
  new.diubah := now();
  new.diubah_oleh := (select auth.uid());
  return new;
end;
$$;
create trigger konten_sebelum_ubah
  before update on public.konten
  for each row execute function public.arsipkan_konten();

-- Gambar yang diunggah dari panel admin (logo & tangkapan layar produk). Publik dibaca.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "media diunggah admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and (select public.is_admin()));
create policy "media diubah admin" on storage.objects
  for update to authenticated using (bucket_id = 'media' and (select public.is_admin()));
create policy "media dihapus admin" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and (select public.is_admin()));
