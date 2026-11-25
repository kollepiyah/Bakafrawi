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

// Catatan biaya (USD per 1 juta token, perkiraan) → naskah.pemakaian, dijumlah di Deck admin.
const HARGA_WORKER = {
  nvidia: { input: 0, output: 0 },
  gemini: { input: 0.3, output: 2.5 },
  cloudflare: { input: 0.29, output: 2.25 },
  'claude-haiku': { input: 0.1, output: 0.5 },
  'claude-sonnet': { input: 2, output: 10 },
};

function catatBiaya(tahap, u = {}, penyedia = 'claude', model = MODEL) {
  const h = penyedia === 'claude' ? (model.includes('haiku') ? HARGA_WORKER['claude-haiku'] : HARGA_WORKER['claude-sonnet']) : (HARGA_WORKER[penyedia] ?? { input: 0, output: 0 });
  const input = (u.input_tokens ?? u.input ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const output = u.output_tokens ?? u.output ?? 0;
  return { tahap, penyedia, model, input, output, biayaUsd: Math.round(((input * h.input + output * h.output) / 1e6) * 1e6) / 1e6 };
}

function ekstrakJson(teks) {
  const t = String(teks ?? '').trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const bersih = m ? m[1].trim() : t;
  const awal = bersih.search(/[[{]/);
  if (awal < 0) return bersih;
  const buka = bersih[awal];
  const tutup = buka === '{' ? '}' : ']';
  const akhir = bersih.lastIndexOf(tutup);
  return akhir > awal ? bersih.slice(awal, akhir + 1) : bersih.slice(awal);
}

async function panggilNvidiaWorker({ system, prompt, maksToken = 4096 }) {
  const baseUrl = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
  const kandidat = [...new Set([process.env.STUDIO_NVIDIA_TEKS, 'qwen/qwen2.5-72b-instruct', 'deepseek-ai/deepseek-v3.2', 'meta/llama-3.1-70b-instruct'].filter(Boolean))];
  let galat = null;
  for (const model of kandidat) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(45_000),
        headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: maksToken,
        }),
      });
      if (!res.ok) {
        const msg = `NVIDIA ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`;
        if (res.status === 404 || res.status === 410) { galat = new Error(msg); continue; }
        throw new Error(msg);
      }
      const j = await res.json();
      const teks = String(j.choices?.[0]?.message?.content ?? '{}');
      return {
        data: JSON.parse(ekstrakJson(teks)),
        penyedia: 'nvidia',
        model,
        usage: { input: Number(j.usage?.prompt_tokens) || 0, output: Number(j.usage?.completion_tokens) || 0 },
      };
    } catch (e) {
      galat = e;
      if (!/NVIDIA (404|410)/.test(String(e))) throw e;
    }
  }
  throw galat ?? new Error('NVIDIA NIM gagal merespons.');
}

async function panggilGeminiWorker({ system, prompt, gambar = [], maksToken = 8000 }) {
  const kandidat = [...new Set([process.env.STUDIO_GEMINI_TEKS, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'].filter(Boolean))];
  const parts = [
    ...gambar.flatMap((g) => [
      { text: g.label },
      { inline_data: { mime_type: 'image/jpeg', data: g.data } },
    ]),
    { text: prompt },
  ];
  let galat = null;
  for (const model of kandidat) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(45_000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.7, maxOutputTokens: maksToken, responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) {
        const msg = `Gemini ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`;
        if (res.status === 404) { galat = new Error(msg); continue; }
        throw new Error(msg);
      }
      const j = await res.json();
      const teks = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('') || '{}';
      const u = j.usageMetadata ?? {};
      return {
        data: JSON.parse(ekstrakJson(teks)),
        penyedia: 'gemini',
        model,
        usage: { input: Number(u.promptTokenCount) || 0, output: (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0) },
      };
    } catch (e) {
      galat = e;
      if (!String(e).includes('Gemini 404')) throw e;
    }
  }
  throw galat ?? new Error('Gemini gagal merespons.');
}

async function panggilCloudflareWorker({ system, prompt, maksToken = 4096 }) {
  const model = process.env.STUDIO_CF_TEKS || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${model}`, {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: maksToken,
    }),
  });
  if (!res.ok) throw new Error(`Cloudflare ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
  const j = await res.json();
  const r = j.result?.response;
  const data = typeof r === 'string' ? JSON.parse(ekstrakJson(r)) : (r ?? {});
  return {
    data,
    penyedia: 'cloudflare',
    model,
    usage: { input: Number(j.result?.usage?.prompt_tokens) || 0, output: Number(j.result?.usage?.completion_tokens) || 0 },
  };
}

/** Urutan hemat worker: NVIDIA NIM → Gemini → Cloudflare → Claude (atau sesuai STUDIO_AI_PROVIDER). */
function daftarPenyediaWorker(adaGambar) {
  const paksa = String(process.env.STUDIO_AI_PROVIDER ?? '').trim().toLowerCase();
  const semua = [
    { nama: 'nvidia', kode: ['nvidia', 'nim'], ada: () => !adaGambar && !!process.env.NVIDIA_API_KEY },
    { nama: 'gemini', kode: ['gemini'], ada: () => !!process.env.GEMINI_API_KEY },
    { nama: 'cloudflare', kode: ['cf', 'cloudflare'], ada: () => !adaGambar && !!(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) },
    { nama: 'claude', kode: ['claude', 'anthropic'], ada: () => !!process.env.ANTHROPIC_API_KEY },
  ];
  return semua.filter((p) => p.ada()).sort((a, b) => Number(b.kode.includes(paksa)) - Number(a.kode.includes(paksa)));
}

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
  const penyediaAktif = daftarPenyediaWorker(false);
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
  if (!penyediaAktif.length) return templat();

  const gayaDasar = merek?.profil?.gaya || (merek?.slug === 'lekkopi' ? GAYA_LEKKOPI : GAYA_BAWAAN);
  const blokRef = ringkasReferensiWorker(referensi);
  const system = gayaDasar
    + ' Kamu membuat naskah VIDEO STORYTELLING FULL AI vertikal 9:16 (bukan demo screenshot layar). Buat alur cerita sinematik 5 adegan yang memikat sejak 2 detik pertama: Adegan 1 Hook menyentil masalah/momen nyata, Adegan 2-4 Cerita suasana/keunggulan nyata, Adegan 5 Penutup & ajakan hangat.';
  const prompt = `Buat naskah video Reels/TikTok Storytelling Full AI (5 adegan) untuk ${adalahKedai ? 'kedai/merek' : 'produk'} berikut.\n\n${ringkasProduk(produk, situs, merek)}${blokRef}\n\nArahan tambahan dari pemilik: ${arahan || '(pilih sudut cerita paling segar & relatable untuk audiens Indonesia)'}`;

  const galat = [];
  for (const p of penyediaAktif) {
    try {
      if (p.nama === 'claude') {
        const client = new Anthropic();
        const res = await client.messages.parse({
          model: MODEL,
          max_tokens: 6000,
          output_config: { effort: 'low', format: zodOutputFormat(SkemaVideoFullAi) },
          system,
          messages: [{ role: 'user', content: prompt }],
        });
        if (res.stop_reason === 'refusal' || !res.parsed_output?.adegan?.length) throw new Error(`Claude menolak (${res.stop_reason}).`);
        return {
          ...res.parsed_output,
          narasi: res.parsed_output.adegan.map((a) => a.narasi),
          sumber: `full-ai:${MODEL}`,
          pemakaian: [catatBiaya('naskah video full ai', res.usage, 'claude', MODEL)],
        };
      }
      const r = p.nama === 'nvidia'
        ? await panggilNvidiaWorker({ system: system + PETUNJUK_JSON_FULL_AI, prompt, maksToken: 4096 })
        : p.nama === 'gemini'
        ? await panggilGeminiWorker({ system: system + PETUNJUK_JSON_FULL_AI, prompt, maksToken: 4096 })
        : await panggilCloudflareWorker({ system: system + PETUNJUK_JSON_FULL_AI, prompt, maksToken: 4096 });
      const cek = SkemaVideoFullAi.safeParse(r.data);
      if (!cek.success || !cek.data.adegan?.length) throw new Error(`Format JSON Full AI tidak cocok (${cek.error?.issues[0]?.path?.join('.') || 'adegan'})`);
      return {
        ...cek.data,
        narasi: cek.data.adegan.map((a) => a.narasi),
        sumber: `full-ai:${r.penyedia}:${r.model}`,
        pemakaian: [catatBiaya('naskah video full ai', r.usage, r.penyedia, r.model)],
      };
    } catch (e) {
      galat.push(`${p.nama}: ${e.message}`);
      console.warn(`Naskah video Full AI ${p.nama} gagal, coba penyedia berikutnya:`, e.message);
    }
  }
  console.error('Semua penyedia naskah video Full AI gagal, memakai templat:', galat.join(' | '));
  return { ...templat(), sumber: `templat-full-ai (${galat[0]?.slice(0, 100) ?? 'galat'})` };
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

/** Naskah hemat multi-provider (NVIDIA NIM → Gemini → Cloudflare → Claude); gagal semua → templat. */
/** merek: baris studio_merek; profil.gaya = arahan copywriter merek itu (bawaan: Bakafrawi / Lek Kopi). */
export async function buatNaskah(produk, situs, arahan, jenis, merek = null) {
  const penyediaAktif = daftarPenyediaWorker(false);
  if (!penyediaAktif.length) return { ...naskahTemplat(produk, situs, merek), sumber: 'templat (tanpa kunci API)' };
  const system = merek?.profil?.gaya || (merek?.slug === 'lekkopi' ? GAYA_LEKKOPI : GAYA_BAWAAN);
  const promptJenis = jenis === 'video'
    ? 'video iklan vertikal (Reels/TikTok) yang menampilkan rekaman layar aplikasinya'
    : produk.kategori === 'kedai'
    ? 'poster promosi Full AI yang menarik perhatian untuk Instagram Feed & Story (pastikan "adegan" berisi prompt visual foto/ilustrasi kopi & suasana sesuai arahan tanpa tulisan)'
    : 'poster promosi';
  const prompt = `Buat naskah ${promptJenis}.\n\n${ringkasProduk(produk, situs, merek)}\n\nArahan tambahan dari pemilik: ${arahan || '(tidak ada)'}`;
  const galat = [];
  for (const p of penyediaAktif) {
    try {
      if (p.nama === 'claude') {
        const client = new Anthropic();
        const res = await client.messages.parse({
          model: MODEL,
          max_tokens: 16000,
          output_config: { effort: 'medium', format: zodOutputFormat(SkemaNaskah) },
          system,
          messages: [{ role: 'user', content: prompt }],
        });
        if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error(`Claude tidak memberi naskah (${res.stop_reason}).`);
        return { ...res.parsed_output, sumber: MODEL, pemakaian: [catatBiaya('naskah poster', res.usage, 'claude', MODEL)] };
      }
      const r = p.nama === 'nvidia'
        ? await panggilNvidiaWorker({ system: system + PETUNJUK_JSON_POSTER, prompt })
        : p.nama === 'gemini'
        ? await panggilGeminiWorker({ system: system + PETUNJUK_JSON_POSTER, prompt })
        : await panggilCloudflareWorker({ system: system + PETUNJUK_JSON_POSTER, prompt });
      const cek = SkemaNaskah.safeParse(r.data);
      if (!cek.success) throw new Error(`Format JSON tidak cocok (${cek.error.issues[0]?.path?.join('.') || 'skema'})`);
      return { ...cek.data, sumber: `${r.penyedia}:${r.model}`, pemakaian: [catatBiaya('naskah poster', r.usage, r.penyedia, r.model)] };
    } catch (e) {
      galat.push(`${p.nama}: ${e.message}`);
      console.warn(`Naskah ${p.nama} gagal, coba penyedia berikutnya:`, e.message);
    }
  }
  console.error('Semua penyedia naskah gagal, memakai templat:', galat.join(' | '));
  return { ...naskahTemplat(produk, situs, merek), sumber: `templat (AI gagal: ${galat[0]?.slice(0, 120) ?? 'galat'})` };
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
 * Claude sebagai gambar (diperkecil) supaya ia memilih bagian yang disorot. Tanpa kunci / gagal →
 * templat. Hasil: keluaran mentah (dirapikan video.mjs keNaskah) + narasi/judul untuk tampilan lama.
 */
export async function buatNaskahVideo(produk, situs, arahan, merek = null, layar = [], kecilkan = null, karakter = [], referensi = []) {
  const templat = () => naskahVideoTemplat(produk, situs, merek, layar.length);
  const gambarSiap = [];
  for (const [i, l] of layar.entries()) {
    const data = kecilkan ? await kecilkan(l.berkas) : null;
    if (!data) continue;
    gambarSiap.push({ label: `Layar ${i}${l.keterangan ? ` (${l.keterangan})` : ''}:`, data });
  }
  const penyediaAktif = daftarPenyediaWorker(gambarSiap.length > 0);
  if (!penyediaAktif.length) return { ...templat(), sumber: 'templat (tanpa kunci API)' };

  const system = merek?.profil?.gaya || GAYA_BAWAAN;
  const blokRef = ringkasReferensiWorker(referensi);
  const prompt = `${ATURAN_VIDEO}\n\nAda ${layar.length} layar aplikasi di atas (nomor 0-${Math.max(0, layar.length - 1)}).${layar.length ? '' : ' Tidak ada layar: jangan pakai jenis "layar".'}\n\nKarakter maskot 3D yang tersedia (tampil di bawah layar, satu karakter untuk seluruh video): ${karakter.length ? karakter.join(', ') : '(belum ada — isi karakter kosong)'}.\n\n${ringkasProduk(produk, situs)}${blokRef}\n\nArahan tambahan dari pemilik: ${arahan || '(tidak ada)'}`;
  const galat = [];

  for (const p of penyediaAktif) {
    try {
      if (p.nama === 'claude') {
        const gambarClaude = gambarSiap.flatMap((g) => [
          { type: 'text', text: g.label },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: g.data } },
        ]);
        const client = new Anthropic();
        const res = await client.messages.parse({
          model: MODEL,
          max_tokens: 16000,
          output_config: { effort: 'medium', format: zodOutputFormat(SkemaVideo) },
          system,
          messages: [{ role: 'user', content: [...gambarClaude, { type: 'text', text: prompt }] }],
        });
        if (res.stop_reason === 'refusal' || !res.parsed_output?.adegan?.length) throw new Error(`Claude tidak memberi naskah (${res.stop_reason}).`);
        return { ...lengkapiVideo(res.parsed_output, MODEL), pemakaian: [catatBiaya('naskah video', res.usage, 'claude', MODEL)] };
      }
      const r = p.nama === 'nvidia'
        ? await panggilNvidiaWorker({ system: system + PETUNJUK_JSON_VIDEO, prompt, maksToken: 6000 })
        : p.nama === 'gemini'
        ? await panggilGeminiWorker({ system: system + PETUNJUK_JSON_VIDEO, prompt, gambar: gambarSiap, maksToken: 8000 })
        : await panggilCloudflareWorker({ system: system + PETUNJUK_JSON_VIDEO, prompt, maksToken: 6000 });
      const cek = SkemaVideo.safeParse(r.data);
      if (!cek.success || !cek.data.adegan?.length) throw new Error(`Format JSON video tidak cocok (${cek.error?.issues[0]?.path?.join('.') || 'adegan'})`);
      return { ...lengkapiVideo(cek.data, `${r.penyedia}:${r.model}`), pemakaian: [catatBiaya('naskah video', r.usage, r.penyedia, r.model)] };
    } catch (e) {
      galat.push(`${p.nama}: ${e.message}`);
      console.warn(`Naskah video ${p.nama} gagal, coba penyedia berikutnya:`, e.message);
    }
  }
  console.error('Semua penyedia naskah video gagal, memakai templat:', galat.join(' | '));
  return { ...templat(), sumber: `templat (AI gagal: ${galat[0]?.slice(0, 120) ?? 'galat'})` };
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
