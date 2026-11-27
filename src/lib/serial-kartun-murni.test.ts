import assert from "node:assert/strict";
import test from "node:test";
import {
  bangunPromptKartunkanFoto,
  bersihkanKodeLokasi,
  buatAdeganKosongSerial,
  buatDrafManualSerial,
  buatPromptNaskahDrafSerial,
  buatPromptRisetCeritaSerial,
  buatPromptSaranCeritaSerial,
  catatEpisodeSelesai,
  episodeBerikutnya,
  estimasiDurasiNaskahSerial,
  formatRisetCeritaKeTeks,
  konfigSerialBawaan,
  normalisasiKonfigSerial,
  normalisasiNaskahDrafSerial,
  normalisasiRisetCeritaSerial,
  normalisasiSaranCeritaSerial,
} from "./serial-kartun-murni.ts";

test("konfigSerialBawaan dan normalisasiKonfigSerial menjaga serial bawaan tetap valid", () => {
  const def = konfigSerialBawaan();
  assert.equal(def.serial.length, 1);
  assert.equal(def.serialAktifId, "cerita-lek-kopi");

  const hasil = normalisasiKonfigSerial({
    latar: [
      {
        id: "l1",
        kode: "Meja Bar!!",
        nama: "Bar Lek Kopi",
        urlKartun: "https://contoh.supabase.co/storage/v1/object/public/studio/serial/latar/bar.jpg",
        jalurKartun: "/serial/latar/bar.jpg",
        gayaKartun: "santai_sore",
      },
      {
        id: "l-invalid",
        kode: "rusak",
        urlKartun: "http://bukan-https.jpg",
        jalurKartun: "a.jpg",
      },
    ],
    serial: [
      {
        id: "Ngopi Waru",
        judul: "Ngopi di Waru",
        moodBawaan: "kehidupan_santai",
        formatSuara: "dialog",
        suaraTokoh: {
          mas_barista: "TX3LPaxmHKxFdv7VOQHJ",
          mbak_pelanggan: "pendek",
        },
        episode: [
          { nomor: 2, judul: "Gajian", ringkasan: "Beli kopi", mood: "komedi_ceria" },
          { nomor: 1, judul: "Salah Pesan", ringkasan: "Kopi pahit", mood: "komedi_ceria" },
        ],
      },
    ],
    serialAktifId: "ngopi-waru",
  });

  assert.equal(hasil.latar.length, 1);
  assert.equal(hasil.latar[0].kode, "meja-bar");
  assert.equal(hasil.latar[0].jalurKartun, "serial/latar/bar.jpg");
  assert.equal(hasil.serialAktifId, "ngopi-waru");
  assert.equal(hasil.serial[0].suaraTokoh.mas_barista, "TX3LPaxmHKxFdv7VOQHJ");
  assert.equal(hasil.serial[0].suaraTokoh.mbak_pelanggan, undefined);
  assert.deepEqual(
    hasil.serial[0].episode.map((e) => e.nomor),
    [1, 2],
  );
});

test("episodeBerikutnya dan catatEpisodeSelesai bersifat idempoten", () => {
  const awal = konfigSerialBawaan();
  assert.equal(episodeBerikutnya(awal.serial[0]), 1);

  const ep1 = catatEpisodeSelesai(awal, "cerita-lek-kopi", {
    nomor: 1,
    judul: "Salah Takar",
    ringkasan: "Mas Danu salah pesan double shot.",
    tema: "komedi",
    mood: "komedi_ceria",
    tugasId: "tugas-abc",
    dibuat: "2026-11-25T10:00:00.000Z",
  });
  assert.equal(episodeBerikutnya(ep1.serial[0]), 2);

  // Catat ulang tugasId yang sama → tidak menduplikasi
  const ep1Ulang = catatEpisodeSelesai(ep1, "cerita-lek-kopi", {
    nomor: 1,
    judul: "Salah Takar Revisi",
    ringkasan: "Diperbarui",
    tema: "komedi",
    mood: "komedi_ceria",
    tugasId: "tugas-abc",
    dibuat: "2026-11-25T10:05:00.000Z",
  });
  assert.equal(ep1Ulang.serial[0].episode.length, 1);
  assert.equal(ep1Ulang.serial[0].episode[0].judul, "Salah Takar Revisi");
});

test("bersihkanKodeLokasi dan bangunPromptKartunkanFoto sesuai spesifikasi", () => {
  assert.equal(bersihkanKodeLokasi("  Area Outdoor #1!! "), "area-outdoor-1");
  assert.equal(bersihkanKodeLokasi("___", "outdoor"), "outdoor");

  const promptCeria = bangunPromptKartunkanFoto("ceria_hangat", "Meja Bar Lek Kopi");
  assert.match(promptCeria, /2D cel-shaded cartoon/i);
  assert.match(promptCeria, /NO people/i);
  assert.match(promptCeria, /9:16/i);

  const promptSore = bangunPromptKartunkanFoto("santai_sore", "Paving Outdoor");
  assert.match(promptSore, /golden-hour/i);
});

test("buatPromptSaranCeritaSerial & normalisasiSaranCeritaSerial mengolah kata kunci, menu resmi, dan riwayat", () => {
  const { system, prompt } = buatPromptSaranCeritaSerial({
    judulSerial: "Cerita di Lek Kopi",
    nomorEpisode: 2,
    kataKunci: "hujan sore",
    mood: "komedi_ceria",
    riwayatEpisode: [{ nomor: 1, judul: "Salah Pesan", ringkasan: "Pesan pahit", tema: "kopi", mood: "komedi_ceria", dibuat: "2026-11-25T00:00:00Z" }],
    daftarMenu: [{ nama: "Kopi Lek", harga: 10000, kategori: "Kopi" }],
  });
  assert.match(system, /Lek Kopi/);
  assert.match(prompt, /hujan sore/);
  assert.match(prompt, /Ep 1 "Salah Pesan"/);
  assert.match(prompt, /Kopi Lek \(Rp10\.000\)/);
  assert.match(prompt, /lek-kopi\.web\.app/);

  const hasil = normalisasiSaranCeritaSerial({
    saran: [
      { judul: "Hujan di Paving", premis: "Tenda bocor dikit.", punchline: "Malah jadi akrab.", mood: "komedi_ceria", ideLengkap: "Cerita hujan sore." },
      { judul: "Kosong", premis: "", ideLengkap: "" },
      { judul: "Kopi Hangat", premis: "Mas Danu kedinginan.", punchline: "Pesan matcha hangat.", mood: "ngarang", ideLengkap: "" },
      { judul: "Ketiga", premis: "Premis 3", punchline: "Ending 3", mood: "cerita_kopi", ideLengkap: "Ide 3" },
      { judul: "Keempat dibuang", premis: "Premis 4", punchline: "Ending 4", mood: "cerita_kopi", ideLengkap: "Ide 4" },
    ],
  }, "kehidupan_santai");
  assert.equal(hasil.length, 3);
  assert.equal(hasil[1].mood, "kehidupan_santai");
});

test("buatPromptNaskahDrafSerial & normalisasiNaskahDrafSerial menormalisasi adegan siap render", () => {
  const { prompt } = buatPromptNaskahDrafSerial({
    judulSerial: "Cerita di Lek Kopi",
    nomorEpisode: 3,
    kataKunci: "gajian",
    daftarLatar: [{ id: "1", kode: "bar", nama: "Meja Bar", deskripsi: "Mesin kopi", urlKartun: "https://x/a.jpg", jalurKartun: "a.jpg", gayaKartun: "ceria_hangat", dibuat: "2026-11-25T00:00:00Z" }],
    daftarMenu: [{ nama: "Butterscoth Latte", harga: 14000, kategori: "Kopi" }],
  });
  assert.match(prompt, /"bar": Meja Bar/);
  assert.match(prompt, /gajian/);
  assert.match(prompt, /Butterscoth Latte \(Rp14\.000\)/);
  assert.match(prompt, /lek-kopi\.web\.app/);

  const draf = normalisasiNaskahDrafSerial({
    judulEpisode: "Tanggal Dua Tiba",
    adegan: [
      {
        nomor: 1,
        latarKode: "BAR!",
        kamera: "ngaco",
        tokohKiri: { id: "tokoh_palsu", ekspresi: "ngaco", properti: "es_kopi", efek: "tawa" },
        tokohKanan: null,
        pembicara: "kanan",
        namaPembicara: "",
        dialog: "Akhirnya gajian rek!",
        sfx: "pop",
      },
    ],
    hashtag: ["#Gajian", "Lek Kopi!!"],
  }, 3);
  assert.equal(draf.adegan.length, 1);
  assert.equal(draf.adegan[0].latarKode, "bar");
  assert.equal(draf.adegan[0].kamera, "zoom_masuk");
  assert.equal(draf.adegan[0].tokohKiri?.id, "mas_barista");
  assert.equal(draf.adegan[0].pembicara, "kiri");
  assert.deepEqual(draf.hashtag, ["gajian", "lekkopi"]);
});

test("buatPromptNaskahDrafSerial mendukung cerita naratif panjang, campuran narator+dialog, dan mode bersambung", () => {
  const ceritaPanjang =
    "Setiap pagi, miliaran orang di dunia memulai harinya dengan satu tegukan kopi. ".repeat(16) +
    "AKHIR_CERITA_SYEKH_SYADZILI";
  assert.ok(ceritaPanjang.length > 1000);

  const { prompt } = buatPromptNaskahDrafSerial({
    judulSerial: "Kisah Kopi Pertama",
    nomorEpisode: 1,
    mood: "cerita_kopi",
    formatSuara: "campuran",
    panjangNaskah: "panjang",
    bersambung: true,
    ide: ceritaPanjang,
  });

  assert.match(prompt, /9 sampai 14 adegan/);
  assert.match(prompt, /22–48 kata per adegan/);
  assert.match(prompt, /Narator \+ Dialog Tokoh/);
  assert.match(prompt, /MODE BERSAMBUNG/);
  assert.match(prompt, /Bersambung ke Episode 2/);
  assert.match(prompt, /AKHIR_CERITA_SYEKH_SYADZILI/);

  const konfigCampuran = normalisasiKonfigSerial({
    serial: [{ id: "kisah-kopi", judul: "Kisah Kopi", formatSuara: "campuran" }],
    serialAktifId: "kisah-kopi",
  });
  assert.equal(konfigCampuran.serial[0].formatSuara, "campuran");
});

test("normalisasiNaskahDrafSerial mendukung hingga 16 adegan & dialog panjang, plus estimasiDurasiNaskahSerial", () => {
  const dialogPanjang =
    "Ratusan tahun lalu, seorang ulama besar bernama Syekh Abul Hasan Asy-Syadzili sedang mengembara untuk bertafakur di tengah lembah sunyi. Beliau ingin menghabiskan malamnya dengan beribadah, namun perjalanan panjang membuat tubuhnya sangat lelah sehingga ia berdoa memohon kekuatan kepada Allah.";
  assert.ok(dialogPanjang.length > 260);

  const adeganBanyak = Array.from({ length: 17 }, (_, i) => ({
    nomor: i + 1,
    latarKode: "outdoor",
    kamera: "zoom_masuk",
    tokohKiri: { id: "pak_tetangga", ekspresi: "senyum", properti: "kopi_panas", efek: "tanpa" },
    tokohKanan: null,
    pembicara: "narator",
    namaPembicara: "Narator",
    dialog: i === 0 ? dialogPanjang : "Narasi lanjutan episode cerita kopi hangat yang mengalir tenang.",
    sfx: "tanpa",
  }));

  const draf = normalisasiNaskahDrafSerial({ judulEpisode: "Biji Merah", adegan: adeganBanyak }, 1);
  assert.equal(draf.adegan.length, 16);
  assert.equal(draf.adegan[0].dialog, dialogPanjang);

  const est = estimasiDurasiNaskahSerial([{ dialog: "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh" }]);
  assert.equal(est.totalKata, 10);
  assert.equal(est.totalDetik, 10.4);

  const adeganBaru = buatAdeganKosongSerial(7, "Meja Bar!");
  assert.equal(adeganBaru.nomor, 7);
  assert.equal(adeganBaru.latarKode, "meja-bar");
  assert.equal(adeganBaru.pembicara, "narator");
});

test("normalisasiSaranCeritaSerial, normalisasiNaskahDrafSerial & kataKunci panjang toleran variasi key AI", () => {
  const kataKunciPanjang = `${"Kisah Syekh Abul Hasan Asy-Syadzili di Yaman. ".repeat(14)}UJUNG_KATA_KUNCI`;
  assert.ok(kataKunciPanjang.length > 500);
  const { prompt } = buatPromptSaranCeritaSerial({
    kataKunci: kataKunciPanjang,
    panjangNaskah: "panjang",
  });
  assert.match(prompt, /UJUNG_KATA_KUNCI/);

  const saranBungkus = normalisasiSaranCeritaSerial({
    ide: [
      { title: "Biji Merah di Lembah Sunyi", ringkasan: "Perjalanan tafakur Syekh.", ending: "Lahirnya qahwah.", ide: "Kisah lengkap episode 1." },
    ],
  });
  assert.equal(saranBungkus.length, 1);
  assert.equal(saranBungkus[0].judul, "Biji Merah di Lembah Sunyi");

  const drafBungkus = normalisasiNaskahDrafSerial({
    naskah: {
      judulEpisode: "Qahwah Pertama",
      adegan: [
        {
          nomor: 1,
          latarKode: "outdoor",
          narasi: "Setiap pagi miliaran orang memulai harinya dengan secangkir kopi.",
          pembicara: "narator",
        },
      ],
    },
  });
  assert.equal(drafBungkus.judulEpisode, "Qahwah Pertama");
  assert.equal(drafBungkus.adegan.length, 1);
  assert.match(drafBungkus.adegan[0].dialog, /secangkir kopi/);
});

test("buatPromptRisetCeritaSerial, normalisasiRisetCeritaSerial, dan formatRisetCeritaKeTeks bekerja rapi", () => {
  const { system, prompt } = buatPromptRisetCeritaSerial({
    topik: "Sejarah Kopi Syekh Asy-Syadzili",
    catatanTambahan: "Fokus abad dan rujukan kitab",
  });
  assert.match(system, /Google Search/);
  assert.match(prompt, /Sejarah Kopi Syekh Asy-Syadzili/);
  assert.match(prompt, /Fokus abad dan rujukan kitab/);

  const riset = normalisasiRisetCeritaSerial(
    {
      data: {
        ringkasan: "Qahwah populer di kalangan ahli ibadah Yaman.",
        kronologi: ["Abad ke-15 di pelabuhan Mokha, Yaman"],
        catatan: "Bedakan Syekh Abul Hasan Asy-Syadzili dengan Syekh Ali bin Umar Asy-Syadzili.",
        rujukan: ["Umdat ash-Shafwah fi Hill al-Qahwah"],
      },
    },
    "Topik Cadangan",
  );
  assert.equal(riset.topik, "Topik Cadangan");
  assert.equal(riset.ringkasanFakta, "Qahwah populer di kalangan ahli ibadah Yaman.");
  assert.deepEqual(riset.poinKronologi, ["Abad ke-15 di pelabuhan Mokha, Yaman"]);
  assert.deepEqual(riset.sumber, ["Umdat ash-Shafwah fi Hill al-Qahwah"]);

  const teks = formatRisetCeritaKeTeks(riset);
  assert.match(teks, /RINGKASAN FAKTA:/);
  assert.match(teks, /1\. Abad ke-15 di pelabuhan Mokha, Yaman/);
  assert.match(teks, /CATATAN KRITIS SUMBER:/);
  assert.match(teks, /- Umdat ash-Shafwah fi Hill al-Qahwah/);
});

test("buatPromptNaskahDrafSerial mode dokumenter memakai hasil riset tanpa tokoh kedai dan daftar harga", () => {
  const { system, prompt } = buatPromptNaskahDrafSerial({
    judulSerial: "Jejak Qahwah",
    nomorEpisode: 1,
    gayaCerita: "dokumenter",
    hasilRiset: "Catatan al-Jaziri abad ke-15 tentang tradisi qahwah di Yaman.",
    daftarMenu: [{ nama: "Kopi Lek", harga: 14000, kategori: "kopi" }],
  });
  assert.match(system, /tokohKiri: null/);
  assert.match(system, /tokohKanan: null/);
  assert.match(system, /promptVisual/);
  assert.match(prompt, /DOKUMENTER \/ CERITA MOTION/);
  assert.match(prompt, /Catatan al-Jaziri abad ke-15/);
  assert.equal(prompt.includes("scroll title"), false);
  assert.equal(prompt.includes("14000"), false);
  assert.equal(prompt.includes("Kopi Lek"), false);
});

test("normalisasiNaskahDrafSerial mode dokumenter dan buatAdeganKosongSerial mengosongkan tokoh serta menyimpan promptVisual", () => {
  const kosong = buatAdeganKosongSerial(3, "outdoor", "dokumenter");
  assert.equal(kosong.latarKode, "sejarah");
  assert.equal(kosong.tokohKiri, null);
  assert.equal(kosong.tokohKanan, null);
  assert.equal(kosong.pembicara, "narator");

  const draf = normalisasiNaskahDrafSerial(
    {
      adegan: [
        {
          nomor: 1,
          latarKode: "gua",
          tokohKiri: { id: "mas_barista" },
          pembicara: "kiri",
          narasi: "Di keheningan malam Yaman, doa dipanjatkan.",
          visual: "Warm stylized historical scene in Yemeni mountain cave, vertical 9:16, no text",
        },
      ],
    },
    2,
    { gayaCerita: "dokumenter" },
  );
  assert.equal(draf.tema, "Dokumenter Sejarah");
  assert.equal(draf.adegan[0].tokohKiri, null);
  assert.equal(draf.adegan[0].tokohKanan, null);
  assert.equal(draf.adegan[0].pembicara, "narator");
  assert.equal(draf.adegan[0].namaPembicara, "Narator");
  assert.equal(draf.adegan[0].latarKode, "gua");
  assert.match(draf.adegan[0].promptVisual ?? "", /Yemeni mountain cave/);
});

test("buatDrafManualSerial dan normalisasiNaskahDrafSerial menjaga metadata CeritaMotion per bagian", () => {
  const manualPerkamen = buatDrafManualSerial({
    judulEpisode: "Qahwah dari Mokha",
    nomorEpisode: 2,
    gayaCerita: "dokumenter",
    temaVisual: "perkamen",
  });
  assert.equal(manualPerkamen.adegan.length, 4);
  assert.equal(manualPerkamen.adegan[0].jenisMotion, "pembuka");
  assert.equal(manualPerkamen.adegan[1].jenisMotion, "perkamen");
  assert.equal(manualPerkamen.adegan[2].jenisMotion, "peta");
  assert.equal(manualPerkamen.adegan[3].jenisMotion, "penutup");

  const manualMalam = buatDrafManualSerial({
    judulEpisode: "Malam di Lembah",
    nomorEpisode: 1,
    gayaCerita: "dokumenter",
    temaVisual: "malam",
  });
  assert.equal(manualMalam.adegan[1].jenisMotion, "ilustrasi");

  const rapih = normalisasiNaskahDrafSerial(
    {
      judulEpisode: "Jejak Qahwah",
      adegan: [
        {
          nomor: 1,
          jenisMotion: "perkamen",
          judulKartu: "Buah Merah di Lereng Yaman",
          kartuWaktu: "YAMAN · ABAD KE-15",
          dialog: "Para ulama menyeduh biji merah untuk menjaga dzikir.",
          kataSorot: "ulama, biji, merah, dzikir",
        },
      ],
    },
    1,
    { gayaCerita: "dokumenter" },
  );
  assert.equal(rapih.adegan[0].jenisMotion, "perkamen");
  assert.equal(rapih.adegan[0].judulKartu, "Buah Merah di Lereng Yaman");
  assert.deepEqual(rapih.adegan[0].kataSorot, ["ulama", "biji", "merah", "dzikir"]);
});
