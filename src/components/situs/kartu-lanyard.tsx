"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { Sparkles } from "lucide-react";
import type { Gambar } from "@/content/skema";

/**
 * Kartu Studio Pass 3D Lanyard Interaktif ala portofolio modern:
 * menggantung dengan tali lanyard elastis, bisa ditarik & digoyangkan pakai mouse atau jari di HP,
 * miring 3D dengan fisika pegas, serta kilau metalik mengikuti gerakan.
 * Jika foto diunggah lewat panel Admin → Situs → Hero, bagian tengah menampilkan foto portrait penuh.
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

  // Posisi drag mentah → dihaluskan pegas agar terasa berat & realistis seperti ID card asli
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const springX = useSpring(dragX, { stiffness: 180, damping: 14, mass: 0.9 });
  const springY = useSpring(dragY, { stiffness: 180, damping: 14, mass: 0.9 });

  // Rotasi 3D saat kartu ditarik atau di-hover
  const rotateZ = useTransform(springX, [-140, 0, 140], [16, 0, -16]);
  const rotateY = useTransform(springX, [-140, 0, 140], [-22, 0, 22]);
  const rotateX = useTransform(springY, [-120, 0, 140], [18, 0, -14]);

  // Tali lanyard ikut memanjang & miring mengikuti posisi kartu
  const strapRotate = useTransform(springX, [-140, 0, 140], [19, 0, -19]);
  const strapScaleY = useTransform(springY, [-80, 0, 140], [0.75, 1, 1.48]);

  // Kilau holografis/metalik bergerak berlawanan arah kemiringan
  const sheenX = useTransform(springX, [-140, 140], [15, 85]);
  const sheenY = useTransform(springY, [-120, 140], [15, 85]);
  const sheenBg = useMotionTemplate`radial-gradient(280px circle at ${sheenX}% ${sheenY}%, rgba(227,201,137,0.28), transparent 65%)`;

  return (
    <div
      className="relative mx-auto flex h-[430px] w-full max-w-[320px] flex-col items-center justify-start select-none sm:h-[460px]"
      style={{ perspective: 1200 }}
    >
      {/* Cahaya latar lembut di belakang kartu */}
      <div className="pointer-events-none absolute top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.22),transparent_68%)] blur-2xl" />

      {/* Tali Lanyard yang menggantung dari atas & ikut meregang saat kartu ditarik */}
      <motion.div
        style={{ rotate: strapRotate, scaleY: strapScaleY, transformOrigin: "top center" }}
        className="pointer-events-none relative z-10 -mt-12 flex h-32 w-8 flex-col items-center justify-between overflow-hidden rounded-b-sm border-x border-white/10 bg-gradient-to-b from-[#090b0f] via-[#171b22] to-[#0f1218] py-2 shadow-lg"
      >
        <span className="text-[7px] font-bold tracking-[0.26em] text-emas/80 [writing-mode:vertical-rl]">
          BAKAFRAWI · STUDIO
        </span>
      </motion.div>

      {/* Kartu 3D yang bisa ditarik & digoyangkan */}
      <motion.div
        drag
        dragConstraints={{ left: -120, right: 120, top: -60, bottom: 110 }}
        dragElastic={0.45}
        dragSnapToOrigin
        dragTransition={{ bounceStiffness: 220, bounceDamping: 13 }}
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
        animate={
          ditarik
            ? undefined
            : {
                rotateZ: [-1.4, 1.4, -1.4],
              }
        }
        transition={
          ditarik
            ? undefined
            : {
                duration: 5.5,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.99 }}
        className="relative z-20 -mt-2 w-[276px] cursor-grab active:cursor-grabbing"
      >
        {/* Klip pengait logam di atas kartu */}
        <div className="mx-auto flex flex-col items-center">
          <div className="h-4 w-7 rounded-t-md border border-white/25 bg-gradient-to-b from-zinc-400 to-zinc-700 shadow-md" />
          <div className="-mt-1 h-2.5 w-11 rounded-full border border-white/20 bg-zinc-800 shadow-inner" />
        </div>

        {/* Badan Kartu ID Studio Pass */}
        <div className="relative -mt-1 overflow-hidden rounded-[26px] border border-white/15 bg-gradient-to-br from-[#171b23] via-[#0e1117] to-[#090b10] p-5 shadow-[0_32px_70px_-18px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.14)]">
          {/* Kilau holografis yang bergerak */}
          <motion.div
            style={{ background: sheenBg }}
            className="pointer-events-none absolute inset-0 opacity-90 mix-blend-screen"
          />

          {/* Pola titik halus di sudut kartu */}
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage: "radial-gradient(rgba(201,162,75,0.45) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
              maskImage: "radial-gradient(ellipse at top right, black, transparent 65%)",
            }}
          />

          {/* Lubang slot lanyard */}
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-black/70 ring-1 ring-white/15" />

          {/* Header kartu: Logo + Nomor seri */}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl border border-emas/35 bg-emas/10 p-1.5">
                <Image src="/logo.png" alt="Logo Bakafrawi" width={28} height={28} className="object-contain" />
              </div>
              <div>
                <p className="font-heading text-sm font-semibold tracking-wide text-foreground">
                  {nama}
                  <span className="text-emas">.</span>
                </p>
                <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Studio Pass</p>
              </div>
            </div>
            <span className="rounded-md border border-emas/30 bg-emas/10 px-2 py-0.5 font-mono text-[10px] text-emas-muda">
              ID · 01
            </span>
          </div>

          {/* Visual Tengah: Foto Portrait dari Admin (jika ada) atau Emblem Bawaan */}
          {foto?.src ? (
            <div className="relative my-4 overflow-hidden rounded-2xl border border-white/12 bg-black/50">
              <div className="relative aspect-[4/4.2] w-full">
                <Image
                  src={foto.src}
                  alt={foto.alt || `Foto ${nama}`}
                  fill
                  sizes="240px"
                  unoptimized
                  className="pointer-events-none object-cover object-top"
                />
                {/* Gradasi gelap di bagian bawah agar teks & status terbaca tajam */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#090b10] via-[#090b10]/75 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 text-left">
                  <p className="font-heading text-sm font-semibold text-foreground drop-shadow">
                    Software &amp; Design Studio
                  </p>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-black/65 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300 backdrop-blur-sm">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {status}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative my-5 rounded-2xl border border-white/10 bg-black/35 p-4 text-center">
              <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl border border-emas/30 bg-gradient-to-br from-emas/20 via-emas/5 to-transparent shadow-[0_0_30px_-8px_rgba(201,162,75,0.5)]">
                <Image src="/logo.png" alt="" width={40} height={40} className="object-contain" />
              </div>
              <p className="font-heading text-base font-semibold text-foreground">Software &amp; Design Studio</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Sidoarjo · Jawa Timur</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {status}
              </div>
            </div>
          )}

          {/* Stack Keahlian Mini */}
          <div className="relative flex flex-wrap justify-center gap-1.5">
            {["Web App", "Android", "POS", "AI Studio"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium text-zinc-300"
              >
                {t}
              </span>
            ))}
          </div>

          {/* Garis barcode minimalis di bawah */}
          <div className="relative mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] text-zinc-500">
            <span className="font-mono">bakafrawi.com</span>
            <span className="inline-flex items-center gap-1 text-emas-muda/80">
              <Sparkles className="size-2.5" /> Interactive
            </span>
          </div>
        </div>
      </motion.div>

      {/* Petunjuk kecil di bawah kartu */}
      <p className="pointer-events-none mt-4 text-center text-[11px] text-muted-foreground/70">
        {ditarik ? "Lepaskan untuk memantul ✨" : "Tarik & goyangkan kartu"}
      </p>
    </div>
  );
}
