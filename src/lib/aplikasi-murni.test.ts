import { test } from "node:test";
import assert from "node:assert/strict";
import { angkaUtama, APLIKASI, nilaiAplikasi, rupiah, selisihPersen, urlPintu } from "./aplikasi-murni.ts";

const kini = new Date("2026-11-18T13:00:00Z");

test("daftar & url pintu", () => {
  assert.equal(urlPintu(APLIKASI.find((a) => a.slug === "lekkopi")!), "https://vwepjebxsszoahjmiwxo.supabase.co/functions/v1/pintu-bakafrawi?jenis=dasbor");
  assert.equal(urlPintu(APLIKASI.find((a) => a.slug === "fastabiqu")!), null);
  // Data lembaga klien hanya teknis.
  assert.deepEqual(APLIKASI.filter((a) => a.jenis === "teknis").map((a) => a.slug), ["ammu", "waseela"]);
});

test("format", () => {
  assert.equal(rupiah(1250000), "Rp1.250.000");
  assert.equal(selisihPersen(1100, 1000), "+10%");
  assert.equal(selisihPersen(900, 1000), "−10%");
  assert.equal(selisihPersen(900, 0), "");
});

test("nilai saas", () => {
  assert.deepEqual(nilaiAplikasi("saas", { menunggu_konfirmasi: 2, habis_7h: 1, ukuran_db_mb: 120 }, kini), {
    tingkat: "perhatian",
    catatan: ["2 pembayaran langganan menunggu konfirmasi", "1 langganan habis dalam 7 hari"],
  });
  assert.equal(nilaiAplikasi("saas", { menunggu_konfirmasi: 0, habis_7h: 0 }, kini).tingkat, "baik");
});

test("nilai kedai & database", () => {
  const p = nilaiAplikasi("kedai", { stok_menipis: 2, bahan_menipis: ["Susu UHT", "Gula aren"], ukuran_db_mb: 420 }, kini);
  assert.deepEqual(p.catatan, ["2 bahan menipis: Susu UHT, Gula aren", "Database 420 MB — mendekati batas 500 MB paket gratis"]);
});

test("nilai teknis", () => {
  assert.equal(nilaiAplikasi("teknis", { aktif_24j: 30, login_terakhir: "2026-11-18T10:00:00Z" }, kini).tingkat, "baik");
  assert.deepEqual(nilaiAplikasi("teknis", { aktif_24j: 0, login_terakhir: "2026-11-10T10:00:00Z" }, kini).catatan, [
    "Tidak ada pengguna aktif 24 jam terakhir",
    "Tak ada yang login lebih dari 3 hari",
  ]);
});

test("angka utama", () => {
  assert.deepEqual(angkaUtama("kedai", { omzet: 1100000, omzet_kemarin: 1000000, trx: 80, cup: 95, terlaris: [{ nama: "Kopi Lek", qty: 30 }] }).slice(0, 3), [
    ["Omzet hari ini", "Rp1.100.000 (+10% vs kemarin)"],
    ["Transaksi", "80 · 95 cup"],
    ["Terlaris", "Kopi Lek (30)"],
  ]);
  assert.equal(angkaUtama("saas", { toko: 12, aktif: 7, trial: 3 })[0][1], "12 (7 aktif · 3 trial)");
});
