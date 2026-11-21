"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Smooth scroll elegan berbasis Lenis untuk halaman utama Bakafrawi.
 * Otomatis nonaktif jika pengguna memilih prefers-reduced-motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    // Dukung klik tautan anchor (#produk, #layanan, #kontak, dll.) agar meluncur mulus
    const klikAnchor = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest("a[href^='#']") as HTMLAnchorElement | null;
      if (!target) return;
      const hash = target.getAttribute("href");
      if (!hash || hash === "#") return;
      const el = document.querySelector(hash);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -80 });
    };
    document.addEventListener("click", klikAnchor);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("click", klikAnchor);
      lenis.destroy();
    };
  }, []);

  return null;
}
