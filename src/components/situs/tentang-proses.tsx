import type { Situs } from "@/content/skema";
import { Bagian, KepalaBagian, Label } from "./bagian";
import { Muncul } from "./muncul";

export function Proses({ proses }: { proses: Situs["proses"] }) {
  return (
    <Bagian id="proses">
      <KepalaBagian label="Proses" judul="Cara kami bekerja" isi="Alur yang sederhana dan transparan, dari obrolan pertama sampai sistem berjalan di domain Anda." />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {proses.map((p, i) => (
          <Muncul key={p.judul} jeda={i * 0.06} className="rounded-2xl border border-border bg-card p-6 transition duration-300 hover:-translate-y-1.5 hover:border-white/15">
            <div className="mb-4 font-heading text-3xl leading-none text-emas">{String(i + 1).padStart(2, "0")}</div>
            <h3 className="mb-2 font-semibold">{p.judul}</h3>
            <p className="text-sm text-muted-foreground">{p.isi}</p>
          </Muncul>
        ))}
      </div>
    </Bagian>
  );
}

export function Tentang({ situs }: { situs: Situs }) {
  const { tentang, kontak, statusProyek } = situs;
  const fakta = [
    ...tentang.fakta,
    { label: "Email", isi: kontak.email },
    { label: "WhatsApp", isi: kontak.whatsappTampil },
    { label: "Status", isi: statusProyek },
  ];
  return (
    <Bagian id="tentang">
      <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
        <Muncul>
          <Label>Tentang</Label>
          <h2 className="mb-6 font-heading text-3xl font-medium sm:text-4xl">{tentang.judul}</h2>
          {tentang.paragraf.map((p) => (
            <p key={p} className="mb-4 text-muted-foreground">
              {p}
            </p>
          ))}
        </Muncul>
        <Muncul jeda={0.1} className="rounded-2xl border border-border bg-gradient-to-br from-card to-[#15191f] p-7 shadow-[0_24px_60px_-28px_rgba(0,0,0,.85)]">
          <h3 className="mb-4 font-semibold">Sekilas</h3>
          <dl>
            {fakta.map((f) => (
              <div key={f.label} className="flex justify-between gap-4 border-b border-border py-3.5 text-[0.95rem] last:border-0 last:pb-0">
                <dt className="text-redup">{f.label}</dt>
                <dd className="text-right font-medium">{f.isi}</dd>
              </div>
            ))}
          </dl>
        </Muncul>
      </div>
    </Bagian>
  );
}
