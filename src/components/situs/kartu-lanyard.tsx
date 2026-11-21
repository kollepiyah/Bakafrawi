"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import type { Gambar } from "@/content/skema";

/**
 * Kartu Studio Pass 3D Lanyard Interaktif berbasis fisika pegas GPU (motion/react):
 * super ringan (tanpa WebGL/WASM), langsung tampil instan, bisa ditarik & digoyangkan,
 * miring 3D, kilau holografis, dan menampilkan foto portrait tajam dari Admin → Situs → Hero.
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

  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const springX = useSpring(dragX, { stiffness: 190, damping: 15, mass: 0.85 });
  const springY = useSpring(dragY, { stiffness: 190, damping: 15, mass: 0.85 });

  const rotateZ = useTransform(springX, [-140, 0, 140], [15, 0, -15]);
  const rotateY = useTransform(springX, [-140, 0, 140], [-20, 0, 20]);
  const rotateX = useTransform(springY, [-120, 0, 140], [16, 0, -13]);

  const strapRotate = useTransform(springX, [-140, 0, 140], [18, 0, -18]);
  const strapScaleY = useTransform(springY, [-80, 0, 140], [0.78, 1, 1.45]);

  const sheenX = useTransform(springX, [-140, 140], [15, 85]);
  const sheenY = useTransform(springY, [-120, 140], [15, 85]);
  const sheenBg = useMotionTemplate`radial-gradient(260px circle at ${sheenX}% ${sheenY}%, rgba(227,201,137,0.24), transparent 65%)`;

  return (
    <div
      className="relative mx-auto flex h-[430px] w-full max-w-[310px] flex-col items-center justify-start select-none sm:h-[450px]"
      style={{ perspective: 1100 }}
    >
      {/* Cahaya latar lembut di belakang kartu */}
      <div className="pointer-events-none absolute top-24 left-1/2 size-60 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.2),transparent_68%)] blur-2xl" />

      {/* Tali Lanyard elastis */}
      <motion.div
        style={{ rotate: strapRotate, scaleY: strapScaleY, transformOrigin: "top center" }}
        className="pointer-events-none relative z-10 -mt-10 flex h-28 w-7 flex-col items-center justify-center overflow-hidden rounded-b-sm border-x border-white/10 bg-gradient-to-b from-[#090b0f] via-[#171b22] to-[#0f1218] py-2 shadow-lg"
      >
        <span className="text-[7px] font-bold tracking-[0.26em] text-emas/80 [writing-mode:vertical-rl]">
          BAKAFRAWI · STUDIO
        </span>
      </motion.div>

      {/* Kartu 3D pegas */}
      <motion.div
        drag
        dragConstraints={{ left: -110, right: 110, top: -55, bottom: 100 }}
        dragElastic={0.42}
        dragSnapToOrigin
        dragTransition={{ bounceStiffness: 220, bounceDamping: 14 }}
        onDragStart={() => setDitarik(true)}
        onDragEnd={() => setDitarik(false)}
        style={{
          x: dragX,
          y: dragY,
          rotateX,
          rotateY,
          rotateZ,
          transformStyle: "preserve-3d",
        }}
        animate={ditarik ? undefined : { rotateZ: [-1.2, 1.2, -1.2] }}
        transition={ditarik ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.99 }}
        className="relative z-20 -mt-2 w-[274px] cursor-grab active:cursor-grabbing"
      >
        {/* Klip pengait logam */}
        <div className="mx-auto flex flex-col items-center">
          <div className="h-3.5 w-7 rounded-t-md border border-white/25 bg-gradient-to-b from-zinc-400 to-zinc-700 shadow-md" />
          <div className="-mt-1 h-2.5 w-11 rounded-full border border-white/20 bg-zinc-800 shadow-inner" />
        </div>

        {/* Badan Kartu ID */}
        <div className="relative -mt-1 overflow-hidden rounded-[24px] border border-white/15 bg-gradient-to-br from-[#171b23] via-[#0e1117] to-[#090b10] p-4 shadow-[0_28px_60px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.14)]">
          <motion.div
            style={{ background: sheenBg }}
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
                  unoptimized
                  className="pointer-events-none object-cover object-top"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#090b10] via-[#090b10]/70 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 text-left">
                  <p className="font-heading text-sm font-semibold text-foreground drop-shadow">
                    Software &amp; Design Studio
                  </p>
                  <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-black/65 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300 backdrop-blur-sm">
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
      </motion.div>
    </div>
  );
}
