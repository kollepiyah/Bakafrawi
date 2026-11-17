import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { modeLokal } from "./lingkungan";

// Penyimpanan khusus mode uji lokal (lihat lingkungan.ts). Berkas di `.data/` tidak di-commit.
const FOLDER = path.join(process.cwd(), ".data");
const BERKAS = path.join(FOLDER, "konten.json");
export const FOLDER_MEDIA_LOKAL = path.join(process.cwd(), "public", "_media-lokal");

function jaga() {
  if (!modeLokal) throw new Error("Penyimpanan lokal hanya untuk mode uji lokal.");
}

export async function bacaKontenLokal(): Promise<unknown> {
  jaga();
  try {
    return JSON.parse(await readFile(BERKAS, "utf8"));
  } catch {
    return null;
  }
}

export async function tulisKontenLokal(data: unknown) {
  jaga();
  await mkdir(FOLDER, { recursive: true });
  await writeFile(BERKAS, JSON.stringify(data, null, 2), "utf8");
}

export async function simpanMediaLokal(nama: string, isi: ArrayBuffer) {
  jaga();
  await mkdir(FOLDER_MEDIA_LOKAL, { recursive: true });
  const aman = `${Date.now()}-${nama.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`;
  await writeFile(path.join(FOLDER_MEDIA_LOKAL, aman), Buffer.from(isi));
  return `/_media-lokal/${aman}`;
}
