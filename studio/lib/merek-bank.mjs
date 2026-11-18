// Bahan "bank media" per merek (Lek Kopi): indeks folder bank di Google Drive merek ke studio_bank,
// lalu render video dari naskah yang sudah disetujui memakai modul bank/ (pindahan Studio Lek Kopi).
// Bank tak pernah diunduh utuh: hanya berkas baru/berubah (untuk diperiksa) dan yang dipakai video.
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { probe } from './bank/alat.mjs';
import { daftarLokal, jenisBerkas, tagDari } from './bank/bank.mjs';
import { buatDrive } from './bank/drive.mjs';
import { renderKonten } from './bank/render.mjs';
import { bacaBank, bacaGaya, hapusBank, simpanBank } from './db.mjs';

/**
 * Folder kerja + sambungan Drive satu merek. STUDIO_BANK_LOKAL (uji di laptop) menimpa Drive:
 * bank dibaca langsung dari folder itu.
 */
export async function siapkanMerekBank(merek) {
  const lokal = process.env.STUDIO_BANK_LOKAL;
  const akar = path.join(os.tmpdir(), `studio-${merek.slug}`);
  const folder = { bank: lokal || path.join(akar, 'bank'), hasil: path.join(akar, 'hasil'), referensi: path.join(akar, 'referensi') };
  for (const f of Object.values(folder)) await mkdir(f, { recursive: true });
  if (!lokal && !merek.profil?.drive) throw new Error(`Profil merek ${merek.nama} belum berisi "drive" (mis. gdrive:Lek Kopi Konten).`);
  const drive = lokal ? null : buatDrive(merek.profil.drive, folder);
  return { folder, drive, siapkan: drive ? (d) => drive.siapkan(d) : async () => {} };
}

/**
 * Sinkronkan isi folder bank (Drive) ke studio_bank. Hanya berkas baru/berubah yang di-probe.
 * Bank terbaca kosong padahal indeks berisi → tidak menghapus apa pun (hampir pasti Drive gagal dibaca).
 */
export async function indeksBankMerek(merek, ctx) {
  const isi = ctx.drive ? await ctx.drive.daftar('bank') : await daftarLokal(ctx.folder.bank);
  const lama = new Map((await bacaBank(merek.slug)).map((b) => [b.path, b]));
  const ada = new Set();
  const baru = [];
  for (const { rel, kunci } of isi) {
    const jenis = jenisBerkas(rel);
    if (!jenis) continue;
    const relPosix = rel.split(path.sep).join('/');
    ada.add(relPosix);
    if (lama.get(relPosix)?.versi === kunci) continue;
    const penuh = path.join(ctx.folder.bank, rel);
    await ctx.siapkan([penuh]);
    const info = await probe(penuh).catch(() => ({}));
    baru.push({ merek: merek.slug, path: relPosix, tag: tagDari(relPosix), jenis, durasi: info.durasi ?? null, lebar: info.lebar ?? null, tinggi: info.tinggi ?? null, versi: kunci, diperbarui: new Date().toISOString() });
  }
  if (!ada.size && lama.size) return { total: 0, baru: 0, hilang: 0, kosong: true };
  await simpanBank(baru);
  const hilang = [...lama.keys()].filter((p) => !ada.has(p));
  await hapusBank(merek.slug, hilang);
  return { total: ada.size, baru: baru.length, hilang: hilang.length };
}

/** Render video dari naskah tugas (status sudah disetujui) → { berkas, durasi, catatan }. */
export async function renderBankMerek(tugas, merek, ctx) {
  if (!tugas.naskah?.adegan?.length) throw new Error('Tugas ini belum punya naskah.');
  const bank = (await bacaBank(merek.slug)).map((b) => ({ ...b, path: path.join(ctx.folder.bank, b.path) }));
  if (!bank.some((b) => b.jenis === 'foto' || b.jenis === 'video')) throw new Error(`Bank media ${merek.nama} kosong.`);
  const profilGaya = await bacaGaya(merek.slug);
  return renderKonten({ id: tugas.id, naskah_json: tugas.naskah }, bank, ctx.folder.hasil, { profilGaya, siapkan: ctx.siapkan });
}
