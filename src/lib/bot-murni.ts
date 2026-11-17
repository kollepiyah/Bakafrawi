// Aturan bot Telegram yang murni (tanpa jaringan) — diuji di bot-murni.test.ts.

export type Perintah =
  | { jenis: "daftar"; kode: string }
  | { jenis: "buat"; konten: "gambar" | "video"; kata: string; ai: boolean }
  | { jenis: "status" }
  | { jenis: "bantuan" }
  | { jenis: "lain" };

/** Urai pesan: "/poster maktaba ai", "/video@BotNama waseela", "/start KODE", … */
export function uraiPerintah(teks: string): Perintah {
  const [kepala, ...sisa] = teks.trim().split(/\s+/);
  const cmd = (kepala ?? "").toLowerCase().replace(/@\w+$/, "");
  if (cmd === "/start") return sisa[0] ? { jenis: "daftar", kode: sisa[0] } : { jenis: "bantuan" };
  if (cmd === "/poster" || cmd === "/gambar" || cmd === "/video") {
    const kata = sisa.filter((k) => k.toLowerCase() !== "ai");
    return { jenis: "buat", konten: cmd === "/video" ? "video" : "gambar", kata: kata.join(" "), ai: sisa.some((k) => k.toLowerCase() === "ai") };
  }
  if (cmd === "/status") return { jenis: "status" };
  if (cmd === "/bantuan" || cmd === "/help") return { jenis: "bantuan" };
  return { jenis: "lain" };
}

/** Cari produk dari kata bebas: slug persis, lalu nama/slug yang memuat kata itu. */
export function cariProduk<T extends { slug: string; nama: string }>(produk: T[], kata: string): T | null {
  const k = kata.trim().toLowerCase();
  if (!k) return null;
  return produk.find((p) => p.slug === k) ?? produk.find((p) => p.slug.includes(k) || p.nama.toLowerCase().includes(k)) ?? null;
}

/** Data tombol: "t:<id>" tayang sekarang, "j:<id>" jadwal, "x:<id>" tolak, "u:<id>" buat ulang. */
export function uraiTombol(data: string): { aksi: "sekarang" | "jadwal" | "tolak" | "ulang"; id: string } | null {
  const m = /^([tjxu]):([0-9a-f-]{36})$/.exec(data);
  if (!m) return null;
  const aksi = ({ t: "sekarang", j: "jadwal", x: "tolak", u: "ulang" } as const)[m[1] as "t" | "j" | "x" | "u"];
  return { aksi, id: m[2] };
}

/** Bandingkan rahasia tanpa bocor lewat lama waktu pembandingan. */
export function samaAman(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

export type GiliranBot = { peran: "user" | "assistant"; teks: string };

/**
 * Ingatan pendek bot: ambil giliran terakhir saja, dimulai dari pesan user (syarat API Claude),
 * tiap teks dipotong supaya biaya tiap pesan tetap kecil.
 */
export function rapikanRiwayat(riwayat: GiliranBot[], maks = 10, maksHuruf = 1500): GiliranBot[] {
  const akhir = riwayat.slice(-maks).map((g) => ({ ...g, teks: g.teks.slice(0, maksHuruf) }));
  const mulai = akhir.findIndex((g) => g.peran === "user");
  return mulai < 0 ? [] : akhir.slice(mulai);
}
