import assert from "node:assert/strict";
import test from "node:test";
import {
  ekstrakGayaDariTugas,
  kunciMingguWib,
  normalisasiEvaluasiMingguan,
  waktunyaEvaluasiMingguan,
} from "./evaluasi-mingguan-murni.ts";

test("kunciMingguWib dan waktunyaEvaluasiMingguan mengikuti Senin 06.00 WIB", () => {
  // Minggu 29 Nov 2026 22:00 WIB (15:00 UTC) → masih minggu Senin 23 Nov, dan belum Senin → false
  const mingguMalam = new Date("2026-11-29T15:00:00.000Z");
  assert.equal(kunciMingguWib(mingguMalam), "2026-11-23");
  assert.equal(waktunyaEvaluasiMingguan(mingguMalam, null), false);

  // Senin 30 Nov 2026 05:55 WIB (29 Nov 22:55 UTC) → sebelum jam 6 pagi → false
  const seninPagiButa = new Date("2026-11-29T22:55:00.000Z");
  assert.equal(waktunyaEvaluasiMingguan(seninPagiButa, null), false);

  // Senin 30 Nov 2026 06:05 WIB (29 Nov 23:05 UTC) → sudah waktunya!
  const seninJam6 = new Date("2026-11-29T23:05:00.000Z");
  assert.equal(kunciMingguWib(seninJam6), "2026-11-30");
  assert.equal(waktunyaEvaluasiMingguan(seninJam6, "2026-11-23"), true);
  // Bila minggu ini sudah dievaluasi → tidak dijalankan ulang
  assert.equal(waktunyaEvaluasiMingguan(seninJam6, "2026-11-30"), false);
});

test("ekstrakGayaDariTugas membaca catatan worker dan fallback tag [Gaya:]", () => {
  assert.equal(
    ekstrakGayaDariTugas({ arahan: "Tes", naskah: { catatan: ["referensi aktif: 1", "gaya video: dark-keynote"] } }),
    "dark-keynote",
  );
  assert.equal(ekstrakGayaDariTugas({ arahan: "[Gaya: pov-chat] Halo", naskah: null }), "pov-chat");
  assert.equal(ekstrakGayaDariTugas({ arahan: "Biasa", naskah: null }), null);
});

test("normalisasiEvaluasiMingguan membuang preset palsu dan mencegah tumpang tindih", () => {
  const hasil = normalisasiEvaluasiMingguan(
    {
      ringkasan: "Reels tema gelap lebih diminati.",
      wawasan: ["Satu", "Dua", "Tiga", "Empat dibuang"],
      gayaPrioritas: ["dark-keynote", "gaya-ngarang", "split-hook", "pov-chat"],
      gayaKurangi: ["dark-keynote", "sinematik-ai", "clean-ui"],
      saranHook: "Mulai dengan pertanyaan omzet harian.",
    },
    {
      merek: "bakafrawi",
      minggu: "2026-11-30",
      dibuatPada: "2026-11-29T23:05:00.000Z",
      penyedia: "nvidia",
      totalPostDianalisis: 10,
      rataViews: 1200,
    },
  );
  assert.deepEqual(hasil.gayaPrioritas, ["dark-keynote", "split-hook"]);
  assert.deepEqual(hasil.gayaKurangi, ["sinematik-ai"]);
  assert.equal(hasil.wawasan.length, 3);
});
