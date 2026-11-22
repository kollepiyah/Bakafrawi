"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BarChart2 } from "lucide-react";

/** Cek apakah browser sedang menyimpan sesi login Supabase admin (supaya kunjungan Kyai sendiri tak dihitung). */
function sedangLoginAdmin(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) return true;
    }
  } catch {
    // Abaikan bila localStorage diblokir
  }
  return false;
}

/**
 * Mengirim 1 ping kunjungan halaman nyata ke `/api/kunjungan` tiap kali pengunjung membuka halaman publik.
 * Otomatis mengabaikan `/admin` dan sesi admin yang sedang login.
 */
export function PencatatPengunjung() {
  const jalur = usePathname();
  const terakhir = useRef<string>("");

  useEffect(() => {
    if (!jalur || jalur.startsWith("/admin")) return;
    if (terakhir.current === jalur) return;
    if (sedangLoginAdmin()) return;
    terakhir.current = jalur;

    fetch("/api/kunjungan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jalur, perujuk: document.referrer || "" }),
      keepalive: true,
    }).catch(() => {});
  }, [jalur]);

  return null;
}

/**
 * Menampilkan ringkasan pengunjung nyata di footer paling bawah situs secara halus.
 */
export function LencanaPengunjungFooter() {
  const [data, setData] = useState<{ hariIni: number; total: number } | null>(null);

  useEffect(() => {
    fetch("/api/kunjungan")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) setData({ hariIni: Number(j.hariIni) || 0, total: Number(j.total) || 0 });
      })
      .catch(() => {});
  }, []);

  if (!data || data.total <= 0) return null;

  return (
    <span
      title={`Hari ini: ${data.hariIni.toLocaleString("id-ID")} · Total: ${data.total.toLocaleString("id-ID")}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/[0.03] px-3 py-1 text-xs tabular-nums text-muted-foreground"
    >
      <BarChart2 className="size-3.5 text-emas" />
      <span>{data.total.toLocaleString("id-ID")}</span>
    </span>
  );
}
