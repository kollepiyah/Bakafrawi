import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catatRiwayatVideoBuka,
  daftarSlotCepatWIB,
  jadwalRutinBawaan,
  jamBukaBerikutnya,
  keInputDatetimeWIB,
  normalisasiJadwalRutin,
  normalisasiSasaran,
  pilihVideoBuka,
  uraiJadwalCustomWIB,
} from "./jadwal-tayang-murni.ts";

test("uraiJadwalCustomWIB dan keInputDatetimeWIB", () => {
  // Sekarang: Jumat 20 Nov 2026 pukul 10:00 WIB (03:00 UTC)
  const sekarang = new Date("2026-11-20T03:00:00.000Z");

  const hasil = uraiJadwalCustomWIB("2026-11-20T14:30", sekarang);
  assert.equal(hasil.ok, true);
  if (hasil.ok) {
    assert.equal(hasil.tanggal.toISOString(), "2026-11-20T07:30:00.000Z");
    assert.equal(keInputDatetimeWIB(hasil.tanggal), "2026-11-20T14:30");
  }

  // Waktu yang sudah lewat ditolak
  const lewat = uraiJadwalCustomWIB("2026-11-20T09:00", sekarang);
  assert.equal(lewat.ok, false);

  // Format salah
  const salah = uraiJadwalCustomWIB("bukan-tanggal", sekarang);
  assert.equal(salah.ok, false);
});

test("daftarSlotCepatWIB menghasilkan 5 slot masa depan dalam WIB", () => {
  // Sekarang: Jumat 20 Nov 2026 pukul 15:00 WIB (08:00 UTC)
  const sekarang = new Date("2026-11-20T08:00:00.000Z");
  const slot = daftarSlotCepatWIB(sekarang);
  assert.equal(slot.length, 5);
  // Jam 09.00, 12.00, 14.00 sudah lewat hari ini → otomatis jatuh ke besok (21 Nov)
  assert.equal(slot[0].inputWib, "2026-11-21T09:00");
  assert.equal(slot[1].inputWib, "2026-11-21T12:00");
  assert.equal(slot[2].inputWib, "2026-11-21T14:00");
  // Jam 19.00 & 20.30 belum lewat → hari ini (20 Nov)
  assert.equal(slot[3].inputWib, "2026-11-20T19:00");
  assert.equal(slot[4].inputWib, "2026-11-20T20:30");
});

test("jamBukaBerikutnya melompati hari Minggu (libur) dan hari yang sudah tayang", () => {
  const jadwal = normalisasiJadwalRutin({
    ...jadwalRutinBawaan("lekkopi"),
    aktif: true,
    jam: "09:00",
    hari: [1, 2, 3, 4, 5, 6], // Senin - Sabtu
  });

  // Sabtu 21 Nov 2026 pukul 08:00 WIB (01:00 UTC) → jam buka berikutnya Sabtu 09:00 WIB (02:00 UTC)
  const sabtuPagi = new Date("2026-11-21T01:00:00.000Z");
  assert.equal(jamBukaBerikutnya(jadwal, sabtuPagi)?.toISOString(), "2026-11-21T02:00:00.000Z");

  // Sabtu 21 Nov 2026 pukul 10:00 WIB (03:00 UTC), lewat jam 09:00 → lompati Minggu (22 Nov) → Senin 23 Nov 09:00 WIB
  const sabtuSiang = new Date("2026-11-21T03:00:00.000Z");
  assert.equal(jamBukaBerikutnya(jadwal, sabtuSiang)?.toISOString(), "2026-11-23T02:00:00.000Z");

  // Bila Sabtu sudah ditandai terakhirTayang = "2026-11-21", meskipun masih pukul 08:00 WIB tetap lompat ke Senin 23 Nov
  const sudahTayang = { ...jadwal, terakhirTayang: "2026-11-21" };
  assert.equal(jamBukaBerikutnya(sudahTayang, sabtuPagi)?.toISOString(), "2026-11-23T02:00:00.000Z");
});

test("pilihVideoBuka mendukung mode semua dan wajib+bergilir", () => {
  const jadwal = normalisasiJadwalRutin({
    aktif: true,
    jam: "09:00",
    hari: [1, 2, 3, 4, 5, 6],
    mode: "wajib+bergilir",
    video: [
      { id: "v-wajib", judul: "We Are Open", url: "/open.mp4", jenis: "video", sasaran: "story", wajib: true, aktif: true },
      { id: "v-1", judul: "Suasana Pagi", url: "/pagi.mp4", jenis: "video", sasaran: "story", wajib: false, aktif: true },
      { id: "v-2", judul: "Espresso Shot", url: "/espresso.mp4", jenis: "video", sasaran: "story", wajib: false, aktif: true },
      { id: "v-mati", judul: "Nonaktif", url: "/mati.mp4", jenis: "video", sasaran: "story", wajib: false, aktif: false },
    ],
  });

  const hari1 = pilihVideoBuka(jadwal, new Date("2026-11-20T02:00:00.000Z"));
  const hari2 = pilihVideoBuka(jadwal, new Date("2026-11-21T02:00:00.000Z"));
  // Video wajib selalu ada di urutan pertama, ditambah 1 video pendamping yang berganti tiap hari
  assert.equal(hari1.length, 2);
  assert.equal(hari1[0].id, "v-wajib");
  assert.equal(hari2.length, 2);
  assert.equal(hari2[0].id, "v-wajib");
  assert.notEqual(hari1[1].id, hari2[1].id);

  // Mode semua mengembalikan semua video aktif (3 video)
  const semua = pilihVideoBuka({ ...jadwal, mode: "semua" });
  assert.equal(semua.length, 3);
});

test("normalisasiSasaran", () => {
  assert.equal(normalisasiSasaran("story"), "story");
  assert.equal(normalisasiSasaran("reels+story"), "reels+story");
  assert.equal(normalisasiSasaran("tidak-dikenal"), "otomatis");
  assert.equal(normalisasiSasaran(null), "otomatis");
});

test("pilihVideoBuka mode acak memilih 1 video aktif tanpa mengulang berturut-turut", () => {
  let jadwal = normalisasiJadwalRutin({
    aktif: true,
    jam: "14:00",
    hari: [1, 2, 3, 4, 5, 6],
    mode: "acak",
    video: [
      { id: "v-1", judul: "Story 1", url: "/1.mp4", jenis: "video", sasaran: "story", wajib: true, aktif: true },
      { id: "v-2", judul: "Story 2", url: "/2.mp4", jenis: "video", sasaran: "story", wajib: true, aktif: true },
      { id: "v-3", judul: "Story 3", url: "/3.mp4", jenis: "video", sasaran: "story", wajib: true, aktif: true },
      { id: "v-off", judul: "Nonaktif", url: "/off.mp4", jenis: "video", sasaran: "story", wajib: false, aktif: false },
    ],
  });

  // Simulasikan 3 hari berturut-turut: semua 3 video aktif harus kebagian 1x sebelum siklus reset
  const terlihat = new Set<string>();
  let sebelum: string | null = null;
  for (let i = 0; i < 3; i++) {
    const dipilih = pilihVideoBuka(jadwal, new Date(), { acak: () => 0 });
    assert.equal(dipilih.length, 1);
    assert.notEqual(dipilih[0].id, "v-off");
    assert.notEqual(dipilih[0].id, sebelum);
    terlihat.add(dipilih[0].id);
    sebelum = dipilih[0].id;
    const upd = catatRiwayatVideoBuka(jadwal, dipilih[0].id);
    jadwal = { ...jadwal, ...upd };
  }
  assert.equal(terlihat.size, 3);

  // Hari ke-4 (siklus baru): tidak boleh mengulang video hari ke-3
  const hari4 = pilihVideoBuka(jadwal, new Date(), { acak: () => 0 });
  assert.equal(hari4.length, 1);
  assert.notEqual(hari4[0].id, sebelum);
});

test("jamBukaBerikutnya tetap aktif bila aiAktif=true meskipun daftar video statis kosong", () => {
  const jadwal = normalisasiJadwalRutin({
    aktif: true,
    jam: "14:00",
    hari: [1, 2, 3, 4, 5, 6],
    aiAktif: true,
    aiFormat: "video-animasi",
    aiGaya: "hangat-kafe",
    video: [],
  });
  const jumatPagi = new Date("2026-11-20T03:00:00.000Z"); // 10:00 WIB
  assert.equal(jamBukaBerikutnya(jadwal, jumatPagi)?.toISOString(), "2026-11-20T07:00:00.000Z"); // 14:00 WIB
});
