"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "motion/react";

/**
 * Segel Kaligrafi Orbital Interaktif untuk bagian "Tentang":
 * logo Bakafrawi berada di tengah medali kaca emas yang dikelilingi teks melingkar
 * dan cincin orbit berputar pelan; bereaksi saat di-hover dan berputar penuh saat diklik.
 */
export function SegelLogo() {
  const [putaran, setPutaran] = useState(0);

  return (
    <div className="relative mx-auto flex size-44 items-center justify-center select-none sm:size-48">
      {/* Pendar cahaya emas lembut */}
      <div className="pointer-events-none absolute inset-4 rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.22),transparent_70%)] blur-xl" />

      {/* Cincin orbit luar dengan 2 titik satelit emas */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute inset-1 rounded-full border border-dashed border-emas/25"
      >
        <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-emas shadow-[0_0_10px_rgba(201,162,75,0.9)]" />
        <span className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-teal-400/80 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
      </motion.div>

      {/* Teks melingkar SVG yang berputar pelan berlawanan arah */}
      <motion.svg
        viewBox="0 0 200 200"
        animate={{ rotate: -360 }}
        transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden="true"
      >
        <defs>
          <path
            id="lingkar-bakafrawi"
            d="M 100, 100 m -74, 0 a 74,74 0 1,1 148,0 a 74,74 0 1,1 -148,0"
          />
        </defs>
        <text
          fill="rgba(227,201,137,0.68)"
          fontSize="10.2"
          fontWeight="600"
          letterSpacing="3.4"
        >
          <textPath href="#lingkar-bakafrawi" startOffset="0%">
            BAKAFRAWI PROJECT · SOFTWARE &amp; DESIGN STUDIO ·
          </textPath>
        </text>
      </motion.svg>

      {/* Medali Logo Kaligrafi di tengah (interaktif saat hover & klik) */}
      <motion.button
        type="button"
        onClick={() => setPutaran((p) => p + 360)}
        animate={{ rotate: putaran }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        aria-label="Segel Kaligrafi Bakafrawi"
        className="relative z-10 flex size-24 cursor-pointer items-center justify-center rounded-full border border-emas/40 bg-gradient-to-br from-[#191e27] via-[#10131a] to-[#090b10] p-4 shadow-[0_14px_40px_-10px_rgba(0,0,0,0.9),0_0_32px_-8px_rgba(201,162,75,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emas"
      >
        <Image
          src="/logo.png"
          alt="Logo Bakafrawi"
          width={56}
          height={56}
          className="object-contain drop-shadow-[0_2px_10px_rgba(201,162,75,0.35)]"
        />
      </motion.button>
    </div>
  );
}
