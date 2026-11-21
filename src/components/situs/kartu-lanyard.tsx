"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Gambar } from "@/content/skema";

/**
 * Kartu Studio Pass 3D Lanyard Interaktif tanpa pustaka animasi eksternal (0 KB motion/react):
 * - Saat diam: ayunan lembut murni CSS GPU compositor (0% beban JS main thread).
 * - Saat ditarik: Pointer Events + fisika pegas elastis dengan miring 3D & kilau holografis.
 * - Foto portrait dari Supabase Storage dioptimasi otomatis oleh next/image (WebP/AVIF, 240px).
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
  const [ditarik, setDitarik] = useState(false);
  const kartuRef = useRef<HTMLDivElement>(null);
  const taliRef = useRef<HTMLDivElement>(null);
  const kilauRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef({
    aktif: false,
    asalX: 0,
    asalY: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    raf: 0,
  });

  const terapkanTransform = (x: number, y: number) => {
    const kartu = kartuRef.current;
    const tali = taliRef.current;
    const kilau = kilauRef.current;

    const rz = (-x / 140) * 15;
    const ry = (x / 140) * 20;
    const rx = (-y / 130) * 14;

    if (kartu) {
      kartu.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
    }
    if (tali) {
      const strapRot = (-x / 140) * 18;
      const strapScale = Math.max(0.78, Math.min(1.45, 1 + y / 280));
      tali.style.transform = `rotate(${strapRot.toFixed(2)}deg) scaleY(${strapScale.toFixed(3)})`;
    }
    if (kilau) {
      const sx = 50 + (x / 140) * 35;
      const sy = 50 + (y / 130) * 35;
      kilau.style.background = `radial-gradient(260px circle at ${sx.toFixed(1)}% ${sy.toFixed(1)}%, rgba(227,201,137,0.24), transparent 65%)`;
    }
  };

  useEffect(() => {
    const s = stateRef.current;
    return () => cancelAnimationFrame(s.raf);
  }, []);

  function mulaiTarik(e: PointerEvent<HTMLDivElement>) {
    const s = stateRef.current;
    cancelAnimationFrame(s.raf);
    s.raf = 0;
    s.aktif = true;
    s.asalX = e.clientX - s.x;
    s.asalY = e.clientY - s.y;
    s.vx = 0;
    s.vy = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDitarik(true);
  }

  function geserTarik(e: PointerEvent<HTMLDivElement>) {
    const s = stateRef.current;
    if (!s.aktif) return;
    const mentahX = e.clientX - s.asalX;
    const mentahY = e.clientY - s.asalY;
    // Batas elastis halus agar terasa seperti tali lanyard asli
    const nx = Math.max(-115, Math.min(115, mentahX * 0.72));
    const ny = Math.max(-55, Math.min(105, mentahY * 0.72));
    s.vx = nx - s.x;
    s.vy = ny - s.y;
    s.x = nx;
    s.y = ny;
    terapkanTransform(s.x, s.y);
  }

  function lepasTarik() {
    const s = stateRef.current;
    if (!s.aktif) return;
    s.aktif = false;

    const pegas = () => {
      const k = 0.14;
      const redam = 0.78;
      s.vx = (s.vx - s.x * k) * redam;
      s.vy = (s.vy - s.y * k) * redam;
      s.x += s.vx;
      s.y += s.vy;

      if (Math.abs(s.x) < 0.25 && Math.abs(s.y) < 0.25 && Math.abs(s.vx) < 0.25 && Math.abs(s.vy) < 0.25) {
        s.x = 0;
        s.y = 0;
        s.vx = 0;
        s.vy = 0;
        terapkanTransform(0, 0);
        s.raf = 0;
        setDitarik(false);
        return;
      }

      terapkanTransform(s.x, s.y);
      s.raf = requestAnimationFrame(pegas);
    };
    s.raf = requestAnimationFrame(pegas);
  }

  const bisaDioptimasi =
    !foto?.src || foto.src.startsWith("/") || foto.src.includes(".supabase.co/storage/v1/object/public/media/");

  return (
    <div
      className="relative mx-auto flex h-[430px] w-full max-w-[310px] flex-col items-center justify-start select-none sm:h-[450px]"
      style={{ perspective: 1100 }}
    >
      {/* Cahaya latar lembut di belakang kartu (radial-gradient murni tanpa blur-2xl) */}
      <div className="pointer-events-none absolute top-16 left-1/2 size-80 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.18)_0%,rgba(201,162,75,0.05)_42%,transparent_72%)]" />

      {/* Tali Lanyard elastis */}
      <div
        ref={taliRef}
        style={{ transformOrigin: "top center" }}
        className="pointer-events-none relative z-10 -mt-10 flex h-28 w-7 flex-col items-center justify-center overflow-hidden rounded-b-sm border-x border-white/10 bg-gradient-to-b from-[#090b0f] via-[#171b22] to-[#0f1218] py-2 shadow-lg"
      >
        <span className="text-[7px] font-bold tracking-[0.26em] text-emas/80 [writing-mode:vertical-rl]">
          BAKAFRAWI · STUDIO
        </span>
      </div>

      {/* Pembungkus ayunan idle murni CSS GPU (dijeda saat kartu ditarik) */}
      <div className={`relative z-20 -mt-2 ${ditarik ? "" : "animasi-ayun"}`}>
        {/* Kartu 3D interaktif */}
        <div
          ref={kartuRef}
          onPointerDown={mulaiTarik}
          onPointerMove={geserTarik}
          onPointerUp={lepasTarik}
          onPointerCancel={lepasTarik}
          style={{ transformStyle: "preserve-3d", touchAction: "none" }}
          className="w-[274px] cursor-grab active:cursor-grabbing"
        >
          {/* Klip pengait logam */}
          <div className="mx-auto flex flex-col items-center">
            <div className="h-3.5 w-7 rounded-t-md border border-white/25 bg-gradient-to-b from-zinc-400 to-zinc-700 shadow-md" />
            <div className="-mt-1 h-2.5 w-11 rounded-full border border-white/20 bg-zinc-800 shadow-inner" />
          </div>

          {/* Badan Kartu ID */}
          <div className="relative -mt-1 overflow-hidden rounded-[24px] border border-white/15 bg-gradient-to-br from-[#171b23] via-[#0e1117] to-[#090b10] p-4 shadow-[0_28px_60px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.14)]">
            <div
              ref={kilauRef}
              style={{
                background:
                  "radial-gradient(260px circle at 50% 50%, rgba(227,201,137,0.22), transparent 65%)",
              }}
              className="pointer-events-none absolute inset-0 opacity-90 mix-blend-screen"
            />

            {/* Slot lubang lanyard */}
            <div className="mx-auto mb-3.5 h-1.5 w-12 rounded-full bg-black/70 ring-1 ring-white/15" />

            {/* Header kartu */}
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl border border-emas/35 bg-emas/10 p-1.5">
                  <Image src="/logo.png" alt={`Logo ${nama}`} width={24} height={24} className="object-contain" />
                </div>
                <div>
                  <p className="font-heading text-sm font-semibold tracking-wide text-foreground">
                    {nama}
                    <span className="text-emas">.</span>
                  </p>
                  <p className="text-[9px] tracking-[0.16em] text-muted-foreground uppercase">Studio Pass</p>
                </div>
              </div>
              <span className="rounded-md border border-emas/30 bg-emas/10 px-2 py-0.5 font-mono text-[10px] text-emas-muda">
                ID · 01
              </span>
            </div>

            {/* Visual Tengah: Foto Portrait dari Admin atau Emblem Bawaan */}
            {foto?.src ? (
              <div className="relative my-3.5 overflow-hidden rounded-2xl border border-white/12 bg-black/50">
                <div className="relative aspect-[4/4.3] w-full">
                  <Image
                    src={foto.src}
                    alt={foto.alt || `Foto ${nama}`}
                    fill
                    sizes="240px"
                    preload
                    unoptimized={!bisaDioptimasi}
                    className="pointer-events-none object-cover object-top"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#090b10] via-[#090b10]/70 to-transparent" />
                  <div className="absolute inset-x-3 bottom-3 text-left">
                    <p className="font-heading text-sm font-semibold text-foreground drop-shadow">
                      Software &amp; Design Studio
                    </p>
                    <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-black/65 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      {status}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative my-4 rounded-2xl border border-white/10 bg-black/35 p-4 text-center">
                <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl border border-emas/30 bg-gradient-to-br from-emas/20 via-emas/5 to-transparent">
                  <Image src="/logo.png" alt="" width={40} height={40} className="object-contain" />
                </div>
                <p className="font-heading text-base font-semibold text-foreground">Software &amp; Design Studio</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Sidoarjo · Jawa Timur</p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  {status}
                </div>
              </div>
            )}

            {/* Footer kartu minimalis */}
            <div className="relative flex items-center justify-between border-t border-white/10 pt-2.5 text-[10px] text-zinc-500">
              <span className="font-mono">bakafrawi.com</span>
              <span className="font-mono text-emas-muda/80">Sidoarjo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
