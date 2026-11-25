"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ImageIcon, Send, Trash2, Video } from "lucide-react";
import {
  bangunGridBulan,
  bulanSekarangWib,
  kelompokkanTugasKalender,
  NAMA_BULAN_INDONESIA,
  NAMA_HARI_KALENDER,
  statusVisualTugas,
  tanggalKunciWib,
  type StatusVisualKalender,
} from "@/lib/kalender-studio-murni";

export type ItemTugasKalender = {
  id: string;
  merek: string;
  dibuat: string;
  jenis: "gambar" | "video";
  produk_slug: string;
  arahan: string;
  status: "naskah" | "antre" | "proses" | "selesai" | "gagal";
  caption: string | null;
  hasil: { jenis: "gambar" | "video"; rasio: string; url: string; durasi?: number }[];
  naskah: ({ judul?: string } & Record<string, unknown>) | null;
  status_tayang: "belum" | "antre" | "dijadwalkan" | "proses" | "tayang" | "gagal" | "ditolak";
  jadwal_tayang: string | null;
  tayang?: { waktu?: string; sasaran?: string; rutin?: boolean } | null;
};

const WARNA_STATUS: Record<StatusVisualKalender, { titik: string; pil: string; label: string }> = {
  tayang: { titik: "bg-emerald-400", pil: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300", label: "Tayang" },
  terjadwal: { titik: "bg-sky-400", pil: "border-sky-500/35 bg-sky-500/15 text-sky-300", label: "Terjadwal" },
  cek: { titik: "bg-amber-400", pil: "border-amber-500/35 bg-amber-500/15 text-amber-300", label: "Perlu Cek" },
  proses: { titik: "bg-zinc-300 animate-pulse", pil: "border-white/20 bg-white/10 text-zinc-200", label: "Proses" },
  gagal: { titik: "bg-red-400", pil: "border-red-500/35 bg-red-500/15 text-red-300", label: "Gagal" },
};

export function KalenderStudio({
  daftar,
  namaMerek,
  namaProduk,
  onTayangSekarang,
  onHapus,
  onPilihDetail,
}: {
  daftar: ItemTugasKalender[];
  namaMerek: (slug: string) => string;
  namaProduk: (slug: string) => string;
  onTayangSekarang: (id: string) => void;
  onHapus: (id: string) => void;
  onPilihDetail: (id: string) => void;
}) {
  const awal = bulanSekarangWib();
  const [bulanAktif, setBulanAktif] = useState<{ tahun: number; bulan: number }>(awal);
  const [tanggalDipilih, setTanggalDipilih] = useState<string>(() => tanggalKunciWib(new Date()));

  const grid = bangunGridBulan(bulanAktif.tahun, bulanAktif.bulan);
  const peta = kelompokkanTugasKalender(daftar);
  const itemTanggal = peta[tanggalDipilih] ?? [];

  function geserBulan(delta: number) {
    const totalBulan = bulanAktif.tahun * 12 + (bulanAktif.bulan - 1) + delta;
    const tahun = Math.floor(totalBulan / 12);
    const bulan = (totalBulan % 12) + 1;
    setBulanAktif({ tahun, bulan });
    setTanggalDipilih(`${tahun}-${String(bulan).padStart(2, "0")}-01`);
  }

  function keHariIni() {
    const sekarang = new Date();
    setBulanAktif(bulanSekarangWib(sekarang));
    setTanggalDipilih(tanggalKunciWib(sekarang));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
      {/* Kiri: Grid Kalender Bulanan */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-emas" />
            <h3 className="font-heading text-base font-semibold">
              {NAMA_BULAN_INDONESIA[bulanAktif.bulan - 1]} {bulanAktif.tahun}
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => geserBulan(-1)}
              className="rounded-lg border border-white/10 p-1.5 text-muted-foreground hover:border-emas hover:text-emas"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={keHariIni}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-muted-foreground hover:border-emas hover:text-emas"
            >
              Hari ini
            </button>
            <button
              type="button"
              onClick={() => geserBulan(1)}
              className="rounded-lg border border-white/10 p-1.5 text-muted-foreground hover:border-emas hover:text-emas"
              title="Bulan berikutnya"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Legenda */}
        <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {(Object.keys(WARNA_STATUS) as StatusVisualKalender[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${WARNA_STATUS[k].titik}`} />
              {WARNA_STATUS[k].label}
            </span>
          ))}
        </div>

        {/* Header Hari */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
          {NAMA_HARI_KALENDER.map((h) => (
            <div key={h} className="py-1.5">
              {h}
            </div>
          ))}
        </div>

        {/* Sel Tanggal */}
        <div className="grid grid-cols-7 gap-1">
          {grid.map((sel) => {
            const isi = peta[sel.tanggal] ?? [];
            const dipilih = sel.tanggal === tanggalDipilih;
            return (
              <button
                key={sel.tanggal}
                type="button"
                onClick={() => setTanggalDipilih(sel.tanggal)}
                className={`flex min-h-[68px] flex-col items-start justify-between rounded-xl border p-1.5 text-left transition sm:min-h-[82px] sm:p-2 ${
                  dipilih
                    ? "border-emas bg-emas/10"
                    : sel.hariIni
                    ? "border-sky-500/45 bg-sky-500/[0.06]"
                    : sel.dalamBulan
                    ? "border-border/70 bg-white/[0.02] hover:border-white/25"
                    : "border-transparent bg-transparent opacity-45 hover:opacity-75"
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span
                    className={`text-xs font-medium ${
                      sel.hariIni ? "text-sky-300" : sel.dalamBulan ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {sel.hari}
                  </span>
                  {isi.length > 0 && (
                    <span className="rounded bg-white/10 px-1 text-[10px] font-semibold text-foreground">
                      {isi.length}
                    </span>
                  )}
                </div>

                {isi.length > 0 && (
                  <div className="flex w-full flex-col gap-0.5 pt-1">
                    <div className="flex flex-wrap gap-1 sm:hidden">
                      {isi.slice(0, 4).map((t) => (
                        <span
                          key={t.id}
                          className={`size-1.5 rounded-full ${WARNA_STATUS[statusVisualTugas(t)].titik}`}
                        />
                      ))}
                    </div>
                    <div className="hidden w-full flex-col gap-0.5 sm:flex">
                      {isi.slice(0, 2).map((t) => {
                        const st = statusVisualTugas(t);
                        const label = String(t.naskah?.judul || namaProduk(t.produk_slug)).slice(0, 18);
                        return (
                          <div
                            key={t.id}
                            className={`truncate rounded border px-1 py-0.5 text-[10px] leading-tight ${WARNA_STATUS[st].pil}`}
                          >
                            {label}
                          </div>
                        );
                      })}
                      {isi.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{isi.length - 2} lagi</span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Kanan: Detail Konten di Tanggal Terpilih */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Konten Tanggal (WIB)</p>
            <h4 className="font-heading text-base font-semibold text-foreground">{tanggalDipilih}</h4>
          </div>
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-muted-foreground">
            {itemTanggal.length} item
          </span>
        </div>

        {itemTanggal.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
            Tidak ada jadwal atau konten pada tanggal ini.
          </div>
        ) : (
          <div className="space-y-3">
            {itemTanggal.map((t) => {
              const st = statusVisualTugas(t);
              const metaSt = WARNA_STATUS[st];
              const pratinjau = t.hasil.find((h) => h.jenis === "gambar")?.url ?? t.hasil[0]?.url;
              const jam = new Date(t.jadwal_tayang ?? t.dibuat).toLocaleTimeString("id-ID", {
                timeZone: "Asia/Jakarta",
                hour: "2-digit",
                minute: "2-digit",
              });
              const bisaTayang = t.status === "selesai" && ["belum", "gagal", "ditolak"].includes(t.status_tayang);
              return (
                <div key={t.id} className="space-y-2 rounded-xl border border-border/80 bg-white/[0.02] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {t.jenis === "video" ? (
                          <Video className="size-3.5 shrink-0 text-emas" />
                        ) : (
                          <ImageIcon className="size-3.5 shrink-0 text-emas" />
                        )}
                        <span className="truncate font-medium text-foreground">
                          {namaMerek(t.merek)}
                          {namaProduk(t.produk_slug)}
                        </span>
                        <span>· {jam} WIB</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
                        {String(t.naskah?.judul || t.arahan || "Konten Studio")}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${metaSt.pil}`}>
                      {metaSt.label}
                    </span>
                  </div>

                  {pratinjau && (
                    <div className="overflow-hidden rounded-lg border border-border/60 bg-black/40">
                      {t.hasil[0]?.jenis === "video" && t.hasil.every((h) => h.jenis === "video") ? (
                        <video src={pratinjau} controls playsInline className="max-h-40 w-full object-contain" />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={pratinjau} alt="Pratinjau konten" className="max-h-40 w-full object-contain" />
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => onPilihDetail(t.id)}
                      className="rounded-lg border border-white/15 px-2.5 py-1 text-foreground hover:border-emas hover:text-emas"
                    >
                      Buka Detail
                    </button>
                    {bisaTayang && (
                      <button
                        type="button"
                        onClick={() => onTayangSekarang(t.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emas px-2.5 py-1 font-medium text-background hover:opacity-90"
                      >
                        <Send className="size-3" /> Tayangkan
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onHapus(t.id)}
                      className="ml-auto rounded-lg border border-white/10 p-1 text-muted-foreground hover:border-red-400/50 hover:text-red-300"
                      title="Hapus konten"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
