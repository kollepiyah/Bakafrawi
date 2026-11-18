"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { CalendarDays, CalendarPlus, Check, CloudOff, Loader2, MapPin, Pencil, RefreshCw, Repeat, Trash2, X } from "lucide-react";
import { jamWIB, namaTanggal, tanggalWIB, type Acara } from "@/lib/agenda-murni";

type StatusGoogle = { siap: boolean; tersambung: boolean; email: string | null; galat: string | null; disinkron: string | null };

const PESAN_GOOGLE: Record<string, string> = {
  ok: "Google Calendar tersambung. Agenda 60 hari ke depan sudah ditarik.",
  dibatalkan: "Penyambungan Google dibatalkan.",
  kedaluwarsa: "Tautan izin kedaluwarsa (lebih dari 10 menit). Coba hubungkan lagi.",
};

/** Kirim permintaan ke API agenda dengan token sesi admin. */
export function apiAdmin(sesi: Session | null) {
  return async (jalur: string, isi?: unknown) => {
    const res = await fetch(jalur, {
      method: isi === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}`, "Content-Type": "application/json" },
      body: isi === undefined ? undefined : JSON.stringify(isi),
    });
    return (await res.json().catch(() => ({ ok: false, pesan: `HTTP ${res.status}` }))) as Record<string, unknown> & { ok: boolean; pesan?: string };
  };
}

export function Agenda({ sesi, kepala, pesanAwal }: { sesi: Session | null; kepala: ReactNode; pesanAwal?: string }) {
  const api = useCallback((jalur: string, isi?: unknown) => apiAdmin(sesi)(jalur, isi), [sesi]);
  const [acara, setAcara] = useState<Acara[] | null>(null);
  const [kini, setKini] = useState(0); // waktu daftar dimuat (render harus murni)
  const [google, setGoogle] = useState<StatusGoogle | null>(null);
  const [pesan, setPesan] = useState(pesanAwal ? (PESAN_GOOGLE[pesanAwal] ?? `Google: ${pesanAwal}`) : "");
  const [sibuk, setSibuk] = useState(false);
  const [diubah, setDiubah] = useState<Acara | null>(null);
  const [seharian, setSeharian] = useState(false);

  const muat = useCallback(async () => {
    setKini(Date.now());
    const [a, g] = await Promise.all([api("/api/agenda"), api("/api/agenda/google")]);
    if (a.ok) setAcara(a.acara as Acara[]);
    else setPesan(`Gagal memuat agenda: ${a.pesan ?? ""}`);
    if (g.ok) setGoogle(g as unknown as StatusGoogle);
  }, [api]);

  useEffect(() => {
    const t = setTimeout(muat, 0);
    return () => clearTimeout(t);
  }, [muat]);

  async function google_(aksi: "mulai" | "putus" | "sinkron") {
    if (aksi === "putus" && !confirm("Putuskan Google Calendar? Agenda yang sudah ada tetap tersimpan.")) return;
    setSibuk(true);
    const j = await api("/api/agenda/google", { aksi });
    setSibuk(false);
    if (aksi === "mulai" && j.ok) return void (location.href = String(j.url));
    setPesan(j.pesan ?? (j.ok ? "Selesai." : "Gagal."));
    muat();
  }

  async function simpan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const isi = {
      aksi: diubah ? "ubah" : "tambah",
      id: diubah?.id,
      judul: d.judul,
      seharian,
      mulai: seharian ? d.tanggal : `${d.tanggal}T${d.jamMulai}`,
      selesai: seharian ? d.tanggalSelesai || null : d.jamSelesai ? `${d.tanggal}T${d.jamSelesai}` : null,
      lokasi: d.lokasi,
      catatan: d.catatan,
    };
    setSibuk(true);
    const j = await api("/api/agenda", isi);
    setSibuk(false);
    if (!j.ok) return setPesan(j.pesan ?? "Gagal menyimpan.");
    setPesan(`${diubah ? "Acara diubah" : "Acara ditambahkan"}${j.keGoogle ? " dan masuk Google Calendar." : google?.tersambung ? " — dikirim ke Google pada detak berikutnya (≤5 menit)." : "."}`);
    form.reset();
    setDiubah(null);
    setSeharian(false);
    muat();
  }

  async function hapus(a: Acara) {
    if (!confirm(`Hapus "${a.judul}"${a.google_id ? " (juga dari Google Calendar)" : ""}?`)) return;
    const j = await api("/api/agenda", { aksi: "hapus", id: a.id });
    setPesan(j.ok ? "Acara dihapus." : (j.pesan ?? "Gagal menghapus."));
    muat();
  }

  function ubah(a: Acara) {
    setDiubah(a);
    setSeharian(a.seharian);
    scrollTo({ top: 0, behavior: "smooth" });
  }

  // Kelompokkan per tanggal WIB; acara yang sudah berjalan sejak kemarin (mis. seharian 3 hari) tampil di hari ini.
  const perHari = new Map<string, Acara[]>();
  for (const a of acara ?? []) {
    const k = tanggalWIB(new Date(Math.max(new Date(a.mulai).getTime(), kini)));
    perHari.set(k, [...(perHari.get(k) ?? []), a]);
  }
  const nilai = (a: Acara | null) => {
    if (!a) return {};
    const selesaiInklusif = new Date(new Date(a.selesai).getTime() - (a.seharian ? 86400000 : 0));
    return {
      tanggal: tanggalWIB(new Date(a.mulai)),
      jamMulai: jamWIB(a.mulai).replace(".", ":"),
      jamSelesai: jamWIB(a.selesai).replace(".", ":"),
      tanggalSelesai: tanggalWIB(selesaiInklusif),
    };
  };
  const awal = nilai(diubah);

  return (
    <div className="pb-16">
      {kepala}
      <main className="mx-auto max-w-4xl space-y-6 px-4 pt-6">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3 text-sm">
            <CalendarDays className="size-5 text-emas" />
            {!google ? (
              <span className="text-muted-foreground">Memeriksa Google Calendar…</span>
            ) : !google.siap ? (
              <span className="text-muted-foreground">Google Calendar belum disiapkan (isi GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET di Vercel).</span>
            ) : google.tersambung ? (
              <span>
                Tersambung ke <b>{google.email ?? "Google Calendar"}</b>
                {google.disinkron && <span className="text-muted-foreground"> · sinkron {jamWIB(google.disinkron)} WIB</span>}
                {google.galat && <span className="block text-red-300">{google.galat}</span>}
              </span>
            ) : (
              <span className="text-muted-foreground">Google Calendar belum tersambung.</span>
            )}
          </div>
          {google?.siap && (
            <div className="flex gap-2">
              {google.tersambung && !google.galat ? (
                <>
                  <button disabled={sibuk} onClick={() => google_("sinkron")} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:border-emas">
                    <RefreshCw className={`size-3.5 ${sibuk ? "animate-spin" : ""}`} /> Sinkron sekarang
                  </button>
                  <button disabled={sibuk} onClick={() => google_("putus")} className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-red-300">Putuskan</button>
                </>
              ) : (
                <button disabled={sibuk} onClick={() => google_("mulai")} className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">
                  {google.tersambung ? "Hubungkan ulang" : "Hubungkan Google Calendar"}
                </button>
              )}
            </div>
          )}
        </section>

        <form key={`${diubah?.id ?? "baru"}-${kini}`} onSubmit={simpan} className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-heading text-lg">
            {diubah ? <Pencil className="size-5 text-emas" /> : <CalendarPlus className="size-5 text-emas" />}
            {diubah ? "Ubah acara" : "Tambah acara"}
          </h2>
          <Kolom label="Judul">
            <input name="judul" required maxLength={200} defaultValue={diubah?.judul} placeholder="Rapat pengurus MU" className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm" />
          </Kolom>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={seharian} onChange={(e) => setSeharian(e.target.checked)} className="size-4 accent-emas" /> Seharian
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <Kolom label="Tanggal">
              <input name="tanggal" type="date" required defaultValue={awal.tanggal ?? (kini ? tanggalWIB(new Date(kini)) : undefined)} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm" />
            </Kolom>
            {seharian ? (
              <Kolom label="Sampai tanggal (opsional)">
                <input name="tanggalSelesai" type="date" defaultValue={diubah?.seharian ? awal.tanggalSelesai : undefined} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm" />
              </Kolom>
            ) : (
              <>
                <Kolom label="Mulai">
                  <input name="jamMulai" type="time" required defaultValue={awal.jamMulai ?? "09:00"} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm" />
                </Kolom>
                <Kolom label="Selesai (kosong = 1 jam)">
                  <input name="jamSelesai" type="time" defaultValue={awal.jamSelesai} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm" />
                </Kolom>
              </>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Kolom label="Lokasi (opsional)">
              <input name="lokasi" defaultValue={diubah?.lokasi ?? ""} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm" />
            </Kolom>
            <Kolom label="Catatan (opsional)">
              <input name="catatan" defaultValue={diubah?.catatan ?? ""} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm" />
            </Kolom>
          </div>
          <div className="flex items-center gap-3">
            <button disabled={sibuk} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {diubah ? "Simpan perubahan" : "Tambah"}
            </button>
            {diubah && (
              <button type="button" onClick={() => (setDiubah(null), setSeharian(false))} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <X className="size-4" /> Batal ubah
              </button>
            )}
          </div>
          {pesan && <p role="status" className="text-sm text-emas-muda">{pesan}</p>}
        </form>

        <section className="space-y-5">
          <h2 className="font-heading text-lg">14 hari ke depan</h2>
          {acara === null ? (
            <Loader2 className="size-5 animate-spin text-emas" />
          ) : acara.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada acara. Tambahkan di atas, lewat bot Telegram, atau langsung di Google Calendar.</p>
          ) : (
            [...perHari].map(([tgl, isi]) => (
              <div key={tgl} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tgl === tanggalWIB(new Date(kini)) ? "Hari ini · " : ""}{namaTanggal(tgl)}
                </h3>
                {isi.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{a.judul}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{a.seharian ? "Seharian" : `${jamWIB(a.mulai)}–${jamWIB(a.selesai)} WIB`}</span>
                        {a.lokasi && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{a.lokasi}</span>}
                        {a.berulang && <span className="inline-flex items-center gap-1"><Repeat className="size-3" />berulang</span>}
                        {a.perlu_sinkron && google?.tersambung && <span className="inline-flex items-center gap-1 text-amber-300"><CloudOff className="size-3" />menunggu Google</span>}
                      </p>
                      {a.catatan && <p className="mt-1 text-xs text-muted-foreground">{a.catatan}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => ubah(a)} aria-label="Ubah" className="rounded-full p-2 text-muted-foreground hover:text-emas"><Pencil className="size-4" /></button>
                      <button onClick={() => hapus(a)} aria-label="Hapus" className="rounded-full p-2 text-muted-foreground hover:text-red-300"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

function Kolom({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
