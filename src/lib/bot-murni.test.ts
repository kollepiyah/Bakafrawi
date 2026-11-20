import { test } from "node:test";
import assert from "node:assert/strict";
import { cariProduk, samaAman, uraiPerintah, uraiTombol, uraiTombolNaskah } from "./bot-murni.ts";

test("uraiTombolNaskah", () => {
  const id = "0b9c6a2e-1f2d-4c3b-9a8e-7d6c5b4a3f21";
  assert.deepEqual(uraiTombolNaskah(`ns:${id}`), { aksi: "setujui", id });
  assert.deepEqual(uraiTombolNaskah(`nx:${id}`), { aksi: "tolak", id });
  assert.equal(uraiTombolNaskah(`t:${id}`), null);
  assert.equal(uraiTombol(`ns:${id}`), null);
});

test("uraiPerintah", () => {
  assert.deepEqual(uraiPerintah("/poster maktaba ai"), { jenis: "buat", konten: "gambar", kata: "maktaba", ai: true });
  assert.deepEqual(uraiPerintah("/video@BakafrawiBot Lek Kopi"), { jenis: "buat", konten: "video", kata: "Lek Kopi", ai: false });
  assert.deepEqual(uraiPerintah("/start ABC123"), { jenis: "daftar", kode: "ABC123" });
  assert.deepEqual(uraiPerintah("/start"), { jenis: "bantuan" });
  assert.deepEqual(uraiPerintah("halo"), { jenis: "lain" });
  assert.deepEqual(uraiPerintah("/agenda"), { jenis: "agenda", besok: false });
  assert.deepEqual(uraiPerintah("/agenda@BakafrawiBot Besok"), { jenis: "agenda", besok: true });
});

test("cariProduk", () => {
  const p = [{ slug: "maktaba-pos", nama: "Maktaba POS" }, { slug: "lek-kopi", nama: "Lek Kopi POS" }];
  assert.equal(cariProduk(p, "maktaba")?.slug, "maktaba-pos");
  assert.equal(cariProduk(p, "lek-kopi")?.slug, "lek-kopi");
  assert.equal(cariProduk(p, "Lek Kopi")?.slug, "lek-kopi");
  assert.equal(cariProduk(p, ""), null);
  assert.equal(cariProduk(p, "ammu"), null);
});

test("uraiTombol", () => {
  const id = "0b9c6a2e-1f2d-4c3b-9a8e-7d6c5b4a3f21";
  assert.deepEqual(uraiTombol(`t:${id}`), { aksi: "sekarang", id });
  assert.deepEqual(uraiTombol(`s:${id}`), { aksi: "sekarang", id, sasaran: "story" });
  assert.deepEqual(uraiTombol(`j:${id}`), { aksi: "jadwal", id });
  assert.deepEqual(uraiTombol(`j09:${id}`), { aksi: "jadwal", id, jamWib: 9 });
  assert.deepEqual(uraiTombol(`j12:${id}`), { aksi: "jadwal", id, jamWib: 12 });
  assert.equal(uraiTombol("t:bukan-uuid"), null);
  assert.equal(uraiTombol(`z:${id}`), null);
});

test("samaAman", () => {
  assert.equal(samaAman("abc", "abc"), true);
  assert.equal(samaAman("abc", "abd"), false);
  assert.equal(samaAman("", ""), false);
  assert.equal(samaAman("abc", "abcd"), false);
});

test("rapikanRiwayat", async () => {
  const { rapikanRiwayat } = await import("./bot-murni.ts");
  const r = [
    { peran: "assistant" as const, teks: "a" },
    { peran: "user" as const, teks: "b" },
    { peran: "assistant" as const, teks: "c".repeat(3000) },
  ];
  const hasil = rapikanRiwayat(r, 10, 100);
  assert.equal(hasil[0].peran, "user");
  assert.equal(hasil.length, 2);
  assert.equal(hasil[1].teks.length, 100);
  assert.deepEqual(rapikanRiwayat([{ peran: "assistant", teks: "x" }]), []);
  assert.equal(rapikanRiwayat(Array.from({ length: 30 }, (_, i) => ({ peran: i % 2 ? "assistant" : "user", teks: String(i) }) as const), 10).length <= 10, true);
});
