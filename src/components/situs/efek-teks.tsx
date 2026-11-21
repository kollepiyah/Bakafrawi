"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

/**
 * ShinyText: teks berkilau gradasi emas lembut tanpa animasi background-position non-composited.
 */
export function ShinyText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block bg-gradient-to-r from-zinc-300 via-emas-muda to-zinc-300 bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * CountUp: menampilkan angka statistik secara instan pada SSR/First Paint agar tidak berkedip
 * atau memicu repaint berulang di layar pertama.
 */
export function CountUp({ nilai, className = "" }: { nilai: string; className?: string }) {
  return <span className={className}>{nilai}</span>;
}

/**
 * BorderBeam: garis cahaya emas-teal tipis yang meluncur di tepian atas & bawah kartu produk.
 * Murni transform GPU compositor (0% repaint main thread).
 */
export function BorderBeam({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}>
      <div className="animasi-kilau-garis absolute top-0 left-0 h-[1.5px] w-1/2 bg-gradient-to-r from-transparent via-emas-muda/85 to-transparent will-change-transform" />
      <div className="animasi-kilau-garis absolute bottom-0 left-0 h-px w-1/2 bg-gradient-to-r from-transparent via-teal-400/50 to-transparent will-change-transform [animation-delay:2.4s]" />
    </div>
  );
}

/**
 * KartuMiring3D: memiringkan mockup produk secara 3D mengikuti gerak kursor di desktop.
 * Murni DOM transform + CSS transition tanpa React re-render & tanpa motion/react.
 */
export function KartuMiring3D({
  children,
  className = "",
  maksSudut = 7,
}: {
  children: ReactNode;
  className?: string;
  maksSudut?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function saatGerak(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `rotateX(${(-py * maksSudut * 2).toFixed(2)}deg) rotateY(${(px * maksSudut * 2).toFixed(2)}deg)`;
  }

  function saatKeluar() {
    const el = ref.current;
    if (el) el.style.transform = "rotateX(0deg) rotateY(0deg)";
  }

  return (
    <div style={{ perspective: 1000 }} className={className}>
      <div
        ref={ref}
        onMouseMove={saatGerak}
        onMouseLeave={saatKeluar}
        style={{ transformStyle: "preserve-3d" }}
        className="transition-transform duration-200 ease-out"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * TombolMagnet: menarik tombol pelan ke arah kursor di desktop (murni CSS transform).
 */
export function TombolMagnet({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function gerak(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * 0.16;
    const y = (e.clientY - (r.top + r.height / 2)) * 0.2;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  function lepas() {
    const el = ref.current;
    if (el) el.style.transform = "translate3d(0, 0, 0)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={gerak}
      onMouseLeave={lepas}
      className={`inline-block transition-transform duration-200 ease-out ${className}`}
    >
      {children}
    </div>
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
 * PitaBerjalan: marquee murni CSS GPU compositor (0% beban JS main thread).
 */
export function PitaBerjalan() {
  return (
    <div
      aria-label="Keahlian dan produk Bakafrawi"
      className="relative overflow-hidden border-y border-white/[0.07] bg-white/[0.015] py-4 select-none [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
    >
      <div className="animasi-pita flex w-max items-center gap-8 will-change-transform">
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
      </div>
    </div>
  );
}
