"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { AlertTriangle, Bot, CalendarDays, Clock, LayoutGrid, Loader2, Sparkles, Users } from "lucide-react";
import { TandaAplikasi, useRingkasanAplikasi } from "./aplikasi";
import { Deck } from "./deck";
import { jamWIB, namaTanggal, tanggalWIB, type Acara } from "@/lib/agenda-murni";
import type { RingkasanPengunjung } from "@/lib/kunjungan-murni";
import { apiAdmin } from "./agenda";

type Ringkasan = {
  tanggal: string;
  acaraHariIni: Acara[];
  acaraPekan: Acara[];
  konten: { menungguPersetujuan: number; sedangDibuat: number; terjadwal: number; gagal: number };
  google: { siap: boolean; tersambung: boolean; galat: string | null };
  pengunjung?: RingkasanPengunjung | null;
};

export function Beranda({ sesi, kepala, buka }: { sesi: Session | null; kepala: ReactNode; buka: (h: "agenda" | "studio" | "aplikasi") => void }) {
  const [r, setR] = useState<Ringkasan | null>(null);
  const aplikasi = useRingkasanAplikasi(sesi).daftar;
  const [pesan, setPesan] = useState("");
  const [jam, setJam] = useState<number | null>(null); // jam WIB saat dimuat (render harus murni)

  const muat = useCallback(async () => {
    setJam(Number(jamWIB(new Date().toISOString()).slice(0, 2)));
    const j = await apiAdmin(sesi)("/api/beranda");
    if (j.ok) setR(j as unknown as Ringkasan);
    else setPesan(j.pesan ?? "Gagal memuat ringkasan.");
  }, [sesi]);

  useEffect(() => {
    const t = setTimeout(muat, 0);
    return () => clearTimeout(t);
  }, [muat]);

  const salam = jam === null ? "Assalamu'alaikum" : jam < 11 ? "Selamat pagi" : jam < 15 ? "Selamat siang" : jam < 18 ? "Selamat sore" : "Selamat malam";

  return (
    <div className="pb-16">
      {kepala}
      <main className="mx-auto max-w-4xl space-y-6 px-4 pt-6">
        <div>
          <h1 className="font-heading text-2xl">{salam}, Kyai</h1>
          {r && <p className="text-sm text-muted-foreground">{namaTanggal(r.tanggal)}</p>}
        </div>
        {pesan && <p className="text-sm text-red-300">{pesan}</p>}
        {!r ? (
          !pesan && <Loader2 className="size-5 animate-spin text-emas" />
        ) : (
          <>
            {r.google.siap && (!r.google.tersambung || r.google.galat) && (
              <button onClick={() => buka("agenda")} className="flex w-full items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-200">
                <AlertTriangle className="size-4 shrink-0" /> {r.google.galat ?? "Google Calendar belum tersambung — ketuk untuk menghubungkan."}
              </button>
            )}

            <Kartu judul="Studio AI & Mesin" ikon={<Bot className="size-5 text-emas" />} aksi={() => buka("studio")}>
              <Deck sesi={sesi} bukaStudio={() => buka("studio")} />
            </Kartu>

            <Kartu judul="Agenda hari ini" ikon={<CalendarDays className="size-5 text-emas" />} aksi={() => buka("agenda")}>
              {r.acaraHariIni.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada acara hari ini.</p>
              ) : (
                <ul className="space-y-2">
                  {r.acaraHariIni.map((a) => (
                    <li key={a.id} className="flex gap-3 text-sm">
                      <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{a.seharian ? "Seharian" : `${jamWIB(a.mulai)}–${jamWIB(a.selesai)}`}</span>
                      <span>{a.judul}{a.lokasi && <span className="text-muted-foreground"> · {a.lokasi}</span>}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Kartu>

            <Kartu judul="7 hari ke depan" ikon={<Clock className="size-5 text-emas" />} aksi={() => buka("agenda")}>
              {r.acaraPekan.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada acara.</p>
              ) : (
                <ul className="space-y-2">
                  {r.acaraPekan.slice(0, 6).map((a) => (
                    <li key={a.id} className="flex gap-3 text-sm">
                      <span className="w-24 shrink-0 text-muted-foreground">{namaTanggal(tanggalWIB(new Date(a.mulai))).split(",")[0]} {a.seharian ? "" : jamWIB(a.mulai)}</span>
                      <span>{a.judul}</span>
                    </li>
                  ))}
                  {r.acaraPekan.length > 6 && <li className="text-xs text-muted-foreground">+{r.acaraPekan.length - 6} acara lagi</li>}
                </ul>
              )}
            </Kartu>

            <Kartu judul="Aplikasi" ikon={<LayoutGrid className="size-5 text-emas" />} aksi={() => buka("aplikasi")}>
              {!aplikasi ? (
                <Loader2 className="size-4 animate-spin text-emas" />
              ) : (
                <ul className="space-y-2">
                  {aplikasi.map((a) => (
                    <li key={a.slug} className="flex items-start gap-2 text-sm">
                      <TandaAplikasi a={a} />
                      <span>
                        {a.nama}
                        <span className="text-muted-foreground"> · {a.ok ? (a.penilaian?.catatan[0] ?? "baik") : "belum tersambung"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Kartu>

            <Kartu judul="Konten (30 hari)" ikon={<Sparkles className="size-5 text-emas" />} aksi={() => buka("studio")}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Angka n={r.konten.menungguPersetujuan} label="Menunggu persetujuan" sorot />
                <Angka n={r.konten.sedangDibuat} label="Sedang dibuat" />
                <Angka n={r.konten.terjadwal} label="Akan tayang" />
                <Angka n={r.konten.gagal} label="Gagal" />
              </div>
            </Kartu>

            {r.pengunjung && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-heading text-lg">
                    <Users className="size-5 text-emas" /> Pengunjung Situs
                  </h2>
                  <span className="text-xs text-muted-foreground">Anti-bot · 1 unik/hari · {r.pengunjung.persenHp}% HP</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <AngkaPengunjung unik={r.pengunjung.hariIniUnik} tayangan={r.pengunjung.hariIniTayangan} label="Hari ini" sorot />
                  <AngkaPengunjung unik={r.pengunjung.pekanUnik} tayangan={r.pengunjung.pekanTayangan} label="7 hari" />
                  <AngkaPengunjung unik={r.pengunjung.bulanUnik} tayangan={r.pengunjung.bulanTayangan} label="30 hari" />
                  <AngkaPengunjung unik={r.pengunjung.totalUnik} tayangan={r.pengunjung.totalTayangan} label="Total" />
                </div>
                {(r.pengunjung.halamanTeratas.length > 0 || r.pengunjung.sumberTeratas.length > 0) && (
                  <div className="mt-4 grid gap-4 border-t border-border/60 pt-4 text-xs sm:grid-cols-2">
                    <div>
                      <p className="mb-2 font-medium text-muted-foreground">Halaman terpopuler (30 hari)</p>
                      <ul className="space-y-1">
                        {r.pengunjung.halamanTeratas.map((h) => (
                          <li key={h.jalur} className="flex justify-between gap-2">
                            <span className="truncate font-mono text-foreground/90">{h.jalur}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{h.tayangan.toLocaleString("id-ID")}×</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-2 font-medium text-muted-foreground">Sumber kunjungan (30 hari)</p>
                      <ul className="space-y-1">
                        {r.pengunjung.sumberTeratas.map((s) => (
                          <li key={s.sumber} className="flex justify-between gap-2">
                            <span className="truncate text-foreground/90">{s.sumber}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{s.tayangan.toLocaleString("id-ID")}×</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Kartu({ judul, ikon, aksi, children }: { judul: string; ikon: ReactNode; aksi: () => void; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-heading text-lg">{ikon}{judul}</h2>
        <button onClick={aksi} className="text-xs text-muted-foreground hover:text-emas">Buka →</button>
      </div>
      {children}
    </section>
  );
}

function Angka({ n, label, sorot }: { n: number; label: string; sorot?: boolean }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <p className={`font-heading text-2xl tabular-nums ${sorot && n > 0 ? "text-emas" : ""}`}>{n}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function AngkaPengunjung({ unik, tayangan, label, sorot }: { unik: number; tayangan: number; label: string; sorot?: boolean }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <p className={`font-heading text-2xl tabular-nums ${sorot && unik > 0 ? "text-emas" : ""}`}>{unik.toLocaleString("id-ID")}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[11px] tabular-nums text-redup">{tayangan.toLocaleString("id-ID")} tayangan</p>
    </div>
  );
}
