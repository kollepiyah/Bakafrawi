"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Loader2, Music, RefreshCw, Trash2, Upload, User } from "lucide-react";

type AsetStudioItem = {
  id: string;
  kategori: "maskot" | "musik";
  karakter?: string;
  pose?: string;
  nama: string;
  url: string;
  jalur: string;
  ekstensi: string;
  dibuat: string;
};

const KARAKTER_CEPAT = [
  { slug: "ibu-hijab", label: "Wanita · ibu-hijab" },
  { slug: "bapak-kopiah", label: "Pria · bapak-kopiah" },
  { slug: "custom", label: "Karakter baru / custom…" },
];

const DAFTAR_POSE = [
  { kode: "", label: "Utama (Semua adegan bila video)" },
  { kode: "kaget", label: "kaget (Hook pembuka)" },
  { kode: "tunjuk", label: "tunjuk (Menunjuk layar)" },
  { kode: "hp", label: "hp (Pegang HP / Kasir)" },
  { kode: "jempol", label: "jempol (Setuju / Hasil)" },
  { kode: "lambai", label: "lambai (Penutup / Sapa)" },
];

export function PanelAsetStudio({
  tokenSegar,
  onAsetBerubah,
}: {
  tokenSegar: () => Promise<string>;
  onAsetBerubah?: () => void;
}) {
  const [daftar, setDaftar] = useState<AsetStudioItem[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");

  // Form maskot
  const [modeKarakter, setModeKarakter] = useState("ibu-hijab");
  const [karakterCustom, setKarakterCustom] = useState("");
  const [pose, setPose] = useState("");
  const [fileMaskot, setFileMaskot] = useState<File | null>(null);
  const [unggahMaskot, setUnggahMaskot] = useState(false);

  // Form musik
  const [namaMusik, setNamaMusik] = useState("");
  const [fileMusik, setFileMusik] = useState<File | null>(null);
  const [unggahMusik, setUnggahMusik] = useState(false);

  const muatDaftar = useCallback(async () => {
    setMemuat(true);
    const tok = await tokenSegar();
    if (!tok) {
      setMemuat(false);
      return;
    }
    const res = await fetch("/api/studio/aset", {
      headers: { Authorization: `Bearer ${tok}` },
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setMemuat(false);
    if (j.ok && Array.isArray(j.daftar)) {
      setDaftar(j.daftar as AsetStudioItem[]);
    }
  }, [tokenSegar]);

  useEffect(() => {
    const t = setTimeout(() => void muatDaftar(), 0);
    return () => clearTimeout(t);
  }, [muatDaftar]);

  async function unggahBerkas(kategori: "maskot" | "musik") {
    const file = kategori === "musik" ? fileMusik : fileMaskot;
    if (!file) return setGalat("Pilih berkas terlebih dahulu.");

    const karakterFinal =
      kategori === "maskot"
        ? (modeKarakter === "custom" ? karakterCustom : modeKarakter)
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/^-+|-+$/g, "")
        : "";
    if (kategori === "maskot" && !karakterFinal) {
      return setGalat("Isi nama karakter (mis. mbak-kasir atau pak-ustadz).");
    }

    setGalat("");
    setPesan("");
    if (kategori === "musik") setUnggahMusik(true);
    else setUnggahMaskot(true);

    try {
      const tok = await tokenSegar();
      const izinRes = await fetch("/api/studio/aset", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "izin-unggah",
          kategori,
          karakter: karakterFinal,
          namaBerkas: file.name,
        }),
      });
      const izin = await izinRes.json().catch(() => ({}));
      if (!izinRes.ok || !izin.ok || !izin.uploadUrl || !izin.publicUrl) {
        throw new Error(izin.pesan ?? "Gagal menyiapkan alamat unggah.");
      }

      const upRes = await fetch(izin.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!upRes.ok) {
        throw new Error(`Upload ke penyimpanan gagal (${upRes.status}).`);
      }

      const simpanRes = await fetch("/api/studio/aset", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "simpan",
          kategori,
          karakter: karakterFinal,
          pose: kategori === "maskot" ? pose : "",
          nama: (kategori === "musik" ? namaMusik.trim() : "") || file.name,
          url: izin.publicUrl,
          jalur: izin.jalur,
          ekstensi: izin.ekstensi,
        }),
      });
      const j = await simpanRes.json().catch(() => ({}));
      if (!simpanRes.ok || !j.ok) {
        throw new Error(j.pesan ?? "Gagal menyimpan data aset.");
      }
      setDaftar((j.daftar ?? []) as AsetStudioItem[]);
      setPesan(j.pesan ?? "Aset tersimpan.");
      if (kategori === "musik") {
        setFileMusik(null);
        setNamaMusik("");
      } else {
        setFileMaskot(null);
      }
      onAsetBerubah?.();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal mengunggah aset.");
    } finally {
      if (kategori === "musik") setUnggahMusik(false);
      else setUnggahMaskot(false);
    }
  }

  async function hapusItem(id: string) {
    setGalat("");
    setPesan("");
    const tok = await tokenSegar();
    const res = await fetch("/api/studio/aset", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "hapus", id }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && j.ok) {
      setDaftar((j.daftar ?? []) as AsetStudioItem[]);
      setPesan(j.pesan ?? "Aset dihapus.");
      onAsetBerubah?.();
    } else {
      setGalat(j.pesan ?? "Gagal menghapus aset.");
    }
  }

  const daftarMaskot = daftar.filter((d) => d.kategori === "maskot");
  const daftarMusik = daftar.filter((d) => d.kategori === "musik");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-lg">
              <FolderOpen className="size-5 text-emas" /> Pustaka Aset &amp; Karakter Studio
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Unggah foto/video karakter maskot Bakafrawi &amp; musik latar langsung di sini tanpa bolak-balik Google
              Drive. Semua aset otomatis ditarik mesin video GitHub Actions saat render berjalan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void muatDaftar()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground hover:border-emas hover:text-emas"
          >
            <RefreshCw className="size-3" /> Segarkan
          </button>
        </div>

        {pesan && <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{pesan}</p>}
        {galat && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{galat}</p>}
      </div>

      {/* Bagian 1: Karakter Maskot */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <User className="size-4 text-emas" />
          <h3 className="font-semibold text-sm">Karakter Maskot Video (PNG/JPG/WebM/MP4)</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Tips: foto pose atau video pendek berlatar hijau (green screen) akan dipotong latarnya otomatis oleh Remotion
          saat render. Gunakan nama berawalan <code className="text-foreground">ibu-</code> /{" "}
          <code className="text-foreground">mbak-</code> untuk otomatis dikenali sebagai karakter wanita.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Karakter</span>
            <select
              value={modeKarakter}
              onChange={(e) => setModeKarakter(e.target.value)}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
            >
              {KARAKTER_CEPAT.map((k) => (
                <option key={k.slug} value={k.slug} className="bg-card">
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          {modeKarakter === "custom" ? (
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Slug Karakter Baru</span>
              <input
                value={karakterCustom}
                onChange={(e) => setKarakterCustom(e.target.value)}
                placeholder="mis. mbak-kasir"
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
              />
            </label>
          ) : (
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Pose Adegan</span>
              <select
                value={pose}
                onChange={(e) => setPose(e.target.value)}
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
              >
                {DAFTAR_POSE.map((p) => (
                  <option key={p.kode} value={p.kode} className="bg-card">
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {modeKarakter === "custom" && (
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Pose Adegan</span>
              <select
                value={pose}
                onChange={(e) => setPose(e.target.value)}
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
              >
                {DAFTAR_POSE.map((p) => (
                  <option key={p.kode} value={p.kode} className="bg-card">
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Berkas Maskot</span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.webm,.mp4,.mov"
              onChange={(e) => setFileMaskot(e.target.files?.[0] ?? null)}
              className="text-xs file:mr-2 file:rounded-lg file:border file:border-white/15 file:bg-white/5 file:px-3 file:py-1.5 file:text-xs file:text-foreground"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => void unggahBerkas("maskot")}
          disabled={unggahMaskot || !fileMaskot}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {unggahMaskot ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Unggah Maskot
        </button>

        {memuat ? (
          <p className="text-xs text-muted-foreground">Memuat daftar maskot…</p>
        ) : daftarMaskot.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            Belum ada karakter yang diunggah dari web (mesin saat ini memakai aset maskot di Google Drive).
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {daftarMaskot.map((item) => {
              const adalahVideo = /\.(mp4|mov|webm)$/i.test(item.ekstensi);
              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-border/80 bg-white/[0.02] p-3 text-xs"
                >
                  <div className="overflow-hidden rounded-lg bg-black/40">
                    {adalahVideo ? (
                      <video src={item.url} muted playsInline controls className="h-32 w-full object-contain" />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={item.url} alt={item.nama} className="h-32 w-full object-contain" />
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{item.karakter}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {item.pose ? `Pose: ${item.pose}` : "Utama / Polos"} · {item.nama}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void hapusItem(item.id)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-400"
                      title="Hapus aset"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Bagian 2: Musik Latar */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Music className="size-4 text-emas" />
          <h3 className="font-semibold text-sm">Musik Latar Video (MP3 / M4A / WAV)</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Nama Musik (opsional)</span>
            <input
              value={namaMusik}
              onChange={(e) => setNamaMusik(e.target.value)}
              placeholder="mis. Lo-Fi Santai Pagi"
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Berkas Audio</span>
            <input
              type="file"
              accept=".mp3,.m4a,.wav,.ogg,.aac"
              onChange={(e) => setFileMusik(e.target.files?.[0] ?? null)}
              className="text-xs file:mr-2 file:rounded-lg file:border file:border-white/15 file:bg-white/5 file:px-3 file:py-1.5 file:text-xs file:text-foreground"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => void unggahBerkas("musik")}
          disabled={unggahMusik || !fileMusik}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {unggahMusik ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Unggah Musik
        </button>

        {daftarMusik.length > 0 && (
          <div className="space-y-2">
            {daftarMusik.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-white/[0.02] px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{m.nama}</p>
                </div>
                <audio src={m.url} controls className="h-8 w-full max-w-xs" />
                <button
                  type="button"
                  onClick={() => void hapusItem(m.id)}
                  className="rounded p-1 text-muted-foreground hover:text-red-400"
                  title="Hapus musik"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
