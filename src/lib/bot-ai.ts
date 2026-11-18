import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Situs } from "@/content/skema";
import { rapikanRiwayat, type GiliranBot } from "./bot-murni";
import { aturTayang, buatTugas, daftarTugasBot, ubahCaption, type AksiTayang } from "./studio-server";

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
  return `Kamu asisten Studio AI milik Kyai (pemilik Bakafrawi Project, software developer di Sidoarjo) di Telegram.
Bakafrawi membuat website & aplikasi custom dan menjual aplikasi siap pakai (Maktaba POS). Tugasmu: membantu Kyai membuat dan mengelola konten promosi Instagram, memberi ide konten, dan menjawab pertanyaan seputar konten.
Sekarang: ${hari} WIB.
Produk:
${produk}

Aturan:
- Jawab dalam Bahasa Indonesia yang hangat dan ringkas (pesan Telegram, bukan esai). Panggil pengguna "Kyai".
- Untuk memesan, melihat, mengubah caption, atau menayangkan konten, PAKAI ALAT — jangan pernah mengaku sudah melakukan sesuatu tanpa hasil alat.
- Menayangkan ke Instagram hanya bila Kyai memintanya jelas. Kalau ragu konten mana yang dimaksud, lihat daftar_konten dulu lalu tanyakan.
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
