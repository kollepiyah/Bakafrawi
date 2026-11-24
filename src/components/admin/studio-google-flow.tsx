"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Film,
  Loader2,
  Send,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import {
  OPSI_BAHASA_FLOW,
  OPSI_FORMAT_DIALOG_FLOW,
  OPSI_GAYA_FLOW,
  OPSI_PRODUK_BAKAFRAWI,
  type BahasaFlow,
  type FormatDialogFlow,
  type GayaFlow,
  type PaketGoogleFlow,
} from "@/lib/google-flow-murni";
import {
  DAFTAR_SASARAN_VIDEO,
  daftarSlotCepatWIB,
  type SasaranTayang,
} from "@/lib/jadwal-tayang-murni";

type MerekRingkas = { slug: string; nama: string; aktif: boolean };

async function buatSampulVideoFlow(berkas: File): Promise<{ blob: Blob | null; durasi: number }> {
  const url = URL.createObjectURL(berkas);
  try {
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    await new Promise<void>((ok) => {
      v.onloadedmetadata = () => ok();
      v.onerror = () => ok();
      setTimeout(ok, 2500);
    });
    const durasi = Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration) : 15;
    if (!v.videoWidth || !v.videoHeight) return { blob: null, durasi };
    await new Promise<void>((ok) => {
      const selesai = () => {
        v.onseeked = null;
        ok();
      };
      v.onseeked = selesai;
      v.currentTime = Math.min(Math.max(0.2, durasi * 0.15), 1.5);
      setTimeout(selesai, 1500);
    });
    const lebar = Math.min(540, v.videoWidth);
    const tinggi = Math.max(1, Math.round(lebar * (v.videoHeight / v.videoWidth)));
    const canvas = document.createElement("canvas");
    canvas.width = lebar;
    canvas.height = tinggi;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: null, durasi };
    ctx.drawImage(v, 0, 0, lebar, tinggi);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob((b) => ok(b), "image/jpeg", 0.82));
    return { blob, durasi };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PanelGoogleFlow({
  merekDaftar,
  merekAwal,
  topikAwal,
  tokenSegar,
  selesaiUpload,
}: {
  merekDaftar: MerekRingkas[];
  merekAwal?: string;
  topikAwal?: string;
  tokenSegar: () => Promise<string>;
  selesaiUpload: (pesan: string) => void;
}) {
  const [merek, setMerek] = useState(merekAwal || merekDaftar[0]?.slug || "lekkopi");
  const [produk, setProduk] = useState("ammu-online");
  const [bahasa, setBahasa] = useState<BahasaFlow>("jawa_campur");
  const [gaya, setGaya] = useState<GayaFlow>("storytelling_hangat");
  const [formatDialog, setFormatDialog] = useState<FormatDialogFlow>("obrolan_2_orang");
  const [jumlahAdegan, setJumlahAdegan] = useState(4);
  const [topik, setTopik] = useState(topikAwal ?? "");
  const [sedangBuat, setSedangBuat] = useState(false);
  const [paket, setPaket] = useState<PaketGoogleFlow | null>(null);
  const [penyedia, setPenyedia] = useState("");
  const [salinKunci, setSalinKunci] = useState<string | null>(null);
  const [galat, setGalat] = useState("");

  // State upload balik hasil Google Flow
  const [berkas, setBerkas] = useState<File | null>(null);
  const [pratinjauUrl, setPratinjauUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [sasaran, setSasaran] = useState<SasaranTayang>("reels");
  const [modeTayang, setModeTayang] = useState<"jadwal" | "sekarang" | "draf">("jadwal");
  const [waktuJadwal, setWaktuJadwal] = useState(() => daftarSlotCepatWIB()[3]?.inputWib ?? "");
  const [sibukUpload, setSibukUpload] = useState(false);
  const [progresUpload, setProgresUpload] = useState("");

  useEffect(() => {
    if (!merekAwal) return;
    const t = setTimeout(() => setMerek(merekAwal), 0);
    return () => clearTimeout(t);
  }, [merekAwal]);

  useEffect(() => {
    if (!topikAwal) return;
    const t = setTimeout(() => setTopik(topikAwal), 0);
    return () => clearTimeout(t);
  }, [topikAwal]);

  useEffect(() => {
    return () => {
      if (pratinjauUrl) URL.revokeObjectURL(pratinjauUrl);
    };
  }, [pratinjauUrl]);

  async function salinTeks(kunci: string, teks: string) {
    try {
      await navigator.clipboard.writeText(teks);
      setSalinKunci(kunci);
      setTimeout(() => setSalinKunci((k) => (k === kunci ? null : k)), 1800);
    } catch {
      setGalat("Gagal menyalin ke clipboard.");
    }
  }

  async function buatPaketPrompt(e: FormEvent) {
    e.preventDefault();
    setSedangBuat(true);
    setGalat("");
    try {
      const tok = await tokenSegar();
      if (!tok) throw new Error("Sesi login tidak ditemukan — coba muat ulang halaman.");
      const res = await fetch("/api/studio/google-flow", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          merek,
          produk: merek === "bakafrawi" ? produk : undefined,
          topik: topik.trim(),
          bahasa,
          gaya,
          formatDialog,
          jumlahAdegan,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok || !j.paket) {
        throw new Error(j.pesan ?? "Gagal membuat paket prompt Google Flow.");
      }
      setPaket(j.paket as PaketGoogleFlow);
      setCaption(String(j.paket.caption ?? ""));
      setPenyedia(j.penyedia ? `${j.penyedia}${j.model ? ` · ${j.model}` : ""}` : "");
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal membuat paket prompt.");
    } finally {
      setSedangBuat(false);
    }
  }

  function pilihBerkasVideo(f: File | null) {
    if (pratinjauUrl) URL.revokeObjectURL(pratinjauUrl);
    setGalat("");
    if (!f) {
      setBerkas(null);
      setPratinjauUrl(null);
      return;
    }
    if (f.size > 95 * 1024 * 1024) {
      setGalat("Ukuran video melebihi 95 MB. Kompres dulu agar diterima Instagram.");
      return;
    }
    setBerkas(f);
    setPratinjauUrl(URL.createObjectURL(f));
  }

  async function unggahHasilFlow() {
    if (!berkas) {
      setGalat("Pilih berkas video (.mp4 / .mov) hasil dari Google Flow terlebih dahulu.");
      return;
    }
    if (modeTayang === "jadwal" && !waktuJadwal.trim()) {
      setGalat("Tentukan tanggal & jam tayang (WIB).");
      return;
    }
    setSibukUpload(true);
    setGalat("");
    try {
      const tok = await tokenSegar();
      if (!tok) throw new Error("Sesi login tidak ditemukan.");

      setProgresUpload("Menyiapkan ruang unggah…");
      const izinRes = await fetch("/api/studio/unggah", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "izin-unggah", merek, namaBerkas: berkas.name }),
      });
      const izin = await izinRes.json().catch(() => ({}));
      if (!izin.ok || !izin.uploadUrl || !izin.publicUrl) {
        throw new Error(izin.pesan ?? "Gagal menyiapkan unggahan.");
      }

      setProgresUpload(`Mengunggah video Google Flow (${(berkas.size / 1_048_576).toFixed(1)} MB)…`);
      const upRes = await fetch(izin.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4" },
        body: berkas,
      });
      if (!upRes.ok) throw new Error(`Unggah video gagal (HTTP ${upRes.status}).`);

      setProgresUpload("Membuat sampul pratinjau…");
      let sampulUrl: string | undefined;
      const { blob, durasi } = await buatSampulVideoFlow(berkas);
      if (blob) {
        const izinS = await fetch("/api/studio/unggah", {
          method: "POST",
          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
          body: JSON.stringify({ aksi: "izin-unggah", merek, namaBerkas: "sampul-flow.jpg" }),
        });
        const jS = await izinS.json().catch(() => ({}));
        if (jS.ok && jS.uploadUrl && jS.publicUrl) {
          const uS = await fetch(jS.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: blob,
          });
          if (uS.ok) sampulUrl = jS.publicUrl;
        }
      }

      setProgresUpload("Menyimpan tugas & jadwal tayang…");
      const simpanRes = await fetch("/api/studio/unggah", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "simpan-tugas",
          merek,
          jenis: "video",
          url: izin.publicUrl,
          sampulUrl,
          durasi,
          judul: paket?.judul || berkas.name.replace(/\.[a-z0-9]+$/i, ""),
          caption: caption.trim(),
          sasaran,
          modeTayang,
          jadwalWib: modeTayang === "jadwal" ? waktuJadwal : undefined,
        }),
      });
      const simpan = await simpanRes.json().catch(() => ({}));
      if (!simpan.ok) throw new Error(simpan.pesan ?? "Gagal menyimpan video hasil Google Flow.");

      pilihBerkasVideo(null);
      selesaiUpload(simpan.pesan ?? "Video Google Flow berhasil masuk Studio!");
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal mengunggah hasil Google Flow.");
    } finally {
      setSibukUpload(false);
      setProgresUpload("");
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Langkah 1: Generator Paket Prompt Google Flow ── */}
      <form
        onSubmit={buatPaketPrompt}
        className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-lg">
              <Wand2 className="size-5 text-emas" /> Google Flow Bridge (Video Full AI)
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Agen meriset tren &amp; menyusun paket prompt <b>Veo 3 / Google Flow</b> lengkap dengan dialog natural Indonesia/Jawa, lalu Kyai tinggal upload balik hasilnya di bawah.
            </p>
          </div>
          <a
            href="https://labs.google/fx/tools/flow"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emas/40 bg-emas/10 px-3 py-1 text-xs font-medium text-emas-muda hover:bg-emas/20"
          >
            Buka Google Flow <ExternalLink className="size-3" />
          </a>
        </div>

        {/* Pilihan Merek */}
        {merekDaftar.length > 1 && (
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Akun / Merek</span>
            <div className="flex flex-wrap gap-2">
              {merekDaftar.map((m) => (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() => setMerek(m.slug)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                    merek === m.slug
                      ? "border-emas bg-emas text-background"
                      : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/25 hover:text-foreground"
                  }`}
                >
                  {m.nama}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pilihan Produk Bakafrawi */}
        {merek === "bakafrawi" && (
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Produk yang Dipromosikan</span>
            <div className="flex flex-wrap gap-2">
              {OPSI_PRODUK_BAKAFRAWI.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setProduk(p.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    produk === p.slug
                      ? "border-sky-400 bg-sky-500/20 text-sky-200"
                      : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/25 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Format Dialog</span>
            <select
              value={formatDialog}
              onChange={(e) => setFormatDialog(e.target.value as FormatDialogFlow)}
              className="h-10 rounded-xl border border-input bg-card px-3 text-xs"
            >
              {OPSI_FORMAT_DIALOG_FLOW.map((f) => (
                <option key={f.kode} value={f.kode}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Bahasa &amp; Logat Dialog</span>
            <select
              value={bahasa}
              onChange={(e) => setBahasa(e.target.value as BahasaFlow)}
              className="h-10 rounded-xl border border-input bg-card px-3 text-xs"
            >
              {OPSI_BAHASA_FLOW.map((b) => (
                <option key={b.kode} value={b.kode}>
                  {b.label} — {b.ket}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Gaya Cerita / Visual</span>
            <select
              value={gaya}
              onChange={(e) => {
                const g = e.target.value as GayaFlow;
                setGaya(g);
                if (g === "fooh_3d") {
                  setFormatDialog("tanpa_dialog_sfx");
                  setJumlahAdegan(1);
                } else if (g === "sketsa_visual") {
                  setFormatDialog("tanpa_dialog_sfx");
                  setJumlahAdegan(2);
                } else if (g === "iklan_komersial") {
                  setFormatDialog("tanpa_dialog_sfx");
                  setJumlahAdegan(4);
                }
              }}
              className="h-10 rounded-xl border border-input bg-card px-3 text-xs"
            >
              {OPSI_GAYA_FLOW.map((g) => (
                <option key={g.kode} value={g.kode}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Jumlah Klip (@ 8 dtk)</span>
            <select
              value={jumlahAdegan}
              onChange={(e) => setJumlahAdegan(Number(e.target.value))}
              className="h-10 rounded-xl border border-input bg-card px-3 text-xs"
            >
              <option value={1}>1 Klip (±8 detik · Cocok FOOH 3D)</option>
              <option value={2}>2 Klip (±16 detik · Cocok Sketsa Visual)</option>
              <option value={3}>3 Klip (±24 detik)</option>
              <option value={4}>4 Klip (±32 detik · Disarankan)</option>
              <option value={5}>5 Klip (±40 detik)</option>
            </select>
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Topik / Ide Cerita (kosongkan agar Agen riset ide viral terbaru otomatis)
          </span>
          <textarea
            rows={2}
            value={topik}
            onChange={(e) => setTopik(e.target.value)}
            placeholder={
              merek === "lekkopi"
                ? "Mis. Sketsa bapak-bapak Panjunan kaget nyoba Sakura-ne Lek Rp14.000, atau kosongkan untuk ide viral otomatis…"
                : "Mis. Cerita pemilik toko kelontong capek rekap manual malam-malam lalu kenal Maktaba POS, atau kosongkan…"
            }
            className="rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
          />
        </label>

        {galat && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {galat}
          </p>
        )}

        <button
          type="submit"
          disabled={sedangBuat}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emas px-5 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-50 sm:w-auto"
        >
          {sedangBuat ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {sedangBuat ? "Menyusun storyboard & prompt Google Flow…" : "Buat Paket Prompt Google Flow"}
        </button>
      </form>

      {/* ── Hasil Paket Prompt per Adegan ── */}
      {paket && (
        <div className="space-y-4 rounded-2xl border border-emas/30 bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-3">
            <div className="min-w-0">
              <h3 className="font-heading text-base font-semibold text-emas-muda">{paket.judul}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{paket.ringkasanKonsep}</p>
            </div>
            {penyedia && (
              <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-zinc-400">
                AI: {penyedia}
              </span>
            )}
          </div>

          {/* Langkah 0: Prompt Gambar Referensi Karakter (Ingredients to Video) */}
          {paket.promptGambarKarakter && (
            <div className="space-y-2 rounded-xl border border-sky-400/35 bg-sky-500/[0.06] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="block text-xs font-semibold text-sky-300">
                    Langkah 0 (Biar Wajah Karakter Tidak Berubah-Ubah!)
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Generate 1× gambar ini dulu di Google Flow, lalu masukkan sebagai <b>Ingredient / Bahan Referensi</b> di semua klip di bawah.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void salinTeks("karakter-ref", paket.promptGambarKarakter)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    salinKunci === "karakter-ref"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-sky-400 text-black hover:brightness-110"
                  }`}
                >
                  {salinKunci === "karakter-ref" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {salinKunci === "karakter-ref" ? "Tersalin" : "Copy Prompt Karakter"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-200">
                {paket.promptGambarKarakter}
              </pre>
            </div>
          )}

          {/* Character Bible */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
                Panduan Karakter &amp; Lokasi Konsisten
              </span>
              <button
                type="button"
                onClick={() => void salinTeks("bible", paket.karakterBible)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-emas hover:text-emas"
              >
                {salinKunci === "bible" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                {salinKunci === "bible" ? "Tersalin" : "Salin"}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{paket.karakterBible}</p>
          </div>

          {/* Kartu tiap adegan */}
          <div className="space-y-3">
            {paket.adegan.map((a) => {
              const kunci = `klip-${a.nomor}`;
              const tersalin = salinKunci === kunci;
              return (
                <div
                  key={a.nomor}
                  className="space-y-2 rounded-xl border border-border/80 bg-white/[0.02] p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-emas/20 px-2 py-0.5 text-[11px] font-bold text-emas">
                        Klip {a.nomor} · {a.durasiDetik} dtk
                      </span>
                      <span className="text-xs font-medium text-foreground">{a.ringkasAksi}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void salinTeks(kunci, a.promptGoogleFlow)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                        tersalin
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-emas text-background hover:brightness-110"
                      }`}
                    >
                      {tersalin ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {tersalin ? "Prompt Tersalin" : "Copy Prompt Flow"}
                    </button>
                  </div>

                  <div className="grid gap-1.5 text-xs sm:grid-cols-2">
                    <div className="rounded-lg bg-black/25 px-2.5 py-2">
                      <span className="block text-[10px] uppercase text-zinc-500">
                        {formatDialog === "tanpa_dialog_sfx" ? "SFX / Suara" : "Dialog"}
                      </span>
                      <p className="mt-0.5 text-foreground">&ldquo;{a.dialog}&rdquo;</p>
                    </div>
                    <div className="rounded-lg bg-black/25 px-2.5 py-2">
                      <span className="block text-[10px] uppercase text-zinc-500">Logat &amp; Teks Layar</span>
                      <p className="mt-0.5 text-muted-foreground">
                        {a.arahanLogat}
                        {a.teksLayar ? ` · Layar: "${a.teksLayar}"` : ""}
                      </p>
                    </div>
                  </div>

                  <pre className="whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-300">
                    {a.promptGoogleFlow}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Langkah 2: Upload Balik Video Hasil Google Flow ── */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div>
          <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
            <Upload className="size-4 text-emas" /> Langkah 2: Upload Video Hasil Google Flow ke Studio
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Setelah selesai merender di Google Flow, unggah videonya di sini — caption &amp; hashtag konsisten sudah otomatis siap.
          </p>
        </div>

        {!berkas ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emas/30 bg-emas/[0.03] px-4 py-6 text-center transition hover:border-emas hover:bg-emas/[0.06]">
            <Film className="size-6 text-emas" />
            <span className="text-xs font-semibold text-foreground">
              Pilih Video Hasil Google Flow (.mp4 / .mov, maks 95 MB)
            </span>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => {
                pilihBerkasVideo(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:flex-row sm:items-center">
            {pratinjauUrl && (
              <video
                src={pratinjauUrl}
                controls
                playsInline
                className="mx-auto h-44 w-28 shrink-0 rounded-lg bg-black object-cover sm:mx-0"
              />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-foreground">{berkas.name}</p>
                <button
                  type="button"
                  onClick={() => pilihBerkasVideo(null)}
                  disabled={sibukUpload}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:text-red-300"
                >
                  <X className="size-3" /> Ganti
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DAFTAR_SASARAN_VIDEO.map((o) => (
                  <button
                    key={o.kode}
                    type="button"
                    onClick={() => setSasaran(o.kode)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                      sasaran === o.kode
                        ? "border-emas bg-emas/15 text-emas"
                        : "border-white/10 text-muted-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Caption & Hashtag Konsisten */}
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Caption &amp; Hashtag Konsisten ({merek === "lekkopi" ? "@lekkopi.id" : "@bakafrawi.project"})
            </span>
            {caption.trim() && (
              <button
                type="button"
                onClick={() => void salinTeks("caption-flow", caption)}
                className="inline-flex items-center gap-1 text-[11px] text-emas hover:underline"
              >
                {salinKunci === "caption-flow" ? <Check className="size-3" /> : <Copy className="size-3" />}
                {salinKunci === "caption-flow" ? "Tersalin" : "Salin Caption"}
              </button>
            )}
          </div>
          <textarea
            rows={5}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Akan terisi otomatis setelah Kyai klik 'Buat Paket Prompt Google Flow' di atas…"
            className="rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
          />
        </div>

        {/* Mode & Waktu Tayang */}
        <div className="space-y-2.5 rounded-xl border border-border/70 bg-white/[0.02] p-3">
          <div className="flex flex-wrap gap-2">
            {[
              { kode: "jadwal" as const, label: "Jadwalkan Otomatis" },
              { kode: "sekarang" as const, label: "Tayangkan Sekarang" },
              { kode: "draf" as const, label: "Simpan Draf" },
            ].map((m) => (
              <button
                key={m.kode}
                type="button"
                onClick={() => setModeTayang(m.kode)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  modeTayang === m.kode
                    ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                    : "border-white/10 text-muted-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {modeTayang === "jadwal" && (
            <div className="flex flex-wrap items-center gap-2">
              <CalendarClock className="size-4 text-emas" />
              <input
                type="datetime-local"
                value={waktuJadwal}
                onChange={(e) => setWaktuJadwal(e.target.value)}
                className="h-9 rounded-lg border border-input bg-card px-2.5 font-mono text-xs"
              />
              <span className="text-[11px] text-muted-foreground">WIB</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void unggahHasilFlow()}
          disabled={sibukUpload || !berkas}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40 sm:w-auto"
        >
          {sibukUpload ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {sibukUpload
            ? progresUpload || "Mengunggah…"
            : modeTayang === "sekarang"
            ? "Upload & Tayangkan ke IG"
            : modeTayang === "jadwal"
            ? "Upload & Jadwalkan Otomatis"
            : "Upload sebagai Draf"}
        </button>
      </div>
    </div>
  );
}
