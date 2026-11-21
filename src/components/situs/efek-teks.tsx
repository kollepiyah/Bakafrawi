"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";

/**
 * BlurText (ala React Bits): memecah kalimat per kata lalu memunculkannya
 * dari efek kabur + naik lembut satu per satu.
 */
export function BlurText({
  teks,
  className = "",
  jedaAwal = 0,
}: {
  teks: string;
  className?: string;
  jedaAwal?: number;
}) {
  const kata = teks.split(" ");
  return (
    <span className={className}>
      {kata.map((k, i) => (
        <motion.span
          key={`${k}-${i}`}
          initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: 0.55,
            delay: jedaAwal + i * 0.055,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block"
        >
          {k}
          {i < kata.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}

/**
 * ShinyText (ala React Bits): efek kilau cahaya melintas halus di atas teks.
 */
export function ShinyText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`animasi-kilau inline-block bg-gradient-to-r from-zinc-400 via-emas-muda to-zinc-400 bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * CountUp (ala React Bits): menganimasikan angka statistik seperti "30+" atau "100%"
 * dari 0 naik ke nilai akhir saat masuk layar.
 */
export function CountUp({ nilai, className = "" }: { nilai: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const terlihat = useInView(ref, { once: true, margin: "-40px" });
  const cocok = nilai.match(/^([^0-9]*)(\d+)(.*)$/);
  const targetAngka = cocok ? Number(cocok[2]) : null;
  const awalan = cocok ? cocok[1] : "";
  const akhiran = cocok ? cocok[3] : "";
  const [tampil, setTampil] = useState(0);

  useEffect(() => {
    if (!terlihat || targetAngka === null) return;
    let raf = 0;
    const durasi = 1200;
    const mulai = performance.now();
    const langkah = (now: number) => {
      const p = Math.min(1, (now - mulai) / durasi);
      const easeOut = 1 - Math.pow(1 - p, 3);
      setTampil(Math.round(easeOut * targetAngka));
      if (p < 1) raf = requestAnimationFrame(langkah);
    };
    raf = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(raf);
  }, [terlihat, targetAngka]);

  if (targetAngka === null) {
    return <span className={className}>{nilai}</span>;
  }

  return (
    <span ref={ref} className={className}>
      {awalan}
      {terlihat ? tampil : 0}
      {akhiran}
    </span>
  );
}

/**
 * BorderBeam (ala Magic UI): garis cahaya emas-teal mengalir lembut mengelilingi
 * pinggiran kartu produk unggulan.
 */
export function BorderBeam({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] p-[1px] [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] [mask-composite:exclude] ${className}`}
    >
      <div
        className="animasi-beam absolute top-1/2 left-1/2 aspect-square w-[220%] opacity-80"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg 260deg, rgba(24,180,168,0.85) 295deg, rgba(227,201,137,0.95) 330deg, transparent 360deg)",
        }}
      />
    </div>
  );
}

/**
 * KartuMiring3D (ala React Bits TiltedCard): memiringkan mockup produk secara 3D
 * mengikuti gerak kursor, kembali rata saat kursor keluar.
 */
export function KartuMiring3D({
  children,
  className = "",
  maksSudut = 8,
}: {
  children: ReactNode;
  className?: string;
  maksSudut?: number;
}) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const springRx = useSpring(rx, { stiffness: 220, damping: 22 });
  const springRy = useSpring(ry, { stiffness: 220, damping: 22 });

  function saatGerak(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * maksSudut * 2);
    rx.set(-py * maksSudut * 2);
  }

  function saatKeluar() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <div style={{ perspective: 1000 }} className={className}>
      <motion.div
        onMouseMove={saatGerak}
        onMouseLeave={saatKeluar}
        style={{ rotateX: springRx, rotateY: springRy, transformStyle: "preserve-3d" }}
        className="will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * TombolMagnet (ala React Bits Magnet): pembungkus yang menarik tombol pelan ke arah kursor.
 */
export function TombolMagnet({ children, className = "" }: { children: ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18 });
  const sy = useSpring(y, { stiffness: 260, damping: 18 });

  function gerak(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.18);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.22);
  }

  function lepas() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      onMouseMove={gerak}
      onMouseLeave={lepas}
      style={{ x: sx, y: sy }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  );
}

const ITEM_PITA = [
  "Next.js & React",
  "Aplikasi Android",
  "Maktaba POS",
  "Ammu Online",
  "Sistem Pesantren",
  "Studio Konten AI",
  "UI/UX Modern",
  "Integrasi API & Bot",
];

/**
 * PitaBerjalan (Scroll Velocity Marquee ala React Bits):
 * pita teks elegan yang meluncur terus dan ikut melaju lebih cepat mengikuti kecepatan scroll.
 */
export function PitaBerjalan() {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 360 });
  const faktorKecepatan = useTransform(smoothVelocity, [-1200, 0, 1200], [-3.2, 0, 3.2]);
  const arahRef = useRef(1);

  useAnimationFrame((_, delta) => {
    const v = faktorKecepatan.get();
    if (v < -0.05) arahRef.current = -1;
    else if (v > 0.05) arahRef.current = 1;

    // Gerak dasar perlahan + dorongan kecepatan scroll
    let geser = arahRef.current * 2.4 * (delta / 1000);
    geser += arahRef.current * Math.abs(v) * 2.6 * (delta / 1000);

    let next = baseX.get() - geser;
    if (next <= -50) next += 50;
    if (next > 0) next -= 50;
    baseX.set(next);
  });

  const xPersen = useTransform(baseX, (v) => `${v}%`);

  return (
    <div
      aria-label="Keahlian dan produk Bakafrawi"
      className="relative overflow-hidden border-y border-white/[0.07] bg-white/[0.015] py-4 select-none [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
    >
      <motion.div style={{ x: xPersen }} className="flex w-max items-center gap-8 will-change-transform">
        {[0, 1].map((salinan) => (
          <div key={salinan} className="flex shrink-0 items-center gap-8">
            {ITEM_PITA.map((item) => (
              <span
                key={`${salinan}-${item}`}
                className="inline-flex items-center gap-8 font-heading text-base tracking-wide text-zinc-400 sm:text-lg"
              >
                <span className="transition-colors hover:text-emas-muda">{item}</span>
                <span className="size-1.5 rounded-full bg-emas/50" />
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
