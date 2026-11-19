import test from "node:test";
import assert from "node:assert/strict";
import {
  JADWAL_OPTIMAL,
  statusWaktuSekarang,
  rapikanRisetReels,
  promptRisetReels,
} from "./riset-reels-murni.ts";

test("JADWAL_OPTIMAL: memiliki 4 slot waktu dengan golden prime time tertinggi", () => {
  assert.equal(JADWAL_OPTIMAL.length, 4);
  const golden = JADWAL_OPTIMAL.find((j) => j.slot === "sore");
  assert.ok(golden);
  assert.equal(golden.skor, 98);
});

test("statusWaktuSekarang: mengidentifikasi status prime time sesuai jam WIB", () => {
  const sore = statusWaktuSekarang(18);
  assert.equal(sore.status, "sedang_prime_time");
  assert.match(sore.label, /Golden Prime Time/);

  const siang = statusWaktuSekarang(12);
  assert.equal(siang.status, "sedang_prime_time");
  assert.match(siang.label, /Prime Time Siang/);

  const pagi = statusWaktuSekarang(9);
  assert.equal(pagi.status, "menunggu");
  assert.match(pagi.label, /Prime Time Siang/);
});

test("promptRisetReels: menghasilkan prompt terstruktur dengan nama dan fitur produk", () => {
  const p = promptRisetReels({
    nama: "Maktaba POS",
    judul: "Kasir Modern",
    deskripsi: "Aplikasi kasir online & offline",
    kategori: "saas",
    klien: null,
    fitur: [{ judul: "Struk WA", isi: "Kirim struk lewat WhatsApp" }],
  });
  assert.match(p, /Maktaba POS/);
  assert.match(p, /Struk WA/);
  assert.match(p, /arahanStudio/);
});

test("rapikanRisetReels: membersihkan dan memotong input mentah dari AI", () => {
  const hasil = rapikanRisetReels({
    konsep: [
      {
        judul: "  Hook 1  ",
        hook: "  Pernah gak sih... ",
        sudutMasalah: "Masalah stok hilang",
        alurVisual: "Layar berputar",
        teksLayarKunci: "Stok Bocor",
        ajakanCta: "Cek link bio",
        arahanStudio: "Sasar pemilik warung kopi, tonjolkan struk WA",
      },
      {
        judul: "Kosong",
        hook: "",
        arahanStudio: "",
      },
    ],
  });

  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].judul, "Hook 1");
  assert.equal(hasil[0].hook, "Pernah gak sih...");
  assert.equal(hasil[0].teksLayarKunci, "Stok Bocor");
});
