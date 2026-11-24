import { test } from "node:test";
import assert from "node:assert/strict";
import { buatPromptAuditIg, ringkasMetrikAudit, type PostAuditMasukan } from "./audit-ig-murni.ts";

const CONTOH_POSTS: PostAuditMasukan[] = [
  {
    id: "p1",
    merek: "lekkopi",
    produk: "lekkopi-promo",
    jenis: "video",
    format: "reels",
    caption: "Reel terbaru kopi susu sepi nih",
    dibuat: "2026-11-24T10:00:00Z",
    tayangWaktu: "2026-11-24T12:00:00Z",
    likes: 8,
    comments: 0,
    views: 300,
    reach: 280,
    saved: 1,
    shares: 0,
  },
  {
    id: "p2",
    merek: "lekkopi",
    produk: "lekkopi-menu",
    jenis: "video",
    format: "reels",
    caption: "Sakura Iced Coffee segar banget!",
    dibuat: "2026-11-22T10:00:00Z",
    tayangWaktu: "2026-11-22T12:00:00Z",
    likes: 45,
    comments: 5,
    views: 1500,
    reach: 1320,
    saved: 20,
    shares: 8,
  },
  {
    id: "p3",
    merek: "lekkopi",
    produk: "lekkopi-suasana",
    jenis: "gambar",
    format: "feed",
    caption: "Malam minggu ngopi di Waru",
    dibuat: "2026-11-20T10:00:00Z",
    tayangWaktu: "2026-11-20T12:00:00Z",
    likes: 30,
    comments: 3,
    views: 900,
    reach: 800,
    saved: 10,
    shares: 4,
  },
  {
    id: "p4",
    merek: "lekkopi",
    produk: "rutin-buka",
    jenis: "video",
    format: "story",
    caption: null,
    dibuat: "2026-11-21T07:00:00Z",
    tayangWaktu: "2026-11-21T07:00:00Z",
    likes: 0,
    comments: 0,
    views: null,
    reach: null,
  },
  {
    id: "p5",
    merek: "bakafrawi",
    produk: "maktaba-pos",
    jenis: "video",
    format: "reels",
    caption: "Kasir Maktaba POS untuk warung kopi",
    dibuat: "2026-11-23T10:00:00Z",
    tayangWaktu: "2026-11-23T12:00:00Z",
    likes: 50,
    comments: 6,
    views: 2100,
    reach: 1900,
  },
];

test("ringkasMetrikAudit menyaring merek dan menghitung rata-rata serta rasio terbaru", () => {
  const lek = ringkasMetrikAudit(CONTOH_POSTS, "lekkopi");
  assert.equal(lek.totalPost, 4);
  assert.equal(lek.jumlahReels, 2);
  assert.equal(lek.jumlahFeed, 1);
  assert.equal(lek.jumlahStory, 1);
  // rataViews hanya menghitung 3 post yg punya views angka (300 + 1500 + 900) / 3 = 900
  assert.equal(lek.rataViews, 900);
  // rataLikes hanya non-story (8 + 45 + 30) / 3 = 28
  assert.equal(lek.rataLikes, 28);
  assert.equal(lek.postTerbaru?.id, "p1");
  // 300 / 900 = 0.33
  assert.equal(lek.rasioTerbaruVsRata, 0.33);
  assert.equal(lek.tertinggi[0]?.id, "p2");
  assert.equal(lek.terendah.length, 1);
  assert.equal(lek.terendah[0]?.id, "p4");

  const semua = ringkasMetrikAudit(CONTOH_POSTS, "semua");
  assert.equal(semua.totalPost, 5);
  assert.equal(semua.tertinggi[0]?.id, "p5");
});

test("buatPromptAuditIg menyertakan pertanyaan khusus dan ringkasan angka nyata", () => {
  const stat = ringkasMetrikAudit(CONTOH_POSTS, "lekkopi");
  const p = buatPromptAuditIg({
    statistik: stat,
    pertanyaan: "Kenapa reel terakhirku cuma 300 views?",
  });
  assert.match(p.system, /Kyai/);
  assert.match(p.prompt, /Lek Kopi/);
  assert.match(p.prompt, /Rata-rata Views: 900/);
  assert.match(p.prompt, /rasioViewsVsRata=0\.33x/);
  assert.match(p.prompt, /Kenapa reel terakhirku cuma 300 views\?/);
});
