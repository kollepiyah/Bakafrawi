import { ArrowRight } from "lucide-react";
import type { Situs } from "@/content/skema";
import { AuroraBg } from "./aurora-bg";
import { Label, TombolTautan } from "./bagian";
import { CountUp, ShinyText, TombolMagnet } from "./efek-teks";
import { KartuLanyard } from "./kartu-lanyard";

export function Hero({ situs }: { situs: Situs }) {
  const { hero, statistik, statusProyek } = situs;
  return (
    <section id="beranda" className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-24">
      {/* Latar belakang Aurora & meteor cahaya (murni CSS GPU) */}
      <AuroraBg />

      {/* Grid halus berpola di atas Aurora */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />

      <div className="wadah relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
          {/* Kolom Kiri: Headline + CTA (langsung tampil di SSR tanpa opacity: 0 agar LCP instan) */}
          <div>
            <span className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-black/45 px-4 py-1.5 text-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-green-400" />
              </span>
              <ShinyText>{statusProyek}</ShinyText>
            </span>

            <Label>{hero.label}</Label>

            <h1 className="mb-6 max-w-[15ch] font-heading text-[2.5rem] leading-[1.06] font-medium sm:text-5xl lg:text-[4.1rem]">
              {hero.judul}{" "}
              {hero.sorot.map((kata, i) => (
                <span key={kata}>
                  <em className="italic text-emas-muda">{kata}</em>
                  {i < hero.sorot.length - 1 ? " & " : "."}
                </span>
              ))}
            </h1>

            <p className="mb-9 max-w-xl text-base text-muted-foreground sm:text-lg">{hero.isi}</p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <TombolMagnet>
                <TombolTautan href="#kontak">
                  Konsultasi Gratis <ArrowRight className="size-4" />
                </TombolTautan>
              </TombolMagnet>
              <TombolMagnet>
                <TombolTautan href="#produk" varian="garis">
                  Lihat Produk
                </TombolTautan>
              </TombolMagnet>
            </div>
          </div>

          {/* Kolom Kanan: Kartu Lanyard 3D Interaktif */}
          <div className="relative">
            <KartuLanyard nama={situs.nama} status={statusProyek} foto={hero.fotoKartu} />
          </div>
        </div>

        {/* Bar Statistik */}
        <div className="mt-14 grid grid-cols-2 gap-6 border-t border-border pt-8 sm:grid-cols-4">
          {statistik.map((s) => (
            <div key={s.label}>
              <div className="font-heading text-3xl leading-none text-foreground">
                <CountUp nilai={s.angka} />
              </div>
              <div className="mt-2 text-sm text-redup">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
