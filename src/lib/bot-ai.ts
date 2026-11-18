import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Situs } from "@/content/skema";
import { awalHariWIB, barisAcara, tanggalWIB } from "./agenda-murni";
import { daftarAcara, hapusAcara, tambahAcara, ubahAcara } from "./agenda-server";
import { rapikanRiwayat, type GiliranBot } from "./bot-murni";
import { usulkanIde } from "./naskah-bank";
import { isiNaskah, naskahMenungguTerakhir, pesanNaskah } from "./studio-naskah";
import { aturTayang, buatTugas, daftarMerek, daftarTugasBot, ubahCaption, type AksiTayang } from "./studio-server";

// Chat bebas bot Telegram: Claude Haiku 5.5 effort rendah — sama dengan bot Kantor AI Lek Kopi
// (tanya-jawab ringan, cepat & murah). Aksi nyata dijalankan lewat alat yang memakai aturan yang
// sama dengan admin (studio-server.ts), jadi bot tak bisa melakukan hal yang admin tak bisa.
const MODEL = "claude-haiku-5-5";
const MAKS_PUTARAN = 5;

const ALAT: Anthropic.Tool[] = [
  {
    name: "buat_konten",
    description: "Pesan konten promosi baru ke Studio (poster 3 ukuran atau video Reels). Hasilnya dikirim ke chat ini dengan tombol persetujuan.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["produk_slug", "jenis", "latar_ai", "arahan"],
      properties: {
        produk_slug: { type: "string", description: "slug produk dari daftar produk" },
        jenis: { type: "string", enum: ["gambar", "video"] },
        latar_ai: { type: "boolean", description: "pakai latar foto suasana buatan AI (gratis lewat Cloudflare, ±60 gambar/hari)" },
        arahan: { type: "string", description: "arahan gaya/sasaran untuk penulis naskah; kosong bila tidak ada" },
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
    name: "pesan_video_merek",
    description: "Pesan video dari bank foto/video sebuah merek (mis. Lek Kopi, slug 'lekkopi'). Naskah ditulis dulu dan dikirim ke chat ini untuk disetujui; video baru dibuat setelah naskah disetujui.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["merek", "permintaan"],
      properties: {
        merek: { type: "string", description: "slug merek, mis. lekkopi" },
        permintaan: { type: "string", description: "ide/permintaan video dari Kyai, selengkap mungkin" },
      },
    },
  },
  {
    name: "usul_ide_merek",
    description: "Usulkan ide video dari data kedai minggu lalu (menu laris/turun, jam sepi, promo) untuk merek berbahan bank media, mis. lekkopi. Tampilkan sebagai daftar bernomor; bila Kyai memilih, pakai pesan_video_merek dengan judul+sudut ide itu sebagai permintaan.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["merek", "jumlah"],
      properties: { merek: { type: "string" }, jumlah: { type: "integer", description: "2-5" } },
    },
  },
  {
    name: "revisi_naskah",
    description: "Revisi naskah video merek yang masih menunggu persetujuan. id kosong = naskah menunggu yang terbaru.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["id", "catatan"],
      properties: { id: { type: "string" }, catatan: { type: "string", description: "catatan revisi dari Kyai" } },
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
    description: "Tayangkan konten yang sudah jadi ke Instagram sekarang, jadwalkan pukul 19.00 WIB, tolak, atau batalkan tayang. Pakai hanya bila pemilik memintanya dengan jelas.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["id", "aksi"],
      properties: { id: { type: "string" }, aksi: { type: "string", enum: ["sekarang", "jadwal", "tolak", "batal"] } },
    },
  },
];

async function jalankanAlat(nama: string, isi: Record<string, unknown>, situs: Situs): Promise<string> {
  switch (nama) {
    case "buat_konten": {
      const slug = String(isi.produk_slug);
      if (!situs.produk.some((p) => p.slug === slug)) return `Produk "${slug}" tidak ada. Pilihan: ${situs.produk.map((p) => p.slug).join(", ")}`;
      const { tugas, dipicu } = await buatTugas({
        produk_slug: slug,
        jenis: isi.jenis === "video" ? "video" : "gambar",
        latar: isi.latar_ai ? "ai" : "polos",
        arahan: String(isi.arahan ?? ""),
      });
      return JSON.stringify({ ok: true, id: tugas.id, perkiraan: dipicu ? (isi.jenis === "video" ? "3-6 menit" : "1-2 menit") : "putaran jadwal berikutnya (≤30 menit)" });
    }
    case "daftar_konten":
      return JSON.stringify(
        (await daftarTugasBot(Number(isi.batas) || 5)).map((t) => ({ ...t, caption: t.caption?.slice(0, 300) ?? null })),
      );
    case "ubah_caption":
      await ubahCaption(String(isi.id), String(isi.caption));
      return JSON.stringify({ ok: true });
    case "pesan_video_merek": {
      const { id, merek } = await pesanNaskah({ merek: String(isi.merek), permintaan: String(isi.permintaan) });
      await isiNaskah(id); // naskah + tombol persetujuan langsung dikirim ke chat ini
      return JSON.stringify({ ok: true, id, merek: merek.nama, catatan: "naskah sudah dikirim ke chat dengan tombol Setujui/Tolak" });
    }
    case "usul_ide_merek": {
      const merek = (await daftarMerek()).find((m) => m.slug === String(isi.merek) && m.aktif);
      if (!merek) return `Merek "${isi.merek}" tidak ada atau belum aktif.`;
      const { ide, bankKosong } = await usulkanIde(merek, Math.min(5, Math.max(2, Number(isi.jumlah) || 4)));
      return JSON.stringify({ merek: merek.nama, ide, ...(bankKosong ? { peringatan: "bank media masih kosong/belum diindeks" } : {}) });
    }
    case "revisi_naskah": {
      const id = String(isi.id ?? "").trim() || (await naskahMenungguTerakhir());
      if (!id) return "Tidak ada naskah yang menunggu persetujuan.";
      await isiNaskah(id, String(isi.catatan));
      return JSON.stringify({ ok: true, id, catatan: "naskah revisi sudah dikirim ke chat" });
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
      const t = await aturTayang(String(isi.id), isi.aksi as AksiTayang);
      return JSON.stringify({ ok: true, status_tayang: t.status_tayang, jadwal_tayang: t.jadwal_tayang });
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
- Merek lain selain Bakafrawi (mis. Lek Kopi, slug lekkopi): videonya dari bank foto/video kafe — pakai pesan_video_merek, bukan buat_konten. Naskahnya dikirim dulu untuk disetujui lewat tombol; revisi lewat revisi_naskah.
- Ide konten: beri daftar bernomor yang singkat; Kyai bisa membalas "nomor 2 jadikan poster".
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
