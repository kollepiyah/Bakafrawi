"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps } from "react";

/** Membungkus elemen agar muncul halus saat masuk layar; dimatikan bila pengguna minta gerak dikurangi. */
export function Muncul({ jeda = 0, className, children, ...rest }: ComponentProps<typeof motion.div> & { jeda?: number }) {
  const kurangiGerak = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={kurangiGerak ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.7, delay: jeda, ease: [0.2, 0.7, 0.2, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
