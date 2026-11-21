"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Kartu Bento interaktif dengan efek sorot cahaya emas lembut yang mengikuti posisi kursor.
 * Murni CSS custom properties + IntersectionObserver (0 React re-render saat hover, tanpa motion/react).
 */
export function KartuSpotlight({
  children,
  className,
  jeda = 0,
}: {
  children: ReactNode;
  className?: string;
  jeda?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cahayaRef = useRef<HTMLDivElement>(null);
  const [terlihat, setTerlihat] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setTerlihat(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -48px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function gerak(e: MouseEvent<HTMLDivElement>) {
    const cahaya = cahayaRef.current;
    if (!cahaya) return;
    const r = e.currentTarget.getBoundingClientRect();
    cahaya.style.background = `radial-gradient(360px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(201,162,75,0.14), transparent 70%)`;
  }

  return (
    <div
      ref={ref}
      onMouseMove={gerak}
      style={{ transitionDelay: jeda ? `${Math.round(jeda * 1000)}ms` : undefined }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card transition-[opacity,transform,border-color] duration-500 ease-out hover:-translate-y-1 hover:border-emas/35 motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        terlihat ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        className,
      )}
    >
      <div
        ref={cahayaRef}
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
