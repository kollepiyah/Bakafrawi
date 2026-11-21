import "server-only";
import { rest } from "./db-server";
import { panggilLlmJson, type PemakaianLlm } from "./llm-router";
import {
  captionAkhir, MODE_BAWAAN, promptIde, promptNaskah, rapikanNaskah, skemaNaskah, SKEMA_IDE, SISTEM_KONTEN, teksNaskah,
  type DataKonten, type ModeVideo, type Naskah,
} from "./lekkopi/konten-murni";
import type { Merek } from "./studio-server";

// Naskah video bahan "bank media" (gaya Lek Kopi): data kedai dari pintu-bakafrawi Lek Kopi
// (baca-saja), isi bank & gaya dari tabel Bakafrawi, aturan & prompt dari konten-murni.
// Penyedia AI dipilih llm-router (Gemini → Cloudflare → Claude) supaya hemat kuota Claude.

type DataPintu = Pick<DataKonten, "periode" | "terlaris" | "turun" | "jamSepi" | "menu" | "promo" | "toko" | "ingatan">;

async function dataPintuLekKopi(): Promise<DataPintu> {
  const url = process.env.LEKKOPI_PINTU_URL;
  const rahasia = process.env.LEKKOPI_PINTU_RAHASIA;
  if (!url || !rahasia) throw new Error("LEKKOPI_PINTU_URL / LEKKOPI_PINTU_RAHASIA belum diisi di Vercel.");
  const r = await fetch(url, { headers: { "x-pintu-rahasia": rahasia }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(`Pintu Lek Kopi menolak (${r.status}${j.pesan ? `: ${j.pesan}` : ""}).`);
  return j.data as DataPintu;
}

export type MenuAsliMerek = {
  nama: string;
  harga: number;
  kategori?: string;
  foto?: string | null;
  /** Urutan terlaris (1, 2, 3, ...) bila masuk daftar terlaris dari pintu-bakafrawi. */
  peringkatTerlaris?: number;
};

/** Ambil daftar menu asli & foto produk dari pintu-bakafrawi Lek Kopi, diurutkan dengan menu terlaris di depan. */
export async function ambilMenuLekKopi(): Promise<MenuAsliMerek[]> {
  try {
    const data = await dataPintuLekKopi();
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const urutanTerlaris = new Map<string, number>();
    (data.terlaris ?? []).forEach((t, idx) => {
      const nama = typeof t === "string" ? t : String((t as { nama?: string })?.nama ?? "");
      if (nama) urutanTerlaris.set(norm(nama), idx + 1);
    });

    const daftar: MenuAsliMerek[] = (data.menu ?? [])
      .filter((m) => m && m.nama)
      .map((m) => {
        const nama = String(m.nama).trim();
        const peringkat = urutanTerlaris.get(norm(nama));
        return {
          nama,
          harga: Number(m.harga) || 0,
          kategori: m.kategori ? String(m.kategori).trim() : undefined,
          foto: String(m.foto || m.gambar || m.image_url || "").trim() || null,
          ...(peringkat ? { peringkatTerlaris: peringkat } : {}),
        };
      });

    // Menu terlaris hari/periode sebelumnya ditaruh paling atas (1, 2, 3...)
    daftar.sort((a, b) => (a.peringkatTerlaris ?? 999) - (b.peringkatTerlaris ?? 999));
    return daftar;
  } catch {
    return [];
  }
}

const KOSONG: DataPintu = { periode: "-", terlaris: [], turun: [], jamSepi: [], menu: [], promo: [] };

/** Bahan prompt untuk satu merek: data kedai (bila merek punya pintu) + isi bank + gaya + judul terakhir. */
export async function dataKontenMerek(merek: Merek): Promise<DataKonten> {
  const m = encodeURIComponent(merek.slug);
  const [pintu, bank, gaya, terakhir] = await Promise.all([
    merek.profil.naskah === "lekkopi" ? dataPintuLekKopi() : Promise.resolve(KOSONG),
    rest(`studio_bank?merek=eq.${m}&jenis=in.(foto,video)&select=tag,jenis,kurasi`) as Promise<{ tag: string; jenis: string; kurasi: { deskripsi?: string; kualitas?: number } | null }[]>,
    rest(`studio_gaya?merek=eq.${m}&select=profil`) as Promise<{ profil: { naskah?: Record<string, unknown> } }[]>,
    rest(`studio_tugas?merek=eq.${m}&naskah=not.is.null&select=naskah->>judul&order=dibuat.desc&limit=10`) as Promise<{ judul: string | null }[]>,
  ]);
  // Isi terbaik per tag hasil kurasi (video didahulukan) — supaya naskah memilih tag yang gambarnya
  // cocok dengan tema, dan tahu tag mana yang punya rekaman bergerak.
  const perTag = new Map<string, { deskripsi: string; kualitas: number; video: boolean }[]>();
  for (const b of bank) {
    if (!b.kurasi?.deskripsi) continue;
    perTag.set(b.tag, [...(perTag.get(b.tag) ?? []), { deskripsi: b.kurasi.deskripsi, kualitas: Number(b.kurasi.kualitas) || 0, video: b.jenis === "video" }]);
  }
  const isiBank = [...perTag].flatMap(([tag, isi]) =>
    isi.sort((a, b) => Number(b.video) - Number(a.video) || b.kualitas - a.kualitas).slice(0, 4)
      .map((x) => `${tag}: [${x.video ? "VIDEO" : "foto"}] ${x.deskripsi} (kualitas ${x.kualitas || "-"})`));
  return {
    ...pintu,
    tagBank: [...new Set(bank.map((b) => b.tag))].sort(),
    isiBank,
    gaya: gaya[0]?.profil?.naskah ?? null,
    // Aktifkan B-roll gambar AI gratis (maks 2 adegan) secara bawaan agar video tidak hanya bergantung
    // pada foto bank — tetap bisa dimatikan dengan mengatur gambar_ai_maks = 0 di profil merek.
    gambarAi: merek.profil.gambar_ai_maks !== undefined ? Number(merek.profil.gambar_ai_maks) : 2,
    kontenTerakhir: terakhir.map((t) => t.judul).filter((j): j is string => Boolean(j)),
  };
}

/** Usulan ide video dari data kedai minggu lalu (seperti /ide Lek AI) → [{ judul, alasan, sudut, rekaman }]. */
export async function usulkanIde(merek: Merek, jumlah = 4) {
  const data = await dataKontenMerek(merek);
  const { data: j, pemakaian } = await panggilLlmJson<{ ide?: Record<string, string>[] }>({
    system: SISTEM_KONTEN,
    prompt: promptIde(data, jumlah),
    skema: SKEMA_IDE as Record<string, unknown>,
    maksToken: 8000,
    valid: (d) => Array.isArray((d as { ide?: unknown[] })?.ide) && ((d as { ide: unknown[] }).ide.length > 0),
  }, "ide");
  const ide = (j.ide ?? []).slice(0, jumlah);
  if (!ide.length) throw new Error("AI tidak memberi ide.");
  return { ide, bankKosong: !data.tagBank.length, pemakaian };
}

/**
 * Tulis (atau revisi) naskah video bank media dari permintaan Kyai.
 * Memulangkan naskah rapi + caption + teks Telegram + daftar perbaikan tag.
 */
export async function tulisNaskahBank(
  merek: Merek,
  permintaan: string,
  opsi: { mode?: ModeVideo; catatan?: string; naskahLama?: Naskah } = {},
) {
  const mode = opsi.mode ?? MODE_BAWAAN;
  const data = await dataKontenMerek(merek);
  if (!data.tagBank.length) throw new Error(`Bank media ${merek.nama} masih kosong — mesin Studio belum mengindeks folder Drive-nya.`);
  const adalahEditorial = /\[Gaya:\s*editorial-scroll\]/i.test(permintaan);
  const adalahDial = /\[Gaya:\s*dial-menu\]/i.test(permintaan);
  const adalahStoryDrop = /\[Gaya:\s*story-drop\]/i.test(permintaan);
  if (adalahEditorial || adalahDial || adalahStoryDrop) {
    // Gaya referensi (laptop POUR/PLAY, keypad Happy Cake, atau Story Drop Aurelia Cafe) butuh visual produk bersih & seragam (gratis via Cloudflare FLUX.2).
    data.gambarAi = Math.max(Number(data.gambarAi) || 0, adalahDial ? 8 : adalahStoryDrop ? 6 : 4);
  }
  const sudutStoryDrop = `MODE STORY-DROP (persis referensi "Aurelia Cafe", ±9 detik): buat TEPAT 5 adegan, satu adegan = satu menu andalan (minuman kopi, matcha, non-kopi, atau cemilan) yang akan melompat turun dari lingkaran Instagram Story ke atas meja kafe (durasi 1.4 detik per adegan).
ATURAN VISUAL WAJIB:
- DILARANG memakai tag "suasana", "racik", atau "logo"! Hanya fokus pada 5 item menu produk.
- Gunakan tag "ai" untuk setiap menu agar tiap produk tampil utuh (satu gelas/cangkir/piring utuh terpusat pada latar polos terang/krem bersih sehingga mudah dipotong rapi otomatis ke atas meja).
- Tulis "bidikan" dalam BAHASA INGGRIS yang spesifik menggambarkan satu objek utuh terpusat (mis. "Single iced palm sugar milk coffee (es kopi susu) in a clear aesthetic cafe glass with ice cubes, centered product photography on a clean solid light cream background, studio lighting, sharp focus, no hands, no text").
- WAJIB isi "teks_layar" tiap adegan singkat dalam format "Jenis | Nama Pendek" agar rapi di bawah lingkaran Story (mis. "Kopi | Kopi Susu", "Matcha | Matcha Latte", "Spesial | Sakura Coffee", "Cemilan | Cireng", "Minuman | Milkshake"). Tanpa narasi.`;
  const sudutDial = `MODE DIAL-MENU (persis "Dial a slice" Happy Cake, cepat ±10 detik): buat TEPAT 7 adegan, satu adegan = satu menu minuman/cemilan andalan Lek Kopi (durasi 0.9 detik per adegan).
ATURAN VISUAL WAJIB (SANGAT PENTING):
- DILARANG memakai tag "suasana", "racik", atau "logo"! Jangan pernah tampilkan foto jendela kedai, barista, atau logo pada mode ini.
- Gunakan tag "ai" untuk setiap menu agar ke-7 foto produk seragam, close-up gelas/piring di tengah meja kayu/marmer kafe yang hangat & menggugah selera (persis gaya foto kue seragam Happy Cake).
- Tulis "bidikan" dalam BAHASA INGGRIS yang spesifik menggambarkan bentuk & warna minumannya (mis. "Close-up of iced palm sugar milk coffee (es kopi susu gula aren) in a clear glass with ice cubes and creamy swirl centered on a warm wooden cafe table, soft window daylight, bokeh cafe background" atau "Close-up of refreshing iced green pandan melon drink with ice cubes in a tall glass centered on a marble cafe table, no people, no text").
- WAJIB isi "teks_layar" tiap adegan dengan format "Jenis | Nama Menu" tanpa mengulang kata yang sama (mis. "Kopi | Es Kopi Susu Lek", "Kopi | Latte Art", "Minuman | Banana Milkshake", "Minuman | Es Ijo Segar", "Cemilan | Cireng Crispy"). Tanpa narasi.`;
  const sudutTambahan = adalahStoryDrop ? sudutStoryDrop : adalahDial ? sudutDial : adalahEditorial
    ? `MODE EDITORIAL LAPTOP 1-SCENE (persis referensi POUR/PLAY): buat TEPAT 4 adegan untuk 4 blok gulir di dalam layar laptop (durasi 2.2–2.5 detik per blok, total ±9.6 detik). WAJIB isi "teks_layar" pada blok 1, 2, 4 dengan format "JUDUL 2–3 KATA | subteks pendek 6–10 kata" (bahasa Indonesia keren untuk menu/suasana Lek Kopi); blok 3 cukup judul 2 kata sebagai showcase full-bleed. Pakai tag "ai" untuk 3–4 blok dengan "bidikan" fotografi studio kopi minimalis mewah berlatar krem hangat (#F4ECE0): mis. biji kopi & percikan espresso emas, tuangan pour-over di gelas kaca estetik, latte art creamy melayang di cangkir — TANPA tulisan di gambar.`
    : `Ikuti persis tema permintaan ini: "${permintaan}". Pilih tag & bidikan yang paling sesuai temanya (utamakan rekaman video).`;
  const ide = { judul: permintaan, alasan: "permintaan Kyai", sudut: sudutTambahan };
  const { data: mentah, pemakaian } = await panggilLlmJson<Naskah>({
    system: SISTEM_KONTEN,
    prompt: promptNaskah(data, ide, opsi.catatan, opsi.naskahLama as unknown as Record<string, unknown>, mode),
    skema: skemaNaskah(mode) as Record<string, unknown>,
    maksToken: 16000,
    valid: (d) => Array.isArray((d as { adegan?: unknown[] })?.adegan) && ((d as { adegan: unknown[] }).adegan.length > 0),
  }, opsi.catatan ? "revisi naskah" : "naskah");
  const { naskah, perbaikan } = rapikanNaskah(mentah, data.tagBank, mode, data.gambarAi ?? 0);
  if (!naskah.adegan.length) throw new Error("Naskah dari AI tidak berisi adegan.");

  // Cocokkan tiap adegan dengan foto produk ASLI dari aplikasi Lek Kopi (bila pintu-bakafrawi mengirim URL foto).
  const menuBerfoto = (data.menu ?? [])
    .map((m) => ({ nama: m.nama, url: String(m.foto || m.gambar || m.image_url || "").trim() }))
    .filter((m) => /^https?:\/\//i.test(m.url));
  if (menuBerfoto.length > 0 && (adalahDial || adalahEditorial || adalahStoryDrop)) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    let cocokFoto = 0;
    for (const a of naskah.adegan) {
      const sasaran = norm(`${a.teks_layar ?? ""} ${a.bidikan ?? ""}`);
      const temu = menuBerfoto.find((m) => {
        const nm = norm(m.nama);
        return nm.length >= 3 && sasaran.includes(nm);
      });
      if (temu) {
        a.foto_url = temu.url;
        cocokFoto++;
      }
    }
    if (cocokFoto > 0) perbaikan.push(`${cocokFoto} adegan memakai foto asli dari aplikasi ${merek.nama}`);
  }

  // Catatan biaya ikut tersimpan di naskah → dijumlah di Deck. Revisi menambah ke catatan lama.
  const lama = ((opsi.naskahLama as unknown as { pemakaian?: PemakaianLlm[] } | undefined)?.pemakaian ?? []);
  (naskah as Naskah & { pemakaian?: PemakaianLlm[] }).pemakaian = [...lama, pemakaian];
  return { naskah, caption: captionAkhir(naskah), teks: teksNaskah(naskah), perbaikan };
}
