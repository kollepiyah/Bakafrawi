import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Situs } from "@/content/skema";
import { awalHariWIB, barisAcara, tanggalWIB } from "./agenda-murni";
import { daftarAcara, hapusAcara, tambahAcara, ubahAcara } from "./agenda-server";
import { rapikanRiwayat, type GiliranBot } from "./bot-murni";
import { ringkasanAplikasi } from "./aplikasi-server";
import { jalankanAuditInstagram } from "./audit-ig-server";
import { usulkanArahan, usulkanArahanLekKopi } from "./usul-arahan";
import { bedahDanSimpanReferensi, daftarReferensiMerek } from "./referensi-video";
import { JADWAL_OPTIMAL, statusWaktuSekarang } from "./riset-reels-murni";
import {
  aturTayang,
  bacaJadwalRutin,
  buatTugas,
  daftarTugasBot,
  simpanJadwalRutin,
  tayangkanRutinSekarang,
  ubahCaption,
  type AksiTayang,
} from "./studio-server";

// Chat bebas bot Telegram: Claude Haiku 5.5 effort rendah — sama dengan bot Kantor AI Lek Kopi
// (tanya-jawab ringan, cepat & murah). Aksi nyata dijalankan lewat alat yang memakai aturan yang
// sama dengan admin (studio-server.ts), jadi bot tak bisa melakukan hal yang admin tak bisa.
const MODEL = "claude-haiku-5-5";
const MAKS_PUTARAN = 5;

const ALAT: Anthropic.Tool[] = [
  {
    name: "info_jam_tayang",
    description: "Cek jadwal jam tayang Reels/Instagram yang paling bagus dan optimal (WIB), serta status waktu saat ini (apakah sedang Golden Prime Time atau waktu lainnya).",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: [], properties: {} },
  },
  {
    name: "usul_arahan_konten",
    description: "Usulkan pilihan arahan/sudut promosi AI untuk produk Bakafrawi (maktaba-pos, ammu-online, waseela) maupun kedai Lek Kopi (lekkopi-promo, lekkopi-menu, lekkopi-suasana, lekkopi-story). Kyai bisa memilih salah satu untuk langsung dibuatkan poster atau video.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["produk_slug", "jenis"],
      properties: {
        produk_slug: { type: "string", description: "slug produk Bakafrawi (mis. maktaba-pos, ammu-online, waseela) atau 'lekkopi' / 'lekkopi-promo' untuk Lek Kopi" },
        jenis: { type: "string", enum: ["gambar", "video"] },
      },
    },
  },
  {
    name: "buat_konten",
    description: "Pesan konten promosi Full AI baru ke Studio (poster 3 ukuran 1:1/4:5/9:16 atau video Reels) untuk Bakafrawi maupun Lek Kopi. Hasilnya dikirim ke chat ini dengan tombol persetujuan.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["merek", "produk_slug", "jenis", "latar_ai", "arahan"],
      properties: {
        merek: { type: "string", enum: ["bakafrawi", "lekkopi"], description: "merek konten: 'bakafrawi' atau 'lekkopi'" },
        produk_slug: { type: "string", description: "untuk bakafrawi: slug produk dari daftar produk; untuk lekkopi: lekkopi-promo, lekkopi-menu, lekkopi-suasana, atau lekkopi-story" },
        jenis: { type: "string", enum: ["gambar", "video"] },
        latar_ai: { type: "boolean", description: "pakai visual/latar buatan AI (default true)" },
        arahan: { type: "string", description: "arahan tema/promo/gaya/sasaran untuk AI (mis. 'Poster promo Hari Guru untuk Lek Kopi'); kosong bila otomatis" },
      },
    },
  },
  {
    name: "daftar_konten",
    description: "Lihat konten Studio terbaru beserta status pembuatan, status tayang, jadwal, dan caption.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["batas"],
      properties: { batas: { type: "integer", description: "jumlah konten, 1-20" } },
    },
  },
  {
    name: "ubah_caption",
    description: "Ganti caption sebuah konten yang belum tayang. Tulis caption lengkap baru (termasuk ajakan & hashtag).",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["id", "caption"],
      properties: { id: { type: "string" }, caption: { type: "string" } },
    },
  },
  {
    name: "ringkasan_aplikasi",
    description: "Ringkasan terbaru semua aplikasi Kyai: Maktaba POS (toko, langganan, pendapatan, pembayaran menunggu), Lek Kopi (omzet & transaksi hari ini vs kemarin, terlaris, kas, bon/hutang, stok menipis), Ammu Online & Waseela (angka teknis saja), plus hal yang perlu perhatian.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: [], properties: {} },
  },
  {
    name: "pelajari_link_video",
    description: "Bedah tautan video referensi Instagram Reels / TikTok / YouTube Shorts yang dikirim Kyai menjadi Blueprint Gaya (hook, pacing, visual, teks, arahan tiru) lalu simpan ke perpustakaan referensi merek (bakafrawi atau lekkopi).",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["merek", "url", "catatan"],
      properties: {
        merek: { type: "string", description: "bakafrawi atau lekkopi" },
        url: { type: "string", description: "tautan lengkap https://..." },
        catatan: { type: "string", description: "bagian yang disukai/ingin ditiru; kosong bila tidak ada" },
      },
    },
  },
  {
    name: "lihat_referensi_video",
    description: "Lihat daftar link video referensi yang sudah dipelajari Studio untuk satu merek (bakafrawi atau lekkopi).",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["merek"],
      properties: { merek: { type: "string" } },
    },
  },
  {
    name: "lihat_agenda",
    description: "Lihat acara di agenda Kyai (tersinkron Google Calendar) antara dua tanggal WIB, inklusif. Pakai juga untuk mencari id acara sebelum mengubah/menghapus.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["dari", "sampai"],
      properties: {
        dari: { type: "string", description: "tanggal awal YYYY-MM-DD (WIB)" },
        sampai: { type: "string", description: "tanggal akhir YYYY-MM-DD (WIB), inklusif" },
      },
    },
  },
  {
    name: "tambah_acara",
    description: "Tambah acara ke agenda Kyai; otomatis masuk Google Calendar. Waktu ditulis WIB tanpa zona, mis. 2026-11-20T09:00.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["judul", "mulai", "selesai", "seharian", "lokasi", "catatan"],
      properties: {
        judul: { type: "string" },
        mulai: { type: "string", description: "YYYY-MM-DDTHH:MM (WIB), atau YYYY-MM-DD bila seharian" },
        selesai: { type: "string", description: "YYYY-MM-DDTHH:MM; kosong = 1 jam. Bila seharian: tanggal terakhir (inklusif) atau kosong" },
        seharian: { type: "boolean" },
        lokasi: { type: "string", description: "kosong bila tidak disebut" },
        catatan: { type: "string", description: "kosong bila tidak ada" },
      },
    },
  },
  {
    name: "ubah_acara",
    description: "Ubah acara yang ada (geser waktu, ganti judul/lokasi/catatan). Isi hanya kolom yang berubah; kolom lain kosongkan.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["id", "judul", "mulai", "selesai", "lokasi", "catatan"],
      properties: {
        id: { type: "string" },
        judul: { type: "string" },
        mulai: { type: "string", description: "YYYY-MM-DDTHH:MM (WIB); kosong = tetap" },
        selesai: { type: "string", description: "kosong = tetap (bila mulai digeser, isi juga selesai baru)" },
        lokasi: { type: "string" },
        catatan: { type: "string" },
      },
    },
  },
  {
    name: "hapus_acara",
    description: "Hapus acara dari agenda dan Google Calendar. Pakai hanya bila Kyai memintanya jelas.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string" } } },
  },
  {
    name: "atur_tayang",
    description: "Tayangkan konten yang sudah jadi ke Instagram sekarang, jadwalkan pada tanggal & jam custom WIB (atau pukul 19.00 WIB bila jadwal_wib dikosongkan), pilih sasaran (otomatis, story, reels, reels+story, feed, feed+story), tolak, atau batalkan tayang.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["id", "aksi", "jadwal_wib", "sasaran"],
      properties: {
        id: { type: "string" },
        aksi: { type: "string", enum: ["sekarang", "jadwal", "tolak", "batal"] },
        jadwal_wib: {
          type: "string",
          description: "Waktu jadwal custom format YYYY-MM-DDTHH:MM (WIB), mis. 2026-11-21T14:30. Kosongkan bila ingin default 19.00 WIB atau bila aksi bukan jadwal.",
        },
        sasaran: {
          type: "string",
          enum: ["otomatis", "story", "reels", "reels+story", "feed", "feed+story"],
          description: "Sasaran tayang Instagram; pilih 'otomatis' bila tidak diminta khusus.",
        },
      },
    },
  },
  {
    name: "audit_performa_ig",
    description: "Audit performa postingan Instagram (kenapa reel/post terakhir sepi atau ramai, pola berhasil, perbaikan prioritas, & ide konten berikutnya) dari data cache Supabase memakai AI hemat (NVIDIA/Gemini, 0 request Meta tambahan).",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["merek", "pertanyaan"],
      properties: {
        merek: { type: "string", enum: ["semua", "lekkopi", "bakafrawi"], description: "akun yang diaudit: semua, lekkopi, atau bakafrawi" },
        pertanyaan: { type: "string", description: "pertanyaan spesifik Kyai (mis. 'kenapa reel terakhir sepi?'); kosong bila audit umum" },
      },
    },
  },
  {
    name: "atur_jadwal_rutin",
    description: "Lihat atau atur jadwal otomatis jam buka (Story Opening Lek Kopi): aktifkan/nonaktifkan, ubah jam buka (HH:MM WIB, mis. 09:00 atau 14:00), atau langsung tayangkan Story Jam Buka sekarang.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["merek", "aksi", "jam_buka"],
      properties: {
        merek: { type: "string", description: "slug merek, default 'lekkopi'" },
        aksi: { type: "string", enum: ["lihat", "aktifkan", "nonaktifkan", "ubah_jam", "tayang_sekarang"] },
        jam_buka: { type: "string", description: "Jam buka HH:MM WIB (mis. 09:00 atau 14:00); kosong bila tidak diubah" },
      },
    },
  },
];

async function jalankanAlat(nama: string, isi: Record<string, unknown>, situs: Situs): Promise<string> {
  switch (nama) {
    case "info_jam_tayang": {
      const jamWIB = Number(
        new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23" }).format(new Date()),
      );
      const st = statusWaktuSekarang(jamWIB);
      return JSON.stringify({ ok: true, statusSaatIni: st.label, saran: st.saran, jadwalOptimal: JADWAL_OPTIMAL });
    }
    case "usul_arahan_konten": {
      const slug = String(isi.produk_slug ?? "").trim();
      const jenis = isi.jenis === "video" ? "video" : "gambar";
      if (slug === "lekkopi" || slug.startsWith("lekkopi-")) {
        const usulan = await usulkanArahanLekKopi(jenis, slug);
        return JSON.stringify({ ok: true, merek: "Lek Kopi", jenis, usulan });
      }
      const produk = situs.produk.find((p) => p.slug === slug);
      if (!produk) return `Produk "${slug}" tidak ada. Pilihan: ${situs.produk.map((p) => p.slug).join(", ")}, atau lekkopi-promo`;
      const usulan = await usulkanArahan(produk, jenis);
      return JSON.stringify({ ok: true, produk: produk.nama, jenis, usulan });
    }
    case "buat_konten": {
      const merek =
        String(isi.merek ?? "").toLowerCase() === "lekkopi" || String(isi.produk_slug ?? "").startsWith("lekkopi")
          ? "lekkopi"
          : "bakafrawi";
      const jenis = isi.jenis === "video" ? "video" : "gambar";
      const latar = isi.latar_ai === false ? "polos" : "ai";
      if (merek === "lekkopi") {
        const fokusSah = ["lekkopi-promo", "lekkopi-menu", "lekkopi-suasana", "lekkopi-story"];
        const slugMentah = String(isi.produk_slug ?? "").trim();
        const produkSlug = fokusSah.includes(slugMentah) ? slugMentah : "lekkopi-promo";
        const { tugas, dipicu } = await buatTugas({
          merek: "lekkopi",
          produk_slug: produkSlug,
          jenis,
          latar,
          arahan: String(isi.arahan ?? ""),
        });
        return JSON.stringify({
          ok: true,
          id: tugas.id,
          merek: "Lek Kopi",
          jenis,
          perkiraan: dipicu ? (jenis === "video" ? "3-6 menit" : "1-2 menit") : "putaran jadwal berikutnya (≤30 menit)",
        });
      }
      const slug = String(isi.produk_slug);
      const produk = situs.produk.find((p) => p.slug === slug);
      if (!produk) return `Produk "${slug}" tidak ada. Pilihan: ${situs.produk.map((p) => p.slug).join(", ")}`;
      // Video produk software = rekaman aplikasi: tanpa skenario demo maupun tautan, tawarkan poster.
      if (jenis === "video" && !produk.demo?.url && !produk.tautan.length) {
        return `Produk ${produk.nama} belum punya tautan/skenario demo untuk direkam — tawarkan poster saja.`;
      }
      const { tugas, dipicu } = await buatTugas({
        merek: "bakafrawi",
        produk_slug: slug,
        jenis,
        latar,
        arahan: String(isi.arahan ?? ""),
      });
      return JSON.stringify({
        ok: true,
        id: tugas.id,
        merek: "Bakafrawi",
        jenis,
        perkiraan: dipicu ? (jenis === "video" ? "3-6 menit" : "1-2 menit") : "putaran jadwal berikutnya (≤30 menit)",
      });
    }
    case "daftar_konten":
      return JSON.stringify(
        (await daftarTugasBot(Number(isi.batas) || 5)).map((t) => ({ ...t, caption: t.caption?.slice(0, 300) ?? null })),
      );
    case "ubah_caption":
      await ubahCaption(String(isi.id), String(isi.caption));
      return JSON.stringify({ ok: true });
    case "ringkasan_aplikasi":
      return JSON.stringify((await ringkasanAplikasi()).map((a) => (a.ok ? { nama: a.nama, data: a.data, perhatian: a.penilaian?.catatan } : { nama: a.nama, tidak_tersedia: a.galat })));
    case "pelajari_link_video": {
      const ref = await bedahDanSimpanReferensi({
        merek: String(isi.merek || "bakafrawi"),
        url: String(isi.url),
        catatan: String(isi.catatan ?? "") || undefined,
      });
      return JSON.stringify({ ok: true, id: ref.id, blueprint: ref.analisis });
    }
    case "lihat_referensi_video": {
      const daftar = await daftarReferensiMerek(String(isi.merek || "bakafrawi"), 8);
      return JSON.stringify(daftar.map((r) => ({ id: r.id, judul: r.caption, url: r.permalink, preset: r.analisis?.presetCocok, arahanTiru: r.analisis?.arahanTiru })));
    }
    case "lihat_agenda": {
      const dari = awalHariWIB(String(isi.dari));
      const sampai = new Date(awalHariWIB(String(isi.sampai)).getTime() + 86400000);
      if (Number.isNaN(dari.getTime()) || Number.isNaN(sampai.getTime())) return "Tanggal tidak terbaca (pakai YYYY-MM-DD).";
      const acara = await daftarAcara(dari, sampai);
      return JSON.stringify(acara.map((a) => ({ id: a.id, ringkas: barisAcara(a), tanggal: tanggalWIB(new Date(a.mulai)), catatan: a.catatan })));
    }
    case "tambah_acara": {
      const { acara, keGoogle } = await tambahAcara({
        judul: String(isi.judul),
        mulai: String(isi.mulai),
        selesai: String(isi.selesai ?? "") || null,
        seharian: Boolean(isi.seharian),
        lokasi: String(isi.lokasi ?? ""),
        catatan: String(isi.catatan ?? ""),
      });
      return JSON.stringify({ ok: true, id: acara.id, ringkas: barisAcara(acara), tanggal: tanggalWIB(new Date(acara.mulai)), google: keGoogle ? "sudah masuk Google Calendar" : "dikirim ke Google dalam ≤5 menit / Google belum tersambung" });
    }
    case "ubah_acara": {
      const kosongJadiTetap = (v: unknown) => (String(v ?? "").trim() ? String(v) : undefined);
      const { acara } = await ubahAcara(String(isi.id), {
        judul: kosongJadiTetap(isi.judul),
        mulai: kosongJadiTetap(isi.mulai),
        selesai: kosongJadiTetap(isi.selesai),
        lokasi: kosongJadiTetap(isi.lokasi),
        catatan: kosongJadiTetap(isi.catatan),
      });
      return JSON.stringify({ ok: true, ringkas: barisAcara(acara), tanggal: tanggalWIB(new Date(acara.mulai)) });
    }
    case "hapus_acara":
      await hapusAcara(String(isi.id));
      return JSON.stringify({ ok: true });
    case "atur_tayang": {
      const t = await aturTayang(String(isi.id), isi.aksi as AksiTayang, {
        jadwal: String(isi.jadwal_wib ?? "").trim() || undefined,
        sasaran: String(isi.sasaran ?? "otomatis"),
      });
      return JSON.stringify({ ok: true, status_tayang: t.status_tayang, jadwal_tayang: t.jadwal_tayang });
    }
    case "audit_performa_ig": {
      const merek =
        isi.merek === "lekkopi" || isi.merek === "bakafrawi" ? isi.merek : "semua";
      const hasil = await jalankanAuditInstagram({
        merek,
        pertanyaan: String(isi.pertanyaan ?? ""),
      });
      return JSON.stringify({
        ok: true,
        penyedia: `${hasil.penyedia}/${hasil.model}`,
        biayaUsd: hasil.biayaUsd,
        statistik: {
          totalPost: hasil.statistik.totalPost,
          rataViews: hasil.statistik.rataViews,
          rataLikes: hasil.statistik.rataLikes,
          rasioTerbaruVsRata: hasil.statistik.rasioTerbaruVsRata,
        },
        audit: hasil.audit,
      });
    }
    case "atur_jadwal_rutin": {
      const merek = String(isi.merek || "lekkopi");
      const aksi = String(isi.aksi);
      const jam = String(isi.jam_buka ?? "").trim();
      if (aksi === "lihat") {
        return JSON.stringify({ ok: true, ...(await bacaJadwalRutin(merek)) });
      }
      if (aksi === "tayang_sekarang") {
        return JSON.stringify({ ok: true, ...(await tayangkanRutinSekarang(merek)) });
      }
      const patch: Record<string, unknown> = {};
      if (aksi === "aktifkan") patch.aktif = true;
      if (aksi === "nonaktifkan") patch.aktif = false;
      if (jam) patch.jam = jam;
      return JSON.stringify({ ok: true, ...(await simpanJadwalRutin(merek, patch)) });
    }
    default:
      return `Alat ${nama} tidak dikenal.`;
  }
}

function sistem(situs: Situs) {
  const produk = situs.produk.map((p) => `- ${p.slug}: ${p.nama} (${p.kategori}${p.tampil ? "" : ", disembunyikan di situs"}) — ${p.judul}`).join("\n");
  const hari = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full", timeStyle: "short" });
  return `Kamu asisten pribadi Kyai di Bakafrawi Studio (Kyai = pemilik Bakafrawi Project, software developer di Sidoarjo), lewat Telegram.
Bakafrawi membuat website & aplikasi custom dan menjual aplikasi siap pakai (Maktaba POS). Tugasmu: mengatur agenda harian Kyai (tersinkron Google Calendar), membantu membuat dan mengelola konten promosi Instagram, memberi ide konten, dan menjawab pertanyaan seputar itu.
Sekarang: ${hari} WIB (tanggal ${tanggalWIB(new Date())}).
Produk:
${produk}

Aturan:
- Jawab dalam Bahasa Indonesia yang hangat dan ringkas (pesan Telegram, bukan esai). Panggil pengguna "Kyai".
- Untuk memesan, melihat, mengubah caption, atau menayangkan konten, PAKAI ALAT — jangan pernah mengaku sudah melakukan sesuatu tanpa hasil alat.
- Menayangkan ke Instagram hanya bila Kyai memintanya jelas. Kalau ragu konten mana yang dimaksud, lihat daftar_konten dulu lalu tanyakan.
- Agenda: hitung sendiri tanggal dari kata seperti "besok", "Jumat depan", "ba'da Isya" (≈19.30) dari tanggal sekarang; semua jam WIB. Bila jam tidak disebut dan acara bukan seharian, tanyakan dulu. Sebelum ubah/hapus, cari id lewat lihat_agenda. Setelah menyimpan, sebutkan hari, tanggal, dan jamnya supaya Kyai bisa mengecek.
- Merek di Studio ada dua: "bakafrawi" (produk software/aplikasi di atas) dan "lekkopi" (kedai kopi Lek Kopi di Panjunan, Waru, Sidoarjo). Keduanya memakai fitur yang SAMA lewat alat buat_konten (Poster 3 ukuran maupun Video Full AI) — Lek Kopi TIDAK lagi memakai bank video Google Drive.
- Untuk Lek Kopi: pilih merek="lekkopi", produk_slug salah satu dari lekkopi-promo (promo/hari spesial spt Hari Guru), lekkopi-menu, lekkopi-suasana, atau lekkopi-story, dan latar_ai=true.
- Saran & ide konten AI: pakai alat usul_arahan_konten baik untuk produk Bakafrawi maupun Lek Kopi (lekkopi-promo/menu/suasana/story), berikan daftar bernomor yang singkat; Kyai bisa membalas "nomor 2 jadikan poster".
- Pertanyaan keadaan aplikasi/bisnis (toko & langganan Maktaba, omzet/stok/kas Lek Kopi hari ini, pengguna Ammu/Waseela) → ringkasan_aplikasi; sebut angkanya persis dari alat. Untuk Ammu & Waseela hanya ada angka teknis (data lembaga klien) — jangan menebak hal lain.
- AWAS nama ganda: "Lek Kopi" tanpa menyebut aplikasi/kasir maksudnya kedai kopi (merek "lekkopi" di buat_konten), sedangkan produk "lek-kopi" di daftar produk adalah aplikasi kasir Lek Kopi POS (merek "bakafrawi"). Ragu → tanyakan.
- Jam tayang & formula Reels viral: bila Kyai menanyakan jam tayang yang bagus, pakai alat info_jam_tayang (terutama Golden Prime Time 17.30-19.30 WIB dan Istirahat Siang 11.45-13.00 WIB). Bila bertanya rahasia Reels viral, jelaskan 4 pilar: Hook 3 detik pertama, pacing visual 2-4 detik, teks layar kontras, dan CTA konkret.
- Audit performa Instagram (mis. "kenapa reel terakhir sepi?", "evaluasi konten IG", "audit performa IG"): WAJIB pakai alat audit_performa_ig lalu sampaikan hasil bedahnya secara ringkas dan praktis.
- Jangan menyebut harga paket atau angka yang tidak kamu ketahui. Jangan membagikan token/kunci apa pun.`;
}

/** Jawab satu pesan bebas dari pemilik; mengembalikan teks balasan & riwayat baru. */
export async function jawabBebas(teks: string, riwayat: GiliranBot[], situs: Situs): Promise<{ balasan: string; riwayat: GiliranBot[] }> {
  const client = new Anthropic();
  const lalu = rapikanRiwayat(riwayat);
  const pesan: Anthropic.MessageParam[] = [...lalu.map((g) => ({ role: g.peran, content: g.teks })), { role: "user", content: teks }];

  let balasan = "";
  for (let i = 0; i < MAKS_PUTARAN; i++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: sistem(situs),
      tools: ALAT,
      messages: pesan,
    });
    if (res.stop_reason === "refusal") {
      balasan = "Maaf Kyai, permintaan itu tidak bisa saya bantu.";
      break;
    }
    balasan = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    const panggilan = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || panggilan.length === 0) break;
    // Seluruh isi jawaban (termasuk blok thinking) dikembalikan utuh, lalu semua hasil alat dalam satu pesan.
    pesan.push({ role: "assistant", content: res.content });
    const hasil: Anthropic.ToolResultBlockParam[] = [];
    for (const p of panggilan) {
      try {
        hasil.push({ type: "tool_result", tool_use_id: p.id, content: await jalankanAlat(p.name, p.input as Record<string, unknown>, situs) });
      } catch (e) {
        hasil.push({ type: "tool_result", tool_use_id: p.id, is_error: true, content: e instanceof Error ? e.message : "Gagal." });
      }
    }
    pesan.push({ role: "user", content: hasil });
  }
  balasan ||= "Siap, Kyai.";
  return { balasan, riwayat: [...lalu, { peran: "user", teks }, { peran: "assistant", teks: balasan }] };
}
