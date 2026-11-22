-- Statistik pengunjung situs first-party (anti-bot, 1 pengunjung unik per hari WIB, hemat penyimpanan).

create table if not exists public.kunjungan_harian (
  tanggal date primary key,
  pengunjung_unik integer not null default 0,
  tayangan integer not null default 0,
  perangkat_hp integer not null default 0,
  perangkat_desktop integer not null default 0
);

create table if not exists public.kunjungan_detail (
  tanggal date not null,
  jalur text not null,
  sumber text not null,
  tayangan integer not null default 0,
  primary key (tanggal, jalur, sumber)
);

create table if not exists public.kunjungan_unik_harian (
  tanggal date not null,
  sidik text not null,
  primary key (tanggal, sidik)
);

-- Kunci RLS: hanya service_role (server Next.js) yang boleh membaca/menulis.
alter table public.kunjungan_harian enable row level security;
alter table public.kunjungan_detail enable row level security;
alter table public.kunjungan_unik_harian enable row level security;

create or replace function public.catat_kunjungan(
  p_tanggal date,
  p_sidik text,
  p_jalur text,
  p_sumber text,
  p_hp boolean
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_baru boolean := false;
begin
  -- Coba catat sidik unik hari ini; bila belum ada berarti pengunjung unik baru.
  insert into public.kunjungan_unik_harian (tanggal, sidik)
  values (p_tanggal, p_sidik)
  on conflict (tanggal, sidik) do nothing;

  if found then
    v_baru := true;
  end if;

  insert into public.kunjungan_harian (tanggal, pengunjung_unik, tayangan, perangkat_hp, perangkat_desktop)
  values (
    p_tanggal,
    case when v_baru then 1 else 0 end,
    1,
    case when v_baru and p_hp then 1 else 0 end,
    case when v_baru and not p_hp then 1 else 0 end
  )
  on conflict (tanggal) do update set
    pengunjung_unik = public.kunjungan_harian.pengunjung_unik + (case when v_baru then 1 else 0 end),
    tayangan = public.kunjungan_harian.tayangan + 1,
    perangkat_hp = public.kunjungan_harian.perangkat_hp + (case when v_baru and p_hp then 1 else 0 end),
    perangkat_desktop = public.kunjungan_harian.perangkat_desktop + (case when v_baru and not p_hp then 1 else 0 end);

  insert into public.kunjungan_detail (tanggal, jalur, sumber, tayangan)
  values (p_tanggal, p_jalur, p_sumber, 1)
  on conflict (tanggal, jalur, sumber) do update set
    tayangan = public.kunjungan_detail.tayangan + 1;

  -- Bersihkan sidik harian yang lebih dari 3 hari agar database tetap sangat ringan.
  delete from public.kunjungan_unik_harian where tanggal < (p_tanggal - interval '3 days');

  return v_baru;
end;
$$;
