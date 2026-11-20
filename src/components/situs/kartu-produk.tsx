import Image from "next/image";
import { ArrowUpRight, Check } from "lucide-react";
import type { Produk } from "@/content/situs";
import { TombolTautan } from "./bagian";
import { KartuSpotlight } from "./kartu-spotlight";
import { Muncul } from "./muncul";

export function KartuProduk({ produk }: { produk: Produk }) {
  const adaTautanUtama = produk.tautan.some((t) => t.utama);
  return (
    <div className="mt-14 first:mt-12">
      <KartuSpotlight className="bg-gradient-to-br from-card to-[#15191f] p-7 shadow-[0_24px_60px_-28px_rgba(0,0,0,.85)] sm:p-10 lg:p-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <div className="pointer-events-none absolute -top-28 -right-20 size-96 rounded-full bg-[radial-gradient(circle,rgba(201,162,75,.12),transparent_65%)]" />
        <div className="relative">
          <div className="mb-5 flex items-center gap-3">
            {produk.logo && (
              <Image
                src={produk.logo.src}
                alt={produk.logo.alt}
                width={produk.logo.lebar}
                height={produk.logo.tinggi}
                className="h-11 w-auto rounded-lg object-contain"
              />
            )}
            <span className="rounded-full border border-emas/25 bg-emas/12 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-emas">
              {produk.label}
            </span>
          </div>
          <h3 className="mb-4 font-heading text-2xl font-medium sm:text-3xl">{produk.judul}</h3>
          <p className="mb-5 text-muted-foreground">{produk.deskripsi}</p>
          {produk.klien && (
            <p className="mb-5 text-sm text-redup">
              Dikembangkan untuk <span className="text-foreground">{produk.klien}</span>
            </p>
          )}
          <div className="mb-7 flex flex-wrap gap-2">
            {produk.platform.map((p) => (
              <span key={p} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
                {p}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {produk.tautan.map((t) => (
              <TombolTautan key={t.url} href={t.url} baru varian={t.utama ? "utama" : "garis"}>
                {t.label} <ArrowUpRight className="size-4" />
              </TombolTautan>
            ))}
            <TombolTautan href="#kontak" varian={adaTautanUtama ? "garis" : "utama"}>
              {produk.kategori === "pesanan" ? "Pesan yang serupa" : "Tanya / minta demo"}
            </TombolTautan>
          </div>
        </div>
        <ul className="relative grid content-center gap-4">
          {produk.fitur.map((f) => (
            <li key={f.judul} className="flex gap-3 text-muted-foreground">
              <Check className="mt-0.5 size-5 shrink-0 text-emas" />
              <span>
                <b className="font-semibold text-foreground">{f.judul}:</b> {f.isi}
              </span>
            </li>
          ))}
        </ul>
        </div>
      </KartuSpotlight>

      {produk.layarDesktop?.map((g) => (
        <Muncul key={g.src} className="mx-auto mt-10 max-w-4xl">
          <div className="overflow-hidden rounded-xl border border-white/15 bg-[#0a0c10] shadow-[0_24px_60px_-28px_rgba(0,0,0,.85)]">
            <Image src={g.src} alt={g.alt} width={g.lebar} height={g.tinggi} sizes="(min-width: 1024px) 896px, 100vw" className="w-full" />
          </div>
          {g.keterangan && <p className="mt-3 text-center text-sm text-redup">{g.keterangan}</p>}
        </Muncul>
      ))}

      {produk.layarHp && produk.layarHp.length > 0 && (
        <div className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 sm:justify-center sm:overflow-visible">
          {produk.layarHp.map((g, i) => (
            <Muncul key={g.src} jeda={i * 0.08} className="w-[62vw] max-w-[230px] shrink-0 snap-center">
              <figure>
                <div className="rounded-[30px] border border-white/15 bg-[#0a0c10] p-2 shadow-[0_24px_60px_-28px_rgba(0,0,0,.85)]">
                  <Image src={g.src} alt={g.alt} width={g.lebar} height={g.tinggi} sizes="230px" className="w-full rounded-[22px]" />
                </div>
                {g.keterangan && <figcaption className="mt-3 text-center text-sm text-redup">{g.keterangan}</figcaption>}
              </figure>
            </Muncul>
          ))}
        </div>
      )}
    </div>
  );
}
