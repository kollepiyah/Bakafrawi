"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Flame,
  ImageIcon,
  Lightbulb,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Video,
  X,
} from "lucide-react";
import { Sambungan } from "./studio-sambungan";
import type { Situs } from "@/content/skema";
import { jalurGudang, muatKonten, supabase } from "@/lib/gudang-admin";
import { situsBawaan } from "@/content/situs";
import { teksNaskah, type Naskah } from "@/lib/lekkopi/konten-murni";
import type { UsulanArahan } from "@/lib/usul-arahan-murni";
import type { KonsepReelsViral, SlotWaktu } from "@/lib/riset-reels-murni";

type Hasil = { jenis: "gambar" | "video"; rasio: string; url: string; durasi?: number };
type Tugas = {
  id: string;
  merek: string;
  dibuat: string;
  jenis: "gambar" | "video";
  produk_slug: string;
  arahan: string;
  status: "naskah" | "antre" | "proses" | "selesai" | "gagal";
  caption: string | null;
  hasil: Hasil[];
  galat: string | null;
  naskah: ({ sumber?: string; catatan?: string[] } & Partial<Naskah>) | null;
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
  naskah: { teks: "Naskah menunggu persetujuan", kelas: "bg-sky-500/15 text-sky-300" },
  antre: { teks: "Menunggu mesin", kelas: "bg-white/10 text-muted-foreground" },
  proses: { teks: "Sedang dibuat…", kelas: "bg-amber-500/15 text-amber-300" },
  selesai: { teks: "Selesai", kelas: "bg-green-500/15 text-green-300" },
  gagal: { teks: "Gagal", kelas: "bg-red-500/15 text-red-300" },
};

export function Studio({ sesi, kepala }: { sesi: Session | null; kepala: ReactNode }) {
  const [situs, setSitus] = useState<Situs>(situsBawaan);
  const [merek, setMerek] = useState<{ slug: string; nama: string; aktif: boolean; profil: { bahan?: string[] } }[]>([]);
  const [pilihMerek, setPilihMerek] = useState("bakafrawi");
  const [pilihProduk, setPilihProduk] = useState("maktaba-pos");
  const [daftar, setDaftar] = useState<Tugas[]>([]);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [usulan, setUsulan] = useState<UsulanArahan[]>([]);
  const [mengusulkan, setMengusulkan] = useState(false);
  const [galatUsulan, setGalatUsulan] = useState("");
  const kolomArahan = useRef<HTMLTextAreaElement>(null);

  // Riset Reels Viral & Jam Tayang
  const [konsepViral, setKonsepViral] = useState<KonsepReelsViral[]>([]);
  const [merisetViral, setMerisetViral] = useState(false);
  const [galatRiset, setGalatRiset] = useState("");
  const [bukaRiset, setBukaRiset] = useState(false);
  const [bukaJadwal, setBukaJadwal] = useState(false);
  const [topikRiset, setTopikRiset] = useState("");
  const [infoJadwal, setInfoJadwal] = useState<{
    label: string;
    saran: string;
    slot: SlotWaktu;
  } | null>(null);
  const [daftarJadwal, setDaftarJadwal] = useState<SlotWaktu[]>([]);

  const muat = useCallback(async () => {
    const { data, error } = await supabase().from("studio_tugas").select("*").order("dibuat", { ascending: false }).limit(30);
    if (error) setPesan(`Gagal memuat tugas: ${error.message}`);
    else setDaftar(data as Tugas[]);
  }, []);

  useEffect(() => {
    if (jalurGudang !== "supabase") return;
    muatKonten().then((k) => k && setSitus(k)).catch(() => {});
    supabase().from("studio_merek").select("slug,nama,aktif,profil").order("urutan").then(({ data }) => data && setMerek(data));
    const t = setTimeout(muat, 0);
    return () => clearTimeout(t);
  }, [muat]);

  // Selama ada tugas yang belum selesai, perbarui daftar tiap 10 detik.
  const masihJalan = daftar.some((t) => (t.status === "naskah" && !t.naskah) || t.status === "antre" || t.status === "proses" || t.status_tayang === "antre" || t.status_tayang === "proses");
  useEffect(() => {
    if (!masihJalan) return;
    const t = setInterval(muat, 10000);
    return () => clearInterval(t);
  }, [masihJalan, muat]);

  // Muat status jadwal tayang optimal saat halaman dibuka
  useEffect(() => {
    fetch("/api/studio/riset", { headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          if (j.statusJadwal) setInfoJadwal(j.statusJadwal);
          if (j.jadwal) setDaftarJadwal(j.jadwal);
        }
      })
      .catch(() => {});
  }, [sesi]);

  // Riset konsep Reels viral dari Claude
  async function mintaRisetViral() {
    setMerisetViral(true);
    setGalatRiset("");
    setKonsepViral([]);
    try {
      const res = await fetch("/api/studio/riset", {
        method: "POST",
        headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ produk: pilihProduk, topik: topikRiset }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.ok && Array.isArray(j.konsep)) {
        setKonsepViral(j.konsep);
        if (j.statusJadwal) setInfoJadwal(j.statusJadwal);
        if (j.jadwal) setDaftarJadwal(j.jadwal);
      } else {
        setGalatRiset(j.pesan ?? "Gagal meriset konsep Reels.");
      }
    } catch (e) {
      setGalatRiset(e instanceof Error ? e.message : "Terjadi kesalahan saat meriset.");
    }
    setMerisetViral(false);
  }

  function pakaiKonsepViral(arahan: string) {
    if (!kolomArahan.current) return;
    kolomArahan.current.value = arahan;
    kolomArahan.current.focus();
    setPesan("Konsep arahan viral berhasil disalin ke formulir!");
  }

  // Usulan arahan dari Claude untuk produk & jenis yang sedang dipilih; diklik → mengisi kolom arahan.
  async function mintaUsulan(e: MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.form;
    if (!form) return;
    const d = new FormData(form);
    setMengusulkan(true);
    setGalatUsulan("");
    setUsulan([]);
    const res = await fetch("/api/studio/arahan", {
      method: "POST",
      headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ produk: d.get("produk"), jenis: d.get("jenis") }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setMengusulkan(false);
    if (!j.ok) return setGalatUsulan(j.pesan ?? "Gagal meminta usulan arahan.");
    setUsulan(j.usulan as UsulanArahan[]);
  }

  function pakaiUsulan(teks: string) {
    if (!kolomArahan.current) return;
    kolomArahan.current.value = teks;
    kolomArahan.current.focus();
  }

  async function buat(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setSibuk(true);
    setPesan("");
    // Merek bank media (Lek Kopi): naskah ditulis server dulu, video dibuat setelah naskah disetujui.
    if (merekBank) {
      const j = await kirimNaskah({ aksi: "buat", merek: pilihMerek, permintaan: String(d.get("arahan") ?? "") });
      setSibuk(false);
      if (j.ok) form.reset();
      return void muat();
    }
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

  async function kirimNaskah(isi: Record<string, unknown>) {
    const res = await fetch("/api/studio/naskah", {
      method: "POST",
      headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify(isi),
    });
    const j = await res.json().catch(() => ({ ok: false, pesan: `HTTP ${res.status}` }));
    setPesan(j.pesan ?? (j.ok ? "Tersimpan." : "Gagal."));
    return j as { ok: boolean };
  }

  async function putusNaskah(t: Tugas, aksi: "setujui" | "tolak" | "revisi") {
    const catatan = aksi === "revisi" ? prompt("Catatan revisi untuk naskah ini:")?.trim() : undefined;
    if (aksi === "revisi" && !catatan) return;
    await kirimNaskah({ aksi, id: t.id, catatan });
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
  const merekBank = Boolean(merek.find((m) => m.slug === pilihMerek)?.profil?.bahan?.includes("bank"));
  const namaMerek = (slug: string) => (merekAktif.length > 1 || slug !== "bakafrawi" ? `${merek.find((m) => m.slug === slug)?.nama ?? slug} · ` : "");

  return (
    <div className="pb-16">
      {kepala}
      <main className="mx-auto max-w-4xl px-4 pt-6">
        {jalurGudang !== "supabase" ? (
          <p className="text-muted-foreground">Studio hanya tersedia bila panel admin tersambung ke Supabase.</p>
        ) : (
          <>
            {/* ── Panel Riset Reels Viral & Jam Tayang Optimal ── */}
            <div className="mb-6 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    <Flame className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-semibold text-foreground flex items-center gap-1.5">
                      Riset Reels Viral & Waktu Tayang
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {infoJadwal?.label ?? "Jadwal prime time & formula konten Instagram Reels"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBukaJadwal((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                      bukaJadwal
                        ? "border-amber-400/50 bg-amber-500/10 text-amber-300"
                        : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground"
                    }`}
                  >
                    <Clock className="size-3.5" />
                    <span>Jam Terbaik</span>
                    {bukaJadwal ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBukaRiset((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                      bukaRiset
                        ? "border-emas/50 bg-emas/10 text-emas"
                        : "border-emas/30 text-emas-muda hover:border-emas hover:bg-emas/5"
                    }`}
                  >
                    <TrendingUp className="size-3.5" />
                    <span>Riset Konsep Viral</span>
                    {bukaRiset ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>
                </div>
              </div>

              {/* Status Saran Jam Tayang Singkat */}
              {infoJadwal && !bukaJadwal && (
                <p className="mt-3 text-xs text-zinc-400 border-t border-border/40 pt-2.5">
                  💡 <b className="text-foreground">Saran waktu:</b> {infoJadwal.saran}
                </p>
              )}

              {/* Detail Jadwal Tayang Terbaik */}
              {bukaJadwal && (
                <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      4 Slot Waktu Tayang Optimal Reels (WIB)
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      Hari terbaik: Selasa, Rabu, Kamis, Minggu
                    </span>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {(daftarJadwal.length > 0 ? daftarJadwal : [
                      { slot: "sore", jam: "17.30 - 19.30 WIB", nama: "Golden Prime Time", alasan: "Trafik Instagram Indonesia tertinggi, jangkauan puncak ke Explore.", skor: 98 },
                      { slot: "siang", jam: "11.45 - 13.00 WIB", nama: "Istirahat Siang", alasan: "Penonton fokus demo singkat 30s saat rehat makan siang.", skor: 88 },
                      { slot: "malam", jam: "20.30 - 21.45 WIB", nama: "Santai Malam", alasan: "Waktu santai rebahan, cocok untuk storytelling & edukasi bisnis.", skor: 85 },
                      { slot: "pagi", jam: "07.00 - 08.30 WIB", nama: "Commute Pagi", alasan: "Tips ringan & motivasi sebelum jam mulai kerja.", skor: 74 },
                    ]).map((j) => (
                      <div
                        key={j.slot}
                        className={`rounded-xl border p-3 text-xs ${
                          j.slot === "sore"
                            ? "border-amber-500/40 bg-amber-500/5 text-amber-200"
                            : "border-border/70 bg-white/[0.01] text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-semibold text-foreground">{j.nama}</span>
                          <span className="rounded-full bg-white/10 px-1.5 py-0.2 font-mono text-[10px] text-emas">
                            {j.skor}%
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-emas-muda">{j.jam}</p>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                          {j.alasan}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Panel Riset Konsep Viral */}
              {bukaRiset && (
                <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs space-y-2">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <Lightbulb className="size-3.5 text-emas" /> 4 Pilar Rahasia Reels Viral:
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 text-[11px] text-zinc-400">
                      <div><b>1. Hook 3 Detik:</b> Sentil luka / rasa penasaran, jangan mulai dengan salam klise.</div>
                      <div><b>2. Visual Rhythm:</b> Pacing cepat (ganti adegan tiap 2-4 dtk) + perbesaran layar UI.</div>
                      <div><b>3. Teks Layar Kontras:</b> Teks stabilo tebal karena 80% audiens menonton tanpa suara.</div>
                      <div><b>4. CTA Konkret:</b> Ajakan simpel (mis. coba demo di link bio atau WhatsApp).</div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={topikRiset}
                      onChange={(e) => setTopikRiset(e.target.value)}
                      placeholder={`Topik/sudut khusus untuk ${namaProduk(pilihProduk)} (opsional, mis. nota WhatsApp, kasir lemot)`}
                      className="h-10 flex-1 rounded-lg border border-input bg-transparent px-3 text-xs"
                    />
                    <button
                      type="button"
                      onClick={mintaRisetViral}
                      disabled={merisetViral}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emas px-4 py-2 text-xs font-semibold text-background hover:bg-emas/90 disabled:opacity-60"
                    >
                      {merisetViral ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      Riset 3 Konsep Viral
                    </button>
                  </div>

                  {galatRiset && <p className="text-xs text-red-300">{galatRiset}</p>}

                  {konsepViral.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {konsepViral.map((k, idx) => (
                        <div
                          key={k.judul + idx}
                          className="flex flex-col justify-between rounded-xl border border-border/80 bg-white/[0.02] p-3.5 text-xs hover:border-emas/50 transition"
                        >
                          <div className="space-y-2">
                            <span className="inline-block rounded-md bg-emas/15 px-2 py-0.5 font-semibold text-emas-muda text-[11px]">
                              {k.judul}
                            </span>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Hook 3 Detik</p>
                              <p className="text-xs font-medium text-foreground italic mt-0.5">
                                "{k.hook}"
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Teks Layar & Visual</p>
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                <b className="text-zinc-200">[{k.teksLayarKunci}]</b> · {k.alurVisual}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">CTA</p>
                              <p className="text-[11px] text-zinc-400 mt-0.5">{k.ajakanCta}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => pakaiKonsepViral(k.arahanStudio)}
                            className="mt-3.5 w-full rounded-lg border border-emas/40 bg-emas/10 py-1.5 text-center text-xs font-medium text-emas hover:bg-emas hover:text-background transition"
                          >
                            Gunakan Konsep Ini →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={buat} className="mb-8 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-heading text-lg"><Sparkles className="size-5 text-emas" /> Buat konten promosi</h2>
              {/* Pilihan merek muncul bila lebih dari satu merek aktif (aktifkan di Sambungan). */}
              {merekAktif.length > 1 ? (
                <label className="grid gap-1.5 sm:w-1/2">
                  <span className="text-xs font-medium text-muted-foreground">Merek</span>
                  <select name="merek" value={pilihMerek} onChange={(e) => { setPilihMerek(e.target.value); setUsulan([]); setGalatUsulan(""); }} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm">
                    {merekAktif.map((m) => <option key={m.slug} value={m.slug} className="bg-card">{m.nama}</option>)}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="merek" value={merekAktif[0]?.slug ?? "bakafrawi"} />
              )}
              {merekBank && (
                <p className="text-xs text-redup">Video dari bank foto/video {merek.find((m) => m.slug === pilihMerek)?.nama} di Google Drive. Naskah ditulis dulu dari data kedai dan dikirim ke bot untuk disetujui; videonya dibuat setelah naskah disetujui.</p>
              )}
              <div hidden={merekBank} className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Produk</span>
                  <select
                    name="produk"
                    value={pilihProduk}
                    onChange={(e) => {
                      setPilihProduk(e.target.value);
                      setUsulan([]);
                      setGalatUsulan("");
                    }}
                    className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
                  >
                    {situs.produk.map((p) => (
                      <option key={p.slug} value={p.slug} className="bg-card">{p.nama}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Jenis</span>
                  <select name="jenis" className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm">
                    <option value="gambar" className="bg-card">Poster (1:1, 4:5, 9:16)</option>
                    <option value="video" className="bg-card">Video Reels/TikTok (animasi aplikasi + karakter)</option>
                  </select>
                </label>
              </div>
              <label hidden={merekBank} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="latar" className="mt-0.5 size-4 accent-[#c9a24b]" />
                <span>
                  Latar gambar AI <span className="text-xs text-redup">(khusus poster: foto suasana — gratis ±60 gambar/hari lewat Cloudflare; video memakai karakter dari Drive)</span>
                </span>
              </label>
              <div className="grid gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="studio-arahan" className="text-xs font-medium text-muted-foreground">{merekBank ? "Ide video" : "Arahan untuk AI (opsional)"}</label>
                  {!merekBank && pilihMerek === "bakafrawi" && pilihProduk !== "lek-kopi" ? (
                    <button type="button" onClick={mintaUsulan} disabled={mengusulkan} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs hover:border-emas hover:text-emas disabled:opacity-60">
                      {mengusulkan ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Usulkan arahan
                    </button>
                  ) : !merekBank && pilihProduk === "lek-kopi" ? (
                    <span className="text-[11px] text-muted-foreground italic">Saran AI hanya untuk produk Bakafrawi</span>
                  ) : null}
                </div>
                <textarea
                  id="studio-arahan"
                  ref={kolomArahan}
                  key={merekBank ? "ide" : "arahan"}
                  name="arahan"
                  rows={2}
                  required={merekBank}
                  placeholder={merekBank ? "Mis. suasana malam minggu, tonjolkan es kopi susu & latte art, ajak nongkrong" : "Mis. sasar pemilik warung kopi, tonjolkan fitur struk WhatsApp, nada santai"}
                  className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                />
                {!merekBank && galatUsulan && <p className="text-xs text-red-300">{galatUsulan}</p>}
                {!merekBank && usulan.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {usulan.map((u) => (
                      <button key={u.judul + u.arahan} type="button" onClick={() => pakaiUsulan(u.arahan)} className="rounded-xl border border-white/10 bg-white/[.03] p-3 text-left text-xs hover:border-emas">
                        <span className="mb-1 block font-semibold text-emas-muda">{u.judul}</span>
                        <span className="text-muted-foreground">{u.arahan}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                <KartuTugas key={t.id} t={t} nama={namaMerek(t.merek) + (t.produk_slug === t.merek ? "video bank media" : namaProduk(t.produk_slug))} hapus={() => hapus(t)} tayang={(a) => tayang(t, a)} naskah={(a) => putusNaskah(t, a)} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function KartuTugas({ t, nama, hapus, tayang, naskah }: { t: Tugas; nama: string; hapus: () => void; tayang: (a: AksiTayang) => void; naskah: (a: "setujui" | "tolak" | "revisi") => void }) {
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
      {t.arahan && <p className="mb-3 text-xs text-redup">{t.produk_slug === t.merek ? "Ide" : "Arahan"}: {t.arahan}</p>}
      {t.status === "naskah" && (
        <div className="mb-3 rounded-lg bg-white/[.03] p-3">
          {t.naskah?.adegan ? (
            <pre className="mb-3 max-h-80 overflow-auto font-sans text-sm whitespace-pre-wrap text-muted-foreground">{teksNaskah(t.naskah as Naskah)}</pre>
          ) : (
            <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Naskah sedang ditulis…</p>
          )}
          {t.naskah?.adegan && (
            <div className="flex flex-wrap gap-2 text-sm">
              <button onClick={() => naskah("setujui")} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 font-semibold text-primary-foreground"><Check className="size-4" /> Setujui, buat video</button>
              <button onClick={() => naskah("revisi")} className="rounded-full border border-white/15 px-4 py-1.5 hover:border-emas hover:text-emas">Revisi…</button>
              <button onClick={() => naskah("tolak")} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground hover:text-red-300"><X className="size-4" /> Tolak</button>
            </div>
          )}
        </div>
      )}
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
