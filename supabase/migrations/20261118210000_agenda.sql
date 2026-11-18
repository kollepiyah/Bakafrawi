-- Bakafrawi Studio tahap 1: agenda harian Kyai, tersinkron dua arah dengan Google Calendar.
-- Google Calendar = sumber utama; tabel ini salinan supaya Studio, APK, dan bot bisa membacanya.
-- Semua penulisan lewat server situs (service role) supaya aturan + dorong ke Google ada di satu tempat.

create table public.agenda (
  id uuid primary key default gen_random_uuid(),
  judul text not null check (length(judul) between 1 and 200),
  mulai timestamptz not null,
  selesai timestamptz not null,
  seharian boolean not null default false,
  lokasi text,
  catatan text,
  google_id text unique,
  berulang boolean not null default false,
  status text not null default 'aktif' check (status in ('aktif', 'batal')),
  -- true = perubahan lokal belum terkirim ke Google (dicoba ulang tiap detak 5 menit).
  perlu_sinkron boolean not null default true,
  diingatkan timestamptz,
  dibuat timestamptz not null default now(),
  diubah timestamptz not null default now(),
  check (selesai > mulai)
);
create index agenda_waktu on public.agenda (mulai) where status = 'aktif';
create index agenda_tertunda on public.agenda (diubah) where perlu_sinkron;

alter table public.agenda enable row level security;
create policy "agenda dibaca admin" on public.agenda
  for select to authenticated using ((select public.is_admin()));

-- Kredensial Google & status ringkasan pagi ikut di baris pengaturan (tanpa policy: hanya service role).
alter table public.studio_pengaturan
  add column google_refresh_token text,
  add column google_email text,
  add column google_galat text,
  add column google_disinkron timestamptz,
  add column ringkasan_terakhir date;

-- Detak agenda tiap 5 menit: Supabase memanggil /api/agenda/detak di situs (sinkron Google,
-- pengingat 30 menit, ringkasan pagi 05.30 WIB). Cron Vercel paket gratis hanya sekali sehari.
-- Kode rahasia disimpan Kyai di Vault bernama 'agenda_detak_rahasia' (sama dengan env AGENDA_DETAK_RAHASIA
-- di Vercel); tanpa itu fungsi ini diam saja.
create or replace function public.agenda_detak()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rahasia text;
begin
  select decrypted_secret into v_rahasia from vault.decrypted_secrets where name = 'agenda_detak_rahasia';
  if coalesce(v_rahasia, '') = '' then return 'tanpa rahasia'; end if;
  perform net.http_post(
    url := 'https://bakafrawi.com/api/agenda/detak',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-detak-rahasia', v_rahasia),
    timeout_milliseconds := 60000);
  return 'dipicu';
end;
$$;
revoke all on function public.agenda_detak() from public, anon, authenticated;

select cron.schedule('agenda-detak', '*/5 * * * *', 'select public.agenda_detak()');
