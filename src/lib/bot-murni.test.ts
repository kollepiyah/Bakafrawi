import { test } from "node:test";
import assert from "node:assert/strict";
import { cariProduk, samaAman, uraiPerintah, uraiTombol } from "./bot-murni.ts";

test("uraiPerintah", () => {
  assert.deepEqual(uraiPerintah("/poster maktaba ai"), { jenis: "buat", konten: "gambar", kata: "maktaba", ai: true });
  assert.deepEqual(uraiPerintah("/video@BakafrawiBot Lek Kopi"), { jenis: "buat", konten: "video", kata: "Lek Kopi", ai: false });
  assert.deepEqual(uraiPerintah("/start ABC123"), { jenis: "daftar", kode: "ABC123" });
  assert.deepEqual(uraiPerintah("/start"), { jenis: "bantuan" });
  assert.deepEqual(uraiPerintah("halo"), { jenis: "lain" });
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
  assert.deepEqual(uraiTombol(`j:${id}`), { aksi: "jadwal", id });
  assert.equal(uraiTombol("t:bukan-uuid"), null);
  assert.equal(uraiTombol(`z:${id}`), null);
});

test("samaAman", () => {
  assert.equal(samaAman("abc", "abc"), true);
  assert.equal(samaAman("abc", "abd"), false);
  assert.equal(samaAman("", ""), false);
  assert.equal(samaAman("abc", "abcd"), false);
});
