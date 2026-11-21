"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const menu = [
  { href: "#layanan", label: "Layanan" },
  { href: "#produk", label: "Produk" },
  { href: "#karya", label: "Karya" },
  { href: "#proses", label: "Proses" },
  { href: "#kontak", label: "Kontak" },
];

export function Navbar({ nama }: { nama: string }) {
  const [tergulir, setTergulir] = useState(false);
  const [buka, setBuka] = useState(false);
  const progresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const perbarui = () => {
      const y = window.scrollY;
      setTergulir(y > 24);
      const el = progresRef.current;
      if (el) {
        const maks = document.documentElement.scrollHeight - window.innerHeight;
        const rasio = maks > 0 ? Math.min(1, Math.max(0, y / maks)) : 0;
        el.style.transform = `scaleX(${rasio})`;
      }
    };
    perbarui();
    window.addEventListener("scroll", perbarui, { passive: true });
    return () => window.removeEventListener("scroll", perbarui);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 transition-all duration-300">
      {/* Garis progres baca emas tipis di puncak layar (murni transform GPU tanpa motion/react) */}
      <div
        ref={progresRef}
        style={{ transform: "scaleX(0)", transformOrigin: "0% 50%" }}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] bg-gradient-to-r from-emas/40 via-emas to-emas-muda transition-transform duration-100 ease-out will-change-transform"
      />
      <div
        className={cn(
          "mx-auto flex items-center justify-between transition-all duration-300",
          tergulir
            ? "mt-3 h-[60px] max-w-4xl rounded-full border border-white/12 bg-background/85 px-5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] backdrop-blur-md sm:px-6"
            : "wadah h-[74px] border-b border-transparent",
        )}
      >
        <a href="#beranda" className="group flex items-center gap-2.5 text-lg font-bold">
          <Image
            src="/logo.png"
            alt=""
            width={34}
            height={34}
            preload
            className="transition-transform duration-700 ease-out group-hover:rotate-[360deg]"
          />
          {nama}
          <span className="-ml-2 text-emas">.</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {menu.map((m) => (
            <a key={m.href} href={m.href} className="group relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {m.label}
              <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-emas transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        <a href="#kontak" className="hidden rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_rgba(201,162,75,.6)] transition hover:-translate-y-0.5 hover:bg-emas-muda md:inline-flex">
          Konsultasi Gratis
        </a>

        <Sheet open={buka} onOpenChange={setBuka}>
          <SheetTrigger className="rounded-md p-2 text-foreground md:hidden" aria-label="Buka menu">
            <Menu className="size-6" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 border-border bg-background">
            <SheetTitle className="px-6 pt-6 font-heading text-xl">{nama}</SheetTitle>
            <nav className="flex flex-col px-6 pb-6">
              {menu.map((m) => (
                <a key={m.href} href={m.href} onClick={() => setBuka(false)} className="border-b border-border py-3 text-muted-foreground hover:text-foreground">
                  {m.label}
                </a>
              ))}
              <a href="#kontak" onClick={() => setBuka(false)} className="mt-6 rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground">
                Konsultasi Gratis
              </a>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
