"use client";

import type { MouseEvent, ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Kartu Bento interaktif dengan efek sorot cahaya emas lembut yang mengikuti posisi kursor
 * (gaya Linear / Vercel / portofolio dark tech modern).
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
  const x = useMotionValue(-300);
  const y = useMotionValue(-300);

  function gerak(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - r.left);
    y.set(e.clientY - r.top);
  }

  function keluar() {
    x.set(-300);
    y.set(-300);
  }

  const cahaya = useMotionTemplate`radial-gradient(360px circle at ${x}px ${y}px, rgba(201,162,75,0.14), transparent 70%)`;

  return (
    <motion.div
      onMouseMove={gerak}
      onMouseLeave={keluar}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.65, delay: jeda, ease: [0.2, 0.7, 0.2, 1] }}
      whileHover={{ y: -4 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card transition-colors duration-300 hover:border-emas/35",
        className,
      )}
    >
      <motion.div
        style={{ background: cahaya }}
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
