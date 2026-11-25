import test from "node:test";
import assert from "node:assert/strict";
import { apakahNamaFileAcak, formatCaptionKonsisten, normalisasiMerek, promptCaptionOtomatis } from "./caption-konsisten.ts";
import { buatPromptGoogleFlow } from "./google-flow-murni.ts";

test("normalisasiMerek mengenali lekkopi dan bakafrawi", () => {
  assert.equal(normalisasiMerek("lekkopi"), "lekkopi");
  assert.equal(normalisasiMerek("lek-kopi"), "lekkopi");
  assert.equal(normalisasiMerek("bakafrawi"), "bakafrawi");
  assert.equal(normalisasiMerek(undefined), "bakafrawi");
});

test("formatCaptionKonsisten selalu menyertakan CTA konsisten & hashtag inti unik tanpa duplikat", () => {
  const lk = formatCaptionKonsisten({
    merek: "lekkopi",
    isiCaption: "Sore mendung enaknya ngopi santai di Waru. #spam #lekkopi",
    hashtagTambahan: ["#ButterscothLatte", "lekkopi", "kopi-sore"],
  });
  assert.match(lk.captionLengkap, /Jl\. Kolonel Sugiono No\. 112/);
  assert.match(lk.captionLengkap, /#lekkopi\b/);
  assert.match(lk.captionLengkap, /#butterscothlatte\b/);
  assert.equal(lk.hashtag.filter((h) => h === "lekkopi").length, 1);
  assert.ok(lk.hashtag.length <= 10);

  const bk = formatCaptionKonsisten({
    merek: "bakafrawi",
    isiCaption: "Rekap toko masih manual sampai larut malam?",
    hashtagTambahan: ["maktabapos", "kasirumkm"],
  });
  assert.match(bk.captionLengkap, /bakafrawi\.com/);
  assert.match(bk.captionLengkap, /#bakafrawiproject\b/);
  assert.match(bk.captionLengkap, /#maktabapos\b/);
});

test("promptCaptionOtomatis menghasilkan instruksi sesuai merek", () => {
  const p = promptCaptionOtomatis({ merek: "lekkopi", judul: "Promo Matcha Sore", jenis: "video" });
  assert.match(p.system, /Lek Kopi/);
  assert.match(p.prompt, /Promo Matcha Sore/);
});

test("buatPromptGoogleFlow menyertakan aturan logat, obrolan 2 orang, produk pesantren, larangan logo palsu, dan riwayat anti-ulang", () => {
  const p = buatPromptGoogleFlow({
    merek: "bakafrawi",
    produk: "ammu-online",
    bahasa: "jawa_timur",
    gaya: "komedi_santai",
    formatDialog: "obrolan_2_orang",
    jumlahAdegan: 4,
    riwayat: ["Promo Es Kopi Susu Gula Aren"],
  });
  assert.match(p.system, /Google Flow/);
  assert.match(p.system, /Ammu Online/);
  assert.match(p.prompt, /TEPAT 4 adegan/);
  assert.match(p.prompt, /OBROLAN 2 ORANG/);
  assert.match(p.prompt, /STRICTLY NO shop signs/);
  assert.match(p.prompt, /Jawa Timur/);
  assert.match(p.prompt, /Promo Es Kopi Susu Gula Aren/);
});

test("buatPromptGoogleFlow mendukung preset FOOH 3D, Iklan Fast-Cut, Sketsa Visual, dan mode Tanpa Dialog SFX", () => {
  const fooh = buatPromptGoogleFlow({
    merek: "lekkopi",
    gaya: "fooh_3d",
    formatDialog: "tanpa_dialog_sfx",
    jumlahAdegan: 1,
    topik: "Billboard 3D cup kopi raksasa di Sidoarjo",
  });
  assert.match(fooh.prompt, /TEPAT 1 adegan/);
  assert.match(fooh.prompt, /TANPA DIALOG UCAPAN/);
  assert.match(fooh.prompt, /FOOH 3D/);
  assert.match(fooh.prompt, /STRICTLY NO garbled AI text/);

  const iklan = buatPromptGoogleFlow({
    merek: "lekkopi",
    gaya: "iklan_komersial",
    formatDialog: "tanpa_dialog_sfx",
    jumlahAdegan: 4,
  });
  assert.match(iklan.prompt, /IKLAN KOMERSIAL FAST-CUT/);
  assert.match(iklan.prompt, /TEPAT 4 adegan/);

  const sketsa = buatPromptGoogleFlow({
    merek: "lekkopi",
    gaya: "sketsa_visual",
    formatDialog: "tanpa_dialog_sfx",
    jumlahAdegan: 2,
  });
  assert.match(sketsa.prompt, /SKETSA KOMEDI VISUAL/);
  assert.match(sketsa.prompt, /TEPAT 2 adegan/);
  assert.match(sketsa.prompt, /STRICTLY NO shop signs/);
});

test("buatPromptGoogleFlow wajib memakai format 6 blok arahan jelas & identitas pembicara", () => {
  const p = buatPromptGoogleFlow({
    merek: "lekkopi",
    bahasa: "jawa_campur",
    gaya: "komedi_santai",
    formatDialog: "obrolan_2_orang",
    jumlahAdegan: 3,
  });
  assert.match(p.prompt, /SHOT & CAMERA:/);
  assert.match(p.prompt, /SUBJECT & CONTINUITY:/);
  assert.match(p.prompt, /SETTING & LIGHTING:/);
  assert.match(p.prompt, /ACTION TIMELINE \(0-8s\):/);
  assert.match(p.prompt, /AUDIO & DIALOGUE:/);
  assert.match(p.prompt, /identitas fisik/i);
  assert.match(p.prompt, /CONSTRAINTS:/);
});

test("apakahNamaFileAcak & promptCaptionOtomatis multi-bingkai membaca isi visual video", () => {
  assert.equal(apakahNamaFileAcak("VID_20261124_193011.mp4"), true);
  assert.equal(apakahNamaFileAcak("lv_0_202611241230.mp4"), true);
  assert.equal(apakahNamaFileAcak("ScreenRecording_1124.mp4"), true);
  assert.equal(apakahNamaFileAcak("Promo Kopi Lek Sore.mp4"), false);

  const pAcak = promptCaptionOtomatis({
    merek: "lekkopi",
    judul: "VID_20261124_193011.mp4",
    jenis: "video",
    sasaran: "reels",
    jumlahBingkai: 5,
  });
  assert.match(pAcak.prompt, /TERLAMPIR 5 BINGKAI/);
  assert.match(pAcak.prompt, /teks apa pun yang muncul/i);
  assert.match(pAcak.prompt, /abaikan nama file generik/i);
});
