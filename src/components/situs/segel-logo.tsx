"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "motion/react";

/**
 * Segel Kaligrafi Orbital ringkas untuk menyatu di header kartu "Sekilas" pada bagian Tentang.
 * Putaran orbit memakai CSS murni agar ringan di GPU.
 */
export function SegelLogo() {
  const [putaran, setPutaran] = useState(0);

  return (
    <div className="relative flex size-24 shrink-0 items-center justify-center select-none sm:size-28">
      {/* Pendar cahaya emas halus */}
      <div className="pointer-events-none absolute inset-2 rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.2),transparent_70%)] blur-md" />

      {/* Cincin orbit luar berputar pelan (CSS murni) */}
      <div className="pointer-events-none absolute inset-0.5 animate-[spin_26s_linear_infinite] rounded-full border border-dashed border-emas/30">
        <span className="absolute -top-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-emas" />
        <span className="absolute -bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-teal-400/80" />
      </div>

      {/* Teks melingkar SVG */}
      <svg
        viewBox="0 0 200 200"
        className="pointer-events-none absolute inset-0 size-full animate-[spin_36s_linear_infinite_reverse]"
        aria-hidden="true"
      >
        <defs>
          <path
            id="lingkar-bakafrawi"
            d="M 100, 100 m -74, 0 a 74,74 0 1,1 148,0 a 74,74 0 1,1 -148,0"
          />
        </defs>
        <text fill="rgba(227,201,137,0.7)" fontSize="11.5" fontWeight="600" letterSpacing="3.4">
          <textPath href="#lingkar-bakafrawi" startOffset="0%">
            BAKAFRAWI PROJECT · STUDIO DIGITAL ·
          </textPath>
        </text>
      </svg>

      {/* Medali Logo Kaligrafi di tengah */}
      <motion.button
        type="button"
        onClick={() => setPutaran((p) => p + 360)}
        animate={{ rotate: putaran }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        aria-label="Segel Kaligrafi Bakafrawi"
        className="relative z-10 flex size-14 cursor-pointer items-center justify-center rounded-full border border-emas/40 bg-gradient-to-br from-[#191e27] via-[#10131a] to-[#090b10] p-2.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emas sm:size-16"
      >
        <Image src="/logo.png" alt="Logo Bakafrawi" width={36} height={36} className="object-contain" />
      </motion.button>
    </div>
  );
}
