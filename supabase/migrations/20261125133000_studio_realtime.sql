-- Aktifkan Supabase Realtime untuk tabel studio_tugas agar status render/tayang di /admin terbarui otomatis.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'studio_tugas'
  ) then
    alter publication supabase_realtime add table public.studio_tugas;
  end if;
end $$;
