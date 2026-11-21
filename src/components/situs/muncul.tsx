"use client";

import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Membungkus elemen di bawah lipatan layar agar muncul halus saat masuk layar (CSS GPU + IntersectionObserver). */
export function Muncul({
  jeda = 0,
  className,
  style,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { jeda?: number }) {
  const ref = useRef<HTMLDivElement>(null);
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

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: jeda ? `${Math.round(jeda * 1000)}ms` : undefined,
        ...style,
      }}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        terlihat ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
