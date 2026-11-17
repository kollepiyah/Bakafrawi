-- Studio AI lebih andal:
-- 1) tugas/tayang yang tersangkut "proses" (mesin mati di tengah jalan) dipulihkan jadi "gagal";
-- 2) Supabase (pg_cron tiap 5 menit) menyalakan mesin di GitHub hanya bila ada kerja — jadwal
--    GitHub sering telat 10–30 menit dan dimatikan GitHub bila repo 60 hari tanpa commit;
-- 3) studio_ada_kerja() dipakai workflow untuk melewati pemasangan ffmpeg bila tak ada kerja.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

alter table public.studio_tugas add column tayang_mulai timestamptz;
alter table public.studio_pengaturan
  add column token_dicek timestamptz,
  add column picu_terakhir timestamptz;

create or replace function public.studio_ambil_tayang()
returns setof public.studio_tugas
language sql
security definer
set search_path = ''
as $$
  update public.studio_tugas
     set status_tayang = 'proses', tayang_mulai = now()
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

-- 35 menit > batas waktu job (30 menit): yang masih "proses" selama itu pasti ditinggal mesinnya.
-- Tayang TIDAK diulang otomatis — bisa saja sudah naik ke Instagram sebelum mesin mati.
create or replace function public.studio_pulihkan()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buat int;
  v_tayang int;
begin
  update public.studio_tugas
     set status = 'gagal', selesai = now(),
         galat = 'Mesin berhenti di tengah pembuatan (batas waktu atau galat GitHub). Tekan Buat ulang.'
   where status = 'proses' and mulai < now() - interval '35 minutes';
  get diagnostics v_buat = row_count;

  update public.studio_tugas
     set status_tayang = 'gagal',
         galat = 'Terputus saat menayangkan. Cek Instagram dulu; bila belum muncul, tekan Tayangkan lagi.'
   where status_tayang = 'proses' and coalesce(tayang_mulai, dibuat) < now() - interval '35 minutes';
  get diagnostics v_tayang = row_count;

  return jsonb_build_object('buat', v_buat, 'tayang', v_tayang);
end;
$$;
revoke all on function public.studio_pulihkan() from public, anon, authenticated;

-- Ada yang perlu dikerjakan mesin? Token IG yang hampir habis dicek paling sering sehari sekali.
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
           select 1 from public.studio_pengaturan
            where ig_token is not null and ig_host = 'instagram'
              and ig_kedaluwarsa < now() + interval '10 days'
              and coalesce(token_dicek, '-infinity') < now() - interval '1 day');
$$;
revoke all on function public.studio_ada_kerja() from public, anon, authenticated;

-- Pemicu dari Supabase. Token GitHub (fine-grained, Actions: Read and write, hanya repo Bakafrawi)
-- disimpan Kyai di Vault bernama 'github_studio_token'; tanpa token fungsi ini diam saja.
create or replace function public.studio_picu()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'github_studio_token';
  if coalesce(v_token, '') = '' then return 'tanpa token'; end if;
  if not public.studio_ada_kerja() then return 'tak ada kerja'; end if;
  -- Satu putaran bisa 3–10 menit (termasuk memasang ffmpeg): jangan menumpuk antrean run.
  if exists (select 1 from public.studio_pengaturan where picu_terakhir > now() - interval '10 minutes') then
    return 'baru dipicu';
  end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/kollepiyah/Bakafrawi/actions/workflows/studio.yml/dispatches',
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'bakafrawi-studio',
      'Content-Type', 'application/json'));
  update public.studio_pengaturan set picu_terakhir = now() where id = 1;
  return 'dipicu';
end;
$$;
revoke all on function public.studio_picu() from public, anon, authenticated;

select cron.schedule('studio-picu', '*/5 * * * *', 'select public.studio_picu()');
