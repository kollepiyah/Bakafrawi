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

// ------------------------------------------------------------ naskah video Remotion (19 Nov 2026)

// Adegan datar: satu objek berisi kolom semua jenis (yang tak terpakai dikosongkan). Lebih andal untuk
// keluaran terstruktur daripada union; video.mjs `keNaskah` merapikannya jadi props Remotion.
const JENIS = ['hook', 'layar', 'kasir', 'alur', 'daftar', 'penutup'];
export const SkemaVideo = z.object({
  adegan: z
    .array(
      z.object({
        jenis: z.enum(JENIS).describe('hook = pembuka judul besar (selalu adegan 1); layar = tangkapan layar asli di HP + kotak perbesaran; kasir = mockup transaksi kasir (HANYA aplikasi kasir/POS); alur = diagram 3 simpul + notifikasi; daftar = angka besar + daftar centang; penutup = ajakan (selalu terakhir)'),
        narasi: z.string().describe('Narasi lisan adegan ini, 1-2 kalimat pendek, santai & kekinian, bukan bahasa brosur'),
        kunci: z.array(z.string()).describe('1-3 kata penting dari narasi yang disorot stabilo di subtitle'),
        badge: z.string().describe('Nama langkah 2-3 kata di lencana kiri atas (layar/kasir/alur/daftar), mis. "Kasir Kilat"; kosong untuk hook/penutup'),
        label: z.string().describe('hook: label pil hitam kecil, 3-6 kata, mis. "Sebelum tutup toko hari ini"'),
        judul: z.string().describe('hook: judul besar 4-8 kata yang menyentil (mis. "Jangan rekap manual lagi, pakai Maktaba POS"); penutup: judul ajakan 3-6 kata'),
        tekan: z.string().describe('hook: 1-3 kata dari judul (persis sama) yang masuk kotak warna, biasanya nama produk'),
        sub: z.string().describe('hook: kalimat pendukung ≤ 10 kata'),
        coretan: z.string().describe('hook: coretan tulisan tangan 2-5 kata, mis. "beneran gratis dicoba!"'),
        dari: z.string().describe('hook: cara lama/masalah 1-3 kata, mis. "Buku catatan"'),
        ke: z.string().describe('hook: solusi 1-3 kata, biasanya nama produk'),
        layar: z.number().int().describe('layar: nomor tangkapan layar yang dipakai'),
        fokus_x: z.number().describe('layar: posisi mendatar bagian yang disorot, 0 kiri - 1 kanan'),
        fokus_y: z.number().describe('layar: posisi tegak bagian yang disorot, 0 atas - 1 bawah (dari gambar layar utuh)'),
        sorotan: z.string().describe('layar: label 2-4 kata di atas kotak perbesaran, mis. "Omzet hari ini"'),
        produk: z.array(z.object({ nama: z.string(), harga: z.string() })).describe('kasir: 3 barang contoh yang wajar untuk sasaran produk, harga format "Rp 18.000"'),
        total: z.string().describe('kasir: jumlah harga barang di atas, format "Rp 104.500"'),
        lencana: z.string().describe('kasir: lencana kecil, mis. "Scan Barcode ✓"'),
        struk: z.string().describe('kasir: keterangan struk, mis. "Lunas · terkirim ke WhatsApp"'),
        simpul: z.array(z.string()).describe('alur: tepat 3 kartu 2-3 kata yang tersambung ke produk'),
        notifikasi: z.string().describe('alur: notifikasi kuning ≤ 6 kata'),
        hitung_label: z.string().describe('alur: label penghitung di kartu pertama (mis. "Kopi Arabika"), kosong bila tak perlu'),
        hitung_dari: z.number().describe('alur: angka awal penghitung'),
        hitung_ke: z.number().describe('alur: angka akhir penghitung'),
        label_angka: z.string().describe('daftar: label angka besar, mis. "Omzet hari ini" / "Santri tercatat"'),
        angka: z.string().describe('daftar: angka besar, mis. "Rp 2.885.500" — hanya angka yang terlihat di layar aplikasi'),
        catatan: z.string().describe('daftar: lencana kecil di samping angka (mis. "▲ 18%"), kosong bila tak ada datanya'),
        daftar: z.array(z.string()).describe('daftar: 3 manfaat masing-masing ≤ 7 kata'),
        tombol: z.string().describe('penutup: teks tombol ≤ 5 kata'),
      }),
    )
    .describe('5-6 adegan berurutan, total narasi dibaca 30-45 detik'),
  ajakan: z.string().describe('Ajakan bertindak singkat untuk caption, maksimal 5 kata'),
  caption: z.string().describe('Caption media sosial 2-4 kalimat, tanpa hashtag'),
  hashtag: z.array(z.string()).describe('5-8 hashtag tanpa tanda #'),
});

const ATURAN_VIDEO = `Bentuk video: Reels/TikTok iklan 9:16 gaya motion-graphic UI yang sedang ramai (latar putih berkisi,
kartu UI beranimasi, lencana langkah 1-2-3, subtitle kata-per-kata). Urutan:
- Adegan 1 "hook": langsung menyentil masalah/rasa penasaran penonton; judul besar bergaya karosel IG.
- 3-4 adegan langkah, satu manfaat per adegan. Utamakan "layar" (tampilan ASLI aplikasi) untuk tiap gambar layar yang
  relevan — pilih nomor layar & titik fokus pada angka/tombol/daftar yang membuktikan manfaat itu. "kasir" hanya untuk
  aplikasi kasir/POS. "alur" untuk otomatisasi/integrasi, "daftar" untuk ringkasan manfaat.
- Adegan terakhir "penutup": ajak mencoba/menghubungi (kontak diisi sistem, jangan menulis nomor/alamat).
- Narasi bahasa lisan sehari-hari, kalimat pendek. Jangan mengarang angka atau fitur yang tidak ada di data/layar.`;

/**
 * Naskah video iklan Remotion. layar: [{ berkas, keterangan? }] tangkapan layar aplikasi — dikirim ke
 * Claude sebagai gambar (diperkecil) supaya ia memilih bagian yang disorot. Tanpa kunci / gagal →
 * templat. Hasil: keluaran mentah (dirapikan video.mjs keNaskah) + narasi/judul untuk tampilan lama.
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
          { type: 'text', text: `${ATURAN_VIDEO}\n\nAda ${layar.length} layar aplikasi di atas (nomor 0-${Math.max(0, layar.length - 1)}).${layar.length ? '' : ' Tidak ada layar: jangan pakai jenis "layar".'}\n\n${ringkasProduk(produk, situs)}\n\nArahan tambahan dari pemilik: ${arahan || '(tidak ada)'}` },
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
const lengkapiVideo = (n, sumber) => ({ ...n, judul: n.adegan.find((a) => a.jenis === 'hook')?.judul ?? '', narasi: n.adegan.map((a) => a.narasi), sumber });

export function naskahVideoTemplat(produk, situs, merek = null, jumlahLayar = 0) {
  const lama = naskahTemplat(produk, situs, merek);
  const fitur = produk.fitur.slice(0, 3);
  return lengkapiVideo({
    adegan: [
      { jenis: 'hook', narasi: produk.kategori === 'pesanan' ? `Butuh aplikasi seperti ${produk.nama}? Ini contohnya.` : `Masih ribet ngurus semuanya manual? Ada ${produk.nama}.`, kunci: [produk.nama], label: produk.label || produk.nama, judul: produk.kategori === 'pesanan' ? `Butuh aplikasi seperti ${produk.nama}?` : `Saatnya pakai ${produk.nama}`, tekan: produk.nama, sub: produk.judul, coretan: 'cek sampai habis!', dari: 'Cara lama', ke: produk.nama },
      ...fitur.map((f, i) => (jumlahLayar
        ? { jenis: 'layar', narasi: `${f.judul}: ${f.isi}`, kunci: [f.judul], badge: f.judul, layar: i % jumlahLayar, fokus_x: 0.5, fokus_y: 0.3, sorotan: f.judul }
        : { jenis: 'daftar', narasi: `${f.judul}: ${f.isi}`, kunci: [f.judul], badge: f.judul, label_angka: '', angka: produk.nama, catatan: '', daftar: [f.judul] })),
      { jenis: 'penutup', narasi: `${lama.ajakan}. Hubungi kami lewat link di bio!`, kunci: [produk.nama], judul: lama.ajakan, tombol: lama.ajakan },
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
