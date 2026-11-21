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
  ExternalLink,
  Flame,
  ImageIcon,
  Lightbulb,
  Link2,
  Loader2,
  Palette,
  Play,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Video,
  X,
} from "lucide-react";
import { Sambungan } from "./studio-sambungan";
import type { Situs } from "@/content/skema";
import { jalurGudang, muatKonten, supabase } from "@/lib/gudang-admin";
import {
  DAFTAR_SASARAN_GAMBAR,
  DAFTAR_SASARAN_VIDEO,
  daftarSlotCepatWIB,
  HARI_WIB,
  jadwalRutinBawaan,
  keInputDatetimeWIB,
  VIDEO_OPENING_BAWAAN_LEKKOPI,
  type JadwalRutin,
  type SasaranTayang,
  type VideoRutin,
} from "@/lib/jadwal-tayang-murni";
import { situsBawaan } from "@/content/situs";
import { teksNaskah, type Naskah } from "@/lib/lekkopi/konten-murni";
import type { UsulanArahan } from "@/lib/usul-arahan-murni";
import type { KonsepReelsViral, SlotWaktu } from "@/lib/riset-reels-murni";
import type { ReferensiTersimpan } from "@/lib/referensi-video";

const PRESET_VIDEO = [
  { kode: "otomatis", label: "Otomatis (sesuai AI / referensi)" },
  { kode: "story-drop", label: "Story Drop: Menu Lompat dari IG Story ke Meja (ala Aurelia Cafe)" },
  { kode: "editorial-scroll", label: "Laptop di Meja Kayu / Scroll Website (ala POUR·PLAY)" },
  { kode: "dial-menu", label: "Dial Menu: Keypad + Foto Penuh Bernomor (ala Happy Cake)" },
  { kode: "sinematik-kafe", label: "Sinematik Kafe / Remotion + B-roll AI" },
  { kode: "clean-ui", label: "Clean Motion UI + Maskot" },
  { kode: "dark-keynote", label: "Dark Tech / Apple Keynote" },
  { kode: "pov-chat", label: "POV / Storytelling & Chat WA" },
  { kode: "split-hook", label: "Split-Screen / Fast Hook" },
];

type BingkaiUnggah = { mimeType: string; data: string };

/** Ekstrak 5 bingkai merata dari video .mp4/.mov langsung di browser (hemat ukuran & anti-timeout Vercel). */
async function ekstrakBingkaiVideo(file: File, jumlah = 5): Promise<{ gambar: BingkaiUnggah[]; durasiDetik: number }> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    await new Promise<void>((ok, gagal) => {
      v.onloadedmetadata = () => ok();
      v.onerror = () => gagal(new Error("Video tidak dapat dibaca browser."));
    });
    const durasi = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 6;
    const lebar = Math.min(540, v.videoWidth || 540);
    const tinggi = Math.max(1, Math.round(lebar * ((v.videoHeight || 960) / (v.videoWidth || 540))));
    const canvas = document.createElement("canvas");
    canvas.width = lebar;
    canvas.height = tinggi;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");

    const titik = Array.from({ length: jumlah }, (_, i) => Math.min(durasi - 0.1, Math.max(0.05, durasi * (0.05 + (i * 0.87) / Math.max(1, jumlah - 1)))));
    const hasil: BingkaiUnggah[] = [];
    for (const t of titik) {
      await new Promise<void>((ok) => {
        const selesai = () => { v.onseeked = null; ok(); };
        v.onseeked = selesai;
        v.currentTime = t;
        setTimeout(selesai, 1500);
      });
      ctx.drawImage(v, 0, 0, lebar, tinggi);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
      hasil.push({ mimeType: "image/jpeg", data: dataUrl.split(",")[1] ?? "" });
    }
    return { gambar: hasil.filter((g) => g.data), durasiDetik: durasi };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Perkecil screenshot (JPG/PNG/WebP) ke lebar maks 720px agar ringan dikirim ke Vision AI. */
async function kompresGambar(file: File): Promise<BingkaiUnggah> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((ok, gagal) => {
      img.onload = () => ok();
      img.onerror = () => gagal(new Error(`Gambar ${file.name} gagal dibaca.`));
    });
    const rasio = Math.min(1, 720 / (img.naturalWidth || 720));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * rasio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * rasio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return { mimeType: "image/jpeg", data: dataUrl.split(",")[1] ?? "" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const PRESET_POSTER = [
  { kode: "otomatis", label: "Otomatis (sesuai AI)" },
  { kode: "modern-clean", label: "Modern Clean Editorial" },
  { kode: "before-after", label: "Before vs After (Masalah vs Solusi)" },
  { kode: "bold-typo", label: "Bold Typography / Karosel IG" },
  { kode: "photo-floating", label: "Foto Suasana AI + UI Melayang" },
];

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
  tayang: {
    sasaran?: SasaranTayang;
    rutin?: boolean;
    instagram?: {
      feed?: { permalink?: string };
      reels?: { permalink?: string };
      story?: { id?: string; galat?: string };
      stories?: { id?: string }[];
    };
  };
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
  const [pilihJenis, setPilihJenis] = useState<"gambar" | "video">("gambar");
  const [pilihGaya, setPilihGaya] = useState("otomatis");
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
  const [bukaRef, setBukaRef] = useState(false);
  const [urlRef, setUrlRef] = useState("");
  const [catatanRef, setCatatanRef] = useState("");
  const [berkasRef, setBerkasRef] = useState<File[]>([]);
  const [membedahRef, setMembedahRef] = useState(false);
  const [galatRef, setGalatRef] = useState("");
  const [daftarRef, setDaftarRef] = useState<ReferensiTersimpan[]>([]);
  const [topikRiset, setTopikRiset] = useState("");
  const [infoJadwal, setInfoJadwal] = useState<{
    label: string;
    saran: string;
    slot: SlotWaktu;
  } | null>(null);
  const [daftarJadwal, setDaftarJadwal] = useState<SlotWaktu[]>([]);

  // Jadwal Otomatis Jam Buka (Story Opening Lek Kopi)
  const [bukaRutin, setBukaRutin] = useState(false);
  const [merekRutin, setMerekRutin] = useState("lekkopi");
  const [jadwalRutin, setJadwalRutin] = useState<JadwalRutin>(() => jadwalRutinBawaan("lekkopi"));
  const [berikutnyaRutin, setBerikutnyaRutin] = useState<string | null>(null);
  const [menyimpanRutin, setMenyimpanRutin] = useState(false);
  const [mengunggahRutin, setMengunggahRutin] = useState(false);
  const [pesanRutin, setPesanRutin] = useState("");
  const [urlBaruRutin, setUrlBaruRutin] = useState("");
  const [judulBaruRutin, setJudulBaruRutin] = useState("");

  // Jadwal Tayang Custom saat membuat konten baru
  const [modeJadwalBuat, setModeJadwalBuat] = useState<"persetujuan" | "prime19" | "custom">("persetujuan");
  const [waktuJadwalBuat, setWaktuJadwalBuat] = useState(() => daftarSlotCepatWIB()[3]?.inputWib ?? "");
  const [sasaranBuat, setSasaranBuat] = useState<SasaranTayang>("otomatis");

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

  // Selalu ambil token terbaru dari Supabase (otomatis segar meski halaman lama terbuka di HP)
  const tokenSegar = useCallback(async () => {
    try {
      const { data } = await supabase().auth.getSession();
      if (data.session?.access_token) return data.session.access_token;
    } catch { /* pakai prop sesi */ }
    return sesi?.access_token ?? "";
  }, [sesi]);

  // Muat daftar link video referensi yang sudah dipelajari untuk merek aktif
  const muatReferensi = useCallback(async () => {
    const tok = await tokenSegar();
    if (!tok) return;
    const res = await fetch(`/api/studio/referensi?merek=${encodeURIComponent(pilihMerek)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (j.ok && Array.isArray(j.daftar)) setDaftarRef(j.daftar as ReferensiTersimpan[]);
  }, [tokenSegar, pilihMerek]);

  useEffect(() => {
    const t = setTimeout(muatReferensi, 0);
    return () => clearTimeout(t);
  }, [muatReferensi]);

  // Muat konfigurasi jadwal otomatis jam buka (Story Opening)
  const muatJadwalRutin = useCallback(async () => {
    const tok = await tokenSegar();
    if (!tok) return;
    const res = await fetch(`/api/studio/rutin?merek=${encodeURIComponent(merekRutin)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (j.ok && j.jadwal) {
      setJadwalRutin(j.jadwal as JadwalRutin);
      setBerikutnyaRutin(j.berikutnya ?? null);
    }
  }, [tokenSegar, merekRutin]);

  useEffect(() => {
    const t = setTimeout(muatJadwalRutin, 0);
    return () => clearTimeout(t);
  }, [muatJadwalRutin]);

  async function simpanPengaturanRutin(patch?: Partial<JadwalRutin>) {
    setMenyimpanRutin(true);
    setPesanRutin("");
    const jadwalBaru = patch ? { ...jadwalRutin, ...patch } : jadwalRutin;
    if (patch) setJadwalRutin(jadwalBaru);
    try {
      const tok = await tokenSegar();
      const res = await fetch("/api/studio/rutin", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "simpan", merek: merekRutin, jadwal: jadwalBaru }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.ok) {
        if (j.jadwal) setJadwalRutin(j.jadwal as JadwalRutin);
        setBerikutnyaRutin(j.berikutnya ?? null);
        setPesanRutin(j.pesan ?? "Jadwal jam buka disimpan.");
        muat();
      } else {
        setPesanRutin(j.pesan ?? "Gagal menyimpan jadwal rutin.");
      }
    } catch (e) {
      setPesanRutin(e instanceof Error ? e.message : "Gagal menyimpan jadwal rutin.");
    }
    setMenyimpanRutin(false);
  }

  async function buatPratinjauStoryBuka() {
    setMenyimpanRutin(true);
    setPesanRutin("");
    try {
      const tok = await tokenSegar();
      const res = await fetch("/api/studio/rutin", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "pratinjau", merek: merekRutin }),
      });
      const j = await res.json().catch(() => ({}));
      setPesanRutin(j.pesan ?? (j.ok ? "Pratinjau Story Jam Buka sedang dibuat." : "Gagal membuat pratinjau."));
      if (j.ok) muat();
    } catch (e) {
      setPesanRutin(e instanceof Error ? e.message : "Gagal membuat pratinjau Story Jam Buka.");
    }
    setMenyimpanRutin(false);
  }

  async function tayangkanStoryBukaSekarang() {
    setMenyimpanRutin(true);
    setPesanRutin("");
    try {
      const tok = await tokenSegar();
      const res = await fetch("/api/studio/rutin", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "tayang-sekarang", merek: merekRutin }),
      });
      const j = await res.json().catch(() => ({}));
      setPesanRutin(j.pesan ?? (j.ok ? "Story Jam Buka sedang ditayangkan." : "Gagal menayangkan."));
      if (j.ok) muat();
    } catch (e) {
      setPesanRutin(e instanceof Error ? e.message : "Gagal menayangkan Story Jam Buka.");
    }
    setMenyimpanRutin(false);
  }

  async function unggahVideoRutin(berkas: File) {
    setMengunggahRutin(true);
    setPesanRutin("");
    try {
      const adalahGambar = berkas.type.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(berkas.name);
      let durasi = 9;
      if (!adalahGambar) {
        const urlTmp = URL.createObjectURL(berkas);
        try {
          const v = document.createElement("video");
          v.src = urlTmp;
          v.preload = "metadata";
          await new Promise<void>((ok) => {
            v.onloadedmetadata = () => ok();
            v.onerror = () => ok();
            setTimeout(ok, 2000);
          });
          if (Number.isFinite(v.duration) && v.duration > 0) durasi = Math.round(v.duration);
        } finally {
          URL.revokeObjectURL(urlTmp);
        }
      }

      const tok = await tokenSegar();
      const izinRes = await fetch("/api/studio/rutin", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "izin-unggah", merek: merekRutin, namaBerkas: berkas.name }),
      });
      const izin = await izinRes.json().catch(() => ({}));
      if (!izin.ok || !izin.uploadUrl) throw new Error(izin.pesan ?? "Gagal menyiapkan unggahan.");

      const upRes = await fetch(izin.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": adalahGambar ? berkas.type || "image/jpeg" : "video/mp4" },
        body: berkas,
      });
      if (!upRes.ok) throw new Error(`Unggah gagal (HTTP ${upRes.status}).`);

      const itemBaru: VideoRutin = {
        id: `rutin-${Date.now()}`,
        judul: berkas.name.replace(/\.[a-z0-9]+$/i, ""),
        url: izin.publicUrl,
        sampul: null,
        jenis: adalahGambar ? "gambar" : "video",
        durasi: adalahGambar ? undefined : durasi,
        sasaran: "story",
        wajib: true,
        aktif: true,
        caption: "We are OPEN! Lek Kopi Waru Sidoarjo ☕",
      };
      await simpanPengaturanRutin({ video: [...jadwalRutin.video, itemBaru] });
    } catch (e) {
      setPesanRutin(e instanceof Error ? e.message : "Gagal mengunggah video.");
    }
    setMengunggahRutin(false);
  }

  function tambahUrlRutin() {
    const u = urlBaruRutin.trim();
    if (!u) return;
    const adalahGambar = /\.(jpg|jpeg|png)(\?|$)/i.test(u);
    const itemBaru: VideoRutin = {
      id: `rutin-${Date.now()}`,
      judul: judulBaruRutin.trim() || `Video Opening #${jadwalRutin.video.length + 1}`,
      url: u,
      sampul: null,
      jenis: adalahGambar ? "gambar" : "video",
      durasi: adalahGambar ? undefined : 10,
      sasaran: "story",
      wajib: true,
      aktif: true,
      caption: "We are OPEN! Lek Kopi Waru Sidoarjo ☕",
    };
    setUrlBaruRutin("");
    setJudulBaruRutin("");
    void simpanPengaturanRutin({ video: [...jadwalRutin.video, itemBaru] });
  }

  async function bedahLinkReferensi() {
    if (!berkasRef.length && !urlRef.trim()) {
      return setGalatRef("Unggah video (.mp4) / screenshot, atau tempel tautan Reels/TikTok terlebih dahulu.");
    }
    setMembedahRef(true);
    setGalatRef("");
    try {
      let gambar: BingkaiUnggah[] | undefined;
      let durasiDetik: number | undefined;
      let namaFile: string | undefined;

      if (berkasRef.length > 0) {
        const videoFile = berkasRef.find((f) => f.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(f.name));
        if (videoFile) {
          const r = await ekstrakBingkaiVideo(videoFile, 5);
          gambar = r.gambar;
          durasiDetik = r.durasiDetik;
          namaFile = videoFile.name;
        } else {
          gambar = await Promise.all(berkasRef.slice(0, 6).map(kompresGambar));
          namaFile = berkasRef[0].name;
        }
      }

      const tok = await tokenSegar();
      const res = await fetch("/api/studio/referensi", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          merek: pilihMerek,
          url: urlRef.trim() || undefined,
          namaFile,
          durasiDetik,
          gambar,
          catatan: catatanRef.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.ok && j.referensi) {
        setUrlRef("");
        setCatatanRef("");
        setBerkasRef([]);
        setPesan(`Referensi "${j.referensi.caption}" berhasil ditonton AI & disimpan!`);
        muatReferensi();
      } else {
        setGalatRef(j.pesan ?? `Gagal membedah referensi (HTTP ${res.status}).`);
      }
    } catch (e) {
      setGalatRef(e instanceof Error ? e.message : "Terjadi kesalahan saat membedah referensi.");
    }
    setMembedahRef(false);
  }

  async function hapusReferensi(id: string) {
    const tok = await tokenSegar();
    await fetch(`/api/studio/referensi?merek=${encodeURIComponent(pilihMerek)}&id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tok}` },
    }).catch(() => null);
    muatReferensi();
  }

  function tiruReferensi(r: ReferensiTersimpan) {
    const b = r.analisis;
    if (!b || !kolomArahan.current) return;
    if (b.presetCocok) setPilihGaya(b.presetCocok);
    kolomArahan.current.value = `${b.arahanTiru}\n(Referensi gaya: ${b.judul} — Hook: ${b.hook3Detik} | Pacing: ${b.pacing})`;
    kolomArahan.current.focus();
    setPesan(`Pola referensi "${b.judul}" diterapkan ke formulir!`);
  }

  // Riset konsep Reels viral (Gemini Google Search)
  async function mintaRisetViral() {
    setMerisetViral(true);
    setGalatRiset("");
    setKonsepViral([]);
    try {
      const res = await fetch("/api/studio/riset", {
        method: "POST",
        headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ merek: pilihMerek, produk: merekBank ? pilihMerek : pilihProduk, topik: topikRiset }),
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

  // Usulan arahan dari Claude untuk produk & jenis yang sedang dipilih (Bakafrawi & Lek Kopi).
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
      body: JSON.stringify({
        merek: pilihMerek,
        produk: merekBank ? pilihMerek : d.get("produk"),
        jenis: merekBank ? "video" : d.get("jenis"),
      }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setMengusulkan(false);
    if (!j.ok) return setGalatUsulan(j.pesan ?? "Gagal meminta usulan.");
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
    const arahanMentah = String(d.get("arahan") ?? "").trim();
    const prefiksGaya = pilihGaya !== "otomatis" ? `[Gaya: ${pilihGaya}] ` : "";
    const arahanAkhir = prefiksGaya + arahanMentah;

    let jadwalOtomatisIso: string | null = null;
    if (modeJadwalBuat === "prime19") {
      jadwalOtomatisIso = daftarSlotCepatWIB()[3]?.waktuIso ?? null;
    } else if (modeJadwalBuat === "custom" && waktuJadwalBuat.trim()) {
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(waktuJadwalBuat.trim());
      if (m) {
        const [, y, mo, da, h, mi] = m;
        const tgl = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), 0) - 7 * 3600_000);
        if (tgl.getTime() <= Date.now() - 60_000) {
          setSibuk(false);
          return setPesan("Waktu jadwal custom sudah lewat — pilih waktu ke depan (WIB).");
        }
        jadwalOtomatisIso = tgl.toISOString();
      }
    }

    // Merek bank media (Lek Kopi): naskah ditulis server dulu, video dibuat setelah naskah disetujui.
    if (merekBank) {
      const j = await kirimNaskah({
        aksi: "buat",
        merek: pilihMerek,
        permintaan: arahanAkhir,
        jadwal_tayang: jadwalOtomatisIso,
        sasaran: sasaranBuat,
      });
      setSibuk(false);
      if (j.ok) form.reset();
      return void muat();
    }
    const barisInsert: Record<string, unknown> = {
      merek: d.get("merek") ?? "bakafrawi",
      jenis: d.get("jenis"),
      produk_slug: d.get("produk"),
      arahan: arahanAkhir,
      latar: d.get("latar") ? "ai" : "polos",
    };
    if (jadwalOtomatisIso) {
      barisInsert.status_tayang = "dijadwalkan";
      barisInsert.jadwal_tayang = jadwalOtomatisIso;
    }
    if (sasaranBuat !== "otomatis") {
      barisInsert.tayang = { sasaran: sasaranBuat };
    }
    const { error } = await supabase().from("studio_tugas").insert(barisInsert);
    if (error) {
      setSibuk(false);
      return setPesan(`Gagal membuat tugas: ${error.message}`);
    }
    const res = await fetch("/api/studio/jalankan", { method: "POST", headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}` } });
    const j = await res.json().catch(() => ({}));
    const infoJadwalPesan = jadwalOtomatisIso
      ? ` & otomatis dijadwalkan ${new Date(jadwalOtomatisIso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" })} WIB`
      : "";
    setPesan(
      j.dipicu
        ? `Tugas dibuat${infoJadwalPesan} — mesin Studio dinyalakan. Gambar ±1–2 menit, video ±3–6 menit.`
        : `Tugas dibuat${infoJadwalPesan}. Mesin akan mengerjakannya pada putaran jadwal berikutnya (≤ 30 menit).`,
    );
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

  async function tayang(t: Tugas, aksi: AksiTayang, opsi?: { jadwal?: string; sasaran?: SasaranTayang }) {
    const tok = await tokenSegar();
    const res = await fetch("/api/studio/tayang", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, aksi, ...opsi }),
    });
    const j = await res.json().catch(() => ({}));
    const waktuLabel = j.tugas?.jadwal_tayang
      ? new Date(j.tugas.jadwal_tayang).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) + " WIB"
      : "pukul 19.00 WIB";
    const ok: Record<AksiTayang, string> = {
      sekarang: opsi?.sasaran === "story" ? "Segera ditayangkan ke Story Instagram." : "Segera ditayangkan ke Instagram.",
      jadwal: `Dijadwalkan tayang ${waktuLabel}.`,
      tolak: "Ditolak.",
      batal: "Tayang dibatalkan.",
      ulang: "Dibuat ulang.",
    };
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

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBukaJadwal((v) => !v)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
                      bukaJadwal
                        ? "border-amber-400/50 bg-amber-500/10 text-amber-300"
                        : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground"
                    }`}
                  >
                    <Clock className="size-3.5 shrink-0" />
                    <span>Jam Terbaik</span>
                    {bukaJadwal ? <ChevronUp className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBukaRiset((v) => !v)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
                      bukaRiset
                        ? "border-emas/50 bg-emas/10 text-emas"
                        : "border-emas/30 text-emas-muda hover:border-emas hover:bg-emas/5"
                    }`}
                  >
                    <TrendingUp className="size-3.5 shrink-0" />
                    <span>Riset Tren Viral</span>
                    {bukaRiset ? <ChevronUp className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBukaRef((v) => !v)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
                      bukaRef
                        ? "border-sky-400/50 bg-sky-500/10 text-sky-300"
                        : "border-white/10 text-muted-foreground hover:border-sky-400/40 hover:text-sky-300"
                    }`}
                  >
                    <Link2 className="size-3.5 shrink-0" />
                    <span>Pelajari Link Video</span>
                    {daftarRef.length > 0 && (
                      <span className="rounded-full bg-sky-500/20 px-1.5 text-[10px] text-sky-300">{daftarRef.length}</span>
                    )}
                    {bukaRef ? <ChevronUp className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBukaRutin((v) => !v)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
                      bukaRutin || jadwalRutin.aktif
                        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                        : "border-white/10 text-muted-foreground hover:border-emerald-400/40 hover:text-emerald-300"
                    }`}
                  >
                    <CalendarClock className="size-3.5 shrink-0" />
                    <span>Story Jam Buka</span>
                    <span className={`rounded-full px-1.5 text-[10px] ${jadwalRutin.aktif ? "bg-emerald-500/25 text-emerald-200" : "bg-white/10 text-zinc-400"}`}>
                      {jadwalRutin.aktif ? jadwalRutin.jam : "Mati"}
                    </span>
                    {bukaRutin ? <ChevronUp className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />}
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
                      placeholder={`Topik/sudut khusus untuk ${merekBank ? (merek.find((m) => m.slug === pilihMerek)?.nama ?? pilihMerek) : namaProduk(pilihProduk)} (opsional, mis. ${merekBank ? "suasana malam minggu, es kopi susu" : "nota WhatsApp, kasir lemot"})`}
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

                  {galatRiset && <p className="text-xs text-red-300 break-words">{galatRiset}</p>}

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

              {/* Panel Tempel Link Referensi Video (Instagram Reels / TikTok) */}
              {bukaRef && (
                <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                    <p className="flex-1 min-w-[220px]">
                      Tempelkan tautan <b className="text-foreground">Instagram Reels, TikTok, atau YouTube Shorts</b>. AI akan membedah <i>hook</i>, ritme potongan, gaya teks & visualnya untuk merek aktif.
                    </p>
                    {merekAktif.length > 1 && (
                      <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-0.5">
                        {merekAktif.map((m) => (
                          <button
                            key={m.slug}
                            type="button"
                            onClick={() => { setPilihMerek(m.slug); setUsulan([]); setGalatUsulan(""); }}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                              pilihMerek === m.slug
                                ? "bg-emas text-background"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {m.nama}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-sky-400/40 bg-sky-500/5 px-4 py-3 text-center text-xs hover:border-sky-400 hover:bg-sky-500/10 transition">
                      <div className="flex items-center gap-1.5 font-medium text-sky-300">
                        <Upload className="size-4" />
                        <span>
                          {berkasRef.length > 0
                            ? `${berkasRef.length} berkas dipilih (${berkasRef[0].name})`
                            : "Unggah Video Reels/TikTok (.mp4) atau 2–5 Screenshot — AI Menonton Langsung!"}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        Paling akurat (anti-blokir login Instagram) · otomatis mengambil 5 bingkai utama dari video
                      </span>
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => setBerkasRef(Array.from(e.target.files ?? []))}
                      />
                    </label>

                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        type="url"
                        value={urlRef}
                        onChange={(e) => setUrlRef(e.target.value)}
                        placeholder="Atau tempel link TikTok / YouTube Shorts (opsional)"
                        className="h-10 rounded-lg border border-input bg-transparent px-3 text-xs"
                      />
                      <input
                        type="text"
                        value={catatanRef}
                        onChange={(e) => setCatatanRef(e.target.value)}
                        placeholder="Catatan (mis. sesuaikan dengan menu Lek Kopi)"
                        className="h-10 rounded-lg border border-input bg-transparent px-3 text-xs"
                      />
                      <button
                        type="button"
                        onClick={bedahLinkReferensi}
                        disabled={membedahRef}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
                      >
                        {membedahRef ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                        {berkasRef.length > 0 ? "Tonton & Bedah AI" : "Bedah & Simpan"}
                      </button>
                    </div>
                  </div>

                  {galatRef && <p className="text-xs text-red-300 break-words">{galatRef}</p>}

                  {daftarRef.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {daftarRef.map((r) => {
                        const b = r.analisis;
                        if (!b) return null;
                        return (
                          <div key={r.id} className="flex flex-col justify-between rounded-xl border border-border/80 bg-white/[0.02] p-3.5 text-xs">
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="inline-block rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-300 mr-1.5">
                                    {b.platform}
                                  </span>
                                  <span className="font-semibold text-foreground">{b.judul}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {r.permalink && (
                                    <a href={r.permalink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-emas" title="Buka video asli">
                                      <ExternalLink className="size-3.5" />
                                    </a>
                                  )}
                                  <button type="button" onClick={() => hapusReferensi(r.id)} className="text-muted-foreground hover:text-red-400" title="Hapus referensi">
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[11px] text-zinc-400">{b.ringkas}</p>
                              <p className="text-[11px] text-zinc-300"><b>Hook:</b> {b.hook3Detik}</p>
                              <p className="text-[11px] text-zinc-400"><b>Visual & Teks:</b> {b.gayaVisual} · {b.gayaTeks}</p>
                              <p className="text-[10px] text-emas-muda">Preset cocok: <b>{b.presetCocok}</b> · Pacing: {b.pacing}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => tiruReferensi(r)}
                              className="mt-3 w-full rounded-lg border border-sky-400/40 bg-sky-500/10 py-1.5 text-center text-xs font-medium text-sky-300 hover:bg-sky-500 hover:text-white transition"
                            >
                              Tiru Gaya Ini →
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Panel Jadwal Otomatis Setiap Jam Buka (Story & Opening Lek Kopi) ── */}
              {bukaRutin && (
                <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-heading text-sm font-semibold text-foreground flex items-center gap-2">
                        <CalendarClock className="size-4 text-emerald-400" />
                        Jadwal Otomatis Setiap Jam Buka (Story & Opening)
                      </h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Otomatis mengunggah video opening (mis. <b>We Are Open</b>) ke Instagram Story / Reels setiap hari buka sesuai jam yang ditentukan.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {merek.length > 1 && (
                        <select
                          value={merekRutin}
                          onChange={(e) => setMerekRutin(e.target.value)}
                          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs"
                        >
                          {merek.map((m) => (
                            <option key={m.slug} value={m.slug} className="bg-card">
                              {m.nama}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        disabled={menyimpanRutin}
                        onClick={() => void simpanPengaturanRutin({ aktif: !jadwalRutin.aktif })}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                          jadwalRutin.aktif
                            ? "bg-emerald-500 text-background hover:bg-emerald-400"
                            : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-background"
                        }`}
                      >
                        {menyimpanRutin ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        {jadwalRutin.aktif ? "Jadwal Buka Aktif" : "Aktifkan Jadwal Buka"}
                      </button>
                    </div>
                  </div>

                  {/* Status waktu tayang berikutnya */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2.5 text-xs">
                    <div className="text-zinc-300">
                      {jadwalRutin.aktif && berikutnyaRutin ? (
                        <>
                          ⏰ <b className="text-emerald-300">Tayang otomatis berikutnya:</b>{" "}
                          {new Date(berikutnyaRutin).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                            dateStyle: "full",
                            timeStyle: "short",
                          })}{" "}
                          WIB ({jadwalRutin.video.filter((v) => v.aktif).length + (jadwalRutin.aiAktif ? 1 : 0)} konten siap tayang
                          {jadwalRutin.aiAktif ? ` · termasuk AI ${jadwalRutin.aiFormat === "poster" ? "Poster" : "Animasi"}` : ""})
                        </>
                      ) : (
                        <span className="text-zinc-400">
                          Jadwal otomatis sedang nonaktif. Klik <b>Aktifkan Jadwal Buka</b> atau atur jam & video di bawah lalu tekan <b>Simpan Jadwal Buka</b>.
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={menyimpanRutin}
                        onClick={buatPratinjauStoryBuka}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emas px-3 py-1.5 text-xs font-semibold text-background hover:bg-emas/90 disabled:opacity-50"
                      >
                        <Sparkles className="size-3.5" /> Buat Pratinjau Dulu (Cek di Studio & Telegram)
                      </button>
                      <button
                        type="button"
                        disabled={menyimpanRutin || (!jadwalRutin.aiAktif && jadwalRutin.video.filter((v) => v.aktif).length === 0)}
                        onClick={tayangkanStoryBukaSekarang}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500 hover:text-background disabled:opacity-50"
                      >
                        <Play className="size-3" /> Langsung Tayangkan Sekarang
                      </button>
                    </div>
                  </div>

                  {/* Pengaturan Jam Buka, Hari Buka, dan Mode Beberapa Video */}
                  <div className="grid gap-4 sm:grid-cols-3 rounded-xl border border-border/70 bg-white/[0.02] p-3.5 text-xs">
                    <div className="space-y-1.5">
                      <span className="font-medium text-foreground block">Jam Buka (WIB)</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          value={jadwalRutin.jam}
                          onChange={(e) => setJadwalRutin((j) => ({ ...j, jam: e.target.value || "09:00" }))}
                          className="h-9 rounded-lg border border-input bg-transparent px-3 font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setJadwalRutin((j) => ({ ...j, jam: "09:00" }))}
                          className={`rounded-md border px-2 py-1 text-[11px] ${
                            jadwalRutin.jam === "09:00" ? "border-emas bg-emas/15 text-emas" : "border-white/10 text-zinc-400 hover:text-foreground"
                          }`}
                        >
                          09:00 (Video)
                        </button>
                        <button
                          type="button"
                          onClick={() => setJadwalRutin((j) => ({ ...j, jam: "14:00" }))}
                          className={`rounded-md border px-2 py-1 text-[11px] ${
                            jadwalRutin.jam === "14:00" ? "border-emas bg-emas/15 text-emas" : "border-white/10 text-zinc-400 hover:text-foreground"
                          }`}
                        >
                          14:00 (Shift)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Hari Buka</span>
                        <button
                          type="button"
                          onClick={() => setJadwalRutin((j) => ({ ...j, hari: [1, 2, 3, 4, 5, 6] }))}
                          className="text-[10px] text-emas hover:underline"
                        >
                          Senin–Sabtu
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {HARI_WIB.map((h) => {
                          const dipilih = jadwalRutin.hari.includes(h.kode);
                          return (
                            <button
                              key={h.kode}
                              type="button"
                              onClick={() =>
                                setJadwalRutin((j) => ({
                                  ...j,
                                  hari: dipilih ? j.hari.filter((x) => x !== h.kode) : [...j.hari, h.kode],
                                }))
                              }
                              className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                                dipilih
                                  ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                                  : "border-white/10 bg-white/[0.02] text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              {h.pendek}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="font-medium text-foreground block">Mode Beberapa Video</span>
                      <select
                        value={jadwalRutin.mode}
                        onChange={(e) => setJadwalRutin((j) => ({ ...j, mode: e.target.value as JadwalRutin["mode"] }))}
                        className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs"
                      >
                        <option value="semua" className="bg-card">Upload semua video aktif sekaligus</option>
                        <option value="wajib+bergilir" className="bg-card">Video wajib + 1 video pendamping bergilir/hari</option>
                      </select>
                    </div>
                  </div>

                  {/* Konten Jam Buka Generated AI (Selalu Baru Tiap Hari — Animasi Remotion / Poster AI) */}
                  <div className="rounded-xl border border-emas/30 bg-emas/[0.04] p-3.5 text-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(jadwalRutin.aiAktif)}
                          onChange={(e) => setJadwalRutin((j) => ({ ...j, aiAktif: e.target.checked }))}
                          className="size-4 accent-[#c9a24b]"
                        />
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-emas" />
                          Buat Konten Opening Baru oleh AI Setiap Jam Buka (Tanpa Bank Video)
                        </span>
                      </label>
                      <span className="rounded-full bg-emas/15 px-2 py-0.5 text-[10px] font-medium text-emas-muda">
                        3 Menu Terlaris Asli + Musik & SFX Adaptif
                      </span>
                    </div>

                    {jadwalRutin.aiAktif && (
                      <div className="grid gap-3 sm:grid-cols-3 pt-1">
                        <label className="grid gap-1">
                          <span className="text-[11px] text-muted-foreground">Format Konten AI</span>
                          <select
                            value={jadwalRutin.aiFormat ?? "video-animasi"}
                            onChange={(e) =>
                              setJadwalRutin((j) => ({
                                ...j,
                                aiFormat: e.target.value as JadwalRutin["aiFormat"],
                              }))
                            }
                            className="h-9 rounded-lg border border-input bg-card px-2.5 text-xs"
                          >
                            <option value="video-animasi" className="bg-card">🎬 Video Animasi 3 Menu Terlaris (15 dtk + Musik & SFX)</option>
                            <option value="poster" className="bg-card">🖼 Poster Story AI (9:16, cepat & ringan)</option>
                          </select>
                        </label>

                        <label className="grid gap-1">
                          <span className="text-[11px] text-muted-foreground">Tema Visual</span>
                          <select
                            value={jadwalRutin.aiGaya ?? "otomatis"}
                            onChange={(e) =>
                              setJadwalRutin((j) => ({
                                ...j,
                                aiGaya: e.target.value as JadwalRutin["aiGaya"],
                              }))
                            }
                            className="h-9 rounded-lg border border-input bg-card px-2.5 text-xs"
                          >
                            <option value="otomatis" className="bg-card">Otomatis berganti tiap hari</option>
                            <option value="hangat-kafe" className="bg-card">Hangat Kafe (Cokelat Emas)</option>
                            <option value="terang-modern" className="bg-card">Terang Modern (Krem Bersih)</option>
                            <option value="minimalis-gelap" className="bg-card">Minimalis Gelap (Teal Elegan)</option>
                          </select>
                        </label>

                        <label className="grid gap-1">
                          <span className="text-[11px] text-muted-foreground">Arahan AI (opsional)</span>
                          <input
                            type="text"
                            value={jadwalRutin.aiArahan ?? ""}
                            onChange={(e) => setJadwalRutin((j) => ({ ...j, aiArahan: e.target.value }))}
                            placeholder="Kosongkan agar AI pilih menu tiap hari"
                            className="h-9 rounded-lg border border-input bg-card px-2.5 text-xs"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Daftar Video Jam Buka */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        Daftar Video Opening / Story Jam Buka ({jadwalRutin.video.length} video)
                      </p>
                      {!jadwalRutin.video.some((v) => v.url.includes("lekkopi-opening-story")) && (
                        <button
                          type="button"
                          onClick={() =>
                            setJadwalRutin((j) => ({
                              ...j,
                              video: [{ ...VIDEO_OPENING_BAWAAN_LEKKOPI }, ...j.video],
                            }))
                          }
                          className="text-[11px] text-emas hover:underline"
                        >
                          + Pulihkan Video Bawaan "We Are Open"
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {jadwalRutin.video.map((v, idx) => (
                        <div
                          key={v.id}
                          className={`flex gap-3 rounded-xl border p-3 text-xs transition ${
                            v.aktif ? "border-border/80 bg-white/[0.03]" : "border-border/40 bg-white/[0.01] opacity-60"
                          }`}
                        >
                          <div className="shrink-0">
                            {v.jenis === "video" ? (
                              <video
                                src={v.url}
                                poster={v.sampul ?? undefined}
                                controls
                                playsInline
                                preload="metadata"
                                className="h-32 w-20 rounded-lg bg-black object-cover"
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={v.url} alt={v.judul} className="h-32 w-20 rounded-lg bg-black object-cover" />
                            )}
                          </div>

                          <div className="flex flex-1 flex-col justify-between gap-2 min-w-0">
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-1">
                                <input
                                  type="text"
                                  value={v.judul}
                                  onChange={(e) =>
                                    setJadwalRutin((j) => ({
                                      ...j,
                                      video: j.video.map((x, i) => (i === idx ? { ...x, judul: e.target.value } : x)),
                                    }))
                                  }
                                  className="h-7 w-full rounded border border-white/10 bg-transparent px-2 text-xs font-semibold text-foreground"
                                  placeholder="Judul video opening"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setJadwalRutin((j) => ({
                                      ...j,
                                      video: j.video.filter((_, i) => i !== idx),
                                    }))
                                  }
                                  className="p-1 text-zinc-400 hover:text-red-400"
                                  title="Hapus dari jadwal buka"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>

                              <select
                                value={v.sasaran}
                                onChange={(e) =>
                                  setJadwalRutin((j) => ({
                                    ...j,
                                    video: j.video.map((x, i) =>
                                      i === idx ? { ...x, sasaran: e.target.value as VideoRutin["sasaran"] } : x,
                                    ),
                                  }))
                                }
                                className="h-7 w-full rounded border border-white/10 bg-transparent px-2 text-[11px]"
                              >
                                <option value="story" className="bg-card">📱 Upload ke Story Instagram</option>
                                <option value="reels+story" className="bg-card">🎬 Upload ke Story + Reels</option>
                                <option value="reels" className="bg-card">🎬 Upload ke Reels saja</option>
                              </select>

                              <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px]">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={v.aktif}
                                    onChange={(e) =>
                                      setJadwalRutin((j) => ({
                                        ...j,
                                        video: j.video.map((x, i) => (i === idx ? { ...x, aktif: e.target.checked } : x)),
                                      }))
                                    }
                                    className="size-3.5 accent-emerald-500"
                                  />
                                  <span>Aktif</span>
                                </label>
                                <label className="inline-flex items-center gap-1.5 cursor-pointer" title="Selalu diupload setiap jam buka">
                                  <input
                                    type="checkbox"
                                    checked={v.wajib}
                                    onChange={(e) =>
                                      setJadwalRutin((j) => ({
                                        ...j,
                                        video: j.video.map((x, i) => (i === idx ? { ...x, wajib: e.target.checked } : x)),
                                      }))
                                    }
                                    className="size-3.5 accent-[#c9a24b]"
                                  />
                                  <span className="text-emas-muda">Selalu tayang tiap buka</span>
                                </label>
                              </div>
                            </div>

                            <span className="truncate text-[10px] text-zinc-500">
                              {v.durasi ? `${v.durasi} dtk · ` : ""}{v.url}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Unggah Video Opening Baru atau Tambah URL */}
                    <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-400/40 bg-emerald-500/5 px-4 py-2.5 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/10 transition">
                        {mengunggahRutin ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        <span>
                          {mengunggahRutin ? "Mengunggah video ke Studio…" : "Unggah Video/Foto Opening Baru (.mp4 / .mov / .jpg)"}
                        </span>
                        <input
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
                          className="hidden"
                          disabled={mengunggahRutin}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void unggahVideoRutin(f);
                            e.target.value = "";
                          }}
                        />
                      </label>

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={judulBaruRutin}
                          onChange={(e) => setJudulBaruRutin(e.target.value)}
                          placeholder="Judul (opsional)"
                          className="h-10 w-28 rounded-lg border border-input bg-transparent px-2.5 text-xs"
                        />
                        <input
                          type="text"
                          value={urlBaruRutin}
                          onChange={(e) => setUrlBaruRutin(e.target.value)}
                          placeholder="Atau tempel URL video (.mp4)"
                          className="h-10 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={tambahUrlRutin}
                          disabled={!urlBaruRutin.trim()}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 text-xs hover:border-emas hover:text-emas disabled:opacity-40"
                        >
                          <Plus className="size-3.5" /> Tambah
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      disabled={menyimpanRutin}
                      onClick={() => void simpanPengaturanRutin()}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emas px-4 py-2 text-xs font-semibold text-background hover:bg-emas/90 disabled:opacity-60"
                    >
                      {menyimpanRutin ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      Simpan Jadwal Buka
                    </button>
                    {pesanRutin && <span className="text-xs text-emerald-300">{pesanRutin}</span>}
                  </div>
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
                  <select
                    name="jenis"
                    value={pilihJenis}
                    onChange={(e) => {
                      setPilihJenis(e.target.value as "gambar" | "video");
                      setPilihGaya("otomatis");
                    }}
                    className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="gambar" className="bg-card">Poster (1:1, 4:5, 9:16)</option>
                    <option value="video" className="bg-card">Video Reels/TikTok (Remotion + animasi)</option>
                  </select>
                </label>
              </div>
              {/* Preset Gaya Desain — tersedia sama untuk Bakafrawi & Lek Kopi */}
              <label className="grid gap-1.5 sm:w-1/2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Palette className="size-3.5 text-emas" /> Gaya Desain {merekBank || pilihJenis === "video" ? "Video" : "Poster"}
                </span>
                <select
                  name="gaya"
                  value={pilihGaya}
                  onChange={(e) => setPilihGaya(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  {(merekBank || pilihJenis === "video" ? PRESET_VIDEO : PRESET_POSTER).map((g) => (
                    <option key={g.kode} value={g.kode} className="bg-card">{g.label}</option>
                  ))}
                </select>
              </label>
              <label hidden={merekBank} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="latar" className="mt-0.5 size-4 accent-[#c9a24b]" />
                <span>
                  Latar gambar AI <span className="text-xs text-redup">(khusus poster: foto suasana — gratis ±60 gambar/hari lewat Cloudflare; video memakai karakter dari Drive)</span>
                </span>
              </label>
              <div className="grid gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="studio-arahan" className="text-xs font-medium text-muted-foreground">{merekBank ? "Ide video (opsional — kosongkan agar AI memilih otomatis)" : "Arahan untuk AI (opsional)"}</label>
                  <button type="button" onClick={mintaUsulan} disabled={mengusulkan} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs hover:border-emas hover:text-emas disabled:opacity-60">
                    {mengusulkan ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} {merekBank ? "Usulkan ide AI" : "Usulkan arahan"}
                  </button>
                </div>
                <textarea
                  id="studio-arahan"
                  ref={kolomArahan}
                  key={merekBank ? "ide" : "arahan"}
                  name="arahan"
                  rows={2}
                  placeholder={merekBank ? "Opsional: mis. suasana malam minggu, es kopi susu (kosongkan agar AI pilih menu terbaik otomatis)" : "Mis. sasar pemilik warung kopi, tonjolkan fitur struk WhatsApp, nada santai"}
                  className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                />
                {galatUsulan && <p className="text-xs text-red-300">{galatUsulan}</p>}
                {usulan.length > 0 && (
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

              {/* Opsi Jadwal Tayang Otomatis / Custom & Sasaran Instagram */}
              <div className="rounded-xl border border-border/70 bg-white/[0.02] p-3.5 text-xs space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                      <CalendarClock className="size-3.5 text-emas" /> Jadwal Tayang Setelah Selesai
                    </span>
                    <select
                      value={modeJadwalBuat}
                      onChange={(e) => setModeJadwalBuat(e.target.value as "persetujuan" | "prime19" | "custom")}
                      className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
                    >
                      <option value="persetujuan" className="bg-card">Tunggu persetujuan dulu (bawaan)</option>
                      <option value="prime19" className="bg-card">Otomatis jadwalkan Prime Time 19.00 WIB</option>
                      <option value="custom" className="bg-card">Otomatis jadwalkan di tanggal & jam custom…</option>
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="font-medium text-muted-foreground">Sasaran Tayang Instagram</span>
                    <select
                      value={sasaranBuat}
                      onChange={(e) => setSasaranBuat(e.target.value as SasaranTayang)}
                      className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
                    >
                      {(merekBank || pilihJenis === "video" ? DAFTAR_SASARAN_VIDEO : DAFTAR_SASARAN_GAMBAR).map((s) => (
                        <option key={s.kode} value={s.kode} className="bg-card">
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {modeJadwalBuat === "custom" && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="datetime-local"
                      value={waktuJadwalBuat}
                      onChange={(e) => setWaktuJadwalBuat(e.target.value)}
                      className="h-9 rounded-lg border border-input bg-transparent px-3 font-mono text-xs"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {daftarSlotCepatWIB().map((s) => (
                        <button
                          key={s.kode}
                          type="button"
                          onClick={() => setWaktuJadwalBuat(s.inputWib)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                            waktuJadwalBuat === s.inputWib
                              ? "border-emas bg-emas/15 text-emas"
                              : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-foreground"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
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
                <KartuTugas
                  key={t.id}
                  t={t}
                  nama={
                    namaMerek(t.merek) +
                    (t.produk_slug === "rutin-buka"
                      ? "Story Jam Buka Otomatis"
                      : t.produk_slug === t.merek
                      ? "video bank media"
                      : namaProduk(t.produk_slug))
                  }
                  hapus={() => hapus(t)}
                  tayang={(a, opsi) => tayang(t, a, opsi)}
                  naskah={(a) => putusNaskah(t, a)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function KartuTugas({
  t,
  nama,
  hapus,
  tayang,
  naskah,
}: {
  t: Tugas;
  nama: string;
  hapus: () => void;
  tayang: (a: AksiTayang, opsi?: { jadwal?: string; sasaran?: SasaranTayang }) => void;
  naskah: (a: "setujui" | "tolak" | "revisi") => void;
}) {
  const [tersalin, setTersalin] = useState(false);
  const [bukaCustom, setBukaCustom] = useState(false);
  const [waktuCustom, setWaktuCustom] = useState(() =>
    t.jadwal_tayang ? keInputDatetimeWIB(new Date(t.jadwal_tayang)) : (daftarSlotCepatWIB()[3]?.inputWib ?? ""),
  );
  const [sasaranCustom, setSasaranCustom] = useState<SasaranTayang>(() => t.tayang?.sasaran ?? "otomatis");

  const s = LABEL_STATUS[t.status];
  const st = LABEL_TAYANG[t.status_tayang];
  const tautanIg = t.tayang?.instagram?.reels?.permalink ?? t.tayang?.instagram?.feed?.permalink;
  const bisaTayang = t.status === "selesai" && ["belum", "gagal", "ditolak"].includes(t.status_tayang);
  const bisaUbahJadwal = t.status === "selesai" && ["belum", "gagal", "ditolak", "dijadwalkan"].includes(t.status_tayang);
  const daftarSasaran = t.jenis === "video" ? DAFTAR_SASARAN_VIDEO : DAFTAR_SASARAN_GAMBAR;

  function simpanJadwalCustom() {
    if (!waktuCustom.trim()) return;
    tayang("jadwal", { jadwal: waktuCustom.trim(), sasaran: sasaranCustom });
    setBukaCustom(false);
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          {t.jenis === "video" ? <Video className="size-4 text-emas" /> : <ImageIcon className="size-4 text-emas" />}
          <b>{nama}</b>
          <span className="text-redup">· {new Date(t.dibuat).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
        <div className="flex items-center gap-2">
          {t.tayang?.sasaran && t.tayang.sasaran !== "otomatis" && (
            <span className="rounded-full bg-purple-500/15 px-2.5 py-1 text-xs text-purple-300 uppercase">
              {t.tayang.sasaran}
            </span>
          )}
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
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {bisaTayang && (
              <>
                <button onClick={() => tayang("sekarang")} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 font-semibold text-primary-foreground">
                  <Send className="size-4" /> Tayangkan sekarang
                </button>
                <button
                  onClick={() => tayang("sekarang", { sasaran: "story" })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500 hover:text-background"
                >
                  📱 Story sekarang
                </button>
                <button onClick={() => tayang("jadwal")} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 hover:border-emas hover:text-emas">
                  <CalendarClock className="size-4" /> Jadwal 19.00
                </button>
              </>
            )}
            {bisaUbahJadwal && (
              <button
                type="button"
                onClick={() => setBukaCustom((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  bukaCustom
                    ? "border-emas bg-emas/15 text-emas"
                    : "border-white/15 text-muted-foreground hover:border-emas hover:text-emas"
                }`}
              >
                <Clock className="size-3.5" />
                {t.status_tayang === "dijadwalkan" ? "Ubah Jadwal Custom…" : "Jadwal Custom…"}
              </button>
            )}
            {(t.status_tayang === "antre" || t.status_tayang === "dijadwalkan") && (
              <button onClick={() => tayang("batal")} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5">
                <X className="size-4" /> Batalkan tayang
              </button>
            )}
            {t.status_tayang !== "tayang" && t.status_tayang !== "proses" && t.produk_slug !== "rutin-buka" && (
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

          {/* Pemilih Jadwal Tayang Custom pada Kartu Tugas */}
          {bukaCustom && bisaUbahJadwal && (
            <div className="rounded-xl border border-emas/30 bg-emas/[0.04] p-3.5 text-xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarClock className="size-3.5 text-emas" /> Atur Tanggal, Jam (WIB) & Sasaran Tayang Custom
                </span>
                <div className="flex flex-wrap gap-1">
                  {daftarSlotCepatWIB().map((slot) => (
                    <button
                      key={slot.kode}
                      type="button"
                      onClick={() => setWaktuCustom(slot.inputWib)}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                        waktuCustom === slot.inputWib
                          ? "border-emas bg-emas/20 text-emas"
                          : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-foreground"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  value={waktuCustom}
                  onChange={(e) => setWaktuCustom(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-card px-3 font-mono text-xs"
                />
                <select
                  value={sasaranCustom}
                  onChange={(e) => setSasaranCustom(e.target.value as SasaranTayang)}
                  className="h-9 rounded-lg border border-input bg-card px-2.5 text-xs"
                >
                  {daftarSasaran.map((ds) => (
                    <option key={ds.kode} value={ds.kode} className="bg-card">
                      {ds.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={simpanJadwalCustom}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emas px-4 py-2 text-xs font-semibold text-background hover:bg-emas/90"
                >
                  <Check className="size-3.5" /> Simpan Jadwal
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
