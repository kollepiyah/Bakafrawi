"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CalendarClock,
  Check,
  Film,
  ImageIcon,
  Loader2,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { apakahNamaFileAcak } from "@/lib/caption-konsisten";
import {
  DAFTAR_SASARAN_GAMBAR,
  DAFTAR_SASARAN_VIDEO,
  daftarSlotCepatWIB,
  type SasaranTayang,
} from "@/lib/jadwal-tayang-murni";

type MerekRingkas = { slug: string; nama: string; aktif: boolean };

/** Ekstrak 1 bingkai awal video (detik 0.8) sebagai sampul JPG ringan untuk pratinjau di Riwayat & Insight. */
async function buatSampulVideo(berkas: File): Promise<{ blob: Blob | null; durasi: number }> {
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
    const durasi = Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration) : 10;
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

/** Ekstrak hingga 5 bingkai merata (awal, tengah, akhir) agar Vision AI membaca keseluruhan isi video. */
async function ekstrakBingkaiVideoManual(berkas: File, jumlah = 5): Promise<{ mimeType: string; data: string }[]> {
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
    if (!v.videoWidth || !v.videoHeight) return [];

    const durasi = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 8;
    const lebar = Math.min(480, v.videoWidth);
    const tinggi = Math.max(1, Math.round(lebar * (v.videoHeight / v.videoWidth)));
    const canvas = document.createElement("canvas");
    canvas.width = lebar;
    canvas.height = tinggi;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];

    const titik = [0.08, 0.28, 0.5, 0.72, 0.9]
      .slice(0, jumlah)
      .map((p) => Math.max(0.05, Math.min(durasi - 0.1, durasi * p)));
    const hasil: { mimeType: string; data: string }[] = [];
    for (const t of titik) {
      await new Promise<void>((ok) => {
        const selesai = () => {
          v.onseeked = null;
          ok();
        };
        v.onseeked = selesai;
        v.currentTime = t;
        setTimeout(selesai, 1400);
      });
      ctx.drawImage(v, 0, 0, lebar, tinggi);
      const data = canvas.toDataURL("image/jpeg", 0.72).split(",")[1] ?? "";
      if (data) hasil.push({ mimeType: "image/jpeg", data });
    }
    return hasil;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type InfoVisualCaption = {
  ringkas: string;
  penyedia?: string;
  jumlahBingkai: number;
  pakaiVision: boolean;
  catatan?: string;
};

export function PanelUnggahManual({
  merekDaftar,
  tokenSegar,
  selesai,
}: {
  merekDaftar: MerekRingkas[];
  tokenSegar: () => Promise<string>;
  selesai: (pesan: string) => void;
}) {
  const [merek, setMerek] = useState(merekDaftar[0]?.slug ?? "bakafrawi");
  const [berkas, setBerkas] = useState<File | null>(null);
  const [pratinjauUrl, setPratinjauUrl] = useState<string | null>(null);
  const [jenis, setJenis] = useState<"video" | "gambar">("video");
  const [durasi, setDurasi] = useState<number>(0);
  const [judul, setJudul] = useState("");
  const [caption, setCaption] = useState("");
  const [sasaran, setSasaran] = useState<SasaranTayang>("reels");
  const [modeTayang, setModeTayang] = useState<"jadwal" | "sekarang" | "draf">("jadwal");
  const [waktuJadwal, setWaktuJadwal] = useState(() => daftarSlotCepatWIB()[3]?.inputWib ?? "");
  const [progres, setProgres] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [sedangBuatCaption, setSedangBuatCaption] = useState(false);
  const [infoVisual, setInfoVisual] = useState<InfoVisualCaption | null>(null);
  const idAnalisisRef = useRef(0);

  useEffect(() => {
    if (merekDaftar.length > 0 && !merekDaftar.some((m) => m.slug === merek)) {
      const target = merekDaftar[0].slug;
      const t = setTimeout(() => setMerek(target), 0);
      return () => clearTimeout(t);
    }
  }, [merekDaftar, merek]);

  useEffect(() => {
    return () => {
      if (pratinjauUrl) URL.revokeObjectURL(pratinjauUrl);
    };
  }, [pratinjauUrl]);

  function pilihBerkas(f: File | null) {
    if (pratinjauUrl) URL.revokeObjectURL(pratinjauUrl);
    idAnalisisRef.current += 1;
    setGalat("");
    setInfoVisual(null);
    if (!f) {
      setBerkas(null);
      setPratinjauUrl(null);
      setDurasi(0);
      return;
    }
    const maksByte = 95 * 1024 * 1024;
    if (f.size > maksByte) {
      setGalat("Ukuran berkas melebihi 95 MB. Kompres dulu agar cepat diunggah & diterima Instagram.");
      return;
    }
    const adalahGambar = f.type.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(f.name);
    const jenisBaru = adalahGambar ? "gambar" : "video";
    const sasaranBaru: SasaranTayang = adalahGambar ? "story" : "reels";
    setBerkas(f);
    setJenis(jenisBaru);
    setSasaran(sasaranBaru);

    const namaDasar = f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
    const judulAwal = !judul.trim() && !apakahNamaFileAcak(f.name) ? namaDasar : judul;
    if (!judul.trim() && !apakahNamaFileAcak(f.name)) {
      setJudul(namaDasar);
    }
    const u = URL.createObjectURL(f);
    setPratinjauUrl(u);

    if (!adalahGambar) {
      const v = document.createElement("video");
      v.src = u;
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        if (Number.isFinite(v.duration) && v.duration > 0) setDurasi(Math.round(v.duration));
      };
    } else {
      setDurasi(0);
    }

    // Begitu video dipilih (sasaran awal Reels), otomatis tonton 5 bingkai & buatkan caption sesuai isi konten
    if (sasaranBaru !== "story") {
      void buatCaptionOtomatis({
        file: f,
        jenisFile: jenisBaru,
        sasaranTarget: sasaranBaru,
        judulSaatIni: judulAwal,
        modeOtomatis: true,
      });
    }
  }

  async function buatCaptionOtomatis(opsi?: {
    file?: File | null;
    jenisFile?: "video" | "gambar";
    sasaranTarget?: SasaranTayang;
    judulSaatIni?: string;
    modeOtomatis?: boolean;
  }) {
    const tokenAnalisis = ++idAnalisisRef.current;
    const targetFile = opsi?.file ?? berkas;
    const targetJenis = opsi?.jenisFile ?? jenis;
    const targetSasaran = opsi?.sasaranTarget ?? sasaran;
    const targetJudul = opsi?.judulSaatIni ?? judul;

    setSedangBuatCaption(true);
    setGalat("");
    try {
      const tok = await tokenSegar();
      if (!tok) throw new Error("Sesi login tidak ditemukan — coba muat ulang halaman.");

      // Ambil hingga 5 bingkai ringan (maks 480px) agar AI bisa membaca awal–tengah–akhir konten
      let gambarBase64: { mimeType: string; data: string }[] | undefined;
      if (targetFile) {
        try {
          if (targetJenis === "video") {
            const hasilBingkai = await ekstrakBingkaiVideoManual(targetFile, 5);
            if (hasilBingkai.length > 0) gambarBase64 = hasilBingkai;
          } else {
            const url = URL.createObjectURL(targetFile);
            try {
              const img = new Image();
              img.src = url;
              await new Promise<void>((ok) => {
                img.onload = () => ok();
                img.onerror = () => ok();
              });
              if (img.naturalWidth > 0) {
                const rasio = Math.min(1, 480 / img.naturalWidth);
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(img.naturalWidth * rasio));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * rasio));
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const b64 = canvas.toDataURL("image/jpeg", 0.72).split(",")[1] ?? "";
                  if (b64) gambarBase64 = [{ mimeType: "image/jpeg", data: b64 }];
                }
              }
            } finally {
              URL.revokeObjectURL(url);
            }
          }
        } catch {
          // Lanjut pakai judul/konteks teks saja bila ekstraksi bingkai gagal
        }
      }

      if (idAnalisisRef.current !== tokenAnalisis) return;

      const res = await fetch("/api/studio/caption", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          merek,
          judul: targetJudul.trim() || (!apakahNamaFileAcak(targetFile?.name ?? "") ? targetFile?.name ?? "" : ""),
          konteks: opsi?.modeOtomatis ? undefined : caption.trim() || undefined,
          jenis: targetJenis,
          sasaran: targetSasaran,
          gambar: gambarBase64,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (idAnalisisRef.current !== tokenAnalisis) return;
      if (!res.ok || !j.ok || !j.caption) {
        throw new Error(j.pesan ?? "Gagal membuat caption otomatis.");
      }
      setCaption(String(j.caption));
      const judulSaran = String(j.judulSaran ?? "").trim();
      if (judulSaran && (!targetJudul.trim() || apakahNamaFileAcak(targetJudul))) {
        setJudul(judulSaran);
      }
      setInfoVisual({
        ringkas: String(j.ringkasVisual ?? "").trim(),
        penyedia: typeof j.penyedia === "string" ? j.penyedia : undefined,
        jumlahBingkai: Number(j.jumlahBingkai) || 0,
        pakaiVision: Boolean(j.pakaiVision),
        catatan: typeof j.catatan === "string" ? j.catatan : undefined,
      });
    } catch (e) {
      if (idAnalisisRef.current !== tokenAnalisis) return;
      const pesan = e instanceof Error ? e.message : "Gagal membuat caption otomatis.";
      if (opsi?.modeOtomatis) {
        setInfoVisual({ ringkas: "", jumlahBingkai: 0, pakaiVision: false, catatan: pesan });
      } else {
        setGalat(pesan);
      }
    } finally {
      if (idAnalisisRef.current === tokenAnalisis) {
        setSedangBuatCaption(false);
      }
    }
  }

  async function kirim(e: FormEvent) {
    e.preventDefault();
    if (!berkas) {
      setGalat("Pilih berkas video (.mp4 / .mov) atau foto (.jpg / .png) terlebih dahulu.");
      return;
    }
    if (modeTayang === "jadwal" && !waktuJadwal.trim()) {
      setGalat("Tentukan tanggal & jam tayang (WIB).");
      return;
    }

    setSibuk(true);
    setGalat("");
    try {
      const tok = await tokenSegar();
      if (!tok) throw new Error("Sesi login tidak ditemukan — coba muat ulang halaman.");

      // 1. Minta signed upload URL untuk media utama
      setProgres("Menyiapkan ruang unggah…");
      const izinRes = await fetch("/api/studio/unggah", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "izin-unggah", merek, namaBerkas: berkas.name }),
      });
      const izin = await izinRes.json().catch(() => ({}));
      if (!izin.ok || !izin.uploadUrl || !izin.publicUrl) {
        throw new Error(izin.pesan ?? "Gagal menyiapkan unggahan.");
      }

      // 2. Upload media utama langsung ke Supabase Storage
      setProgres(`Mengunggah ${jenis === "video" ? "video" : "foto"} (${(berkas.size / 1_048_576).toFixed(1)} MB)…`);
      const mimeUpload =
        jenis === "gambar"
          ? berkas.type === "image/png" || /\.png$/i.test(berkas.name)
            ? "image/png"
            : "image/jpeg"
          : "video/mp4";
      const upRes = await fetch(izin.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeUpload },
        body: berkas,
      });
      if (!upRes.ok) throw new Error(`Unggah media gagal (HTTP ${upRes.status}).`);

      // 3. Ekstrak & unggah sampul otomatis untuk video (tidak menggagalkan jika tidak didukung browser)
      let sampulUrl: string | null = null;
      let durasiAkhir = durasi;
      if (jenis === "video") {
        setProgres("Membuat sampul pratinjau…");
        const snap = await buatSampulVideo(berkas).catch(() => ({ blob: null, durasi }));
        if (snap.durasi > 0) durasiAkhir = snap.durasi;
        if (snap.blob) {
          const izinSampulRes = await fetch("/api/studio/unggah", {
            method: "POST",
            headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
            body: JSON.stringify({ aksi: "izin-unggah", merek, namaBerkas: "sampul.jpg" }),
          }).catch(() => null);
          const izinSampul = izinSampulRes ? await izinSampulRes.json().catch(() => ({})) : {};
          if (izinSampul.ok && izinSampul.uploadUrl && izinSampul.publicUrl) {
            const upSampul = await fetch(izinSampul.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": "image/jpeg" },
              body: snap.blob,
            }).catch(() => null);
            if (upSampul?.ok) sampulUrl = izinSampul.publicUrl;
          }
        }
      }

      // 4. Simpan tugas & jadwal tayang
      setProgres(modeTayang === "jadwal" ? "Menyimpan jadwal tayang…" : modeTayang === "sekarang" ? "Menyalakan mesin tayang…" : "Menyimpan draf…");
      const simpanRes = await fetch("/api/studio/unggah", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "buat",
          merek,
          judul: judul.trim() || berkas.name.replace(/\.[a-z0-9]+$/i, ""),
          url: izin.publicUrl,
          sampulUrl,
          jenis,
          durasi: jenis === "video" ? durasiAkhir : undefined,
          caption: sasaran === "story" ? "" : caption.trim(),
          sasaran,
          modeTayang,
          jadwal: modeTayang === "jadwal" ? waktuJadwal.trim() : null,
        }),
      });
      const hasil = await simpanRes.json().catch(() => ({}));
      if (!hasil.ok) throw new Error(hasil.pesan ?? "Gagal menyimpan jadwal konten.");

      // Bersihkan formulir
      pilihBerkas(null);
      setJudul("");
      setCaption("");
      setInfoVisual(null);
      selesai(hasil.pesan ?? "Konten manual berhasil diunggah!");
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal mengunggah konten.");
    } finally {
      setProgres("");
      setSibuk(false);
    }
  }

  const opsiSasaran =
    jenis === "video"
      ? [
          { kode: "reels" as SasaranTayang, label: "Reels Instagram", ket: "Feed + tab Reels" },
          { kode: "story" as SasaranTayang, label: "Story saja", ket: "24 jam di IG Story" },
          { kode: "reels+story" as SasaranTayang, label: "Reels + Story", ket: "Tayang di keduanya" },
        ]
      : DAFTAR_SASARAN_GAMBAR.map((s) => ({
          kode: s.kode,
          label: s.label.replace(" (bawaan)", ""),
          ket: s.kode === "story" ? "24 jam di IG Story" : s.kode === "feed" ? "Postingan Feed" : "Feed & Story",
        }));

  const perluCaption = sasaran !== "story";

  return (
    <form onSubmit={kirim} className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-lg">
            <Upload className="size-5 text-emas" /> Unggah Video / Foto Manual
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Unggah video hasil edit sendiri untuk tayang langsung atau dijadwalkan otomatis ke <b>Instagram Story</b> maupun <b>Reels</b>.
          </p>
        </div>
      </div>

      {/* Pilihan Merek */}
      {merekDaftar.length > 1 && (
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">Akun / Merek Tujuan</span>
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

      {/* Area Pilih Berkas & Pratinjau */}
      {!berkas ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emas/35 bg-emas/[0.03] px-4 py-8 text-center transition hover:border-emas hover:bg-emas/[0.07]">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emas/15 text-emas">
            <Film className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Pilih Video (.mp4 / .mov) atau Foto (.jpg / .png)</p>
            <p className="text-xs text-muted-foreground">Rasio vertikal 9:16 disarankan untuk Story & Reels · Maksimal 95 MB</p>
          </div>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              pilihBerkas(f);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-white/[0.02] p-3.5 sm:flex-row">
          <div className="relative mx-auto shrink-0 sm:mx-0">
            {jenis === "video" && pratinjauUrl ? (
              <video
                src={pratinjauUrl}
                controls
                playsInline
                className="h-52 w-32 rounded-xl bg-black object-cover"
              />
            ) : pratinjauUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pratinjauUrl} alt="Pratinjau" className="h-52 w-32 rounded-xl bg-black object-cover" />
            ) : null}
          </div>

          <div className="flex flex-1 flex-col justify-between gap-3 min-w-0">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emas/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emas-muda">
                    {jenis === "video" ? <Film className="size-3" /> : <ImageIcon className="size-3" />}
                    {jenis === "video" ? "Video" : "Foto"}
                    {durasi > 0 ? ` · ${durasi} dtk` : ""}
                    {` · ${(berkas.size / 1_048_576).toFixed(1)} MB`}
                  </span>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{berkas.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => pilihBerkas(null)}
                  disabled={sibuk}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-400 hover:border-red-400/50 hover:text-red-300"
                >
                  <X className="size-3.5" /> Ganti
                </button>
              </div>

              <label className="grid gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">Judul catatan (untuk Riwayat Studio)</span>
                <input
                  type="text"
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="Mis. Promo Sakura-ne Lek Sore"
                  className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
                />
              </label>
            </div>

            {/* Sasaran Tayang */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium text-muted-foreground">Tayang ke mana?</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {opsiSasaran.map((o) => {
                  const aktif = sasaran === o.kode;
                  return (
                    <button
                      key={o.kode}
                      type="button"
                      onClick={() => {
                        setSasaran(o.kode);
                        if (o.kode !== "story" && berkas && !caption.trim() && !sedangBuatCaption) {
                          void buatCaptionOtomatis({ file: berkas, jenisFile: jenis, sasaranTarget: o.kode, modeOtomatis: true });
                        }
                      }}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        aktif
                          ? "border-emas bg-emas/15 text-foreground"
                          : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/25"
                      }`}
                    >
                      <span className={`block text-xs font-semibold ${aktif ? "text-emas" : "text-foreground"}`}>
                        {o.label}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">{o.ket}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Caption (untuk Reels / Feed) */}
      {perluCaption && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Caption & Hashtag Instagram (standar konsisten merek)</span>
            <button
              type="button"
              onClick={() => void buatCaptionOtomatis()}
              disabled={sedangBuatCaption || sibuk}
              className="inline-flex items-center gap-1.5 rounded-full border border-emas/40 bg-emas/10 px-3 py-1 text-[11px] font-medium text-emas-muda transition hover:bg-emas/20 disabled:opacity-50"
            >
              {sedangBuatCaption ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              {sedangBuatCaption
                ? jenis === "video"
                  ? "Menonton isi video…"
                  : "Menganalisis foto…"
                : caption.trim()
                ? "Buat Ulang Caption dari Isi Video"
                : "Buat Caption & Hashtag Otomatis"}
            </button>
          </div>
          {sedangBuatCaption && (
            <p className="rounded-xl border border-sky-400/25 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-sky-200">
              {jenis === "video"
                ? "AI sedang menonton isi video (5 bingkai awal–tengah–akhir) & menyusun caption otomatis…"
                : "AI sedang melihat isi foto & menyusun caption otomatis…"}
            </p>
          )}
          {!sedangBuatCaption && infoVisual && (infoVisual.ringkas || infoVisual.catatan) && (
            <p
              className={`rounded-xl border px-3 py-2 text-[11px] ${
                infoVisual.pakaiVision
                  ? "border-emerald-400/25 bg-emerald-500/[0.06] text-emerald-200"
                  : "border-amber-400/25 bg-amber-500/[0.06] text-amber-200"
              }`}
            >
              {infoVisual.pakaiVision && infoVisual.ringkas ? (
                <>
                  <b>
                    Terbaca dari {jenis === "video" ? `video (${infoVisual.jumlahBingkai} bingkai` : "foto ("}
                    {infoVisual.penyedia ? ` · ${infoVisual.penyedia}` : ""}):
                  </b>{" "}
                  {infoVisual.ringkas}
                </>
              ) : (
                infoVisual.catatan
              )}
            </p>
          )}
          <textarea
            rows={5}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Pilih video agar caption langsung dibuat otomatis sesuai isinya, atau klik tombol 'Buat Caption & Hashtag Otomatis'…"
            className="rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* Pengaturan Waktu Tayang */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-white/[0.02] p-3.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <CalendarClock className="size-4 text-emas" /> Waktu Tayang
        </span>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { kode: "jadwal" as const, label: "Jadwalkan Otomatis", ket: "Pilih tanggal & jam WIB" },
            { kode: "sekarang" as const, label: "Tayangkan Sekarang", ket: "Langsung naik ke IG" },
            { kode: "draf" as const, label: "Simpan Draf Dulu", ket: "Atur jadwal nanti di Riwayat" },
          ].map((m) => {
            const aktif = modeTayang === m.kode;
            return (
              <button
                key={m.kode}
                type="button"
                onClick={() => setModeTayang(m.kode)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  aktif
                    ? "border-emerald-400/60 bg-emerald-500/15"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <span className={`block text-xs font-semibold ${aktif ? "text-emerald-300" : "text-foreground"}`}>
                  {m.label}
                </span>
                <span className="block text-[10px] text-muted-foreground">{m.ket}</span>
              </button>
            );
          })}
        </div>

        {modeTayang === "jadwal" && (
          <div className="space-y-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={waktuJadwal}
                onChange={(e) => setWaktuJadwal(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 font-mono text-xs sm:w-auto"
              />
              <span className="text-[11px] text-muted-foreground">Zona waktu WIB (UTC+7)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {daftarSlotCepatWIB().map((s) => (
                <button
                  key={s.kode}
                  type="button"
                  onClick={() => setWaktuJadwal(s.inputWib)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    waktuJadwal === s.inputWib
                      ? "border-emas bg-emas/15 text-emas"
                      : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {galat && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{galat}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={sibuk || !berkas}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
        >
          {sibuk ? (
            <Loader2 className="size-4 animate-spin" />
          ) : modeTayang === "sekarang" ? (
            <Send className="size-4" />
          ) : modeTayang === "jadwal" ? (
            <CalendarClock className="size-4" />
          ) : (
            <Check className="size-4" />
          )}
          {sibuk
            ? progres || "Memproses…"
            : modeTayang === "sekarang"
            ? "Unggah & Tayangkan Sekarang"
            : modeTayang === "jadwal"
            ? "Unggah & Jadwalkan Tayang"
            : "Unggah & Simpan Draf"}
        </button>

        {!sibuk && berkas && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-emas" />
            {DAFTAR_SASARAN_VIDEO.find((x) => x.kode === sasaran)?.label ??
              DAFTAR_SASARAN_GAMBAR.find((x) => x.kode === sasaran)?.label ??
              sasaran.toUpperCase()}
          </span>
        )}
      </div>
    </form>
  );
}
