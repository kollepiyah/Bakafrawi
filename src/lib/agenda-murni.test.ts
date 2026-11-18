import { test } from "node:test";
import assert from "node:assert/strict";
import {
  awalHariWIB,
  barisAcara,
  dariGoogle,
  idGoogle,
  keGoogle,
  masukanDariAcara,
  namaTanggal,
  normalisasiAcara,
  perluDiingatkan,
  pesanPengingat,
  pesanRingkasanPagi,
  rencanaSinkron,
  rentangHariWIB,
  tanggalWIB,
  waktunyaRingkasanPagi,
} from "./agenda-murni.ts";

test("tanggal & rentang WIB", () => {
  // 18.30 UTC = 01.30 WIB keesokan harinya.
  assert.equal(tanggalWIB(new Date("2026-11-18T18:30:00Z")), "2026-11-19");
  assert.equal(awalHariWIB("2026-11-19").toISOString(), "2026-11-18T17:00:00.000Z");
  const besok = rentangHariWIB(new Date("2026-11-18T23:00:00Z"), 1);
  assert.equal(besok.dari.toISOString(), "2026-11-19T17:00:00.000Z");
  assert.equal(besok.sampai.toISOString(), "2026-11-20T17:00:00.000Z");
});

test("normalisasiAcara: waktu tanpa zona = WIB, selesai default 1 jam", () => {
  const h = normalisasiAcara({ judul: "  Rapat   MU ", mulai: "2026-11-20T09:00", lokasi: " " });
  assert.ok(h.ok);
  assert.deepEqual(h.data, { judul: "Rapat MU", mulai: "2026-11-20T02:00:00.000Z", selesai: "2026-11-20T03:00:00.000Z", seharian: false, lokasi: null, catatan: null });
  const z = normalisasiAcara({ judul: "x", mulai: "2026-11-20T02:00:00Z", selesai: "2026-11-20T04:30:00+00:00" });
  assert.ok(z.ok && z.data.selesai === "2026-11-20T04:30:00.000Z");
});

test("normalisasiAcara: seharian dibulatkan, selesai eksklusif", () => {
  const satu = normalisasiAcara({ judul: "Libur", mulai: "2026-11-20T15:00", seharian: true });
  assert.ok(satu.ok);
  assert.equal(satu.data.mulai, "2026-11-19T17:00:00.000Z");
  assert.equal(satu.data.selesai, "2026-11-20T17:00:00.000Z");
  const tiga = normalisasiAcara({ judul: "Dauroh", mulai: "2026-11-20", selesai: "2026-11-22", seharian: true });
  assert.ok(tiga.ok && tiga.data.selesai === "2026-11-22T17:00:00.000Z");
  // Ubah sebagian kolom berkali-kali tak boleh memanjangkan acara.
  const ulang = normalisasiAcara({ ...masukanDariAcara(tiga.data), judul: "Dauroh 2" });
  assert.ok(ulang.ok && ulang.data.mulai === tiga.data.mulai && ulang.data.selesai === tiga.data.selesai);
  const biasa = normalisasiAcara({ judul: "R", mulai: "2026-11-20T09:00" });
  assert.ok(biasa.ok);
  const biasa2 = normalisasiAcara({ ...masukanDariAcara(biasa.data), lokasi: "MU" });
  assert.ok(biasa2.ok && biasa2.data.selesai === biasa.data.selesai && biasa2.data.lokasi === "MU");
});

test("normalisasiAcara: galat", () => {
  assert.equal(normalisasiAcara({ mulai: "2026-11-20T09:00" }).ok, false);
  assert.equal(normalisasiAcara({ judul: "a" }).ok, false);
  assert.equal(normalisasiAcara({ judul: "a", mulai: "besok" }).ok, false);
  assert.equal(normalisasiAcara({ judul: "a", mulai: "2026-11-20T09:00", selesai: "2026-11-20T08:00" }).ok, false);
  assert.equal(normalisasiAcara({ judul: "a", mulai: "2026-11-20T09:00", selesai: "2027-01-20T08:00" }).ok, false);
});

test("Google: bolak-balik", () => {
  assert.equal(idGoogle("0B9C6A2E-1f2d-4c3b-9a8e-7d6c5b4a3f21"), "0b9c6a2e1f2d4c3b9a8e7d6c5b4a3f21");
  const biasa = keGoogle({ judul: "Rapat", mulai: "2026-11-20T02:00:00.000Z", selesai: "2026-11-20T03:00:00.000Z", seharian: false, lokasi: null, catatan: null });
  assert.deepEqual(biasa.start, { dateTime: "2026-11-20T02:00:00.000Z", date: null, timeZone: "Asia/Jakarta" });
  const hari = keGoogle({ judul: "Libur", mulai: "2026-11-19T17:00:00.000Z", selesai: "2026-11-20T17:00:00.000Z", seharian: true, lokasi: null, catatan: null });
  assert.deepEqual([hari.start.date, hari.end.date], ["2026-11-20", "2026-11-21"]);

  const g = dariGoogle({ id: "abc", summary: "Ngaji", start: { dateTime: "2026-11-20T19:30:00+07:00" }, end: { dateTime: "2026-11-20T21:00:00+07:00" }, recurringEventId: "r1" });
  assert.deepEqual(g, { google_id: "abc", judul: "Ngaji", mulai: "2026-11-20T12:30:00.000Z", selesai: "2026-11-20T14:00:00.000Z", seharian: false, lokasi: null, catatan: null, status: "aktif", berulang: true });
  const s = dariGoogle({ id: "d", start: { date: "2026-11-20" }, end: { date: "2026-11-21" }, status: "cancelled" });
  assert.equal(s?.mulai, "2026-11-19T17:00:00.000Z");
  assert.equal(s?.judul, "(tanpa judul)");
  assert.equal(s?.status, "batal");
  assert.equal(dariGoogle({ id: "x" }), null);
});

test("rencanaSinkron", () => {
  const google = [
    { id: "g1", summary: "A", start: { dateTime: "2026-11-20T09:00:00+07:00" }, end: { dateTime: "2026-11-20T10:00:00+07:00" } },
    { id: "g2", summary: "B", start: { dateTime: "2026-11-21T09:00:00+07:00" }, end: { dateTime: "2026-11-21T10:00:00+07:00" } },
  ];
  const isi = { judul: "A", mulai: "2026-11-20T02:00:00+00:00", selesai: "2026-11-20T03:00:00+00:00", seharian: false, lokasi: null, catatan: null, berulang: false, status: "aktif" as const };
  const lokal = [
    { ...isi, id: "l1", google_id: "g1", perlu_sinkron: false, judul: "A lama" }, // diubah di Google
    { ...isi, id: "l2", google_id: "g2", perlu_sinkron: true }, // diubah di Studio, belum terkirim
    { ...isi, id: "l3", google_id: "g3", perlu_sinkron: false }, // hilang dari jendela
    { ...isi, id: "l4", google_id: null, perlu_sinkron: true },
  ];
  const r = rencanaSinkron(lokal, google);
  assert.deepEqual(r.simpan.map((s) => s.google_id), ["g1"]);
  assert.deepEqual(r.hilang, ["l3"]);
  // Sama persis (format waktu database berbeda) → tak ditulis ulang.
  const tetap = rencanaSinkron([{ ...isi, id: "l1", google_id: "g1", perlu_sinkron: false }], [google[0]]);
  assert.deepEqual(tetap.simpan, []);
  // Acara baru dari Google ikut disimpan.
  assert.deepEqual(rencanaSinkron([], google).simpan.length, 2);
});

test("perluDiingatkan", () => {
  const now = new Date("2026-11-20T01:40:00Z"); // 08.40 WIB
  const a = (mulai: string, lain = {}) => ({ mulai, seharian: false, status: "aktif" as const, diingatkan: null as string | null, ...lain });
  const daftar = [
    a("2026-11-20T02:00:00Z"), // 09.00 → 20 menit lagi
    a("2026-11-20T02:30:00Z"), // 50 menit lagi
    a("2026-11-20T01:30:00Z"), // sudah lewat
    a("2026-11-20T02:05:00Z", { diingatkan: "x" }),
    a("2026-11-20T02:05:00Z", { seharian: true }),
    a("2026-11-20T02:05:00Z", { status: "batal" }),
  ];
  assert.deepEqual(perluDiingatkan(daftar, now).map((x) => x.mulai), ["2026-11-20T02:00:00Z"]);
});

test("ringkasan pagi", () => {
  assert.equal(waktunyaRingkasanPagi(new Date("2026-11-19T22:29:00Z"), null), false); // 05.29 WIB
  assert.equal(waktunyaRingkasanPagi(new Date("2026-11-19T22:30:00Z"), null), true); // 05.30 WIB tgl 20
  assert.equal(waktunyaRingkasanPagi(new Date("2026-11-19T22:30:00Z"), "2026-11-20"), false);
  assert.equal(waktunyaRingkasanPagi(new Date("2026-11-20T05:00:00Z"), "2026-11-19"), false); // 12.00 WIB
  assert.equal(namaTanggal("2026-11-19"), "Kamis, 19 November 2026");
  const acara = [
    { judul: "B", mulai: "2026-11-20T06:00:00Z", selesai: "2026-11-20T07:00:00Z", seharian: false, lokasi: null },
    { judul: "A", mulai: "2026-11-20T02:00:00Z", selesai: "2026-11-20T03:30:00Z", seharian: false, lokasi: "MU" },
  ];
  assert.equal(pesanRingkasanPagi(acara, "2026-11-20"), "☀️ Agenda Jumat, 20 November 2026\n• 09.00–10.30 A (MU)\n• 13.00–14.00 B");
  assert.equal(pesanRingkasanPagi([], "2026-11-20"), "☀️ Agenda Jumat, 20 November 2026\nTidak ada acara.");
  assert.equal(pesanRingkasanPagi([], "2026-11-21", "📅"), "📅 Agenda Sabtu, 21 November 2026\nTidak ada acara.");
  assert.equal(barisAcara({ judul: "Libur", mulai: "x", selesai: "y", seharian: true, lokasi: null }), "• Seharian Libur");
  assert.equal(pesanPengingat({ judul: "A", mulai: "2026-11-20T02:00:00Z", lokasi: "MU" }, new Date("2026-11-20T01:30:00Z")), "⏰ 30 menit lagi: A — pukul 09.00 WIB di MU.");
});
