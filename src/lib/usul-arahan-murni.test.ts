import { test } from "node:test";
import assert from "node:assert/strict";
import { promptArahan, rapikanUsulan } from "./usul-arahan-murni.ts";

const produk = {
  nama: "Maktaba POS",
  kategori: "saas" as const,
  judul: "Kasir modern",
  deskripsi: "Aplikasi kasir.",
  fitur: [{ judul: "Kasir cepat", isi: "barcode & QRIS" }],
};

test("promptArahan: memuat data produk & aturan ajakan sesuai kategori", () => {
  const p = promptArahan(produk, "video");
  assert.match(p, /3 arahan/);
  assert.match(p, /video iklan Reels/);
  assert.match(p, /Kasir cepat: barcode & QRIS/);
  assert.match(p, /coba\/berlangganan/);
  const pesanan = promptArahan({ ...produk, kategori: "pesanan", klien: "Pondok X" }, "gambar", 2);
  assert.match(pesanan, /2 arahan/);
  assert.match(pesanan, /karya pesanan untuk Pondok X/);
  assert.match(pesanan, /poster promosi/);
});

test("rapikanUsulan: buang yang kosong, isi judul yang hilang, batasi jumlah & panjang", () => {
  const hasil = rapikanUsulan({
    usulan: [
      { judul: "  Capek   rekap ", arahan: "Sasar pemilik warung. Tonjolkan laporan." },
      { judul: "Kosong", arahan: "   " },
      { judul: "", arahan: "Sasar kedai kopi, nada santai" },
      { judul: "Keempat", arahan: "x".repeat(500) },
      { judul: "Kelima", arahan: "y" },
    ],
  });
  assert.equal(hasil.length, 3);
  assert.deepEqual(hasil[0], { judul: "Capek rekap", arahan: "Sasar pemilik warung. Tonjolkan laporan." });
  assert.equal(hasil[1].judul, "Sasar kedai kopi");
  assert.equal(hasil[2].arahan.length, 400);
  assert.deepEqual(rapikanUsulan(null), []);
  assert.deepEqual(rapikanUsulan({ usulan: "bukan daftar" }), []);
});
