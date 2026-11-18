// Akses Supabase untuk mesin Studio memakai kunci service role (rahasia GitHub Actions) —
// hanya mesin ini yang boleh mengubah status & hasil tugas (RLS menutupnya untuk browser).

const URL_SB = () => process.env.SUPABASE_URL ?? '';
const KUNCI = () => process.env.SUPABASE_SERVICE_KEY ?? '';

function kepala(tambahan = {}) {
  return { apikey: KUNCI(), Authorization: `Bearer ${KUNCI()}`, ...tambahan };
}

async function periksa(res, apa) {
  if (!res.ok) throw new Error(`${apa} gagal (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res;
}

export function siapDb() {
  if (!URL_SB() || !KUNCI()) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY belum diisi di rahasia GitHub.');
}

/** Ambil satu tugas antre (atomik di database) → objek tugas atau null. */
export async function ambilTugas() {
  const res = await periksa(
    await fetch(`${URL_SB()}/rest/v1/rpc/studio_ambil_tugas`, { method: 'POST', headers: kepala({ 'Content-Type': 'application/json' }), body: '{}' }),
    'Ambil tugas',
  );
  const baris = await res.json();
  return baris[0] ?? null;
}

export async function perbaruiTugas(id, isi) {
  await periksa(
    await fetch(`${URL_SB()}/rest/v1/studio_tugas?id=eq.${id}`, {
      method: 'PATCH',
      headers: kepala({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(isi),
    }),
    'Perbarui tugas',
  );
}

export async function bacaKonten() {
  const res = await periksa(await fetch(`${URL_SB()}/rest/v1/konten?id=eq.situs&select=data`, { headers: kepala() }), 'Baca konten');
  return (await res.json())[0]?.data ?? null;
}

/** Unggah berkas ke bucket publik `studio` → alamat publiknya. */
export async function unggah(jalur, isi, jenis) {
  await periksa(
    await fetch(`${URL_SB()}/storage/v1/object/studio/${jalur}`, {
      method: 'POST',
      headers: kepala({ 'Content-Type': jenis, 'x-upsert': 'true' }),
      body: isi,
    }),
    `Unggah ${jalur}`,
  );
  return `${URL_SB()}/storage/v1/object/public/studio/${jalur}`;
}

/** Tugas/tayang yang ditinggal mesin (mati di tengah jalan) → "gagal"; memulangkan jumlahnya. */
export async function pulihkan() {
  const res = await periksa(
    await fetch(`${URL_SB()}/rest/v1/rpc/studio_pulihkan`, { method: 'POST', headers: kepala({ 'Content-Type': 'application/json' }), body: '{}' }),
    'Pulihkan tugas',
  );
  return res.json();
}

/** Ambil satu tugas yang waktunya tayang (atomik) → objek tugas atau null. */
export async function ambilTayang() {
  const res = await periksa(
    await fetch(`${URL_SB()}/rest/v1/rpc/studio_ambil_tayang`, { method: 'POST', headers: kepala({ 'Content-Type': 'application/json' }), body: '{}' }),
    'Ambil tayang',
  );
  return (await res.json())[0] ?? null;
}

/** Profil satu merek (studio_merek) → { slug, nama, profil } atau null. */
export async function bacaMerek(slug) {
  const res = await periksa(await fetch(`${URL_SB()}/rest/v1/studio_merek?slug=eq.${encodeURIComponent(slug)}&select=slug,nama,profil`, { headers: kepala() }), 'Baca merek');
  return (await res.json())[0] ?? null;
}

// ------------------------------------------------------------ bank media per merek

const m = (slug) => encodeURIComponent(slug);

/** Isi indeks bank satu merek → [{ path (relatif), tag, jenis, durasi, versi, kurasi }]. */
export async function bacaBank(merek) {
  const res = await periksa(await fetch(`${URL_SB()}/rest/v1/studio_bank?merek=eq.${m(merek)}&select=path,tag,jenis,durasi,lebar,tinggi,versi,kurasi`, { headers: kepala() }), 'Baca bank');
  return res.json();
}

export async function simpanBank(baris) {
  if (!baris.length) return;
  await periksa(
    await fetch(`${URL_SB()}/rest/v1/studio_bank?on_conflict=merek,path`, {
      method: 'POST',
      headers: kepala({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(baris),
    }),
    'Simpan bank',
  );
}

export async function hapusBank(merek, daftarPath) {
  for (const p of daftarPath) {
    await periksa(
      await fetch(`${URL_SB()}/rest/v1/studio_bank?merek=eq.${m(merek)}&path=eq.${encodeURIComponent(p)}`, { method: 'DELETE', headers: kepala({ Prefer: 'return=minimal' }) }),
      'Hapus bank',
    );
  }
}

/** Merek aktif berbahan bank yang indeksnya sudah lebih dari 6 jam (atau belum pernah). */
export async function merekBankBasi() {
  const batas = Date.now() - 6 * 3600_000;
  const res = await periksa(await fetch(`${URL_SB()}/rest/v1/studio_merek?aktif=is.true&select=slug,nama,profil,bank_diindeks`, { headers: kepala() }), 'Baca merek bank');
  // Disaring di sini (merek hanya segelintir): sama dengan syarat bank di studio_ada_kerja().
  return (await res.json()).filter((r) => r.profil?.bahan?.includes?.('bank') && (!r.bank_diindeks || new Date(r.bank_diindeks).getTime() < batas));
}

export async function tandaiBankDiindeks(merek) {
  await periksa(
    await fetch(`${URL_SB()}/rest/v1/studio_merek?slug=eq.${m(merek)}`, {
      method: 'PATCH',
      headers: kepala({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ bank_diindeks: new Date().toISOString() }),
    }),
    'Tandai bank',
  );
}

/** Panggilan REST singkat untuk tabel kurasi/referensi/gaya (galat dilempar dengan label). */
async function sb(jalur, apa, init = {}) {
  const res = await periksa(await fetch(`${URL_SB()}/rest/v1/${jalur}`, { ...init, headers: kepala({ 'Content-Type': 'application/json', ...init.headers }) }), apa);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}
const patch = (isi) => ({ method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(isi) });
const upsert = (isi) => ({ method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(isi) });

export const bankBelumKurasi = (merek, n) =>
  sb(`studio_bank?merek=eq.${m(merek)}&jenis=in.(foto,video)&kurasi=is.null&order=diperbarui.asc&limit=${n}&select=path,tag,jenis,durasi`, 'Bank belum kurasi');
export const simpanKurasiBank = (merek, rel, kurasi) =>
  sb(`studio_bank?merek=eq.${m(merek)}&path=eq.${encodeURIComponent(rel)}`, 'Simpan kurasi', patch({ kurasi }));

export const referensiSudah = async (merek) =>
  new Set((await sb(`studio_referensi?merek=eq.${m(merek)}&analisis=not.is.null&select=id`, 'Referensi')).map((r) => r.id));
export const perbaruiStatistikReferensi = (merek, id, statistik) =>
  sb(`studio_referensi?merek=eq.${m(merek)}&id=eq.${encodeURIComponent(id)}`, 'Statistik referensi', patch({ statistik }));
export const simpanReferensi = (merek, baris) =>
  sb('studio_referensi?on_conflict=merek,id', 'Simpan referensi', upsert({ ...baris, merek, dianalisis: new Date().toISOString() }));
export const semuaReferensi = (merek) =>
  sb(`studio_referensi?merek=eq.${m(merek)}&analisis=not.is.null&select=caption,durasi,potong,statistik,analisis`, 'Semua referensi');
export const gayaMintaUlang = async (merek) =>
  Boolean((await sb(`studio_gaya?merek=eq.${m(merek)}&select=minta_ulang`, 'Gaya'))[0]?.minta_ulang);
/** gaya null = hanya padamkan minta_ulang. */
export const simpanGaya = (merek, gaya) =>
  sb('studio_gaya?on_conflict=merek', 'Simpan gaya', upsert({ merek, minta_ulang: false, diubah: new Date().toISOString(), ...(gaya ?? {}) }));

export async function bacaGaya(merek) {
  const res = await periksa(await fetch(`${URL_SB()}/rest/v1/studio_gaya?merek=eq.${m(merek)}&select=profil`, { headers: kepala() }), 'Baca gaya');
  return (await res.json())[0]?.profil ?? {};
}

/** Semua kredensial sosmed satu layanan → [{ merek, data, dicek }]. */
export async function daftarKredensial(layanan) {
  const res = await periksa(await fetch(`${URL_SB()}/rest/v1/studio_kredensial?layanan=eq.${layanan}&select=merek,data,dicek`, { headers: kepala() }), 'Baca kredensial');
  return res.json();
}

/** Perbarui kredensial (gabung ke data lama) dan/atau tandai sudah dicek. */
export async function perbaruiKredensial(merek, layanan, { data, dicek }) {
  const isi = { diubah: new Date().toISOString(), ...(dicek ? { dicek } : {}), ...(data ? { data } : {}) };
  await periksa(
    await fetch(`${URL_SB()}/rest/v1/studio_kredensial?merek=eq.${encodeURIComponent(merek)}&layanan=eq.${layanan}`, {
      method: 'PATCH',
      headers: kepala({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(isi),
    }),
    'Simpan kredensial',
  );
}

export async function bacaPengaturan() {
  const res = await periksa(await fetch(`${URL_SB()}/rest/v1/studio_pengaturan?id=eq.1&select=*`, { headers: kepala() }), 'Baca pengaturan');
  return (await res.json())[0] ?? {};
}

export async function simpanPengaturan(isi) {
  await periksa(
    await fetch(`${URL_SB()}/rest/v1/studio_pengaturan?id=eq.1`, {
      method: 'PATCH',
      headers: kepala({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ ...isi, diubah: new Date().toISOString() }),
    }),
    'Simpan pengaturan',
  );
}
