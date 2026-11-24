"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Eye,
  Heart,
  ImageIcon,
  Loader2,
  MessageCircle,
  Play,
  RefreshCw,
  Sparkles,
  Video,
  Wallet,
  Workflow,
  XCircle,
} from "lucide-react";
import type { KesimpulanWorkflow, RunWorkflow } from "@/lib/deck-server";
import type { HasilTugas, RingkasBiaya, RingkasTugas } from "@/lib/studio-server";
import type { RingkasInsight } from "@/lib/instagram-insight";
import { apiAdmin } from "./agenda";

type DeckResponse = {
  ok: boolean;
  workflows: RunWorkflow[];
  tugas: RingkasTugas[];
  insight?: RingkasInsight;
  biaya?: RingkasBiaya | null;
  pesan?: string;
};

const KURS_IDR = 16_300;
const angka = (n: number) => new Intl.NumberFormat("id-ID", { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
const rupiah = (usd: number) => `Rp${Math.round(usd * KURS_IDR).toLocaleString("id-ID")}`;

/** Miniatur konten: gambar sampul/poster, atau bingkai awal video bila tak ada sampul. */
function Miniatur({ gambar, video, adalahVideo, besar = false }: { gambar?: string | null; video?: string | null; adalahVideo: boolean; besar?: boolean }) {
  const ukuran = besar ? "h-20 w-[3.4rem]" : "h-12 w-9";
  return (
    <div className={`relative ${ukuran} shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5`}>
      {gambar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={gambar} alt="" loading="lazy" className="size-full object-cover" />
      ) : video ? (
        <video src={`${video}#t=0.8`} preload="metadata" muted playsInline className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          {adalahVideo ? <Video className="size-4 text-sky-400" /> : <ImageIcon className="size-4 text-amber-400" />}
        </div>
      )}
      {adalahVideo && (gambar || video) && (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 p-0.5"><Play className="size-2.5 fill-white text-white" /></span>
      )}
    </div>
  );
}

const miniaturTugas = (hasil?: HasilTugas[]) => ({
  gambar: hasil?.find((h) => h.rasio === "sampul")?.url ?? hasil?.find((h) => h.jenis === "gambar")?.url ?? null,
  video: hasil?.find((h) => h.jenis === "video")?.url ?? null,
});

function formatDurasi(detik: number | null) {
  if (detik == null) return "-";
  if (detik < 60) return `${detik}s`;
  const m = Math.floor(detik / 60);
  const s = detik % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function waktuRelatif(iso: string) {
  const dtk = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (dtk < 60) return `${dtk}s lalu`;
  const mnt = Math.floor(dtk / 60);
  if (mnt < 60) return `${mnt}m lalu`;
  const jam = Math.floor(mnt / 60);
  if (jam < 24) return `${jam}j lalu`;
  const hari = Math.floor(jam / 24);
  return `${hari}h lalu`;
}

export function Deck({ sesi, bukaStudio }: { sesi: Session | null; bukaStudio?: () => void }) {
  const [data, setData] = useState<{
    workflows: RunWorkflow[];
    tugas: RingkasTugas[];
    insight?: RingkasInsight;
    biaya?: RingkasBiaya | null;
  } | null>(null);
  const [galat, setGalat] = useState("");
  const [sedangMuat, setSedangMuat] = useState(false);
  const [tampilSemuaRun, setTampilSemuaRun] = useState(false);
  const [tabAktif, setTabAktif] = useState<"mesin" | "insight">("mesin");

  const muat = useCallback(async (segar = false) => {
    setSedangMuat(true);
    setGalat("");
    try {
      const j = (await apiAdmin(sesi)(segar ? "/api/deck?segar=1" : "/api/deck")) as DeckResponse;
      if (!j.ok) {
        setGalat(j.pesan ?? "Gagal memuat status Studio.");
        setSedangMuat(false);
        return;
      }
      setData({
        workflows: j.workflows ?? [],
        tugas: j.tugas ?? [],
        insight: j.insight,
        biaya: j.biaya ?? null,
      });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal memuat.");
    }
    setSedangMuat(false);
  }, [sesi]);

  useEffect(() => {
    const t = setTimeout(() => { void muat(false); }, 0);
    return () => clearTimeout(t);
  }, [muat]);

  // Tidak lagi auto-polling tiap 30 detik agar hemat kuota & aman dari pembatasan otomatis Meta/GitHub API.

  if (!data && !galat) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-emas" /> Memeriksa status Studio & Insight…
      </div>
    );
  }

  if (galat) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
        <span>{galat}</span>
        <button onClick={() => void muat(true)} className="underline hover:text-white">Coba lagi</button>
      </div>
    );
  }

  const workflows = data?.workflows ?? [];
  const tugas = data?.tugas ?? [];
  const insight = data?.insight;
  const biaya = data?.biaya;

  const runSedangJalan = workflows.find((w) => w.status === "in_progress" || w.status === "queued");
  const runTerakhir = workflows[0];
  const suksesTotal = workflows.filter((w) => w.kesimpulan === "success").length;
  const gagalTotal = workflows.filter((w) => w.kesimpulan === "failure" || w.kesimpulan === "timed_out").length;

  const workflowsDitampilkan = tampilSemuaRun ? workflows : workflows.slice(0, 3);
  const tugasDitampilkan = tugas.slice(0, 4);

  return (
    <div className="min-w-0 space-y-4">
      {/* ── Ringkasan cepat: tayangan & biaya AI bulan ini ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-border/80 bg-white/[0.02] p-3">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Eye className="size-3 shrink-0 text-sky-400" /> Total tayangan</p>
          <p className="mt-1 font-heading text-xl font-bold text-foreground">{angka(insight?.totalViews ?? 0)}</p>
          <p className="text-[10px] text-zinc-500">{insight?.totalTayang ?? 0} postingan terakhir</p>
        </div>
        <div className="min-w-0 rounded-xl border border-border/80 bg-white/[0.02] p-3">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Heart className="size-3 shrink-0 text-red-400" /> Suka · Komentar</p>
          <p className="mt-1 font-heading text-xl font-bold text-foreground">{angka(insight?.totalLikes ?? 0)} <span className="text-sm text-muted-foreground">· {angka(insight?.totalComments ?? 0)}</span></p>
          <p className="text-[10px] text-zinc-500">dari Instagram</p>
        </div>
        <div className="col-span-2 min-w-0 rounded-xl border border-emas/25 bg-emas/[0.04] p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Wallet className="size-3 text-emas" /> Pengeluaran Token & Biaya AI</p>
              <p className="mt-1 font-heading text-xl font-bold text-foreground">
                {biaya ? rupiah(biaya.usd) : "-"} <span className="text-xs font-normal text-muted-foreground">{biaya ? `≈ $${biaya.usd.toFixed(3)}` : ""}</span>
              </p>
              <p className="text-[10px] text-zinc-500">
                {biaya ? `${angka(biaya.input)} token masuk · ${angka(biaya.output)} token keluar · ${biaya.tugas} konten${biaya.kurasi ? ` · ${biaya.kurasi} kurasi` : ""}` : "Belum ada catatan biaya."}
              </p>
            </div>
            {biaya && biaya.perPenyedia.length > 0 && (
              <div className="space-y-0.5 text-right text-[10px]">
                {biaya.perPenyedia.map((p) => (
                  <p key={p.penyedia} className="text-muted-foreground">
                    <span className="capitalize text-foreground">{p.penyedia}</span> · {p.panggilan}× · {rupiah(p.usd)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ── Status Mesin & Navigasi Tab ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTabAktif("mesin")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              tabAktif === "mesin"
                ? "bg-white/10 text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            <Sparkles className="size-3.5 text-emas" /> Tugas & Mesin
          </button>
          <button
            type="button"
            onClick={() => setTabAktif("insight")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              tabAktif === "insight"
                ? "bg-white/10 text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            <BarChart3 className="size-3.5 text-sky-400" /> Insight Instagram
            {insight && insight.totalTayang > 0 && (
              <span className="rounded-full bg-sky-500/20 px-1.5 py-0.2 text-[10px] text-sky-300">
                {insight.totalTayang}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {tabAktif === "mesin" && (
            <>
              {runSedangJalan ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                  <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Mesin aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Mesin Siap
                </span>
              )}
            </>
          )}

          {tabAktif === "insight" && insight?.akun && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">
              {insight.akun}
            </span>
          )}

          <button
            onClick={() => void muat(tabAktif === "insight")}
            disabled={sedangMuat}
            title={tabAktif === "insight" ? "Tarik data terbaru dari Instagram (maks 1× per 15 menit)" : "Segarkan status mesin & tugas (tanpa memanggil API Instagram)"}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-emas hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${sedangMuat ? "animate-spin" : ""}`} />
            <span>{tabAktif === "insight" ? "Tarik dari IG" : "Segarkan"}</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: TUGAS & MESIN WORKFLOW ── */}
      {tabAktif === "mesin" && (
        <div className="space-y-4">
          {/* Tugas Konten Studio Terakhir */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Sparkles className="size-3.5 text-emas" /> Tugas Konten Studio
              </p>
              {bukaStudio && (
                <button
                  onClick={bukaStudio}
                  className="text-xs text-muted-foreground transition hover:text-emas hover:underline"
                >
                  Buka Studio →
                </button>
              )}
            </div>

            {tugas.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 py-4 text-center text-xs text-muted-foreground">
                Belum ada tugas konten. Buat konten di tab Studio.
              </p>
            ) : (
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                {tugasDitampilkan.map((t) => {
                  const adalahVideo = t.jenis === "video";
                  const mini = miniaturTugas(t.hasil);
                  return (
                    <div
                      key={t.id}
                      onClick={bukaStudio}
                      className="group flex min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-xl border border-border/70 bg-white/[0.02] p-3 transition hover:border-emas/50 hover:bg-white/[0.04]"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Miniatur gambar={mini.gambar} video={mini.video} adalahVideo={adalahVideo} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground group-hover:text-emas">
                            {t.judul || t.produk_slug}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {t.merek && t.merek !== "bakafrawi" ? `${t.merek} · ` : ""}
                            {adalahVideo ? "Video Reels" : "Poster promosi"}
                            {t.dibuat ? ` · ${waktuRelatif(t.dibuat)}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            t.status === "selesai"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : t.status === "proses"
                              ? "bg-amber-500/15 text-amber-300"
                              : t.status === "gagal"
                              ? "bg-red-500/15 text-red-300"
                              : "bg-white/10 text-muted-foreground"
                          }`}
                        >
                          {t.status === "selesai" ? "Selesai" : t.status === "proses" ? "Diproses" : t.status}
                        </span>

                        {t.status_tayang && t.status_tayang !== "belum" && (
                          <span className="text-[10px] text-muted-foreground">
                            {t.status_tayang === "tayang"
                              ? "Tayang IG"
                              : t.status_tayang === "dijadwalkan"
                              ? "Terjadwal"
                              : t.status_tayang === "antre"
                              ? "Siap tayang"
                              : t.status_tayang}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Riwayat Eksekusi GitHub Actions */}
          {workflows.length > 0 && (
            <div className="pt-1">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Workflow className="size-3.5 text-muted-foreground" /> Eksekusi Mesin ({suksesTotal} sukses, {gagalTotal} gagal)
                </p>
                {workflows.length > 3 && (
                  <button
                    onClick={() => setTampilSemuaRun((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {tampilSemuaRun ? (
                      <>Ringkas <ChevronUp className="size-3" /></>
                    ) : (
                      <>+{workflows.length - 3} lainnya <ChevronDown className="size-3" /></>
                    )}
                  </button>
                )}
              </div>

              <div className="divide-y divide-border/40 rounded-xl border border-border/70 bg-white/[0.01]">
                {workflowsDitampilkan.map((w) => {
                  const sukses = w.kesimpulan === "success";
                  const gagal = w.kesimpulan === "failure" || w.kesimpulan === "timed_out";
                  const sedangJalan = w.status === "in_progress" || w.status === "queued";

                  return (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {sedangJalan ? (
                          <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-400" />
                        ) : sukses ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                        ) : gagal ? (
                          <XCircle className="size-3.5 shrink-0 text-red-400" />
                        ) : (
                          <Clock className="size-3.5 shrink-0 text-zinc-500" />
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-medium text-foreground">
                              #{w.id.toString().slice(-4)}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="truncate text-muted-foreground">{w.pemicu}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                        <span className="font-mono text-[11px]">
                          {formatDurasi(w.durasi)}
                        </span>
                        <span className="text-[11px]">
                          {waktuRelatif(w.selesai ?? w.mulai)}
                        </span>
                        <a
                          href={w.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Lihat log di GitHub Actions"
                          className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-emas"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: INSIGHT KONTEN INSTAGRAM ── */}
      {tabAktif === "insight" && (
        <div className="space-y-4">
          {/* Ringkasan metrik ada di kartu atas; tab ini fokus per postingan. */}
          {/* Daftar Postingan Tayang */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Postingan Terbaru di Instagram
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {insight?.diambilPada && (
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px]">
                    {insight.dariCache ? "Cache aman" : "Baru ditarik"} · {waktuRelatif(insight.diambilPada)}
                  </span>
                )}
                {insight?.akun && (
                  <span>
                    Akun: <b className="text-foreground">{insight.akun}</b>
                  </span>
                )}
              </div>
            </div>

            {insight?.galatInsight && (
              <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200 break-words">
                <b className="text-amber-300">Info tayangan Instagram:</b> {insight.galatInsight}
                <span className="block mt-1 text-amber-200/80">
                  Pastikan token Instagram di Studio → Sambungan memiliki izin <code>instagram_business_manage_insights</code> / <code>instagram_manage_insights</code>.
                </span>
              </div>
            )}

            {!insight || insight.posts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground space-y-2">
                <p>{insight?.pesan ?? "Belum ada konten yang dipublikasikan ke Instagram."}</p>
                {bukaStudio && (
                  <button
                    onClick={bukaStudio}
                    className="inline-flex items-center gap-1 text-emas hover:underline"
                  >
                    Buat dan jadwalkan konten di Studio →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {insight.posts.map((p) => {
                  const adalahVideo = p.jenis === "video";
                  const adalahStory = p.format === "story";
                  const labelFormat = adalahStory ? "Story" : p.format === "feed" ? "Feed" : "Reels";
                  const namaProdukLabel =
                    p.produk === "rutin-buka"
                      ? "Story Jam Buka"
                      : p.produk === "unggah-manual"
                      ? "Unggah Manual"
                      : p.produk === p.merek
                      ? adalahStory
                        ? "Story IG"
                        : adalahVideo
                        ? "Video"
                        : "Postingan"
                      : p.produk;
                  return (
                    <div
                      key={p.id}
                      className="flex min-w-0 flex-col justify-between gap-3 overflow-hidden rounded-xl border border-border/70 bg-white/[0.02] p-3 transition hover:border-border hover:bg-white/[0.03] sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Miniatur gambar={p.thumbnail} video={p.videoUrl} adalahVideo={adalahVideo} besar />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                adalahStory
                                  ? "bg-fuchsia-500/20 text-fuchsia-300"
                                  : p.format === "feed"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-sky-500/15 text-sky-300"
                              }`}
                            >
                              {labelFormat}
                            </span>
                            <p className="text-xs font-semibold text-foreground truncate">
                              {p.merek && p.merek !== "bakafrawi" ? `${p.merek} · ` : ""}
                              {namaProdukLabel}
                            </p>
                            {adalahStory && p.arsipStory && (
                              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
                                Arsip &gt;24 jam
                              </span>
                            )}
                          </div>
                          <p className="max-w-full truncate text-[11px] text-muted-foreground">
                            {p.caption ? p.caption.slice(0, 60) + (p.caption.length > 60 ? "…" : "") : adalahStory ? "Story Instagram" : "Tanpa caption"}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] ${adalahStory ? "bg-fuchsia-500/10 text-fuchsia-300" : "bg-sky-500/10 text-sky-300"}`}>
                              <Eye className="size-3" />{" "}
                              {p.views != null
                                ? `${angka(p.views)} ${adalahStory ? "penonton" : "kali ditonton"}`
                                : adalahStory && p.arsipStory
                                ? "kedaluwarsa >24 jam (belum sempat tersimpan)"
                                : "penonton belum tersedia"}
                            </p>
                            {adalahStory && p.reach != null && p.reach !== p.views && (
                              <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                                {angka(p.reach)} akun unik
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/30 text-xs">
                        <div className="flex items-center gap-3 text-muted-foreground">
                          {!adalahStory ? (
                            <>
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-red-300">
                                <Heart className="size-3 text-red-400 fill-red-400/20" /> {p.likes}
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-300">
                                <MessageCircle className="size-3 text-sky-400" /> {p.comments}
                              </span>
                            </>
                          ) : (
                            p.replies != null && (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-fuchsia-300" title="Balasan Story">
                                <MessageCircle className="size-3 text-fuchsia-400" /> {p.replies} balas
                              </span>
                            )
                          )}
                          {p.reach != null && !adalahStory && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400" title="Jangkauan (akun unik)">
                              <BarChart3 className="size-3" /> {angka(p.reach)}
                            </span>
                          )}
                          <span className="text-[11px] text-zinc-500">
                            {waktuRelatif(p.tayangWaktu ?? p.dibuat)}
                          </span>
                        </div>

                        {p.permalink && (
                          <a
                            href={p.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-muted-foreground hover:border-emas hover:text-emas"
                          >
                            <span>Buka di IG</span>
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
