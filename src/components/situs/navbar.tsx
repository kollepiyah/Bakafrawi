"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const cek = () => setTergulir(window.scrollY > 20);
    cek();
    window.addEventListener("scroll", cek, { passive: true });
    return () => window.removeEventListener("scroll", cek);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300",
        tergulir ? "border-border bg-background/75 backdrop-blur-xl" : "border-transparent",
      )}
    >
      <div className="wadah flex h-[72px] items-center justify-between">
        <a href="#beranda" className="flex items-center gap-2.5 text-lg font-bold">
          <Image src="/logo.png" alt="" width={34} height={34} priority />
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
