import { Check } from "lucide-react";
import { ambilPaketMaktaba, rupiah } from "@/lib/paket-maktaba";
import { TombolTautan } from "./bagian";
import { Muncul } from "./muncul";
import { cn } from "@/lib/utils";

export async function HargaMaktaba({ urlDaftar }: { urlDaftar: string }) {
  const paket = await ambilPaketMaktaba();
  if (paket.length === 0) return null;
  const tengah = Math.floor(paket.length / 2);
  const trial = Math.max(...paket.map((p) => p.trialHari));
  return (
    <div className="mt-10">
      <Muncul className="mb-6 text-center">
        <h3 className="font-heading text-2xl">Paket Maktaba POS</h3>
        {trial > 0 && <p className="mt-1 text-sm text-muted-foreground">Coba gratis {trial} hari · bayar bulanan atau tahunan</p>}
      </Muncul>
      <div className="grid gap-5 md:grid-cols-3">
        {paket.map((p, i) => (
          <Muncul
            key={p.nama}
            jeda={i * 0.07}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-card p-6",
              i === tengah && paket.length > 2 ? "border-emas/50 shadow-[0_0_40px_-12px_rgba(201,162,75,.45)]" : "border-border",
            )}
          >
            {i === tengah && paket.length > 2 && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                Terpopuler
              </span>
            )}
            <h4 className="font-heading text-xl">{p.nama}</h4>
            <p className="mt-3 font-heading text-3xl text-emas-muda">
              {rupiah(p.bulanan)}
              <span className="font-sans text-sm text-muted-foreground"> /bulan</span>
            </p>
            {p.tahunan > 0 && (
              <p className="mt-1 text-sm text-redup">
                atau {rupiah(p.tahunan)}/tahun
                {p.tahunan < p.bulanan * 12 && <span className="text-green-400"> · hemat {rupiah(p.bulanan * 12 - p.tahunan)}</span>}
              </p>
            )}
            <ul className="mt-5 grow space-y-2 text-sm">
              {p.poin.map((t) => (
                <li key={t} className="flex gap-2 text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-emas" /> {t}
                </li>
              ))}
            </ul>
            <TombolTautan href={urlDaftar} baru varian={i === tengah ? "utama" : "garis"} className="mt-6">
              Mulai dengan {p.nama}
            </TombolTautan>
          </Muncul>
        ))}
      </div>
    </div>
  );
}
