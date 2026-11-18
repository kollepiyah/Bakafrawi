"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { CalendarClock, Check, Copy, Download, ImageIcon, Loader2, RefreshCw, Send, Sparkles, Trash2, Video, X } from "lucide-react";
import { Sambungan } from "./studio-sambungan";
import type { Situs } from "@/content/skema";
import { jalurGudang, muatKonten, supabase } from "@/lib/gudang-admin";
import { situsBawaan } from "@/content/situs";

type Hasil = { jenis: "gambar" | "video"; rasio: string; url: string; durasi?: number };
type Tugas = {
  id: string;
  merek: string;
  dibuat: string;
  jenis: "gambar" | "video";
  produk_slug: string;
  arahan: string;
  status: "antre" | "proses" | "selesai" | "gagal";
  caption: string | null;
  hasil: Hasil[];
  galat: string | null;
  naskah: { sumber?: string; catatan?: string[] } | null;
  latar: "polos" | "ai";
  status_tayang: "belum" | "antre" | "dijadwalkan" | "proses" | "tayang" | "gagal" | "ditolak";
  jadwal_tayang: string | null;
  tayang: { instagram?: { feed?: { permalink?: string }; reels?: { permalink?: string } } };
};

const LABEL_TAYANG: Partial<Record<Tugas["status_tayang"], { teks: string; kelas: string }>> = {
  antre: { teks: "Menunggu tayang", kelas: "bg-amber-500/15 text-amber-300" },
  dijadwalkan: { teks: "Terjadwal", kelas: "bg-sky-500/15 text-sky-300" },
  proses: { teks: "Sedang tayang…", kelas: "bg-amber-500/15 text-amber-300" },
  tayang: { teks: "Tayang di Instagram", kelas: "bg-green-500/15 text-green-300" },
  gagal: { teks: "Gagal tayang", kelas: "bg-red-500/15 text-red-300" },
  ditolak: { teks: "Ditolak", kelas: "bg-white/10 text-muted-foreground" },
};

type AksiTayang = "sekarang" | "jadwal" | "tolak" | "batal" | "ulang";

const LABEL_STATUS: Record<Tugas["status"], { teks: string; kelas: string }> = {
  antre: { teks: "Menunggu mesin", kelas: "bg-white/10 text-muted-foreground" },
  proses: { teks: "Sedang dibuat…", kelas: "bg-amber-500/15 text-amber-300" },
  selesai: { teks: "Selesai", kelas: "bg-green-500/15 text-green-300" },
  gagal: { teks: "Gagal", kelas: "bg-red-500/15 text-red-300" },
};

export function Studio({ sesi, kepala }: { sesi: Session | null; kepala: ReactNode }) {
  const [situs, setSitus] = useState<Situs>(situsBawaan);
  const [merek, setMerek] = useState<{ slug: string; nama: string; aktif: boolean }[]>([]);
  const [daftar, setDaftar] = useState<Tugas[]>([]);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    const { data, error } = await supabase().from("studio_tugas").select("*").order("dibuat", { ascending: false }).limit(30);
    if (error) setPesan(`Gagal memuat tugas: ${error.message}`);
    else setDaftar(data as Tugas[]);
  }, []);

  useEffect(() => {
    if (jalurGudang !== "supabase") return;
    muatKonten().then((k) => k && setSitus(k)).catch(() => {});
    supabase().from("studio_merek").select("slug,nama,aktif").order("urutan").then(({ data }) => data && setMerek(data));
    const t = setTimeout(muat, 0);
    return () => clearTimeout(t);
  }, [muat]);

  // Selama ada tugas yang belum selesai, perbarui daftar tiap 10 detik.
  const masihJalan = daftar.some((t) => t.status === "antre" || t.status === "proses" || t.status_tayang === "antre" || t.status_tayang === "proses");
  useEffect(() => {
    if (!masihJalan) return;
    const t = setInterval(muat, 10000);
    return () => clearInterval(t);
  }, [masihJalan, muat]);

  async function buat(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setSibuk(true);
    setPesan("");
    const { error } = await supabase().from("studio_tugas").insert({ merek: d.get("merek") ?? "bakafrawi", jenis: d.get("jenis"), produk_slug: d.get("produk"), arahan: String(d.get("arahan") ?? ""), latar: d.get("latar") ? "ai" : "polos" });
    if (error) {
      setSibuk(false);
      return setPesan(`Gagal membuat tugas: ${error.message}`);
    }
    const res = await fetch("/api/studio/jalankan", { method: "POST", headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}` } });
    const j = await res.json().catch(() => ({}));
    setPesan(j.dipicu ? "Tugas dibuat — mesin Studio dinyalakan. Gambar ±1–2 menit, video ±3–6 menit." : "Tugas dibuat. Mesin akan mengerjakannya pada putaran jadwal berikutnya (≤ 30 menit).");
    setSibuk(false);
    form.reset();
    muat();
  }

  async function tayang(t: Tugas, aksi: AksiTayang) {
    const res = await fetch("/api/studio/tayang", {
      method: "POST",
      headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, aksi }),
    });
    const j = await res.json().catch(() => ({}));
    const ok: Record<AksiTayang, string> = { sekarang: "Segera ditayangkan ke Instagram.", jadwal: "Dijadwalkan pukul 19.00 WIB.", tolak: "Ditolak.", batal: "Tayang dibatalkan.", ulang: "Dibuat ulang." };
    setPesan(j.ok ? ok[aksi] : (j.pesan ?? "Gagal."));
    muat();
  }

  async function hapus(t: Tugas) {
    if (!confirm("Hapus tugas ini beserta hasilnya?")) return;
    const berkas = t.hasil.map((h) => h.url.split("/studio/").pop()!).filter(Boolean);
    if (berkas.length) await supabase().storage.from("studio").remove(berkas);
    await supabase().from("studio_tugas").delete().eq("id", t.id);
    muat();
  }

  const namaProduk = (slug: string) => situs.produk.find((p) => p.slug === slug)?.nama ?? slug;
  const merekAktif = merek.filter((m) => m.aktif);
  const namaMerek = (slug: string) => (merekAktif.length > 1 || slug !== "bakafrawi" ? `${merek.find((m) => m.slug === slug)?.nama ?? slug} · ` : "");

  return (
    <div className="pb-16">
      {kepala}
      <main className="mx-auto max-w-4xl px-4 pt-6">
        {jalurGudang !== "supabase" ? (
          <p className="text-muted-foreground">Studio hanya tersedia bila panel admin tersambung ke Supabase.</p>
        ) : (
          <>
            <form onSubmit={buat} className="mb-8 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-heading text-lg"><Sparkles className="size-5 text-emas" /> Buat konten promosi</h2>
              {/* Pilihan merek baru muncul bila lebih dari satu merek aktif (Lek Kopi menyusul di gelombang 2). */}
              {merekAktif.length > 1 ? (
                <label className="grid gap-1.5 sm:w-1/2">
                  <span className="text-xs font-medium text-muted-foreground">Merek</span>
                  <select name="merek" className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm">
                    {merekAktif.map((m) => <option key={m.slug} value={m.slug} className="bg-card">{m.nama}</option>)}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="merek" value={merekAktif[0]?.slug ?? "bakafrawi"} />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Produk</span>
                  <select name="produk" className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm">
                    {situs.produk.map((p) => (
                      <option key={p.slug} value={p.slug} className="bg-card">{p.nama}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Jenis</span>
                  <select name="jenis" className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm">
                    <option value="gambar" className="bg-card">Poster (1:1, 4:5, 9:16)</option>
                    <option value="video" className="bg-card">Video Reels/TikTok (rekaman aplikasi)</option>
                  </select>
                </label>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="latar" className="mt-0.5 size-4 accent-[#c9a24b]" />
                <span>
                  Latar gambar AI <span className="text-xs text-redup">(poster: foto suasana; video: pembuka & penutup bergerak — gratis ±60 gambar/hari lewat Cloudflare)</span>
                </span>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Arahan untuk AI (opsional)</span>
                <textarea name="arahan" rows={2} placeholder="Mis. sasar pemilik warung kopi, tonjolkan fitur struk WhatsApp, nada santai" className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm" />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button disabled={sibuk} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Buat
                </button>
                {pesan && <span className="text-sm text-emas-muda">{pesan}</span>}
              </div>
            </form>

            <Sambungan sesi={sesi} />

            <h2 className="mb-3 font-heading text-lg">Riwayat</h2>
            {daftar.length === 0 && <p className="text-sm text-muted-foreground">Belum ada konten.</p>}
            <div className="grid gap-4">
              {daftar.map((t) => (
                <KartuTugas key={t.id} t={t} nama={namaMerek(t.merek) + namaProduk(t.produk_slug)} hapus={() => hapus(t)} tayang={(a) => tayang(t, a)} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function KartuTugas({ t, nama, hapus, tayang }: { t: Tugas; nama: string; hapus: () => void; tayang: (a: AksiTayang) => void }) {
  const [tersalin, setTersalin] = useState(false);
  const s = LABEL_STATUS[t.status];
  const st = LABEL_TAYANG[t.status_tayang];
  const tautanIg = t.tayang?.instagram?.reels?.permalink ?? t.tayang?.instagram?.feed?.permalink;
  const bisaTayang = t.status === "selesai" && ["belum", "gagal", "ditolak"].includes(t.status_tayang);
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          {t.jenis === "video" ? <Video className="size-4 text-emas" /> : <ImageIcon className="size-4 text-emas" />}
          <b>{nama}</b>
          <span className="text-redup">· {new Date(t.dibuat).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
        <div className="flex items-center gap-2">
          {t.latar === "ai" && <span className="rounded-full bg-emas/15 px-2.5 py-1 text-xs text-emas-muda">Latar AI</span>}
          <span className={`rounded-full px-2.5 py-1 text-xs ${s.kelas}`}>{t.status === "proses" && <Loader2 className="mr-1 inline size-3 animate-spin" />}{s.teks}</span>
          {st && (
            <span className={`rounded-full px-2.5 py-1 text-xs ${st.kelas}`}>
              {st.teks}
              {t.status_tayang === "dijadwalkan" && t.jadwal_tayang && ` · ${new Date(t.jadwal_tayang).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}`}
            </span>
          )}
          <button onClick={hapus} aria-label="Hapus" className="rounded-md p-1.5 hover:bg-white/10"><Trash2 className="size-4 text-red-400" /></button>
        </div>
      </div>
      {t.arahan && <p className="mb-3 text-xs text-redup">Arahan: {t.arahan}</p>}
      {t.galat && <p className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{t.galat}</p>}
      {t.naskah?.catatan?.map((c) => (
        <p key={c} className="mb-2 text-xs text-amber-300">{c}</p>
      ))}
      {t.hasil.length > 0 && (
        <div className="mb-3 flex gap-3 overflow-x-auto pb-2">
          {t.hasil.map((h) => (
            <figure key={h.url} className="shrink-0">
              {h.jenis === "video" ? (
                <video src={h.url} controls playsInline className="h-80 rounded-lg bg-black" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- pratinjau hasil Studio, ukuran bebas
                <img src={h.url} alt={`Poster ${h.rasio}`} className="h-80 rounded-lg" />
              )}
              <figcaption className="mt-1.5 flex items-center justify-between text-xs text-redup">
                {h.rasio}{h.durasi ? ` · ${h.durasi} dtk` : ""}
                <a href={h.url} download target="_blank" className="inline-flex items-center gap-1 text-emas"><Download className="size-3.5" /> Unduh</a>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {t.caption && (
        <div className="rounded-lg bg-white/[.03] p-3">
          <p className="mb-2 text-sm whitespace-pre-line text-muted-foreground">{t.caption}</p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-redup">Naskah: {t.naskah?.sumber ?? "-"}</span>
            <button
              onClick={() => navigator.clipboard.writeText(t.caption ?? "").then(() => { setTersalin(true); setTimeout(() => setTersalin(false), 1500); })}
              className="inline-flex items-center gap-1 text-emas"
            >
              {tersalin ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {tersalin ? "Tersalin" : "Salin caption"}
            </button>
          </div>
        </div>
      )}
      {t.status === "selesai" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {bisaTayang && (
            <>
              <button onClick={() => tayang("sekarang")} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 font-semibold text-primary-foreground">
                <Send className="size-4" /> Tayangkan sekarang
              </button>
              <button onClick={() => tayang("jadwal")} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 hover:border-emas hover:text-emas">
                <CalendarClock className="size-4" /> Jadwal 19.00
              </button>
            </>
          )}
          {(t.status_tayang === "antre" || t.status_tayang === "dijadwalkan") && (
            <button onClick={() => tayang("batal")} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5">
              <X className="size-4" /> Batalkan tayang
            </button>
          )}
          {t.status_tayang !== "tayang" && t.status_tayang !== "proses" && (
            <button onClick={() => tayang("ulang")} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground">
              <RefreshCw className="size-4" /> Buat ulang
            </button>
          )}
          {tautanIg && (
            <a href={tautanIg} target="_blank" className="text-emas underline">
              Lihat di Instagram
            </a>
          )}
        </div>
      )}
    </article>
  );
}
