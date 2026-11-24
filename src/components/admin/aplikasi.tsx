"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, CircleSlash, Loader2, RefreshCw } from "lucide-react";
import { angkaUtama, type JenisPintu } from "@/lib/aplikasi-murni";
import { apiAdmin } from "./agenda";

export type RingkasAplikasi = {
  slug: string;
  nama: string;
  jenis: JenisPintu | null;
  ok: boolean;
  data?: Record<string, unknown>;
  galat?: string;
  penilaian?: { tingkat: "baik" | "perhatian"; catatan: string[] };
};

const LABEL_JENIS: Record<JenisPintu, string> = { saas: "SaaS", kedai: "Kedai", teknis: "Teknis saja" };

/** Muat ringkasan semua aplikasi (dipakai halaman Aplikasi & Beranda). */
export function useRingkasanAplikasi(sesi: Session | null) {
  const [daftar, setDaftar] = useState<RingkasAplikasi[] | null>(null);
  const [galat, setGalat] = useState("");
  const muat = useCallback(async () => {
    const j = await apiAdmin(sesi)("/api/aplikasi/ringkasan");
    if (j.ok) setDaftar(j.aplikasi as RingkasAplikasi[]);
    else setGalat(j.pesan ?? "Gagal memuat ringkasan aplikasi.");
  }, [sesi]);
  useEffect(() => {
    const t = setTimeout(muat, 0);
    return () => clearTimeout(t);
  }, [muat]);
  return { daftar, galat, muat };
}

export function TandaAplikasi({ a }: { a: RingkasAplikasi }) {
  if (!a.ok) return <CircleSlash className="size-4 shrink-0 text-redup" aria-label="Tidak tersambung" />;
  return a.penilaian?.tingkat === "perhatian"
    ? <AlertTriangle className="size-4 shrink-0 text-amber-300" aria-label="Perlu perhatian" />
    : <CheckCircle2 className="size-4 shrink-0 text-green-400" aria-label="Baik" />;
}

export function HalamanAplikasi({ sesi, kepala }: { sesi: Session | null; kepala: ReactNode }) {
  const { daftar, galat, muat } = useRingkasanAplikasi(sesi);
  return (
    <div className="pb-16">
      {kepala}
      <main className="mx-auto w-full max-w-[1600px] space-y-5 px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl">Aplikasi</h1>
            <p className="text-sm text-muted-foreground">Ringkasan dari pintu baca-saja tiap aplikasi · diperbarui tiap ±5 menit</p>
          </div>
          <button onClick={muat} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:border-emas"><RefreshCw className="size-3.5" /> Muat ulang</button>
        </div>
        {galat && <p className="text-sm text-red-300">{galat}</p>}
        {!daftar ? (
          !galat && <Loader2 className="size-5 animate-spin text-emas" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {daftar.map((a) => <KartuAplikasi key={a.slug} a={a} />)}
          </div>
        )}
        <p className="text-xs text-redup">Ammu Online & Waseela milik lembaga klien — yang tampil hanya angka teknis (akun, pengguna aktif, aktivitas, ukuran database), tanpa data santri/murid maupun keuangan.</p>
      </main>
    </div>
  );
}

function KartuAplikasi({ a }: { a: RingkasAplikasi }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-lg"><TandaAplikasi a={a} /> {a.nama}</h2>
        {a.jenis && <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-muted-foreground">{LABEL_JENIS[a.jenis]}</span>}
      </div>
      {!a.ok || !a.data || !a.jenis ? (
        <p className="text-sm text-muted-foreground">{a.galat}</p>
      ) : (
        <>
          <dl className="grid gap-1.5 text-sm">
            {angkaUtama(a.jenis, a.data).map(([label, nilai]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right tabular-nums">{nilai}</dd>
              </div>
            ))}
          </dl>
          {!!a.penilaian?.catatan.length && (
            <ul className="mt-3 space-y-1 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">
              {a.penilaian.catatan.map((c) => <li key={c}>• {c}</li>)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
