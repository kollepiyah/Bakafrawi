"use client";

import { useEffect, useRef } from "react";

/**
 * Pendar cahaya lembut mengikuti kursor di seluruh halaman (khusus desktop mouse/trackpad).
 * Murni manipulasi transform GPU tanpa React re-render; 0% beban di HP/layar sentuh.
 */
export function CahayaKursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia?.("(pointer: fine)").matches) return;

    const el = ref.current;
    if (!el) return;

    let targetX = -999;
    let targetY = -999;
    let curX = -999;
    let curY = -999;
    let rafId = 0;

    const gerak = () => {
      curX += (targetX - curX) * 0.14;
      curY += (targetY - curY) * 0.14;
      el.style.transform = `translate3d(${curX - 240}px, ${curY - 240}px, 0)`;

      if (Math.abs(targetX - curX) > 0.5 || Math.abs(targetY - curY) > 0.5) {
        rafId = requestAnimationFrame(gerak);
      } else {
        rafId = 0;
      }
    };

    const saatGerak = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (curX < -500) {
        curX = targetX;
        curY = targetY;
        el.style.opacity = "1";
      }
      if (!rafId) rafId = requestAnimationFrame(gerak);
    };

    const saatKeluar = () => {
      el.style.opacity = "0";
    };

    window.addEventListener("pointermove", saatGerak, { passive: true });
    document.addEventListener("pointerleave", saatKeluar);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", saatGerak);
      document.removeEventListener("pointerleave", saatKeluar);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-30 hidden size-[480px] rounded-full opacity-0 transition-opacity duration-500 will-change-transform md:block"
      style={{
        background:
          "radial-gradient(circle, rgba(201,162,75,0.085) 0%, rgba(24,180,168,0.045) 38%, transparent 70%)",
      }}
    />
  );
}
