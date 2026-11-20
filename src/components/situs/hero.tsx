import { ArrowRight } from "lucide-react";
import type { Situs } from "@/content/skema";
import { Label, TombolTautan } from "./bagian";
import { KartuLanyard } from "./kartu-lanyard";
import { Muncul } from "./muncul";

export function Hero({ situs }: { situs: Situs }) {
  const { hero, statistik, statusProyek } = situs;
  return (
    <section id="beranda" className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-24">
      {/* Cahaya ambient emas & teal gelap halus */}
      <div className="pointer-events-none absolute -top-40 -right-32 size-[580px] rounded-full bg-[radial-gradient(circle,rgba(201,162,75,.18),transparent_62%)] blur-2xl" />
      <div className="pointer-events-none absolute top-40 -left-40 size-[460px] rounded-full bg-[radial-gradient(circle,rgba(24,180,168,.10),transparent_65%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />

      <div className="wadah relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.18fr_0.82fr] lg:gap-10">
          {/* Kolom Kiri: Headline + CTA */}
          <div>
            <Muncul>
              <span className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.03] px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-md">
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
              <h1 className="mb-6 max-w-[15ch] font-heading text-[2.5rem] leading-[1.06] font-medium sm:text-5xl lg:text-[4.1rem]">
                {hero.judul}{" "}
                {hero.sorot.map((kata, i) => (
                  <span key={kata}>
                    <em className="bg-gradient-to-r from-emas via-emas-muda to-amber-200 bg-clip-text text-transparent">
                      {kata}
                    </em>
                    {i < hero.sorot.length - 1 ? " & " : "."}
                  </span>
                ))}
              </h1>
            </Muncul>
            <Muncul jeda={0.15}>
              <p className="mb-9 max-w-xl text-base text-muted-foreground sm:text-lg">{hero.isi}</p>
            </Muncul>
            <Muncul jeda={0.2} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <TombolTautan href="#kontak">
                Konsultasi Gratis <ArrowRight className="size-4" />
              </TombolTautan>
              <TombolTautan href="#produk" varian="garis">
                Lihat Produk
              </TombolTautan>
            </Muncul>
          </div>

          {/* Kolom Kanan: Kartu Lanyard 3D Interaktif */}
          <Muncul jeda={0.15} className="relative">
            <KartuLanyard nama={situs.nama} status={statusProyek} foto={hero.fotoKartu} />
          </Muncul>
        </div>

        {/* Bar Statistik */}
        <Muncul jeda={0.25} className="mt-14 grid grid-cols-2 gap-6 border-t border-border pt-8 sm:grid-cols-4">
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
