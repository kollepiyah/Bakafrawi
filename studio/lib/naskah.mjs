import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

// Naskah iklan untuk satu produk: dipakai poster (judul, poin, ajakan) dan video (narasi).
export const SkemaNaskah = z.object({
  judul: z.string().describe('Judul iklan, maksimal 7 kata, memancing perhatian'),
  sub: z.string().describe('Kalimat pendukung di bawah judul, maksimal 14 kata'),
  poin: z.array(z.string()).describe('3-4 manfaat utama, masing-masing maksimal 6 kata'),
  ajakan: z.string().describe('Ajakan bertindak singkat, maksimal 5 kata'),
  narasi: z.array(z.string()).describe('4-6 kalimat narasi video, total dibaca sekitar 20-28 detik, bahasa lisan santai'),
  caption: z.string().describe('Caption media sosial 2-4 kalimat, tanpa hashtag'),
  hashtag: z.array(z.string()).describe('5-8 hashtag tanpa tanda #'),
  adegan: z
    .array(z.string())
    .describe('2 deskripsi foto suasana dalam bahasa Inggris untuk latar (generator gambar AI): orang Indonesia sasaran produk dalam situasi nyata terkait masalah/manfaatnya, tanpa layar HP yang terbaca dan tanpa tulisan'),
});

// Sama dengan Lek Kopi (MODEL_KONTEN): Sonnet 5.5 effort medium — naskah iklan pendek tak butuh
// Opus, dan biayanya kira-kira separuh.
const MODEL = process.env.STUDIO_MODEL || 'claude-sonnet-5-5';

// Cadangan bila profil merek belum berisi gaya (isi utamanya ada di studio_merek.profil.gaya).
const GAYA_BAWAAN =
  'Kamu copywriter iklan media sosial untuk Bakafrawi Project, software developer di Sidoarjo yang membuat website & aplikasi custom serta menjual aplikasi siap pakai. ' +
  'Tulis dalam Bahasa Indonesia yang hangat, jelas, dan meyakinkan — bukan bahasa robot, tanpa klaim berlebihan atau angka yang tidak diberikan. ' +
  'Untuk karya pesanan, posisikan sebagai bukti kemampuan: "kami bisa membuatkan yang serupa untuk Anda". Jangan menyebut harga kecuali diberikan.';

function ringkasProduk(produk, situs) {
  const fitur = produk.fitur.map((f) => `- ${f.judul}: ${f.isi}`).join('\n');
  return [
    `Nama: ${produk.nama}`,
    `Jenis: ${produk.kategori === 'pesanan' ? `aplikasi yang Bakafrawi buat khusus untuk ${produk.klien ?? 'klien'} (contoh hasil jasa pembuatan aplikasi custom)` : 'aplikasi siap pakai buatan Bakafrawi'}`,
    `Judul di situs: ${produk.judul}`,
    `Deskripsi: ${produk.deskripsi}`,
    `Platform: ${produk.platform.join(', ')}`,
    `Fitur:\n${fitur}`,
    `Kontak: WhatsApp ${situs.kontak.whatsappTampil}, situs ${situs.urlSitus.replace(/^https?:\/\//, '')}`,
  ].join('\n');
}

/** Naskah dari Claude; tanpa kunci API / bila gagal → naskah templat supaya tugas tetap jadi. */
/** merek: baris studio_merek; profil.gaya = arahan copywriter merek itu (bawaan: Bakafrawi). */
export async function buatNaskah(produk, situs, arahan, jenis, merek = null) {
  if (!process.env.ANTHROPIC_API_KEY) return { ...naskahTemplat(produk, situs, merek), sumber: 'templat (tanpa kunci API)' };
  try {
    const client = new Anthropic();
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium', format: zodOutputFormat(SkemaNaskah) },
      system: merek?.profil?.gaya || GAYA_BAWAAN,
      messages: [
        {
          role: 'user',
          content: `Buat naskah ${jenis === 'video' ? 'video iklan vertikal (Reels/TikTok) yang menampilkan rekaman layar aplikasinya' : 'poster promosi'}.\n\n${ringkasProduk(produk, situs)}\n\nArahan tambahan dari pemilik: ${arahan || '(tidak ada)'}`,
        },
      ],
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error(`Claude tidak memberi naskah (${res.stop_reason}).`);
    return { ...res.parsed_output, sumber: MODEL };
  } catch (e) {
    console.error('Naskah Claude gagal, memakai templat:', e.message);
    return { ...naskahTemplat(produk, situs, merek), sumber: `templat (Claude gagal: ${e.message.slice(0, 120)})` };
  }
}

export function naskahTemplat(produk, situs, merek = null) {
  const poin = produk.fitur.slice(0, 4).map((f) => f.judul);
  const pesanan = produk.kategori === 'pesanan';
  return {
    judul: pesanan ? `Butuh aplikasi seperti ${produk.nama}?` : produk.judul,
    sub: pesanan ? `Kami membangunnya untuk ${produk.klien ?? 'klien kami'} — kami bisa membuatkan untuk Anda.` : produk.deskripsi.split('. ')[0],
    poin,
    ajakan: pesanan ? 'Konsultasi gratis sekarang' : `Coba ${produk.nama}`,
    narasi: [
      pesanan ? `Ini ${produk.nama}, aplikasi yang kami bangun untuk ${produk.klien ?? 'klien kami'}.` : `Kenalkan, ${produk.nama}.`,
      ...produk.fitur.slice(0, 3).map((f) => `${f.judul}: ${f.isi}`),
      `Hubungi Bakafrawi di WhatsApp ${situs.kontak.whatsappTampil}.`,
    ],
    caption: `${produk.judul}. ${produk.deskripsi}`,
    hashtag: merek?.profil?.hashtag?.length ? merek.profil.hashtag : ['bakafrawi', 'jasapembuatanaplikasi', 'aplikasiandroid', 'websitebisnis', 'umkm'],
    adegan: pesanan
      ? ['Staff of an Indonesian Islamic boarding school office working together at a wooden desk, warm afternoon light', 'Smiling Indonesian teacher holding a smartphone in a bright school courtyard']
      : ['Owner of a small Indonesian coffee shop serving a customer at the counter, warm evening light', 'Indonesian shop owner smiling while checking a smartphone behind a tidy counter'],
  };
}
