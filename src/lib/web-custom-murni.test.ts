import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aksenKategoriWebCustom,
  normalisasiDaftarWebCustom,
  normalisasiUrlWeb,
  slugWebCustom,
} from "./web-custom-murni.ts";

test("normalisasiUrlWeb menerima domain polos seperti almansur.id dan menolak localhost", () => {
  const ok1 = normalisasiUrlWeb("almansur.id");
  assert.equal(ok1.ok, true);
  if (ok1.ok) {
    assert.equal(ok1.url, "https://almansur.id");
    assert.equal(ok1.domain, "almansur.id");
  }

  const ok2 = normalisasiUrlWeb("https://www.almansur.id/profil/#sejarah");
  assert.equal(ok2.ok, true);
  if (ok2.ok) {
    assert.equal(ok2.url, "https://www.almansur.id/profil");
    assert.equal(ok2.domain, "almansur.id");
  }

  assert.equal(normalisasiUrlWeb("http://localhost:3000").ok, false);
  assert.equal(normalisasiUrlWeb("http://127.0.0.1/admin").ok, false);
  assert.equal(normalisasiUrlWeb("ftp://almansur.id").ok, false);
  assert.equal(normalisasiUrlWeb("").ok, false);
});

test("slugWebCustom dan normalisasiDaftarWebCustom merapikan daftar tanpa duplikat", () => {
  assert.equal(slugWebCustom("https://almansur.id"), "web-almansur-id");
  assert.equal(slugWebCustom("web-almansur-id"), "web-almansur-id");
  assert.equal(aksenKategoriWebCustom("pesantren"), "#10B981");

  const daftar = normalisasiDaftarWebCustom([
    {
      id: "w1",
      nama: "Pesantren Al Manshur",
      url: "almansur.id",
      kategori: "pesantren",
      deskripsi: "Website resmi Pondok Pesantren Mambaul Ulum Panjunan.",
      aksen: "#10B981",
    },
    // Duplikat domain → diabaikan
    {
      id: "w2",
      nama: "Al Manshur Duplikat",
      url: "https://almansur.id/",
      kategori: "pesantren",
    },
    // URL tidak sah → diabaikan
    {
      id: "w3",
      nama: "Lokal",
      url: "http://192.168.1.1",
      kategori: "custom",
    },
  ]);

  assert.equal(daftar.length, 1);
  assert.equal(daftar[0].slug, "web-almansur-id");
  assert.equal(daftar[0].url, "https://almansur.id");
  assert.equal(daftar[0].kategori, "pesantren");
  assert.equal(daftar[0].aksen, "#10B981");
});
