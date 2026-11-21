"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Smooth scroll berbasis Lenis khusus desktop (mouse/trackpad).
 * Di HP/layar sentuh (pointer: coarse) dibiarkan memakai scroll native agar tetap ringan & responsif.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia?.("(pointer: coarse)").matches) return;

    const lenis = new Lenis({
      duration: 0.95,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

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
