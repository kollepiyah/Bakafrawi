"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, type ReactNode } from "react";
import type { Gambar } from "@/content/skema";

const Lanyard3DCanvas = dynamic(() => import("./lanyard-3d-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
      <div className="size-12 animate-pulse rounded-2xl border border-emas/30 bg-emas/10 p-2.5">
        <Image src="/logo.png" alt="" width={28} height={28} className="object-contain opacity-70" />
      </div>
      <span>Memuat kartu 3D...</span>
    </div>
  ),
});

// Pengaman jika browser/perangkat tidak mendukung WebGL
class BatasWebGL extends Component<{ fallback: ReactNode; children: ReactNode }, { gagal: boolean }> {
  state = { gagal: false };
  static getDerivedStateFromError() {
    return { gagal: true };
  }
  render() {
    return this.state.gagal ? this.props.fallback : this.props.children;
  }
}

/**
 * Wrapper Kartu Lanyard 3D WebGL (Three.js + Rapier Physics + MeshLine).
 * Dimuat lazy secara client-only agar loading awal tetap cepat dan aman untuk SSR.
 */
export function KartuLanyard({
  nama = "Bakafrawi",
  status = "Tersedia untuk proyek baru",
  foto,
}: {
  nama?: string;
  status?: string;
  foto?: Gambar;
}) {
  const cadangan = (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-[260px] rounded-[26px] border border-white/15 bg-gradient-to-br from-[#171b23] to-[#090b10] p-5 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl border border-emas/30 bg-emas/10">
          <Image src="/logo.png" alt={`Logo ${nama}`} width={40} height={40} className="object-contain" />
        </div>
        <p className="font-heading text-base font-semibold">{nama}.</p>
        <p className="mt-1 text-xs text-muted-foreground">{status}</p>
      </div>
    </div>
  );

  return (
    <div className="relative mx-auto flex h-[470px] w-full max-w-[380px] flex-col items-center justify-center select-none sm:h-[520px]">
      {/* Pendar cahaya halus di belakang ruang 3D */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.22),rgba(24,180,168,0.08)_50%,transparent_72%)] blur-2xl" />

      <div className="relative z-10 h-full w-full">
        <BatasWebGL fallback={cadangan}>
          <Lanyard3DCanvas nama={nama} status={status} fotoUrl={foto?.src} />
        </BatasWebGL>
      </div>
    </div>
  );
}
