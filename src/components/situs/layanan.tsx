import { AppWindow, Building2, LayoutTemplate, Rocket } from "lucide-react";
import type { Layanan as TLayanan } from "@/content/situs";
import { Bagian, KepalaBagian } from "./bagian";
import { Muncul } from "./muncul";

const ikon = { web: LayoutTemplate, aplikasi: AppWindow, lembaga: Building2, saas: Rocket };

export function Layanan({ layanan }: { layanan: TLayanan[] }) {
  return (
    <Bagian id="layanan">
      <KepalaBagian
        label="Layanan"
        judul="Apa yang kami kerjakan"
        isi="Dari halaman profil sederhana hingga sistem operasional lengkap — dibangun sesuai pesanan, kebutuhan, dan anggaran Anda."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {layanan.map((l, i) => {
          const Ikon = ikon[l.ikon];
          return (
            <Muncul key={l.judul} jeda={(i % 2) * 0.08} className="group rounded-2xl border border-border bg-card p-7 transition duration-300 hover:-translate-y-1.5 hover:border-white/15">
              <div className="mb-5 grid size-12 place-items-center rounded-xl bg-emas/12 text-emas transition group-hover:bg-emas/20">
                <Ikon className="size-6" />
              </div>
              <h3 className="mb-2.5 text-lg font-semibold">{l.judul}</h3>
              <p className="mb-5 text-[0.95rem] text-muted-foreground">{l.isi}</p>
              <div className="flex flex-wrap gap-2">
                {l.tag.map((t) => (
                  <span key={t} className="rounded-full border border-border bg-white/[.04] px-3 py-1 text-xs text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </Muncul>
          );
        })}
      </div>
    </Bagian>
  );
}
