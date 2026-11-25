import assert from "node:assert/strict";
import test from "node:test";
import {
  bangunGridBulan,
  kelompokkanTugasKalender,
  statusVisualTugas,
  tanggalKunciWib,
} from "./kalender-studio-murni.ts";

test("tanggalKunciWib mengonversi UTC malam ke hari berikutnya di WIB", () => {
  // 25 Nov 2026 18:30 UTC = 26 Nov 2026 01:30 WIB
  assert.equal(tanggalKunciWib("2026-11-25T18:30:00.000Z"), "2026-11-26");
  // 25 Nov 2026 02:00 UTC = 25 Nov 2026 09:00 WIB
  assert.equal(tanggalKunciWib("2026-11-25T02:00:00.000Z"), "2026-11-25");
});

test("bangunGridBulan memulai minggu dari Senin dengan sel kelipatan 7", () => {
  const grid = bangunGridBulan(2026, 11, "2026-11-25T05:00:00.000Z");
  assert.equal(grid.length % 7, 0);
  // 1 Nov 2026 adalah Minggu → kolom terakhir minggu ke-1, sehingga sel pertama 26 Okt 2026 (Senin)
  assert.equal(grid[0].tanggal, "2026-10-26");
  assert.equal(grid[0].dalamBulan, false);
  const sel25 = grid.find((s) => s.tanggal === "2026-11-25");
  assert.ok(sel25);
  assert.equal(sel25.dalamBulan, true);
  assert.equal(sel25.hariIni, true);
});

test("statusVisualTugas memetakan status ke indikator warna yang tepat", () => {
  assert.equal(statusVisualTugas({ status: "selesai", status_tayang: "tayang" }), "tayang");
  assert.equal(statusVisualTugas({ status: "selesai", status_tayang: "dijadwalkan" }), "terjadwal");
  assert.equal(statusVisualTugas({ status: "proses", status_tayang: "belum" }), "proses");
  assert.equal(statusVisualTugas({ status: "selesai", status_tayang: "belum" }), "cek");
  assert.equal(statusVisualTugas({ status: "gagal", status_tayang: "belum" }), "gagal");
});

test("kelompokkanTugasKalender memprioritaskan jadwal_tayang lalu waktu tayang lalu dibuat", () => {
  const peta = kelompokkanTugasKalender([
    {
      id: "t1",
      dibuat: "2026-11-24T01:00:00.000Z",
      jadwal_tayang: "2026-11-25T12:00:00.000Z",
    },
    {
      id: "t2",
      dibuat: "2026-11-24T03:00:00.000Z",
      jadwal_tayang: null,
    },
  ]);
  assert.equal(peta["2026-11-25"]?.length, 1);
  assert.equal(peta["2026-11-25"]?.[0].id, "t1");
  assert.equal(peta["2026-11-24"]?.length, 1);
  assert.equal(peta["2026-11-24"]?.[0].id, "t2");
});
