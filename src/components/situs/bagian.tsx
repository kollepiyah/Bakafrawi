import type { ReactNode } from "react";
import { Muncul } from "./muncul";
import { cn } from "@/lib/utils";

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("mb-4 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-emas uppercase", className)}>
      <span className="h-px w-6 bg-emas/70" />
      {children}
    </span>
  );
}

export function KepalaBagian({ label, judul, isi }: { label: string; judul: ReactNode; isi?: ReactNode }) {
  return (
    <Muncul>
      <Label>{label}</Label>
      <h2 className="mb-4 font-heading text-3xl font-medium sm:text-4xl lg:text-[2.6rem]">{judul}</h2>
      {isi && <p className="max-w-xl text-muted-foreground">{isi}</p>}
    </Muncul>
  );
}

export function Bagian({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn("relative scroll-mt-16 py-20 sm:py-28", className)}>
      <div className="wadah">{children}</div>
    </section>
  );
}

/** Tombol berbentuk tautan; dipakai di seluruh halaman agar gaya tombol tak tercecer. */
export function TombolTautan({
  href,
  varian = "utama",
  baru,
  children,
  className,
}: {
  href: string;
  varian?: "utama" | "garis";
  baru?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      {...(baru ? { target: "_blank", rel: "noopener" } : {})}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold whitespace-nowrap transition duration-200 hover:-translate-y-0.5",
        varian === "utama"
          ? "bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_rgba(201,162,75,.6)] hover:bg-emas-muda"
          : "border border-white/15 text-foreground hover:border-emas hover:text-emas",
        className,
      )}
    >
      {children}
    </a>
  );
}
