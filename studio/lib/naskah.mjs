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

// ------------------------------------------------------------ naskah video gaya Reels (19 Nov 2026)

const ATAS = ['judul', 'hp', 'layar', 'cta'];
export const SkemaVideo = z.object({
  hook: z.object({
    judul: z.string().describe('Judul besar kartu pembuka, 3-7 kata, memancing penasaran (mis. "Jangan buka toko tanpa aplikasi ini")'),
    sorot: z.string().describe('1-2 kata dari judul itu (persis sama) yang disorot kotak warna'),
    coretan: z.string().describe('Coretan tulisan tangan berpanah, 2-5 kata santai (mis. "serius, gratis!")'),
  }),
  adegan: z
    .array(
      z.object({
        teks: z.string().describe('Satu kalimat narasi lisan untuk adegan ini, 3-10 kata, santai & kekinian'),
        atas: z.enum(ATAS).describe('Isi separuh atas layar: judul = kartu judul besar (hanya adegan 1); hp = kolase HP aplikasi; layar = potongan layar aplikasi yang dizoom; cta = kartu ajakan penutup'),
        layar: z.number().int().describe('Nomor layar aplikasi yang dipakai (untuk hp/layar), 0 bila tidak dipakai'),
        fokus_x: z.number().describe('Untuk atas=layar: posisi mendatar bagian yang disorot, 0 (kiri) sampai 1 (kanan) dari gambar layar itu'),
        fokus_y: z.number().describe('Untuk atas=layar: posisi tegak bagian yang disorot, 0 (atas) sampai 1 (bawah) dari gambar layar itu'),
        zoom: z.number().describe('Untuk atas=layar: 1 (selebar layar, biasanya terbaik) sampai 1.15; kartu sudah memotong pita setinggi bagian itu'),
        sorot: z.array(z.string()).describe('1-2 kata penting dari teks (angka, nama, hasil) yang ditulis huruf serif miring di subtitle'),
        foto: z.string().describe('Bila separuh bawah perlu foto orang baru mulai adegan ini: deskripsi foto dalam bahasa Inggris. Kosongkan untuk tetap memakai foto sebelumnya.'),
      }),
    )
    .describe('5-7 adegan berurutan, total dibaca 18-28 detik'),
  ajakan: z.string().describe('Teks tombol ajakan, maksimal 4 kata'),
  caption: z.string().describe('Caption media sosial 2-4 kalimat, tanpa hashtag'),
  hashtag: z.array(z.string()).describe('5-8 hashtag tanpa tanda #'),
});

const ATURAN_VIDEO = `Bentuk video: Reels/TikTok iklan 9:16 gaya Reels teknologi yang sedang ramai — layar dibagi dua:
separuh atas kartu (judul besar / potongan layar aplikasi / kolase HP), subtitle 1-2 kata di tengah, separuh
bawah foto orang (pengganti wajah pembicara). Satu kalimat per adegan, cepat.
- Adegan 1 (hook, ≤ 2 detik): atas "judul". Kalimatnya langsung menyentil masalah/rasa penasaran penonton. Isi foto: orang Indonesia sasaran produk yang sedang mengalami masalah itu, menatap kamera atau sibuk (seperti pembicara konten).
- Adegan 2: perkenalkan produk, atas "hp".
- Adegan tengah: satu manfaat per adegan, atas "layar" yang menyorot bagian layar aplikasi yang membuktikan manfaat itu (pilih nomor layar dan titik fokus dari gambar; fokus pada angka/tombol/daftar yang relevan). Boleh satu foto baru di tengah untuk suasana hasil (orang yang sama lega/tersenyum).
- Adegan terakhir: atas "cta", ajak mencoba/menghubungi.
- Maksimal 2 foto di seluruh video. Kalimat pendek, bahasa lisan sehari-hari, bukan bahasa brosur. Jangan menyebut angka yang tidak terlihat di layar.`;

/**
 * Naskah video iklan. layar: [{ berkas, keterangan? }] tangkapan layar aplikasi — dikirim ke Claude
 * sebagai gambar (diperkecil) supaya ia memilih bagian yang disorot. Tanpa kunci / gagal → templat.
 */
export async function buatNaskahVideo(produk, situs, arahan, merek = null, layar = [], kecilkan = null) {
  const templat = () => naskahVideoTemplat(produk, situs, merek, layar.length);
  if (!process.env.ANTHROPIC_API_KEY) return { ...templat(), sumber: 'templat (tanpa kunci API)' };
  try {
    const gambar = [];
    for (const [i, l] of layar.entries()) {
      const data = kecilkan ? await kecilkan(l.berkas) : null;
      if (!data) continue;
      gambar.push({ type: 'text', text: `Layar ${i}${l.keterangan ? ` (${l.keterangan})` : ''}:` });
      gambar.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
    }
    const client = new Anthropic();
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium', format: zodOutputFormat(SkemaVideo) },
      system: merek?.profil?.gaya || GAYA_BAWAAN,
      messages: [{
        role: 'user',
        content: [
          ...gambar,
          { type: 'text', text: `${ATURAN_VIDEO}\n\nAda ${layar.length} layar aplikasi di atas (nomor 0-${Math.max(0, layar.length - 1)}).${layar.length ? '' : ' Tidak ada layar: jangan pakai atas hp/layar.'}\n\n${ringkasProduk(produk, situs)}\n\nArahan tambahan dari pemilik: ${arahan || '(tidak ada)'}` },
        ],
      }],
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output?.adegan?.length) throw new Error(`Claude tidak memberi naskah (${res.stop_reason}).`);
    return lengkapiVideo(res.parsed_output, MODEL);
  } catch (e) {
    console.error('Naskah video Claude gagal, memakai templat:', e.message);
    return { ...templat(), sumber: `templat (Claude gagal: ${e.message.slice(0, 120)})` };
  }
}

// narasi & judul ikut disimpan supaya tampilan lama (admin, Telegram) tetap terbaca.
const lengkapiVideo = (n, sumber) => ({ ...n, judul: n.hook.judul, narasi: n.adegan.map((a) => a.teks), sumber });

export function naskahVideoTemplat(produk, situs, merek = null, jumlahLayar = 0) {
  const lama = naskahTemplat(produk, situs, merek);
  const kosong = { layar: 0, fokus_x: 0.5, fokus_y: 0.35, zoom: 1.6, sorot: [], foto: '' };
  const fitur = produk.fitur.slice(0, Math.min(3, Math.max(1, jumlahLayar)));
  return lengkapiVideo({
    hook: { judul: lama.judul, sorot: produk.nama, coretan: 'cek sampai habis!' },
    adegan: [
      { ...kosong, teks: produk.kategori === 'pesanan' ? `Butuh aplikasi seperti ${produk.nama}?` : 'Masih ribet ngurus semuanya manual?', atas: 'judul', foto: lama.adegan[0] },
      { ...kosong, teks: `Kenalin, ${produk.nama}.`, atas: 'hp' },
      ...fitur.map((f, i) => ({ ...kosong, teks: `${f.judul}, beres.`, atas: 'layar', layar: i, sorot: [f.judul] })),
      { ...kosong, teks: `${lama.ajakan}. Hubungi kami sekarang!`, atas: 'cta' },
    ],
    ajakan: lama.ajakan,
    caption: lama.caption,
    hashtag: lama.hashtag,
  }, 'templat');
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
