import { ArrowRight } from "lucide-react";
import type { Situs } from "@/content/situs";
import { Label, TombolTautan } from "./bagian";
import { Muncul } from "./muncul";

export function Hero({ situs }: { situs: Situs }) {
  const { hero, statistik, statusProyek } = situs;
  return (
    <section id="beranda" className="relative overflow-hidden pt-36 pb-24 sm:pt-44 sm:pb-28">
      <div className="pointer-events-none absolute -top-40 -right-32 size-[560px] rounded-full bg-[radial-gradient(circle,rgba(201,162,75,.16),transparent_62%)] blur-xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="wadah relative">
        <Muncul>
          <span className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-green-400" />
            </span>
            {statusProyek}
          </span>
        </Muncul>
        <Muncul jeda={0.05}>
          <Label>{hero.label}</Label>
        </Muncul>
        <Muncul jeda={0.1}>
          <h1 className="mb-6 max-w-[15ch] font-heading text-[2.6rem] leading-[1.08] font-medium sm:text-6xl lg:text-7xl">
            {hero.judul}{" "}
            {hero.sorot.map((kata, i) => (
              <span key={kata}>
                <em className="text-emas">{kata}</em>
                {i < hero.sorot.length - 1 ? " & " : "."}
              </span>
            ))}
          </h1>
        </Muncul>
        <Muncul jeda={0.15}>
          <p className="mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">{hero.isi}</p>
        </Muncul>
        <Muncul jeda={0.2} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TombolTautan href="#kontak">
            Konsultasi Gratis <ArrowRight className="size-4" />
          </TombolTautan>
          <TombolTautan href="#produk" varian="garis">
            Lihat Produk
          </TombolTautan>
        </Muncul>
        <Muncul jeda={0.25} className="mt-16 grid grid-cols-2 gap-6 border-t border-border pt-8 sm:grid-cols-4">
          {statistik.map((s) => (
            <div key={s.label}>
              <div className="font-heading text-3xl leading-none">{s.angka}</div>
              <div className="mt-2 text-sm text-redup">{s.label}</div>
            </div>
          ))}
        </Muncul>
      </div>
    </section>
  );
}
