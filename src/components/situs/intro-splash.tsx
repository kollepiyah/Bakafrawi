"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const KUNCI_SESI = "bakafrawi_intro_tampil";

/**
 * Animasi pembuka singkat (±0,85 detik) saat situs pertama kali dibuka di sesi tab:
 * logo kaligrafi Bakafrawi menyala emas di tengah layar lalu tirai terangkat halus membuka Hero.
 * Konten utama tetap ter-render penuh di bawahnya (aman untuk SEO & aksesibilitas).
 */
export function IntroSplash({ nama = "Bakafrawi" }: { nama?: string }) {
  const kurangiGerak = useReducedMotion();
  const [tampil, setTampil] = useState(false);

  useEffect(() => {
    if (kurangiGerak) return;
    try {
      if (sessionStorage.getItem(KUNCI_SESI)) return;
      sessionStorage.setItem(KUNCI_SESI, "1");
    } catch {
      // Abaikan jika browser memblokir sessionStorage
    }
    setTampil(true);
    const timer = window.setTimeout(() => setTampil(false), 900);
    return () => window.clearTimeout(timer);
  }, [kurangiGerak]);

  return (
    <AnimatePresence>
      {tampil && (
        <motion.div
          key="bakafrawi-splash"
          initial={{ y: 0, opacity: 1 }}
          exit={{
            y: "-100%",
            transition: { duration: 0.65, ease: [0.76, 0, 0.24, 1] },
          }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#090b10]"
          aria-hidden="true"
        >
          {/* Pendar cahaya emas di belakang logo */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.25, opacity: 1 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
            className="pointer-events-none absolute size-72 rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.28),transparent_68%)] blur-2xl"
          />

          {/* Cincin orbit tipis yang mengembang */}
          <motion.div
            initial={{ scale: 0.72, opacity: 0 }}
            animate={{ scale: 1.12, opacity: 0.5 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute size-40 rounded-full border border-emas/35"
          />

          {/* Medali Logo Kaligrafi */}
          <motion.div
            initial={{ scale: 0.78, opacity: 0, filter: "blur(6px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex size-24 items-center justify-center rounded-3xl border border-emas/40 bg-gradient-to-br from-[#171b23] to-[#0c0e14] p-4 shadow-[0_0_50px_-8px_rgba(201,162,75,0.55)]"
          >
            <Image
              src="/logo.png"
              alt=""
              width={64}
              height={64}
              priority
              className="object-contain"
            />
          </motion.div>

          {/* Nama studio di bawah logo */}
          <motion.p
            initial={{ opacity: 0, y: 10, letterSpacing: "0.35em" }}
            animate={{ opacity: 0.9, y: 0, letterSpacing: "0.24em" }}
            transition={{ duration: 0.5, delay: 0.16, ease: "easeOut" }}
            className="mt-5 font-heading text-xs font-medium text-emas-muda uppercase"
          >
            {nama} Project
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
