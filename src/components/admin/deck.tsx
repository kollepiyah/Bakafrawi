"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2, RefreshCw } from "lucide-react";
import type { KesimpulanWorkflow, RunWorkflow, StatusWorkflow } from "@/lib/deck-server";
import type { RingkasTugas } from "@/lib/studio-server";
import { apiAdmin } from "./agenda";

// ───────────────────────────────────────── konfigurasi warna & ikon

type StatusTile = "sukses" | "jalan" | "gagal" | "antre" | "lewat" | "idle";

function statusDariWorkflow(s: StatusWorkflow, k: KesimpulanWorkflow): StatusTile {
  if (s === "in_progress") return "jalan";
  if (s === "queued") return "antre";
  if (k === "success") return "sukses";
  if (k === "failure" || k === "timed_out") return "gagal";
  if (k === "cancelled") return "lewat";
  if (k === "skipped") return "lewat";
  return "idle";
}

function statusDariTugas(s: string): StatusTile {
  if (s === "selesai") return "sukses";
  if (s === "proses" || s === "antre") return "jalan";
  if (s === "gagal") return "gagal";
  return "idle";
}

const WARNA: Record<StatusTile, { bg: string; border: string; dot: string; teks: string }> = {
  sukses:  { bg: "bg-emerald-500/8",  border: "border-emerald-500/25", dot: "bg-emerald-400", teks: "text-emerald-300" },
  jalan:   { bg: "bg-amber-500/8",    border: "border-amber-500/25",   dot: "bg-amber-400",   teks: "text-amber-300" },
  gagal:   { bg: "bg-red-500/8",      border: "border-red-500/25",     dot: "bg-red-400",     teks: "text-red-300" },
  antre:   { bg: "bg-blue-500/8",     border: "border-blue-500/25",    dot: "bg-blue-400",    teks: "text-blue-300" },
  lewat:   { bg: "bg-zinc-500/8",     border: "border-zinc-500/25",    dot: "bg-zinc-500",    teks: "text-zinc-400" },
  idle:    { bg: "bg-zinc-500/5",     border: "border-zinc-500/15",    dot: "bg-zinc-600",    teks: "text-zinc-500" },
};

const LABEL: Record<StatusTile, string> = {
  sukses: "done",
  jalan: "running",
  gagal: "failed",
  antre: "queued",
  lewat: "skipped",
  idle: "idle",
};

// ───────────────────────────────────────── pixel robot SVG

/** Robot pixel-art kecil (20×20) yang warnanya berubah sesuai status. */
function RobotPixel({ status }: { status: StatusTile }) {
  const w = WARNA[status];
  // Warna fill utama bergantung status
  const fills: Record<StatusTile, string> = {
    sukses: "#34d399",
    jalan: "#fbbf24",
    gagal: "#f87171",
    antre: "#60a5fa",
    lewat: "#71717a",
    idle: "#52525b",
  };
  const c = fills[status];
  return (
    <svg viewBox="0 0 20 20" className="size-10 drop-shadow-sm" aria-hidden>
      {/* antena */}
      <rect x="9" y="0" width="2" height="3" fill={c} opacity={0.6} />
      <rect x="8" y="0" width="4" height="1" fill={c} opacity={0.6} />
      {/* kepala */}
      <rect x="4" y="3" width="12" height="8" rx="1" fill={c} />
      {/* mata */}
      <rect x="6" y="5" width="3" height="3" rx="0.5" fill="#0c0e12" />
      <rect x="11" y="5" width="3" height="3" rx="0.5" fill="#0c0e12" />
      {/* pupil */}
      <rect x="7" y="6" width="1" height="1" fill={status === "jalan" ? "#fff" : "#e9eaee"} className={status === "jalan" ? "animate-pulse" : ""} />
      <rect x="12" y="6" width="1" height="1" fill={status === "jalan" ? "#fff" : "#e9eaee"} className={status === "jalan" ? "animate-pulse" : ""} />
      {/* badan */}
      <rect x="5" y="12" width="10" height="6" rx="1" fill={c} opacity={0.75} />
      {/* tangan */}
      <rect x="2" y="13" width="3" height="4" rx="0.5" fill={c} opacity={0.5} />
      <rect x="15" y="13" width="3" height="4" rx="0.5" fill={c} opacity={0.5} />
      {/* kaki */}
      <rect x="6" y="18" width="3" height="2" rx="0.5" fill={c} opacity={0.5} />
      <rect x="11" y="18" width="3" height="2" rx="0.5" fill={c} opacity={0.5} />
    </svg>
  );
}

// ───────────────────────────────────────── waktu relatif

function waktuRelatif(iso: string) {
  const dtk = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (dtk < 60) return `${dtk}s ago`;
  const mnt = Math.floor(dtk / 60);
  if (mnt < 60) return `${mnt}m ago`;
  const jam = Math.floor(mnt / 60);
  if (jam < 24) return `${jam}h ago`;
  const hari = Math.floor(jam / 24);
  return `${hari}d ago`;
}

function formatDurasi(detik: number) {
  if (detik < 60) return `${detik}s`;
  const m = Math.floor(detik / 60);
  const s = detik % 60;
  return s > 0 ? `${m}m${s}s` : `${m}m`;
}

// ───────────────────────────────────────── tile

type TileData = {
  id: string;
  nama: string;
  status: StatusTile;
  waktu: string;
  durasi: number | null;
  jenis: "workflow" | "tugas";
  url?: string;
  keterangan?: string;
};

function Tile({ d }: { d: TileData }) {
  const w = WARNA[d.status];
  const konten = (
    <div className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${w.bg} ${w.border} hover:border-emas/40`}>
      {/* dot status di pojok kanan atas */}
      <span className={`absolute right-2 top-2 size-2 rounded-full ${w.dot} ${d.status === "jalan" ? "animate-pulse" : ""}`} />

      <RobotPixel status={d.status} />

      <p className="max-w-full truncate text-center text-xs font-medium leading-tight">{d.nama}</p>

      <p className={`text-center font-mono text-[10px] leading-none ${w.teks}`}>
        {LABEL[d.status]}
        {d.durasi != null && ` · ${formatDurasi(d.durasi)}`}
      </p>

      <p className="text-center text-[10px] leading-none text-muted-foreground">{waktuRelatif(d.waktu)}</p>
    </div>
  );

  if (d.url) {
    return (
      <a href={d.url} target="_blank" rel="noopener noreferrer" className="outline-none focus-visible:ring-2 focus-visible:ring-emas rounded-xl">
        {konten}
      </a>
    );
  }
  return konten;
}

// ───────────────────────────────────────── komponen utama

type DeckResponse = {
  ok: boolean;
  workflows: RunWorkflow[];
  tugas: RingkasTugas[];
  pesan?: string;
};

export function Deck({ sesi }: { sesi: Session | null }) {
  const [data, setData] = useState<TileData[] | null>(null);
  const [galat, setGalat] = useState("");
  const [sedangMuat, setSedangMuat] = useState(false);

  const muat = useCallback(async () => {
    setSedangMuat(true);
    setGalat("");
    try {
      const j = (await apiAdmin(sesi)("/api/deck")) as DeckResponse;
      if (!j.ok) {
        setGalat(j.pesan ?? "Gagal memuat deck.");
        setSedangMuat(false);
        return;
      }

      const tiles: TileData[] = [];

      // Workflow runs → tiles
      for (const w of j.workflows) {
        tiles.push({
          id: `wf-${w.id}`,
          nama: w.nama,
          status: statusDariWorkflow(w.status, w.kesimpulan),
          waktu: w.selesai ?? w.mulai,
          durasi: w.durasi,
          jenis: "workflow",
          url: w.url,
          keterangan: `${w.pemicu} · ${w.cabang}`,
        });
      }

      // Tugas Studio → tiles
      for (const t of j.tugas) {
        tiles.push({
          id: `tg-${t.id}`,
          nama: `${t.produk_slug} · ${t.jenis}`,
          status: statusDariTugas(t.status),
          waktu: t.jadwal_tayang ?? new Date().toISOString(),
          durasi: null,
          jenis: "tugas",
          keterangan: `tayang: ${t.status_tayang}`,
        });
      }

      setData(tiles);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal memuat.");
    }
    setSedangMuat(false);
  }, [sesi]);

  useEffect(() => {
    const t = setTimeout(muat, 0);
    return () => clearTimeout(t);
  }, [muat]);

  // Auto-refresh tiap 30 detik
  useEffect(() => {
    const iv = setInterval(muat, 30_000);
    return () => clearInterval(iv);
  }, [muat]);

  if (!data && !galat) return <Loader2 className="size-4 animate-spin text-emas" />;
  if (galat) return <p className="text-sm text-red-300">{galat}</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">Belum ada workflow.</p>;

  // Pisahkan workflow dan tugas
  const workflows = data.filter((d) => d.jenis === "workflow");
  const tugas = data.filter((d) => d.jenis === "tugas");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {/* Ringkasan status */}
          <LencanaDeck label="Running" jumlah={data.filter((d) => d.status === "jalan").length} warna="text-amber-300 bg-amber-500/15" />
          <LencanaDeck label="Done" jumlah={data.filter((d) => d.status === "sukses").length} warna="text-emerald-300 bg-emerald-500/15" />
          <LencanaDeck label="Failed" jumlah={data.filter((d) => d.status === "gagal").length} warna="text-red-300 bg-red-500/15" />
        </div>
        <button
          onClick={muat}
          disabled={sedangMuat}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-emas hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${sedangMuat ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {workflows.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">GitHub Actions</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {workflows.map((d) => (
              <Tile key={d.id} d={d} />
            ))}
          </div>
        </div>
      )}

      {tugas.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tugas Studio</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {tugas.map((d) => (
              <Tile key={d.id} d={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LencanaDeck({ label, jumlah, warna }: { label: string; jumlah: number; warna: string }) {
  if (jumlah === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${warna}`}>
      {jumlah} {label}
    </span>
  );
}
