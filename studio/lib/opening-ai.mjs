// Generator Konten Story Jam Buka AI (simpel, selalu baru tiap hari — tanpa perlu bank video).
// Mendukung dua format:
//   1. "video-animasi" → Video animasi 8 detik 9:16 dirender Remotion (komposisi OpeningStory, gaya pegas ala Bakafrawi)
//   2. "poster"        → Poster Story 9:16 dirender Playwright (1080×1920 JPEG)
// Keduanya memakai teks harian dari Claude (jatuh ke templat rotasi harian bila tanpa kunci API)
// dan latar foto suasana kopi AI (Cloudflare Workers AI gratis, jatuh ke latar grafis bila kuota habis).
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';
import { ffmpeg } from './bank/alat.mjs';
import { adaGambarAi, buatGambarAi } from './bank/gambar-ai.mjs';
import { buatMusikKafe, buatSfxOpening } from './opening-audio.mjs';
import { bukaPeramban, potret } from './peramban.mjs';
import { panggilRouterWorkerJson, urutanPenyediaWorker } from './router-worker.mjs';

const jalankan = promisify(execFile);
const DIR = path.dirname(fileURLToPath(import.meta.url));
const REMOTION = path.join(DIR, '..', 'remotion');
const CLI = path.join(REMOTION, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');

const HARI_ID = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const GAYA_LIST = ['hangat-kafe', 'terang-modern', 'minimalis-gelap'];

// Cadangan umum bila pintu-bakafrawi belum terhubung: TANPA mengarang nama menu spesifik atau harga palsu.
const SAPAAN_UMUM_LEKKOPI = [
  {
    judul: 'WE ARE\nOPEN.',
    sub: 'Seduhan kopi segar sudah siap menemani harimu di Lek Kopi.',
    menuNama: 'Racikan Segar Hari Ini',
    menuHarga: '',
    menuKet: 'Kopi, non-kopi, & menu favorit siap disajikan — cek daftar lengkap di lekkopi.bakafrawi.com.',
    promptLatar: 'Cinematic vertical photograph of iced coffee milk swirling with espresso shot in a minimalist glass, warm wooden cafe table, soft morning daylight, shallow depth of field, no text',
  },
  {
    judul: 'WAKTUNYA\nNGOPI.',
    sub: 'Meja outdoor nyaman, angin sepoi, dan minuman dingin siap menyambutmu.',
    menuNama: 'Menu Favorit Kedai',
    menuHarga: '',
    menuKet: 'Diseduh segar per gelas — mampir langsung atau pesan lewat lekkopi.bakafrawi.com.',
    promptLatar: 'Aesthetic minimalist cafe photography of iced coffee and cold drinks on a warm wooden cafe table, soft natural daylight, editorial beverage photography, no text',
  },
  {
    judul: 'SUDAH\nBUKA.',
    sub: 'Espresso ditarik segar per gelas, cocok buat teman kerja atau santai.',
    menuNama: 'Freshly Brewed Today',
    menuHarga: '',
    menuKet: 'Lihat seluruh pilihan menu & harga terbaru langsung di lekkopi.bakafrawi.com.',
    promptLatar: 'Minimalist vertical shot of freshly poured iced coffee with crystal clear ice cubes, warm cafe light, editorial photography, no text',
  },
];

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rupiah = (n) => (Number(n) > 0 ? `Rp${Number(n).toLocaleString('id-ID')}` : '');

/** Pilih gaya visual harian (kalau "otomatis", bergilir berdasarkan tanggal WIB). */
function pilihGaya(gayaPilihan, hariEpoch) {
  if (gayaPilihan === 'hangat-kafe' || gayaPilihan === 'terang-modern' || gayaPilihan === 'minimalis-gelap') {
    return gayaPilihan;
  }
  return GAYA_LIST[Math.abs(hariEpoch) % GAYA_LIST.length];
}

/** Tulis teks opening harian memakai menu ASLI dari database Lek Kopi (tidak pernah mengarang menu/harga). */
export async function buatKonsepOpeningAI({ merekNama = 'Lek Kopi', jamBuka = '09:00', hariNama, arahan = '', gayaPilihan = 'otomatis', hariEpoch = 0, daftarMenu = [] }) {
  const gaya = pilihGaya(gayaPilihan, hariEpoch);
  const menuValid = Array.isArray(daftarMenu) ? daftarMenu.filter((m) => m && m.nama) : [];
  // Prioritaskan menu asli yang punya foto produk, rotasi harian.
  const berfoto = menuValid.filter((m) => /^https?:\/\//i.test(String(m.foto ?? '')));
  const kolam = berfoto.length ? berfoto : menuValid;
  const menuAsli = kolam.length ? kolam[Math.abs(hariEpoch) % kolam.length] : null;

  const dasar = SAPAAN_UMUM_LEKKOPI[Math.abs(hariEpoch) % SAPAAN_UMUM_LEKKOPI.length];
  const cadangan = menuAsli
    ? {
        judul: dasar.judul,
        sub: dasar.sub,
        menuNama: menuAsli.nama,
        menuHarga: rupiah(menuAsli.harga),
        menuKet: `Menu asli ${merekNama} — siap disajikan segar hari ini.`,
        fotoAsliUrl: menuAsli.foto || null,
        promptLatar: `Aesthetic minimalist cafe photography of ${menuAsli.nama} drink in a clean glass on a wooden cafe table, soft natural daylight, warm tones, vertical 9:16, no text`,
      }
    : { ...dasar, fotoAsliUrl: null };

  if (!urutanPenyediaWorker({ adaGambar: false }).length) {
    return { ...cadangan, gaya, sumber: menuAsli ? 'menu-asli-harian' : 'sapaan-umum' };
  }

  try {
    const daftarTeks = menuValid.length
      ? `WAJIB pilih HANYA dari daftar menu asli kedai ini (DILARANG KERAS mengarang menu atau harga di luar daftar):\n${menuValid.slice(0, 30).map((m) => `- ${m.nama}${m.harga ? ` (${rupiah(m.harga)})` : ''}`).join('\n')}`
      : 'Daftar menu tidak tersedia saat ini: JANGAN mengarang nama menu spesifik atau harga! Isi menuNama dengan judul umum seperti "Racikan Segar Hari Ini" dan menuHarga dengan string kosong "".';
    const prompt = [
      `Buat 1 konsep Story Instagram "WE ARE OPEN" yang ringkas, modern, & tidak ramai untuk kedai kopi "${merekNama}" di Panjunan, Waru, Sidoarjo pada hari ${hariNama} (jam buka ${jamBuka} WIB).`,
      daftarTeks,
      arahan ? `Arahan khusus pemilik: ${arahan}` : '',
    ].filter(Boolean).join('\n');

    const petunjukJson =
      '\n\nJawab HANYA dengan JSON valid tanpa markdown:\n' +
      '{"judul":"2 baris sangat singkat maks 22 huruf total (pakai \\n, mis. WE ARE\\nOPEN.)","sub":"1 kalimat singkat maks 68 huruf","menuNama":"nama menu PERSIS dari daftar (atau umum jika daftar kosong)","menuHarga":"Rp... persis dari daftar (atau kosong jika daftar kosong)","menuKet":"1 kalimat singkat maks 72 huruf","promptLatar":"English visual prompt for minimalist coffee product photography on wooden table, daylight, NO text"}';

    const skemaOpening = z.object({
      judul: z.string().min(1),
      sub: z.string().min(1),
      menuNama: z.string().min(1),
      menuHarga: z.string().optional().default(''),
      menuKet: z.string().min(1),
      promptLatar: z.string().min(1),
    });

    const normalisasiOpening = (mentah) => {
      const akar = mentah && typeof mentah === 'object' && !Array.isArray(mentah) ? mentah : {};
      const bungkus = [akar.konsep, akar.data, akar.hasil, akar.story].find(
        (v) => v && typeof v === 'object' && !Array.isArray(v),
      );
      const o = akar.judul || akar.title || akar.headline ? akar : (bungkus ?? akar);
      return {
        judul: String(o.judul ?? o.title ?? o.headline ?? '').trim(),
        sub: String(o.sub ?? o.subtitle ?? o.subjudul ?? cadangan.sub).trim(),
        menuNama: String(o.menuNama ?? o.menu_nama ?? o.menu ?? cadangan.menuNama).trim(),
        menuHarga: String(o.menuHarga ?? o.menu_harga ?? o.harga ?? '').trim(),
        menuKet: String(o.menuKet ?? o.menu_ket ?? o.deskripsi ?? cadangan.menuKet).trim(),
        promptLatar: String(o.promptLatar ?? o.prompt_latar ?? o.prompt ?? cadangan.promptLatar).trim(),
      };
    };

    const r = await panggilRouterWorkerJson({
      system: `Kamu direktur kreatif untuk kedai kopi ${merekNama}. Tulis dalam Bahasa Indonesia yang santai & hangat.`,
      prompt,
      maksToken: 900,
      suhu: 0.7,
      skemaZod: skemaOpening,
      normalisasi: normalisasiOpening,
      petunjukJson,
      namaTahap: 'konsep opening ai',
      effortClaude: 'low',
    });

    const j = r.data;
    const namaDipilih = String(j.menuNama || cadangan.menuNama).trim().slice(0, 50);
    // Kunci ketat: bila daftarMenu tersedia, menuNama & menuHarga WAJIB persis dari database Lek Kopi (tidak boleh dikarang AI).
    const cocokAsli = menuValid.find((m) => m.nama.toLowerCase() === namaDipilih.toLowerCase()) ?? menuAsli;
    return {
      judul: String(j.judul || cadangan.judul).trim().slice(0, 40),
      sub: String(j.sub || cadangan.sub).trim().slice(0, 110),
      menuNama: menuValid.length ? (cocokAsli?.nama ?? cadangan.menuNama) : cadangan.menuNama,
      menuHarga: menuValid.length ? rupiah(cocokAsli?.harga ?? 0) : '',
      menuKet: String(j.menuKet || cadangan.menuKet).trim().slice(0, 100),
      fotoAsliUrl: cocokAsli?.foto || cadangan.fotoAsliUrl || null,
      promptLatar: String(j.promptLatar || cadangan.promptLatar).trim().slice(0, 320),
      gaya,
      sumber: r.sumber,
    };
  } catch (e) {
    console.log(`⚠️ Konsep Opening AI memakai cadangan (${e.message})`);
    return { ...cadangan, gaya, sumber: menuAsli ? 'menu-asli-harian' : 'sapaan-umum' };
  }
}

/** HTML Poster Story 9:16 (1080×1920) untuk opsi format "poster". */
export function htmlStoryOpening(p, fotoUrl = null) {
  const tema =
    p.gaya === 'terang-modern'
      ? { bg: '#F8F5EE', overlay: 'rgba(248,245,238,0.82)', teks: '#181411', sub: '#4D443C', kartu: 'rgba(255,255,255,0.9)', border: 'rgba(24,20,17,0.14)', aksen: p.aksen || '#D9A441' }
      : p.gaya === 'minimalis-gelap'
      ? { bg: '#0A0C10', overlay: 'rgba(10,12,16,0.78)', teks: '#F4F6FA', sub: '#B8C1D1', kartu: 'rgba(18,23,32,0.86)', border: 'rgba(52,224,205,0.38)', aksen: '#34E0CD' }
      : { bg: '#16100C', overlay: 'rgba(16,11,8,0.76)', teks: '#FAF6F0', sub: '#D7CCC0', kartu: 'rgba(26,19,14,0.84)', border: 'rgba(217,164,65,0.42)', aksen: p.aksen || '#D9A441' };

  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1920px;overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif;background:${tema.bg};color:${tema.teks};position:relative}
    .bg-foto{position:absolute;inset:0;background:url('${esc(fotoUrl ?? '')}') center/cover;filter:saturate(1.06)}
    .bg-overlay{position:absolute;inset:0;background:linear-gradient(180deg,${tema.overlay} 0%,rgba(0,0,0,0.45) 45%,${tema.overlay} 100%)}
    .kisi{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1.5px,transparent 1.5px),linear-gradient(90deg,rgba(255,255,255,.04) 1.5px,transparent 1.5px);background-size:68px 68px}
    .bungkus{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:130px 76px 140px}
    .bar-atas{display:flex;align-items:center;justify-content:space-between}
    .merek{display:flex;align-items:center;gap:16px;font-size:32px;font-weight:800;letter-spacing:.14em}
    .titik{width:18px;height:18px;border-radius:50%;background:#22C55E;box-shadow:0 0 18px #22C55E}
    .pil-hari{padding:12px 26px;border-radius:999px;border:2px solid ${tema.border};background:${tema.kartu};font-size:24px;font-weight:800;letter-spacing:.1em;color:${tema.aksen}}
    .lencana{display:inline-block;padding:10px 24px;border-radius:14px;background:${tema.aksen};color:#14100C;font-size:26px;font-weight:800;letter-spacing:.08em;margin-bottom:26px}
    h1{font-size:88px;line-height:1.06;font-weight:800;letter-spacing:-.03em;white-space:pre-line}
    .garis{margin-top:26px;height:7px;width:140px;border-radius:999px;background:${tema.aksen}}
    .sub{margin-top:34px;font-size:34px;line-height:1.45;color:${tema.sub};font-weight:500}
    .kartu{margin-top:44px;padding:36px 40px;border-radius:32px;background:${tema.kartu};border:2px solid ${tema.border};box-shadow:0 28px 60px rgba(0,0,0,.28)}
    .kartu-atas{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .kartu-label{font-size:22px;font-weight:800;letter-spacing:.12em;color:${tema.aksen};text-transform:uppercase}
    .harga{padding:8px 20px;border-radius:999px;background:${tema.aksen};color:#14100C;font-size:26px;font-weight:800}
    .menu-nama{font-size:44px;font-weight:800;margin-bottom:10px}
    .menu-ket{font-size:28px;line-height:1.4;color:${tema.sub}}
    .bawah{display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
    .jam{padding:16px 38px;border-radius:999px;background:${tema.kartu};border:2px solid ${tema.border};font-size:30px;font-weight:800;letter-spacing:.06em}
    .alamat{font-size:26px;color:${tema.sub};font-weight:600}
  </style></head><body>
    ${fotoUrl ? '<div class="bg-foto"></div><div class="bg-overlay"></div>' : '<div class="kisi"></div>'}
    <div class="bungkus">
      <div class="bar-atas">
        <div class="merek"><span class="titik"></span><span>${esc(p.merek)}</span></div>
        <div class="pil-hari">${esc(p.hari)} · OPEN</div>
      </div>
      <div>
        <div class="lencana">WE ARE OPEN</div>
        <h1>${esc(p.judul)}</h1>
        <div class="garis"></div>
        <p class="sub">${esc(p.sub)}</p>
        <div class="kartu">
          <div class="kartu-atas">
            <span class="kartu-label">☕ Rekomendasi Hari Ini</span>
            ${p.menuHarga ? `<span class="harga">${esc(p.menuHarga)}</span>` : ''}
          </div>
          <div class="menu-nama">${esc(p.menuNama)}</div>
          <div class="menu-ket">${esc(p.menuKet)}</div>
        </div>
      </div>
      <div class="bawah">
        <div class="jam">${esc(p.hariBuka)} · ${esc(p.jamBuka)} – ${esc(p.jamTutup)} WIB</div>
        <div class="alamat">${esc(p.situs)} · ${esc(p.alamat)}</div>
      </div>
    </div>
    <script>Promise.all([document.fonts.ready,...[...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))]).then(()=>document.body.setAttribute('data-siap',''))</script>
  </body></html>`;
}

/** Unduh foto produk asli (atau buat foto AI bila belum punya foto) ke folder kerja. */
async function siapkanFotoMenu(menuItem, index, folder, merekNama) {
  if (menuItem.foto && /^https?:\/\//i.test(menuItem.foto)) {
    try {
      const rFoto = await fetch(menuItem.foto);
      if (rFoto.ok) {
        const ekst = /\.(png|webp|jpe?g)(\?|$)/i.exec(menuItem.foto)?.[1] || 'jpg';
        const lokal = path.join(folder, `menu-${index}.${ekst}`);
        await writeFile(lokal, Buffer.from(await rFoto.arrayBuffer()));
        return lokal;
      }
    } catch (e) {
      console.log(`⚠️ Foto asli menu #${index + 1} gagal diunduh: ${e.message}`);
    }
  }
  if (adaGambarAi()) {
    try {
      const prompt = menuItem.promptLatar || `Aesthetic minimalist cafe photography of ${menuItem.nama} at ${merekNama} coffee shop in a clear glass on a warm wooden table, soft morning daylight, shallow depth of field, no text`;
      const r = await buatGambarAi(prompt, '9:16', path.join(folder, `menu-ai-${index}`));
      return r.berkas;
    } catch (e) {
      console.log(`⚠️ Foto AI menu #${index + 1} dilewati: ${e.message}`);
    }
  }
  return null;
}

/**
 * Buat & render 1 konten Story Jam Buka baru oleh AI:
 * - format === 'poster'        → JPEG 1080×1920 via Playwright
 * - format === 'video-animasi' → MP4 9–15 dtk 1080×1920 via Remotion (OpeningStory) dengan 3 menu terlaris,
 *                                musik kafe adaptif generated, dan efek suara transisi (whoosh/pop/chime).
 */
export async function renderOpeningAI({ merek, format = 'video-animasi', gaya = 'otomatis', arahan = '', jamBuka = '09:00', daftarMenu = [], folder }) {
  await mkdir(folder, { recursive: true });
  const wib = new Date(Date.now() + 7 * 3600_000);
  const hariNama = HARI_ID[wib.getUTCDay()] ?? 'HARI INI';
  const hariEpoch = Math.floor(wib.getTime() / 86_400_000);

  const konsep = await buatKonsepOpeningAI({
    merekNama: merek?.nama || 'Lek Kopi',
    jamBuka,
    hariNama,
    arahan,
    gayaPilihan: gaya,
    hariEpoch,
    daftarMenu,
  });

  // Pilih hingga 3 menu terlaris asli dari aplikasi Lek Kopi (untuk format video-animasi 15 detik).
  const menuValid = Array.isArray(daftarMenu) ? daftarMenu.filter((m) => m && m.nama) : [];
  let tigaMenu = [];
  if (menuValid.length >= 2 && format !== 'poster') {
    const terlaris = menuValid.filter((m) => m.peringkatTerlaris).slice(0, 3);
    const sisa = menuValid.filter((m) => !terlaris.includes(m));
    const gabungan = [...terlaris, ...sisa].slice(0, 3);
    tigaMenu = gabungan.map((m, idx) => ({
      nama: m.nama,
      harga: rupiah(m.harga),
      ket: idx === 0 && konsep.menuNama.toLowerCase() === m.nama.toLowerCase()
        ? konsep.menuKet
        : m.peringkatTerlaris
        ? `Salah satu menu paling laris di ${merek?.nama || 'Lek Kopi'} kemarin.`
        : `Pilihan segar ${merek?.nama || 'Lek Kopi'} — siap diseduh hari ini.`,
      lencana: m.peringkatTerlaris ? `#${idx + 1} Terlaris Kemarin` : `Pilihan #${idx + 1}`,
      foto: m.foto || null,
    }));
  } else {
    tigaMenu = [
      {
        nama: konsep.menuNama,
        harga: konsep.menuHarga,
        ket: konsep.menuKet,
        lencana: 'Pilihan Hari Ini',
        foto: konsep.fotoAsliUrl || null,
        promptLatar: konsep.promptLatar,
      },
    ];
  }

  const publik = path.join(folder, 'publik');
  await mkdir(publik, { recursive: true });

  // Siapkan foto untuk setiap menu (foto asli aplikasi → foto AI Cloudflare → ilustrasi minimalis)
  const itemMenuFinal = [];
  let berkasLatarPertama = null;
  for (let i = 0; i < tigaMenu.length; i++) {
    const m = tigaMenu[i];
    const berkas = await siapkanFotoMenu(m, i, folder, merek?.nama || 'Lek Kopi');
    let namaDiPublik;
    if (berkas) {
      if (i === 0) berkasLatarPertama = berkas;
      namaDiPublik = `menu-${i}${path.extname(berkas) || '.jpg'}`;
      await copyFile(berkas, path.join(publik, namaDiPublik));
    }
    itemMenuFinal.push({
      nama: m.nama,
      harga: m.harga,
      ket: m.ket,
      lencana: m.lencana,
      ...(namaDiPublik ? { foto: namaDiPublik } : {}),
    });
  }

  const durasiTotal = (2 + itemMenuFinal.length) * 3; // 3 dtk pembuka + 3 dtk/menu + 3 dtk penutup (15 dtk utk 3 menu)

  const props = {
    merek: (merek?.nama || 'LEK KOPI').toUpperCase(),
    hari: hariNama,
    jamBuka,
    jamTutup: '23:00',
    hariBuka: 'Senin – Sabtu',
    judul: konsep.judul,
    sub: konsep.sub,
    daftarMenu: itemMenuFinal,
    menuNama: itemMenuFinal[0]?.nama ?? konsep.menuNama,
    menuHarga: itemMenuFinal[0]?.harga ?? konsep.menuHarga,
    menuKet: itemMenuFinal[0]?.ket ?? konsep.menuKet,
    situs: merek?.slug === 'lekkopi' ? 'lekkopi.bakafrawi.com' : (merek?.profil?.situs || 'bakafrawi.com'),
    alamat: merek?.slug === 'lekkopi' ? 'Panjunan, Waru, Sidoarjo' : 'Sidoarjo',
    aksen: merek?.profil?.aksen || '#D6A668',
    gaya: konsep.gaya,
    tampilDelivery: hariEpoch % 2 === 0,
  };

  if (format === 'poster') {
    const keluar = path.join(folder, `opening-ai-${Date.now()}.jpg`);
    const peramban = await bukaPeramban();
    try {
      await potret(peramban, {
        w: 1080,
        h: 1920,
        keluar,
        html: htmlStoryOpening(props, berkasLatarPertama ? pathToFileURL(berkasLatarPertama).href : null),
      });
    } finally {
      await peramban.close();
    }
    return { berkas: keluar, jenis: 'gambar', mime: 'image/jpeg', konsep };
  }

  // Generate musik kafe adaptif (selalu variatif sesuai tema visual & hari) + SFX transisi halus
  await buatMusikKafe({
    gaya: konsep.gaya,
    hariEpoch,
    durasiDetik: durasiTotal + 1,
    keluarMp3: path.join(publik, 'musik.mp3'),
  });
  props.musik = 'musik.mp3';
  props.sfx = await buatSfxOpening(publik);

  const berkasProps = path.join(folder, 'opening-props.json');
  await writeFile(berkasProps, JSON.stringify(props));
  const keluar = path.join(folder, `opening-ai-${Date.now()}.mp4`);
  await jalankan(
    process.execPath,
    [CLI, 'render', 'src/index.ts', 'OpeningStory', keluar, `--props=${berkasProps}`, `--public-dir=${publik}`, '--crf=23', '--pixel-format=yuv420p', '--log=error'],
    { cwd: REMOTION },
  );
  const sampul = path.join(folder, `opening-ai-sampul-${Date.now()}.jpg`);
  await ffmpeg(['-y', '-ss', '4', '-i', keluar, '-frames:v', '1', '-q:v', '3', sampul]).catch(() => {});
  return { berkas: keluar, sampul, jenis: 'video', mime: 'video/mp4', durasi: durasiTotal, konsep };
}
