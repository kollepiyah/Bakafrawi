import { z } from 'zod';
import { panggilRouterWorkerJson, urutanPenyediaWorker } from './router-worker.mjs';

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

const PETUNJUK_JSON_POSTER = `\n\nJawab HANYA dengan JSON valid (tanpa markdown) berstruktur:\n{"judul":"...","sub":"...","poin":["...","...","..."],"ajakan":"...","narasi":["..."],"caption":"...","hashtag":["..."],"adegan":["english prompt 1","english prompt 2"]}`;
const PETUNJUK_JSON_VIDEO = `\n\nJawab HANYA dengan JSON valid (tanpa markdown) berstruktur:\n{"adegan":[{"jenis":"hook|layar|kasir|alur|daftar|penutup","narasi":"...","kunci":["..."],"pose":"kaget|tunjuk|hp|jempol|lambai","badge":"","label":"","judul":"","tekan":"","sub":"","coretan":"","dari":"","ke":"","layar":0,"fokus_x":0.5,"fokus_y":0.3,"sorotan":"","produk":[],"total":"","lencana":"","struk":"","simpul":[],"notifikasi":"","hitung_label":"","hitung_dari":0,"hitung_ke":0,"label_angka":"","angka":"","catatan":"","daftar":[],"tombol":""}],"karakter":"","ajakan":"...","caption":"...","hashtag":["..."]}`;

export const SkemaVideoFullAi = z.object({
  judul: z.string().describe('Judul konsep Reels 3-7 kata yang memancing penasaran'),
  adegan: z
    .array(
      z.object({
        narasi: z.string().describe('Narasi lisan santai & natural 1-2 kalimat pendek (Bahasa Indonesia sehari-hari, boleh sentuhan Jawa Timur ringan), total 5-6 adegan sekitar 25-35 detik'),
        teksLayar: z.string().describe('Teks sorotan pendek 2-5 kata yang tampil di layar'),
        bidikan: z.string().describe('Deskripsi visual sinematik dalam bahasa Inggris untuk generator gambar AI vertikal 9:16 (orang Indonesia, ekspresi, pencahayaan, suasana nyata sesuai cerita, TANPA teks/tulisan/watermark/layar HP terbaca)'),
      }),
    )
    .min(4)
    .max(7),
  ajakan: z.string().describe('Ajakan bertindak singkat maksimal 6 kata'),
  caption: z.string().describe('Caption Instagram 2-3 kalimat, santai, tanpa hashtag & tanpa link/alamat'),
  hashtag: z.array(z.string()).describe('3-5 hashtag kontekstual tanpa tanda #'),
});

const PETUNJUK_JSON_FULL_AI = `\n\nJawab HANYA dengan JSON valid (tanpa markdown) berstruktur:\n{"judul":"...","adegan":[{"narasi":"...","teksLayar":"...","bidikan":"english cinematic vertical 9:16 visual prompt, no text, no watermark"}],"ajakan":"...","caption":"...","hashtag":["..."]}`;

/** Ringkas daftar video referensi dari `studio_referensi` agar AI meniru pola hook/visualnya. */
function ringkasReferensiWorker(referensi = []) {
  if (!Array.isArray(referensi) || !referensi.length) return '';
  const daftar = referensi
    .map((r) => r?.analisis)
    .filter((a) => a && (a.judul || a.arahanTiru || a.hook3Detik))
    .slice(0, 4);
  if (!daftar.length) return '';
  const baris = daftar.map((a, i) =>
    `${i + 1}. ${a.judul || 'Referensi'}${a.presetCocok ? ` [preset: ${a.presetCocok}]` : ''}\n   Hook 3s: ${a.hook3Detik || '-'}\n   Visual & Pacing: ${a.gayaVisual || '-'} · ${a.pacing || '-'}\n   Arahan: ${a.arahanTiru || a.ringkas || '-'}`,
  );
  return `\n\nPOLA REFERENSI VIDEO FAVORIT PEMILIK (serap struktur hook, ritme, & gaya penceritaannya tanpa meniru mentah kata-katanya):\n${baris.join('\n')}`;
}

/** Naskah Video Storytelling Full AI (5-6 adegan gambar AI sinematik + narasi natural). */
export async function buatNaskahVideoFullAi(produk, situs, arahan, merek = null, referensi = []) {
  const adalahKedai = produk.kategori === 'kedai';
  const templat = () => {
    const t = naskahTemplat(produk, situs, merek);
    return {
      judul: t.judul,
      adegan: adalahKedai
        ? [
            { narasi: 'Butuh penyegar setelah aktivitas seharian? Mampir ke Lek Kopi yuk!', teksLayar: 'Waktunya Ngopi', bidikan: 'Tired young Indonesian adult walking into a cozy warm outdoor coffee shop at dusk, glowing warm lights, cinematic vertical 9:16 film still, no text' },
            ...produk.fitur.slice(0, 3).map((f) => ({
              narasi: `${f.judul}: ${f.isi}.`,
              teksLayar: f.judul.slice(0, 28),
              bidikan: 'Barista pouring creamy palm sugar iced coffee into a clear glass on a rustic wooden counter, rich golden hour light, cinematic vertical 9:16 photography, no text',
            })),
            { narasi: `Mampir ke ${produk.nama} Waru hari ini atau pesan lewat aplikasi online favoritmu!`, teksLayar: `Mampir ${produk.nama}`, bidikan: 'Friends smiling and relaxing over iced coffee and snacks at an outdoor wooden table in Indonesia at sunset, warm bokeh lights, vertical 9:16 film still, no text' },
          ]
        : [
            { narasi: `Masih sering pusing ngurus kerjaan manual tiap hari?`, teksLayar: 'Capek Cara Lama?', bidikan: 'Tired Indonesian small business owner sitting at a desk in the evening surrounded by paper notebooks, warm moody tungsten lamp light, cinematic vertical 9:16 film still' },
            ...produk.fitur.slice(0, 3).map((f) => ({
              narasi: `${f.judul}: ${f.isi}.`,
              teksLayar: f.judul.slice(0, 28),
              bidikan: 'Confident smiling Indonesian entrepreneur working smoothly in a modern tidy shop or office, warm golden natural window light, cinematic vertical 9:16 photography',
            })),
            { narasi: `Yuk cobain ${produk.nama} sekarang, cek link di bio ya!`, teksLayar: `Coba ${produk.nama}`, bidikan: 'Happy Indonesian business owner relaxing with a warm smile in a bright thriving modern shop, sunset golden hour glow, cinematic vertical 9:16 film still' },
          ],
      narasi: t.narasi,
      ajakan: t.ajakan,
      caption: t.caption,
      hashtag: t.hashtag,
      sumber: 'templat-full-ai',
    };
  };
  if (!urutanPenyediaWorker({ adaGambar: false }).length) return templat();

  const gayaDasar = merek?.profil?.gaya || (merek?.slug === 'lekkopi' ? GAYA_LEKKOPI : GAYA_BAWAAN);
  const blokRef = ringkasReferensiWorker(referensi);
  const system = gayaDasar
    + ' Kamu membuat naskah VIDEO STORYTELLING FULL AI vertikal 9:16 (bukan demo screenshot layar). Buat alur cerita sinematik 5 adegan yang memikat sejak 2 detik pertama: Adegan 1 Hook menyentil masalah/momen nyata, Adegan 2-4 Cerita suasana/keunggulan nyata, Adegan 5 Penutup & ajakan hangat.';
  const prompt = `Buat naskah video Reels/TikTok Storytelling Full AI (5 adegan) untuk ${adalahKedai ? 'kedai/merek' : 'produk'} berikut.\n\n${ringkasProduk(produk, situs, merek)}${blokRef}\n\nArahan tambahan dari pemilik: ${arahan || '(pilih sudut cerita paling segar & relatable untuk audiens Indonesia)'}`;

  try {
    const normalisasiFullAi = (mentah) => {
      const akar = mentah && typeof mentah === 'object' && !Array.isArray(mentah) ? mentah : {};
      const bungkus = [akar.naskah, akar.data, akar.hasil, akar.video].find((v) => v && typeof v === 'object' && !Array.isArray(v));
      const o = Array.isArray(akar.adegan) || Array.isArray(akar.scenes) ? akar : (bungkus ?? akar);
      const daftar = Array.isArray(o.adegan) ? o.adegan : Array.isArray(o.scenes) ? o.scenes : [];
      const adegan = daftar.slice(0, 7).map((a) => ({
        narasi: String(a?.narasi ?? a?.dialog ?? a?.teks ?? '').trim(),
        teksLayar: String(a?.teksLayar ?? a?.teks_layar ?? a?.judul ?? '').trim() || produk.nama,
        bidikan: String(a?.bidikan ?? a?.visual ?? a?.prompt ?? '').trim() || 'Cinematic Indonesian coffee shop scene, warm lighting, vertical 9:16, no text',
      })).filter((a) => a.narasi);
      const hashtag = Array.isArray(o.hashtag)
        ? o.hashtag.map((h) => String(h ?? '').replace(/^#+/, '').trim()).filter(Boolean)
        : [];
      return {
        judul: String(o.judul ?? o.title ?? produk.nama).trim() || produk.nama,
        adegan,
        ajakan: String(o.ajakan ?? o.cta ?? `Coba ${produk.nama}`).trim() || `Coba ${produk.nama}`,
        caption: String(o.caption ?? '').trim() || adegan[0]?.narasi || produk.deskripsi,
        hashtag: hashtag.length ? hashtag : ['bakafrawi'],
      };
    };
    const r = await panggilRouterWorkerJson({
      system,
      prompt,
      maksToken: 4096,
      skemaZod: SkemaVideoFullAi,
      normalisasi: normalisasiFullAi,
      petunjukJson: PETUNJUK_JSON_FULL_AI,
      namaTahap: 'naskah video full ai',
      effortClaude: 'low',
    });
    return {
      ...r.data,
      narasi: r.data.adegan.map((a) => a.narasi),
      sumber: `full-ai:${r.sumber}`,
      pemakaian: r.pemakaian,
    };
  } catch (e) {
    console.error('Semua penyedia naskah video Full AI gagal, memakai templat:', e.message);
    return { ...templat(), sumber: `templat-full-ai (${String(e.message).slice(0, 100)})` };
  }
}

// Cadangan bila profil merek belum berisi gaya (isi utamanya ada di studio_merek.profil.gaya).
const GAYA_BAWAAN =
  'Kamu copywriter iklan media sosial untuk Bakafrawi Project, software developer di Sidoarjo yang membuat website & aplikasi custom serta menjual aplikasi siap pakai. ' +
  'Tulis dalam Bahasa Indonesia yang hangat, jelas, dan meyakinkan — bukan bahasa robot, tanpa klaim berlebihan atau angka yang tidak diberikan. ' +
  'Untuk karya pesanan, posisikan sebagai bukti kemampuan: "kami bisa membuatkan yang serupa untuk Anda". Jangan menyebut harga kecuali diberikan.';

const GAYA_LEKKOPI =
  'Kamu copywriter & direktur kreatif konten media sosial untuk Lek Kopi (@lekkopi.id), kedai kopi hangat di Jl. Kolonel Sugiono No. 112, Panjunan, Waru, Sidoarjo (buka Senin–Sabtu, 14.00–23.00 WIB). ' +
  'Tulis dalam Bahasa Indonesia yang akrab, santai, dan menggugah selera (boleh sentuhan ramah khas Sidoarjo/Jawa Timur yang natural, jangan kaku seperti brosur). ' +
  'Untuk promo atau hari besar (seperti Hari Guru, akhir pekan, promo spesial), tonjolkan kehangatan momen kebersamaan dan kopi segar tanpa mengarang besaran diskon/harga bila tidak disebutkan pemilik. ' +
  'Pada kolom "adegan" (prompt gambar AI berbahasa Inggris), buat deskripsi fotografi editorial kedai kopi/minuman/momen tema yang estetik, pencahayaan hangat, TANPA teks/tulisan/watermark/logo acak, dan TANPA layar HP atau laptop.';

function ringkasProduk(produk, situs, merek = null) {
  const fitur = produk.fitur.map((f) => `- ${f.judul}: ${f.isi}`).join('\n');
  if (produk.kategori === 'kedai') {
    const wa = merek?.profil?.whatsapp || '085710477372';
    return [
      `Nama Merek: ${produk.nama}`,
      `Jenis: Kedai kopi & minuman segar (menu kopi/espresso, es kopi susu, matcha, non-kopi)`,
      `Fokus Konten: ${produk.label || produk.judul}`,
      `Deskripsi: ${produk.deskripsi}`,
      `Lokasi & Jam Buka: Jl. Kolonel Sugiono No. 112, Panjunan, Waru, Sidoarjo · Senin–Sabtu 14.00–23.00 WIB`,
      `Kanal Pesan: ${produk.platform.join(', ')}`,
      `Keunggulan:\n${fitur}`,
      `Kontak: WhatsApp ${wa}`,
    ].join('\n');
  }
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

/** Naskah hemat multi-provider (Groq → NVIDIA → Gemini → OpenRouter → Cloudflare → Claude terakhir); gagal semua → templat. */
/** merek: baris studio_merek; profil.gaya = arahan copywriter merek itu (bawaan: Bakafrawi / Lek Kopi). */
export async function buatNaskah(produk, situs, arahan, jenis, merek = null) {
  if (!urutanPenyediaWorker({ adaGambar: false }).length) {
    return { ...naskahTemplat(produk, situs, merek), sumber: 'templat (tanpa kunci API)' };
  }
  const system = merek?.profil?.gaya || (merek?.slug === 'lekkopi' ? GAYA_LEKKOPI : GAYA_BAWAAN);
  const promptJenis = jenis === 'video'
    ? 'video iklan vertikal (Reels/TikTok) yang menampilkan rekaman layar aplikasinya'
    : produk.kategori === 'kedai'
    ? 'poster promosi Full AI yang menarik perhatian untuk Instagram Feed & Story (pastikan "adegan" berisi prompt visual foto/ilustrasi kopi & suasana sesuai arahan tanpa tulisan)'
    : 'poster promosi';
  const prompt = `Buat naskah ${promptJenis}.\n\n${ringkasProduk(produk, situs, merek)}\n\nArahan tambahan dari pemilik: ${arahan || '(tidak ada)'}`;

  try {
    const normalisasiPoster = (mentah) => {
      const akar = mentah && typeof mentah === 'object' && !Array.isArray(mentah) ? mentah : {};
      const bungkus = [akar.naskah, akar.data, akar.hasil, akar.poster].find((v) => v && typeof v === 'object' && !Array.isArray(v));
      const o = akar.judul || akar.title ? akar : (bungkus ?? akar);
      const keArr = (v, cadangan) => (Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : cadangan);
      return {
        judul: String(o.judul ?? o.title ?? '').trim(),
        sub: String(o.sub ?? o.subtitle ?? produk.judul ?? '').trim(),
        poin: keArr(o.poin, produk.fitur.slice(0, 3).map((f) => f.judul)),
        ajakan: String(o.ajakan ?? o.cta ?? `Coba ${produk.nama}`).trim(),
        narasi: keArr(o.narasi, [String(o.sub ?? produk.deskripsi).trim()]),
        caption: String(o.caption ?? o.sub ?? produk.deskripsi).trim(),
        hashtag: keArr(o.hashtag, ['bakafrawi']).map((h) => h.replace(/^#+/, '')),
        adegan: keArr(o.adegan, ['Warm cinematic Indonesian workspace atmosphere, soft daylight, no text']),
      };
    };
    const r = await panggilRouterWorkerJson({
      system,
      prompt,
      maksToken: 4096,
      skemaZod: SkemaNaskah,
      normalisasi: normalisasiPoster,
      petunjukJson: PETUNJUK_JSON_POSTER,
      namaTahap: 'naskah poster',
      effortClaude: 'low',
    });
    return { ...r.data, sumber: r.sumber, pemakaian: r.pemakaian };
  } catch (e) {
    console.error('Semua penyedia naskah gagal, memakai templat:', e.message);
    return { ...naskahTemplat(produk, situs, merek), sumber: `templat (AI gagal: ${String(e.message).slice(0, 120)})` };
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
        pose: z.enum(['kaget', 'tunjuk', 'hp', 'jempol', 'lambai']).describe('Pose karakter maskot di bawah layar yang paling cocok dengan narasi: kaget (masalah/pembuka), tunjuk (menunjuk tampilan aplikasi), hp (memegang HP), jempol (hasil/manfaat), lambai (penutup/ajakan)'),
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
  karakter: z.string().describe('Nama karakter maskot (persis dari daftar yang diberikan) yang paling cocok dengan sasaran produk; kosong bila tak ada daftar'),
  ajakan: z.string().describe('Ajakan bertindak singkat untuk caption, maksimal 5 kata'),
  caption: z.string().describe('Caption media sosial 2-4 kalimat, tanpa hashtag'),
  hashtag: z.array(z.string()).describe('5-8 hashtag tanpa tanda #'),
});

const ATURAN_VIDEO = `Bentuk video: Reels/TikTok iklan 9:16 gaya motion-graphic UI modern (latar dinamis & gelap/tegas sesuai merek,
kartu UI beranimasi, lencana langkah 1-2-3, subtitle kata-per-kata). Urutan:
- Adegan 1 "hook": langsung menyentil masalah/rasa penasaran penonton; judul besar bergaya karosel IG.
- 3-4 adegan langkah, satu manfaat per adegan. Utamakan "layar" (tampilan ASLI aplikasi) untuk tiap gambar layar yang
  relevan — pilih nomor layar & titik fokus pada angka/tombol/daftar yang membuktikan manfaat itu. "kasir" hanya untuk
  aplikasi kasir/POS. "alur" untuk otomatisasi/integrasi, "daftar" untuk ringkasan manfaat.
- Adegan terakhir "penutup": ajak mencoba/menghubungi (kontak diisi sistem, jangan menulis nomor/alamat).
- Narasi bahasa lisan sehari-hari, kalimat pendek. Jangan mengarang angka atau fitur yang tidak ada di data/layar.`;

/**
 * Naskah video iklan Remotion. layar: [{ berkas, keterangan? }] tangkapan layar aplikasi — dikirim ke
 * AI Vision (diperkecil) supaya ia memilih bagian yang disorot. Tanpa kunci / gagal → templat.
 * Hasil: keluaran mentah (dirapikan video.mjs keNaskah) + narasi/judul untuk tampilan lama.
 */
export async function buatNaskahVideo(produk, situs, arahan, merek = null, layar = [], kecilkan = null, karakter = [], referensi = []) {
  const templat = () => naskahVideoTemplat(produk, situs, merek, layar.length);
  const gambarSiap = [];
  for (const [i, l] of layar.entries()) {
    const data = kecilkan ? await kecilkan(l.berkas) : null;
    if (!data) continue;
    gambarSiap.push({ label: `Layar ${i}${l.keterangan ? ` (${l.keterangan})` : ''}:`, mimeType: 'image/jpeg', data });
  }
  if (!urutanPenyediaWorker({ adaGambar: gambarSiap.length > 0 }).length) {
    return { ...templat(), sumber: 'templat (tanpa kunci API)' };
  }

  const system = merek?.profil?.gaya || GAYA_BAWAAN;
  const blokRef = ringkasReferensiWorker(referensi);
  const prompt = `${ATURAN_VIDEO}\n\nAda ${layar.length} layar aplikasi di atas (nomor 0-${Math.max(0, layar.length - 1)}).${layar.length ? '' : ' Tidak ada layar: jangan pakai jenis "layar".'}\n\nKarakter maskot 3D yang tersedia (tampil di bawah layar, satu karakter untuk seluruh video): ${karakter.length ? karakter.join(', ') : '(belum ada — isi karakter kosong)'}.\n\n${ringkasProduk(produk, situs)}${blokRef}\n\nArahan tambahan dari pemilik: ${arahan || '(tidak ada)'}`;

  try {
    const r = await panggilRouterWorkerJson({
      system,
      prompt,
      gambar: gambarSiap,
      maksToken: 6000,
      skemaZod: SkemaVideo,
      petunjukJson: PETUNJUK_JSON_VIDEO,
      namaTahap: 'naskah video',
      effortClaude: 'medium',
    });
    return { ...lengkapiVideo(r.data, r.sumber), pemakaian: r.pemakaian };
  } catch (e) {
    console.error('Semua penyedia naskah video gagal, memakai templat:', e.message);
    return { ...templat(), sumber: `templat (AI gagal: ${String(e.message).slice(0, 120)})` };
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
    karakter: '',
    ajakan: lama.ajakan,
    caption: lama.caption,
    hashtag: lama.hashtag,
  }, 'templat');
}


export function naskahTemplat(produk, situs, merek = null) {
  const poin = produk.fitur.slice(0, 4).map((f) => f.judul);
  const pesanan = produk.kategori === 'pesanan';
  const kedai = produk.kategori === 'kedai';
  if (kedai) {
    return {
      judul: produk.judul || 'Waktunya Ngopi Santai di Waru',
      sub: produk.deskripsi.split('. ')[0],
      poin,
      ajakan: `Mampir ke ${produk.nama}`,
      narasi: [
        `Lagi cari kopi segar dan suasana santai di Waru? Mampir ke ${produk.nama}!`,
        ...produk.fitur.slice(0, 3).map((f) => `${f.judul}: ${f.isi}`),
        `Buka Senin sampai Sabtu pukul 14.00–23.00 WIB di Panjunan, Waru, Sidoarjo.`,
      ],
      caption: `${produk.judul}. ${produk.deskripsi}`,
      hashtag: merek?.profil?.hashtag?.length ? merek.profil.hashtag : ['lekkopi', 'lekkopisidoarjo', 'kopiwaru', 'kopisidoarjo', 'ngopidisidoarjo'],
      adegan: [
        'Warm aesthetic Indonesian coffee shop table with freshly brewed iced palm sugar milk coffee and latte art, golden sunlight, cozy wooden atmosphere, shallow depth of field, no text, no screens',
        'Smiling Indonesian barista preparing espresso and iced coffee behind a warm wooden cafe counter, soft amber lighting, editorial beverage photography, no text, no watermark',
      ],
    };
  }
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

// ------------------------------------------------------------ naskah WebShowcase 3D Agency

export const SkemaWebShowcase = z.object({
  judul: z.string(),
  hook: z.object({
    badge: z.string(),
    judul: z.string(),
    sorotKata: z.string(),
    sub: z.string(),
    narasi: z.string(),
    kataSorot: z.array(z.string()),
  }),
  browser: z.object({
    judulBagian: z.string(),
    chips: z.array(z.string()).min(1).max(4),
    narasi: z.string(),
    kataSorot: z.array(z.string()),
  }),
  responsive: z.object({
    badge: z.string(),
    judul: z.string(),
    poin: z.array(z.string()).min(1).max(3),
    narasi: z.string(),
    kataSorot: z.array(z.string()),
  }),
  spotlight: z.object({
    badge: z.string(),
    judul: z.string(),
    labelKlik: z.string(),
    daftar: z.array(z.string()).min(1).max(3),
    narasi: z.string(),
    kataSorot: z.array(z.string()),
  }),
  penutup: z.object({
    judul: z.string(),
    tombol: z.string(),
    narasi: z.string(),
    kataSorot: z.array(z.string()),
  }),
  ajakan: z.string(),
  caption: z.string(),
  hashtag: z.array(z.string()),
});

const PETUNJUK_JSON_SHOWCASE = `\n\nJawab HANYA dengan JSON valid (tanpa markdown) berstruktur:\n{"judul":"...","hook":{"badge":"JASA WEB CUSTOM","judul":"...","sorotKata":"...","sub":"...","narasi":"...","kataSorot":["..."]},"browser":{"judulBagian":"...","chips":["...","...","..."],"narasi":"...","kataSorot":["..."]},"responsive":{"badge":"DESKTOP + MOBILE","judul":"...","poin":["...","...","..."],"narasi":"...","kataSorot":["..."]},"spotlight":{"badge":"FITUR UNGGULAN","judul":"...","labelKlik":"...","daftar":["...","...","..."],"narasi":"...","kataSorot":["..."]},"penutup":{"judul":"...","tombol":"Konsultasi Gratis","narasi":"...","kataSorot":["..."]},"ajakan":"Konsultasi gratis sekarang","caption":"...","hashtag":["bakafrawi","jasawebsite"]}`;

export function naskahWebShowcaseTemplat(produk, situs, infoWeb = null) {
  const domain = infoWeb?.domain || produk.urlWeb?.replace(/^https?:\/\//i, '').split('/')[0] || produk.nama;
  const nama = produk.nama || domain;
  const sektor = produk.sektorLabel || (produk.kategori === 'pesanan' ? 'Website Custom' : 'Aplikasi Digital');
  const headingAsli = (infoWeb?.heading ?? []).slice(0, 3);
  const navAsli = (infoWeb?.navigasi ?? []).slice(0, 3);
  const chips = navAsli.length >= 2
    ? navAsli
    : ['Tampilan Profesional', 'Akses Cepat', 'Mudah Dikelola'];
  const daftar = headingAsli.length >= 2
    ? headingAsli.map((h) => h.slice(0, 42))
    : produk.fitur.slice(0, 3).map((f) => f.judul);

  return {
    judul: `Showcase ${nama}`,
    hook: {
      badge: `JASA WEB CUSTOM · ${sektor.toUpperCase().slice(0, 22)}`,
      judul: `WEBSITE MODERN SEPERTI ${domain.toUpperCase()}`,
      sorotKata: domain.toUpperCase(),
      sub: `Contoh karya web custom dari Bakafrawi Project untuk ${sektor.toLowerCase()}.`,
      narasi: `Ingin lembaga atau bisnis Anda punya website sekeren ${domain}? Lihat hasil karya custom dari Bakafrawi Project ini.`,
      kataSorot: [domain, 'Bakafrawi'],
    },
    browser: {
      judulBagian: `Tampilan Lengkap ${nama}`,
      chips,
      narasi: `Desainnya bersih, profesional, dan langsung menampilkan informasi penting dengan rapi saat pengunjung membuka halaman utama.`,
      kataSorot: ['bersih', 'profesional', 'rapi'],
    },
    responsive: {
      badge: '100% RESPONSIF',
      judul: 'Rapi di Laptop Maupun HP',
      poin: ['Cepat dibuka di HP', 'Navigasi jelas & nyaman', 'Siap ditemukan di Google'],
      narasi: `Baik dibuka lewat laptop maupun lewat HP, seluruh tampilan dan menunya otomatis menyesuaikan layar dengan ringan dan cepat.`,
      kataSorot: ['laptop', 'HP', 'cepat'],
    },
    spotlight: {
      badge: 'FITUR & STRUKTUR NYATA',
      judul: 'Dibuat Sesuai Kebutuhan Anda',
      labelKlik: 'Jelajahi Fitur',
      daftar: daftar.length ? daftar : ['Profil lembaga terpercaya', 'Info layanan & pendaftaran online', 'Panel admin mudah diperbarui'],
      narasi: `Setiap halaman dirancang khusus sesuai kebutuhan Anda, bukan templat kaku. Mau tambah fitur pendaftaran, berita, atau sistem khusus? Semua bisa.`,
      kataSorot: ['dirancang', 'khusus', 'bisa'],
    },
    penutup: {
      judul: `Mau Website Seperti ${domain}?`,
      tombol: 'Konsultasi Gratis',
      narasi: `Yuk konsultasi gratis bareng Bakafrawi Project sekarang. Klik link di bio atau hubungi WhatsApp kami!`,
      kataSorot: ['konsultasi', 'gratis', 'Bakafrawi'],
    },
    ajakan: 'Konsultasi gratis sekarang',
    caption: `Contoh website custom karya Bakafrawi Project (${domain}). Dirancang rapi, cepat di HP maupun desktop, dan menyesuaikan penuh kebutuhan lembaga maupun bisnis Anda.`,
    hashtag: ['bakafrawi', 'jasawebsite', 'websitepesantren', 'webcustom', 'softwarehouse'],
    narasi: [],
    sumber: 'templat-web-showcase',
  };
}

/** Susun naskah 5 babak untuk komposisi Remotion `WebShowcase` (3D Agency) berbasis hasil auto-scan web asli. */
export async function buatNaskahWebShowcase(produk, situs, arahan, merek = null, infoWeb = null, referensi = []) {
  const templat = naskahWebShowcaseTemplat(produk, situs, infoWeb);
  templat.narasi = [
    templat.hook.narasi,
    templat.browser.narasi,
    templat.responsive.narasi,
    templat.spotlight.narasi,
    templat.penutup.narasi,
  ];
  if (!urutanPenyediaWorker({ adaGambar: false }).length) return templat;

  const domain = infoWeb?.domain || produk.urlWeb?.replace(/^https?:\/\//i, '').split('/')[0] || produk.nama;
  const blokScan = infoWeb
    ? [
        `URL Asli: ${infoWeb.url || produk.urlWeb || ''}`,
        `Domain: ${domain}`,
        infoWeb.title ? `Title Halaman: ${infoWeb.title}` : '',
        infoWeb.deskripsi ? `Deskripsi Meta: ${infoWeb.deskripsi}` : '',
        infoWeb.heading?.length ? `Heading di Halaman Asli:\n- ${infoWeb.heading.join('\n- ')}` : '',
        infoWeb.navigasi?.length ? `Menu Navigasi Asli: ${infoWeb.navigasi.join(' · ')}` : '',
      ].filter(Boolean).join('\n')
    : '';

  const system = (merek?.profil?.gaya || GAYA_BAWAAN)
    + ' Kamu membuat naskah VIDEO SHOWCASE WEBSITE/APLIKASI CUSTOM 9:16 kelas agency untuk Bakafrawi Project (durasi 25–35 detik, 5 babak: hook → browser scroll → desktop+HP responsive → spotlight fitur → penutup CTA). '
    + 'Posisikan website yang ditampilkan sebagai BUKTI KARYA / STUDI KASUS kemampuan Bakafrawi ("kami bisa membuatkan website profesional seperti ini untuk pesantren, sekolah, UMKM, atau bisnis Anda"). '
    + 'Gunakan Bahasa Indonesia lisan yang hangat, meyakinkan, modern, dan tidak bertele-tele. Jangan menulis nomor WA atau link di dalam narasi suara (kontak otomatis tampil di layar penutup).';

  const prompt = [
    `Buat naskah 5 babak WebShowcase untuk: ${produk.nama} (${domain}).`,
    ringkasProduk(produk, situs, merek),
    blokScan ? `\nHASIL PINDAI HALAMAN ASLI WEBSITE (jadikan rujukan agar akurat, jangan mengarang fitur yang tidak sesuai):\n${blokScan}` : '',
    ringkasReferensiWorker(referensi),
    `\nArahan khusus dari pemilik: ${arahan || '(tonjolkan tampilan profesional, responsif di HP & laptop, dan ajak konsultasi pembuatan web custom)'}`,
    '\nAturan ringkas:',
    '- Tiap narasi 1–2 kalimat lisan tajam (12–24 kata per babak), total 5 babak ±28 detik.',
    '- `hook.judul` maksimal 6 kata (kapital tegas); `hook.sorotKata` 1–2 kata yang persis ada di `hook.judul`.',
    '- `browser.chips`, `responsive.poin`, dan `spotlight.daftar` masing-masing 3 butir singkat (2–5 kata per butir).',
    '- `kataSorot`: 2–3 kata kunci yang persis muncul di `narasi` babak tersebut.',
  ].filter(Boolean).join('\n');

  const normalisasiShowcase = (mentah) => {
    const akar = mentah && typeof mentah === 'object' && !Array.isArray(mentah) ? mentah : {};
    const bungkus = [akar.naskah, akar.data, akar.hasil, akar.showcase].find((v) => v && typeof v === 'object' && !Array.isArray(v));
    const o = akar.hook ? akar : (bungkus ?? akar);
    const arr = (v, cadangan, maks = 3) => {
      const list = Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, maks) : [];
      return list.length ? list : cadangan;
    };
    const str = (v, cadangan, maks = 220) => String(v ?? '').trim().slice(0, maks) || cadangan;
    const h = o.hook ?? {};
    const b = o.browser ?? {};
    const r = o.responsive ?? {};
    const s = o.spotlight ?? {};
    const p = o.penutup ?? {};
    return {
      judul: str(o.judul, templat.judul, 80),
      hook: {
        badge: str(h.badge, templat.hook.badge, 42),
        judul: str(h.judul, templat.hook.judul, 68),
        sorotKata: str(h.sorotKata ?? h.sorot_kata, templat.hook.sorotKata, 28),
        sub: str(h.sub, templat.hook.sub, 95),
        narasi: str(h.narasi, templat.hook.narasi, 240),
        kataSorot: arr(h.kataSorot ?? h.kata_sorot, templat.hook.kataSorot, 4),
      },
      browser: {
        judulBagian: str(b.judulBagian ?? b.judul_bagian ?? b.judul, templat.browser.judulBagian, 56),
        chips: arr(b.chips ?? b.fitur, templat.browser.chips, 4),
        narasi: str(b.narasi, templat.browser.narasi, 240),
        kataSorot: arr(b.kataSorot ?? b.kata_sorot, templat.browser.kataSorot, 4),
      },
      responsive: {
        badge: str(r.badge, templat.responsive.badge, 32),
        judul: str(r.judul, templat.responsive.judul, 56),
        poin: arr(r.poin ?? r.daftar, templat.responsive.poin, 3),
        narasi: str(r.narasi, templat.responsive.narasi, 240),
        kataSorot: arr(r.kataSorot ?? r.kata_sorot, templat.responsive.kataSorot, 4),
      },
      spotlight: {
        badge: str(s.badge, templat.spotlight.badge, 36),
        judul: str(s.judul, templat.spotlight.judul, 56),
        labelKlik: str(s.labelKlik ?? s.label_klik, templat.spotlight.labelKlik, 28),
        daftar: arr(s.daftar ?? s.poin, templat.spotlight.daftar, 3),
        narasi: str(s.narasi, templat.spotlight.narasi, 240),
        kataSorot: arr(s.kataSorot ?? s.kata_sorot, templat.spotlight.kataSorot, 4),
      },
      penutup: {
        judul: str(p.judul, templat.penutup.judul, 56),
        tombol: str(p.tombol, templat.penutup.tombol, 28),
        narasi: str(p.narasi, templat.penutup.narasi, 240),
        kataSorot: arr(p.kataSorot ?? p.kata_sorot, templat.penutup.kataSorot, 4),
      },
      ajakan: str(o.ajakan, templat.ajakan, 60),
      caption: str(o.caption, templat.caption, 800),
      hashtag: arr(o.hashtag, templat.hashtag, 8).map((x) => x.replace(/^#+/, '')),
    };
  };

  try {
    const r = await panggilRouterWorkerJson({
      system,
      prompt,
      maksToken: 4096,
      skemaZod: SkemaWebShowcase,
      normalisasi: normalisasiShowcase,
      petunjukJson: PETUNJUK_JSON_SHOWCASE,
      namaTahap: 'naskah web showcase',
      effortClaude: 'low',
    });
    return {
      ...r.data,
      narasi: [
        r.data.hook.narasi,
        r.data.browser.narasi,
        r.data.responsive.narasi,
        r.data.spotlight.narasi,
        r.data.penutup.narasi,
      ],
      sumber: `web-showcase:${r.sumber}`,
      pemakaian: r.pemakaian,
    };
  } catch (e) {
    console.error('Semua penyedia naskah WebShowcase gagal, memakai templat:', e.message);
    return { ...templat, sumber: `templat-web-showcase (${String(e.message).slice(0, 100)})` };
  }
}
