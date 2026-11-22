import Image from "next/image";
import { Mail, MessageCircle } from "lucide-react";
import type { Situs } from "@/content/skema";
import { Bagian, Label, TombolTautan } from "./bagian";
import { FormKontak } from "./form-kontak";
import { IkonSosial, namaSosial } from "./ikon-sosial";
import { Muncul } from "./muncul";
import { LencanaPengunjungFooter } from "./pencatat-pengunjung";

export function Kontak({ situs }: { situs: Situs }) {
  const { kontak } = situs;
  return (
    <Bagian id="kontak" className="pb-16">
      <Muncul className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[#181c22] to-[#0f1216] px-5 py-12 text-center shadow-[0_24px_60px_-28px_rgba(0,0,0,.85)] sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -bottom-36 left-1/2 h-72 w-[30rem] -translate-x-1/2 bg-[radial-gradient(circle,rgba(201,162,75,.14),transparent_65%)]" />
        <Label className="justify-center">Kontak</Label>
        <h2 className="relative mx-auto mb-4 max-w-2xl font-heading text-3xl font-medium sm:text-5xl">Punya proyek? Ayo ngobrol dulu.</h2>
        <p className="relative mx-auto mb-10 max-w-lg text-muted-foreground">
          Ceritakan kebutuhan Anda — website, aplikasi, sistem lembaga, atau ingin memakai Maktaba POS. Kami balas dengan rekomendasi &amp; estimasi secepatnya.
        </p>
        <FormKontak whatsappNomor={kontak.whatsappNomor} />
        {/* Baris status form di atas sudah memberi jarak; mt-8 dulu membuat celah kosong besar di HP. */}
        <div className="relative mt-4 flex flex-col justify-center gap-3 sm:flex-row">
          <TombolTautan href={`https://wa.me/${kontak.whatsappNomor}?text=${encodeURIComponent("Halo Bakafrawi, saya ingin konsultasi.")}`} baru varian="garis">
            <MessageCircle className="size-4" /> WhatsApp {kontak.whatsappTampil}
          </TombolTautan>
          <TombolTautan href={`mailto:${kontak.email}`} varian="garis">
            <Mail className="size-4" /> {kontak.email}
          </TombolTautan>
        </div>
        <div className="relative mt-9 flex justify-center gap-4">
          {kontak.sosial.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener"
              aria-label={namaSosial[s.jenis]}
              className="grid size-11 place-items-center rounded-full border border-border text-muted-foreground transition hover:-translate-y-0.5 hover:border-emas hover:text-emas"
            >
              <IkonSosial jenis={s.jenis} className="size-5" />
            </a>
          ))}
        </div>
      </Muncul>
    </Bagian>
  );
}

// Tahun dihitung sekali lalu di-cache; Cache Components menolak `new Date()` mentah saat prerender.
async function tahunIni() {
  "use cache";
  return new Date().getFullYear();
}

export async function Footer({ situs }: { situs: Situs }) {
  const tahun = await tahunIni();
  return (
    // Di HP logo, teks, dan tautan ditumpuk di tengah; dulu logo di samping teks dua baris sehingga
    // teks terdorong miring dan tautan berderet berantakan (keluhan Kyai, 19 Nov 2026).
    <footer className="border-t border-border pt-9 pb-[calc(2.25rem+env(safe-area-inset-bottom))] text-sm text-redup">
      <div className="wadah flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Image src="/logo.png" alt="" width={32} height={32} />
          <div className="leading-relaxed">
            <div>© {tahun} Bakafrawi Project<span className="hidden sm:inline">. All rights reserved.</span></div>
            <div>{situs.kontak.lokasi}</div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
          <LencanaPengunjungFooter />
          <a href="/privasi" className="text-muted-foreground hover:text-emas">Kebijakan privasi</a>
        </div>
      </div>
    </footer>
  );
}
