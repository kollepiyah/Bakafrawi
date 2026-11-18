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
