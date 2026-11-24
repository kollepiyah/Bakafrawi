"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CalendarClock,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Flame,
  History,
  ImageIcon,
  Lightbulb,
  Link2,
  Loader2,
  Palette,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Send,
  Shuffle,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { Sambungan } from "./studio-sambungan";
import { PanelUnggahManual } from "./studio-unggah";
import { PanelGoogleFlow } from "./studio-google-flow";
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

  // Navigasi sub-menu Studio (seragam antara Web/PWA dan APK Android)
  type TabStudio = "unggah" | "rutin" | "buat" | "flow" | "riwayat" | "riset" | "sambungan";
  const [tabStudio, setTabStudio] = useState<TabStudio>("unggah");
  const [topikFlowAwal, setTopikFlowAwal] = useState("");
  const [filterRiwayat, setFilterRiwayat] = useState<"semua" | "terjadwal" | "cek" | "tayang">("semua");

  // Riset Reels Viral & Jam Tayang
  const [konsepViral, setKonsepViral] = useState<KonsepReelsViral[]>([]);
  const [merisetViral, setMerisetViral] = useState(false);
  const [galatRiset, setGalatRiset] = useState("");
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
  const [merekRutin, setMerekRutin] = useState("lekkopi");
  const [jadwalRutin, setJadwalRutin] = useState<JadwalRutin>(() => jadwalRutinBawaan("lekkopi"));
  const [berikutnyaRutin, setBerikutnyaRutin] = useState<string | null>(null);
  const [videoBerikutnyaRutin, setVideoBerikutnyaRutin] = useState<{ id: string | null; judul: string } | null>(null);
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
      setVideoBerikutnyaRutin(j.videoBerikutnya ?? null);
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
        setVideoBerikutnyaRutin(j.videoBerikutnya ?? null);
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

  async function acakUlangStoryBuka() {
    setMenyimpanRutin(true);
    setPesanRutin("");
    try {
      const tok = await tokenSegar();
      const res = await fetch("/api/studio/rutin", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "acak-ulang", merek: merekRutin }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.ok) {
        setVideoBerikutnyaRutin(j.videoBerikutnya ?? null);
        setBerikutnyaRutin(j.berikutnya ?? berikutnyaRutin);
        setPesanRutin(j.pesan ?? "Video acak berikutnya berhasil diundi ulang.");
        muat();
      } else {
        setPesanRutin(j.pesan ?? "Gagal mengacak ulang video.");
      }
    } catch (e) {
      setPesanRutin(e instanceof Error ? e.message : "Gagal mengacak ulang video.");
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

  async function unggahBanyakVideoRutin(berkasList: File[]) {
    if (!berkasList.length) return;
    setMengunggahRutin(true);
    setPesanRutin("");
    try {
      const tok = await tokenSegar();
      const tambahan: VideoRutin[] = [];
      for (const berkas of berkasList) {
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

        const izinRes = await fetch("/api/studio/rutin", {
          method: "POST",
          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
          body: JSON.stringify({ aksi: "izin-unggah", merek: merekRutin, namaBerkas: berkas.name }),
        });
        const izin = await izinRes.json().catch(() => ({}));
        if (!izin.ok || !izin.uploadUrl) throw new Error(izin.pesan ?? "Gagal menyiapkan unggahan.");

        const upRes = await fetch(izin.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": adalahGambar
              ? berkas.type === "image/png" || /\.png$/i.test(berkas.name)
                ? "image/png"
                : "image/jpeg"
              : "video/mp4",
          },
          body: berkas,
        });
        if (!upRes.ok) throw new Error(`Unggah ${berkas.name} gagal (HTTP ${upRes.status}).`);

        tambahan.push({
          id: `rutin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          judul: berkas.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim(),
          url: izin.publicUrl,
          sampul: null,
          jenis: adalahGambar ? "gambar" : "video",
          durasi: adalahGambar ? undefined : durasi,
          sasaran: "story",
          wajib: false,
          aktif: true,
          caption: "We are OPEN! Lek Kopi Waru Sidoarjo ☕",
        });
      }
      await simpanPengaturanRutin({ video: [...jadwalRutin.video, ...tambahan] });
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
      wajib: false,
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
    if (!b) return;
    if (b.presetCocok) setPilihGaya(b.presetCocok);
    const teks = `${b.arahanTiru}\n(Referensi gaya: ${b.judul} — Hook: ${b.hook3Detik} | Pacing: ${b.pacing})`;
    setTabStudio("buat");
    setTimeout(() => {
      if (kolomArahan.current) {
        kolomArahan.current.value = teks;
        kolomArahan.current.focus();
      }
    }, 60);
    setPesan(`Pola referensi "${b.judul}" diterapkan ke tab Buat AI!`);
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
    setTabStudio("buat");
    setTimeout(() => {
      if (kolomArahan.current) {
        kolomArahan.current.value = arahan;
        kolomArahan.current.focus();
      }
    }, 60);
    setPesan("Konsep arahan viral berhasil disalin ke tab Buat AI!");
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
      if (j.ok) {
        form.reset();
        setTabStudio("riwayat");
      }
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
    setTabStudio("riwayat");
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

  const jumlahTerjadwal = daftar.filter((t) => t.status_tayang === "dijadwalkan" || t.status_tayang === "antre").length;
  const jumlahPerluCek = daftar.filter(
    (t) => (t.status === "selesai" && t.status_tayang === "belum") || t.status === "naskah",
  ).length;
  const videoRutinAktif = jadwalRutin.video.filter((v) => v.aktif).length;

  const daftarTersaring = daftar.filter((t) => {
    if (filterRiwayat === "terjadwal") return t.status_tayang === "dijadwalkan" || t.status_tayang === "antre";
    if (filterRiwayat === "cek") return (t.status === "selesai" && t.status_tayang === "belum") || t.status === "naskah";
    if (filterRiwayat === "tayang") return t.status_tayang === "tayang";
    return true;
  });

  const MENU_STUDIO: { id: TabStudio; label: string; ikon: ReactNode; lencana?: string | number | null }[] = [
    { id: "unggah", label: "Unggah & Jadwal", ikon: <Upload className="size-3.5 shrink-0" /> },
    {
      id: "rutin",
      label: "Story Otomatis",
      ikon: <Shuffle className="size-3.5 shrink-0" />,
      lencana: jadwalRutin.aktif ? jadwalRutin.jam : null,
    },
    { id: "buat", label: "Buat AI", ikon: <Sparkles className="size-3.5 shrink-0" /> },
    { id: "flow", label: "Google Flow", ikon: <Wand2 className="size-3.5 shrink-0" /> },
    {
      id: "riwayat",
      label: "Riwayat",
      ikon: <History className="size-3.5 shrink-0" />,
      lencana: jumlahPerluCek > 0 ? jumlahPerluCek : jumlahTerjadwal > 0 ? jumlahTerjadwal : daftar.length || null,
    },
    { id: "riset", label: "Riset & Gaya", ikon: <Flame className="size-3.5 shrink-0" /> },
    { id: "sambungan", label: "Sambungan", ikon: <Plug className="size-3.5 shrink-0" /> },
  ];

  return (
    <div className="min-w-0 overflow-x-clip pb-20">
      {kepala}
      <main className="mx-auto w-full max-w-4xl min-w-0 space-y-5 px-4 pt-5">
        {jalurGudang !== "supabase" ? (
          <p className="text-muted-foreground">Studio hanya tersedia bila panel admin tersambung ke Supabase.</p>
        ) : (
          <>
            {/* ── Ringkasan Cepat & Bilah Sub-Menu Studio ── */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="font-heading text-xl font-semibold text-foreground">Studio Konten</h1>
                  <p className="text-xs text-muted-foreground">
                    Unggah manual, rotasi acak Story harian, pembuatan AI, dan penjadwalan otomatis Instagram.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setTabStudio("rutin")}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition ${
                      jadwalRutin.aktif
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/25"
                    }`}
                  >
                    <Shuffle className="size-3" />
                    Story: {jadwalRutin.aktif ? `${jadwalRutin.jam} WIB (${jadwalRutin.mode === "acak" ? "Acak" : jadwalRutin.mode})` : "Nonaktif"}
                  </button>
                  {jumlahTerjadwal > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterRiwayat("terjadwal");
                        setTabStudio("riwayat");
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-sky-300"
                    >
                      <CalendarClock className="size-3" /> {jumlahTerjadwal} Terjadwal
                    </button>
                  )}
                  {jumlahPerluCek > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterRiwayat("cek");
                        setTabStudio("riwayat");
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-emas/40 bg-emas/10 px-2.5 py-1 text-emas-muda"
                    >
                      <Clock className="size-3" /> {jumlahPerluCek} Perlu Cek
                    </button>
                  )}
                </div>
              </div>

              {/* Bar Sub-Tab Horizontal (ramah jari di HP/PWA, rapi di desktop) */}
              <div className="-mx-4 overflow-x-auto px-4 pb-1">
                <div className="inline-flex min-w-full gap-1.5 rounded-2xl border border-border bg-card/80 p-1.5 sm:flex sm:flex-wrap">
                  {MENU_STUDIO.map((m) => {
                    const aktif = tabStudio === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setTabStudio(m.id)}
                        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition ${
                          aktif
                            ? "bg-emas text-background shadow-sm"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        }`}
                      >
                        {m.ikon}
                        <span>{m.label}</span>
                        {m.lencana != null && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              aktif ? "bg-background/20 text-background" : "bg-white/10 text-zinc-300"
                            }`}
                          >
                            {m.lencana}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {pesan && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-emas/30 bg-emas/10 px-3.5 py-2.5 text-xs text-emas-muda">
                  <span>{pesan}</span>
                  <button type="button" onClick={() => setPesan("")} aria-label="Tutup pesan" className="shrink-0 hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* ══════════ TAB 1: UNGGAH MANUAL & JADWAL ══════════ */}
            {tabStudio === "unggah" && (
              <PanelUnggahManual
                merekDaftar={merekAktif.length > 0 ? merekAktif : merek}
                tokenSegar={tokenSegar}
                selesai={(msg) => {
                  setPesan(msg);
                  setFilterRiwayat("semua");
                  setTabStudio("riwayat");
                  void muat();
                }}
              />
            )}

            {/* ══════════ TAB 2: STORY OTOMATIS HARIAN (ACAK / BERGILIR) ══════════ */}
            {tabStudio === "rutin" && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
                      <CalendarClock className="size-5 text-emerald-400" />
                      Story Otomatis Harian (Jam Buka)
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Jadwalkan Story Instagram otomatis tiap hari buka. Gunakan mode <b>Acak 1 Video/Hari</b> agar video berganti-ganti dari koleksi yang sudah diunggah (tidak mengulang kemarin).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {merek.length > 1 && (
                      <select
                        value={merekRutin}
                        onChange={(e) => setMerekRutin(e.target.value)}
                        className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
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
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                        jadwalRutin.aktif
                          ? "bg-emerald-500 text-background hover:bg-emerald-400"
                          : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-background"
                      }`}
                    >
                      {menyimpanRutin ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      {jadwalRutin.aktif ? "Jadwal Aktif" : "Aktifkan Jadwal"}
                    </button>
                  </div>
                </div>

                {/* Status jadwal berikutnya & video acak terpilih */}
                <div className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-xs">
                  <div className="space-y-1 text-zinc-200">
                    {jadwalRutin.aktif && berikutnyaRutin ? (
                      <>
                        <p>
                          ⏰ <b className="text-emerald-300">Tayang otomatis berikutnya:</b>{" "}
                          {new Date(berikutnyaRutin).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                            dateStyle: "full",
                            timeStyle: "short",
                          })}{" "}
                          WIB
                        </p>
                        {jadwalRutin.mode === "acak" && videoBerikutnyaRutin ? (
                          <p className="flex flex-wrap items-center gap-2 text-zinc-300">
                            <span>
                              🎲 Pilihan acak berikutnya: <b className="text-emas-muda">{videoBerikutnyaRutin.judul}</b>{" "}
                              <span className="text-zinc-400">({videoRutinAktif} video aktif ikut undian)</span>
                            </span>
                            {videoRutinAktif > 1 && (
                              <button
                                type="button"
                                disabled={menyimpanRutin}
                                onClick={acakUlangStoryBuka}
                                className="inline-flex items-center gap-1 rounded-full border border-emas/40 bg-emas/10 px-2.5 py-0.5 text-[11px] font-medium text-emas hover:bg-emas hover:text-background disabled:opacity-50"
                              >
                                <Shuffle className="size-3" /> Acak Ulang
                              </button>
                            )}
                          </p>
                        ) : (
                          <p className="text-zinc-400">
                            {videoRutinAktif + (jadwalRutin.aiAktif ? 1 : 0)} konten siap tayang
                            {jadwalRutin.aiAktif ? ` · termasuk AI ${jadwalRutin.aiFormat === "poster" ? "Poster" : "Animasi"}` : ""}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-zinc-400">
                        Jadwal otomatis sedang nonaktif. Atur jam, mode acak, dan koleksi video di bawah lalu tekan <b>Aktifkan Jadwal</b> atau <b>Simpan Jadwal</b>.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={menyimpanRutin || (!jadwalRutin.aiAktif && videoRutinAktif === 0)}
                      onClick={tayangkanStoryBukaSekarang}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500 hover:text-background disabled:opacity-50"
                    >
                      <Play className="size-3" /> Tayangkan 1 Story Sekarang
                    </button>
                    {jadwalRutin.aiAktif && (
                      <button
                        type="button"
                        disabled={menyimpanRutin}
                        onClick={buatPratinjauStoryBuka}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emas px-3 py-1.5 text-xs font-semibold text-background hover:bg-emas/90 disabled:opacity-50"
                      >
                        <Sparkles className="size-3.5" /> Buat Pratinjau AI Dulu
                      </button>
                    )}
                  </div>
                </div>

                {/* Pilihan Mode Putar Video (Kartu Jelas — Acak sebagai pilihan utama) */}
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-foreground">Mode Pemutaran Koleksi Video</span>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    {[
                      {
                        kode: "acak" as const,
                        judul: "Acak 1 Video / Hari",
                        badge: "Disarankan",
                        ket: "Setiap hari diundi 1 video acak dari semua video aktif. Tidak mengulang kemarin sampai semua kebagian.",
                      },
                      {
                        kode: "wajib+bergilir" as const,
                        judul: "Wajib + Bergilir",
                        badge: null,
                        ket: "Video bertanda Wajib selalu tayang + 1 video pendamping bergantian sesuai urutan hari.",
                      },
                      {
                        kode: "semua" as const,
                        judul: "Tayang Semua Aktif",
                        badge: null,
                        ket: "Seluruh video yang berstatus Aktif diunggah sekaligus setiap jam buka.",
                      },
                    ].map((o) => {
                      const aktif = jadwalRutin.mode === o.kode;
                      return (
                        <button
                          key={o.kode}
                          type="button"
                          onClick={() => setJadwalRutin((j) => ({ ...j, mode: o.kode }))}
                          className={`rounded-xl border p-3 text-left transition ${
                            aktif
                              ? "border-emas bg-emas/10"
                              : "border-border/70 bg-white/[0.02] hover:border-white/25"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-xs font-semibold ${aktif ? "text-emas" : "text-foreground"}`}>
                              {o.judul}
                            </span>
                            {o.badge && (
                              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                                {o.badge}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{o.ket}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Jam Buka & Hari Buka */}
                <div className="grid gap-4 rounded-xl border border-border/70 bg-white/[0.02] p-3.5 text-xs sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="block font-medium text-foreground">Jam Tayang Otomatis (WIB)</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={jadwalRutin.jam}
                        onChange={(e) => setJadwalRutin((j) => ({ ...j, jam: e.target.value || "14:00" }))}
                        className="h-9 rounded-lg border border-input bg-transparent px-3 font-mono text-sm"
                      />
                      {["09:00", "14:00", "16:00", "19:00"].map((jm) => (
                        <button
                          key={jm}
                          type="button"
                          onClick={() => setJadwalRutin((j) => ({ ...j, jam: jm }))}
                          className={`rounded-md border px-2 py-1 text-[11px] ${
                            jadwalRutin.jam === jm
                              ? "border-emas bg-emas/15 text-emas"
                              : "border-white/10 text-zinc-400 hover:text-foreground"
                          }`}
                        >
                          {jm}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">Hari Aktif</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setJadwalRutin((j) => ({ ...j, hari: [1, 2, 3, 4, 5, 6] }))}
                          className="text-[10px] text-emas hover:underline"
                        >
                          Sen–Sab
                        </button>
                        <button
                          type="button"
                          onClick={() => setJadwalRutin((j) => ({ ...j, hari: [0, 1, 2, 3, 4, 5, 6] }))}
                          className="text-[10px] text-muted-foreground hover:text-emas hover:underline"
                        >
                          Setiap Hari
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
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
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
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
                </div>

                {/* Koleksi Video Story yang Sudah Diunggah */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">
                      Koleksi Video Story ({videoRutinAktif} aktif dari {jadwalRutin.video.length} video)
                    </p>
                    {!jadwalRutin.video.some((v) => v.url.includes("lekkopi-opening-story")) && (
                      <button
                        type="button"
                        onClick={() =>
                          setJadwalRutin((j) => ({
                            ...j,
                            video: [{ ...VIDEO_OPENING_BAWAAN_LEKKOPI, wajib: false }, ...j.video],
                          }))
                        }
                        className="text-[11px] text-emas hover:underline"
                      >
                        + Pulihkan Video Bawaan &quot;We Are Open&quot;
                      </button>
                    )}
                  </div>

                  {/* Unggah Banyak Video Sekaligus atau Tempel URL */}
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-400/40 bg-emerald-500/5 px-4 py-3 text-xs font-medium text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/10">
                      {mengunggahRutin ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                      <span>
                        {mengunggahRutin ? "Mengunggah video ke Studio…" : "Unggah Video / Foto Story (bisa pilih banyak sekaligus)"}
                      </span>
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
                        multiple
                        className="hidden"
                        disabled={mengunggahRutin}
                        onChange={(e) => {
                          const list = Array.from(e.target.files ?? []);
                          if (list.length) void unggahBanyakVideoRutin(list);
                          e.target.value = "";
                        }}
                      />
                    </label>

                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={judulBaruRutin}
                        onChange={(e) => setJudulBaruRutin(e.target.value)}
                        placeholder="Judul"
                        className="h-11 w-24 rounded-lg border border-input bg-transparent px-2.5 text-xs"
                      />
                      <input
                        type="text"
                        value={urlBaruRutin}
                        onChange={(e) => setUrlBaruRutin(e.target.value)}
                        placeholder="Atau tempel URL video (.mp4)"
                        className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={tambahUrlRutin}
                        disabled={!urlBaruRutin.trim()}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-3 text-xs hover:border-emas hover:text-emas disabled:opacity-40"
                      >
                        <Plus className="size-3.5" /> Tambah
                      </button>
                    </div>
                  </div>

                  {jadwalRutin.video.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border/70 py-6 text-center text-xs text-muted-foreground">
                      Belum ada video Story di koleksi. Unggah beberapa video di atas agar sistem bisa mengacak setiap hari.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {jadwalRutin.video.map((v, idx) => {
                        const sedangTerpilih = jadwalRutin.mode === "acak" && videoBerikutnyaRutin?.id === v.id;
                        return (
                          <div
                            key={v.id}
                            className={`flex gap-3 rounded-xl border p-3 text-xs transition ${
                              sedangTerpilih
                                ? "border-emas/60 bg-emas/[0.06]"
                                : v.aktif
                                ? "border-border/80 bg-white/[0.03]"
                                : "border-border/40 bg-white/[0.01] opacity-60"
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

                            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                              <div className="space-y-1.5">
                                {sedangTerpilih && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emas/20 px-2 py-0.5 text-[10px] font-semibold text-emas-muda">
                                    🎲 Giliran acak berikutnya
                                  </span>
                                )}
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
                                    placeholder="Judul video Story"
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
                                    title="Hapus dari koleksi"
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
                                  <option value="story" className="bg-card">Story Instagram saja</option>
                                  <option value="reels+story" className="bg-card">Story + Reels</option>
                                  <option value="reels" className="bg-card">Reels saja</option>
                                </select>

                                <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px]">
                                  <label className="inline-flex cursor-pointer items-center gap-1.5">
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
                                    <span>{jadwalRutin.mode === "acak" ? "Ikut diacak" : "Aktif"}</span>
                                  </label>
                                  {jadwalRutin.mode !== "acak" && (
                                    <label className="inline-flex cursor-pointer items-center gap-1.5" title="Selalu diupload setiap jam buka">
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
                                      <span className="text-emas-muda">Wajib tiap buka</span>
                                    </label>
                                  )}
                                </div>
                              </div>

                              <span className="truncate text-[10px] text-zinc-500">
                                {v.durasi ? `${v.durasi} dtk` : v.jenis === "gambar" ? "Foto" : "Video"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Opsional: Tambah Konten Opening Generated AI */}
                <div className="space-y-3 rounded-xl border border-emas/25 bg-emas/[0.03] p-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(jadwalRutin.aiAktif)}
                        onChange={(e) => setJadwalRutin((j) => ({ ...j, aiAktif: e.target.checked }))}
                        className="size-4 accent-[#c9a24b]"
                      />
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Sparkles className="size-3.5 text-emas" />
                        Sertakan 1 Konten Opening Generated AI Tiap Jam Buka (Opsional)
                      </span>
                    </label>
                    <span className="rounded-full bg-emas/15 px-2 py-0.5 text-[10px] font-medium text-emas-muda">
                      3 Menu Terlaris + Musik Adaptif
                    </span>
                  </div>

                  {jadwalRutin.aiAktif && (
                    <div className="grid gap-3 pt-1 sm:grid-cols-3">
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
                          <option value="video-animasi" className="bg-card">Video Animasi 3 Menu Terlaris (15 dtk)</option>
                          <option value="poster" className="bg-card">Poster Story AI (9:16, ringan)</option>
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

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    disabled={menyimpanRutin}
                    onClick={() => void simpanPengaturanRutin()}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-emas px-5 py-2.5 text-xs font-semibold text-background hover:bg-emas/90 disabled:opacity-60 sm:w-auto"
                  >
                    {menyimpanRutin ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Simpan Pengaturan Story Otomatis
                  </button>
                  {pesanRutin && <span className="text-xs text-emerald-300">{pesanRutin}</span>}
                </div>
              </div>
            )}

            {/* ══════════ TAB 3: BUAT KONTEN AI ══════════ */}
            {tabStudio === "buat" && (
              <form onSubmit={buat} className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <div>
                  <h2 className="flex items-center gap-2 font-heading text-lg">
                    <Sparkles className="size-5 text-emas" /> Buat Konten Promosi AI
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Mesin otomatis membuat poster atau video iklan Remotion / bank media lengkap dengan naskah dan caption.
                  </p>
                </div>

                {merekAktif.length > 1 ? (
                  <div className="space-y-1.5">
                    <span className="block text-xs font-medium text-muted-foreground">Merek</span>
                    <div className="flex flex-wrap gap-2">
                      {merekAktif.map((m) => (
                        <button
                          key={m.slug}
                          type="button"
                          onClick={() => {
                            setPilihMerek(m.slug);
                            setUsulan([]);
                            setGalatUsulan("");
                          }}
                          className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                            pilihMerek === m.slug
                              ? "border-emas bg-emas text-background"
                              : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/25 hover:text-foreground"
                          }`}
                        >
                          {m.nama}
                        </button>
                      ))}
                    </div>
                    <input type="hidden" name="merek" value={pilihMerek} />
                  </div>
                ) : (
                  <input type="hidden" name="merek" value={merekAktif[0]?.slug ?? "bakafrawi"} />
                )}

                {merekBank && (
                  <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground">
                    Video dari bank foto/video <b>{merek.find((m) => m.slug === pilihMerek)?.nama}</b> di Google Drive. Naskah ditulis dulu dari data kedai untuk Kyai setujui sebelum dirender.
                  </p>
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

                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="latar" defaultChecked className="mt-0.5 size-4 accent-[#c9a24b]" />
                  <span>
                    Mode Visual Full AI <span className="text-xs text-redup">(100% visual AI via Cloudflare / NVIDIA FLUX / Gemini tanpa perlu foto asli; untuk foto/video asli gunakan tab Unggah &amp; Jadwal)</span>
                  </span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emas/25 bg-emas/[0.05] px-3.5 py-2.5 text-xs">
                  <span className="text-muted-foreground">
                    Ingin video storytelling Full AI dengan suara &amp; logat Indonesia/Jawa natural lewat <b>Google Flow (Veo 3)</b>?
                  </span>
                  <button
                    type="button"
                    onClick={() => setTabStudio("flow")}
                    className="inline-flex shrink-0 items-center gap-1 font-semibold text-emas hover:underline"
                  >
                    <Wand2 className="size-3.5" /> Buka Google Flow Bridge →
                  </button>
                </div>

                <div className="grid gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="studio-arahan" className="text-xs font-medium text-muted-foreground">
                      {merekBank ? "Ide video (opsional — kosongkan agar AI memilih otomatis)" : "Arahan untuk AI (opsional)"}
                    </label>
                    <button
                      type="button"
                      onClick={mintaUsulan}
                      disabled={mengusulkan}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs hover:border-emas hover:text-emas disabled:opacity-60"
                    >
                      {mengusulkan ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      {merekBank ? "Usulkan ide AI" : "Usulkan arahan"}
                    </button>
                  </div>
                  <textarea
                    id="studio-arahan"
                    ref={kolomArahan}
                    key={merekBank ? "ide" : "arahan"}
                    name="arahan"
                    rows={3}
                    placeholder={
                      merekBank
                        ? "Opsional: mis. suasana malam minggu, es kopi susu (kosongkan agar AI pilih menu terbaik otomatis)"
                        : "Mis. sasar pemilik warung kopi, tonjolkan fitur struk WhatsApp, nada santai"
                    }
                    className="rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
                  />
                  {galatUsulan && <p className="text-xs text-red-300">{galatUsulan}</p>}
                  {usulan.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {usulan.map((u) => (
                        <button
                          key={u.judul + u.arahan}
                          type="button"
                          onClick={() => pakaiUsulan(u.arahan)}
                          className="rounded-xl border border-white/10 bg-white/[.03] p-3 text-left text-xs hover:border-emas"
                        >
                          <span className="mb-1 block font-semibold text-emas-muda">{u.judul}</span>
                          <span className="text-muted-foreground">{u.arahan}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Opsi Jadwal Tayang Otomatis / Custom & Sasaran Instagram */}
                <div className="space-y-3 rounded-xl border border-border/70 bg-white/[0.02] p-3.5 text-xs">
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
                        className="h-9 w-full rounded-lg border border-input bg-transparent px-3 font-mono text-xs sm:w-auto"
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
                  <button
                    disabled={sibuk}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto"
                  >
                    {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {merekBank ? "Buat Naskah Konten" : "Buat Konten AI"}
                  </button>
                </div>
              </form>
            )}

            {/* ══════════ TAB 3b: GOOGLE FLOW BRIDGE (VIDEO FULL AI) ══════════ */}
            {tabStudio === "flow" && (
              <PanelGoogleFlow
                merekDaftar={merekAktif}
                merekAwal={pilihMerek}
                topikAwal={topikFlowAwal}
                tokenSegar={tokenSegar}
                selesaiUpload={(msg) => {
                  setPesan(msg);
                  setTabStudio("riwayat");
                  void muat();
                }}
              />
            )}

            {/* ══════════ TAB 4: RIWAYAT & ANTREAN TAYANG ══════════ */}
            {tabStudio === "riwayat" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: "semua" as const, label: `Semua (${daftar.length})` },
                      { id: "terjadwal" as const, label: `Terjadwal (${jumlahTerjadwal})` },
                      { id: "cek" as const, label: `Perlu Cek (${jumlahPerluCek})` },
                      { id: "tayang" as const, label: `Tayang (${daftar.filter((t) => t.status_tayang === "tayang").length})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilterRiwayat(f.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          filterRiwayat === f.id
                            ? "border-emas bg-emas/15 text-emas"
                            : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/25 hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void muat()}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground hover:border-emas hover:text-emas"
                  >
                    <RefreshCw className="size-3" /> Segarkan
                  </button>
                </div>

                {daftarTersaring.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-card/40 py-10 text-center text-xs text-muted-foreground">
                    Belum ada konten pada filter ini.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {daftarTersaring.map((t) => (
                      <KartuTugas
                        key={t.id}
                        t={t}
                        nama={
                          namaMerek(t.merek) +
                          (t.produk_slug === "rutin-buka"
                            ? "Story Otomatis Jam Buka"
                            : t.produk_slug === "unggah-manual"
                            ? "Unggah Manual"
                            : t.produk_slug === t.merek
                            ? "Video Bank Media"
                            : namaProduk(t.produk_slug))
                        }
                        hapus={() => hapus(t)}
                        tayang={(a, opsi) => tayang(t, a, opsi)}
                        naskah={(a) => putusNaskah(t, a)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════ TAB 5: RISET TREN, JAM OPTIMAL & REFERENSI VIDEO ══════════ */}
            {tabStudio === "riset" && (
              <div className="space-y-5">
                {/* 5a. Jam Tayang Optimal */}
                <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-amber-400" />
                      <h2 className="font-heading text-base font-semibold text-foreground">
                        4 Slot Waktu Tayang Optimal Reels (WIB)
                      </h2>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Hari terbaik: Selasa, Rabu, Kamis, Minggu
                    </span>
                  </div>
                  {infoJadwal && (
                    <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-zinc-300">
                      💡 <b className="text-foreground">Saran saat ini:</b> {infoJadwal.saran}
                    </p>
                  )}
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {(daftarJadwal.length > 0
                      ? daftarJadwal
                      : [
                          { slot: "sore", jam: "17.30 - 19.30 WIB", nama: "Golden Prime Time", alasan: "Trafik Instagram Indonesia tertinggi, jangkauan puncak ke Explore.", skor: 98 },
                          { slot: "siang", jam: "11.45 - 13.00 WIB", nama: "Istirahat Siang", alasan: "Penonton fokus demo singkat 30s saat rehat makan siang.", skor: 88 },
                          { slot: "malam", jam: "20.30 - 21.45 WIB", nama: "Santai Malam", alasan: "Waktu santai rebahan, cocok untuk storytelling & edukasi bisnis.", skor: 85 },
                          { slot: "pagi", jam: "07.00 - 08.30 WIB", nama: "Commute Pagi", alasan: "Tips ringan & motivasi sebelum jam mulai kerja.", skor: 74 },
                        ]
                    ).map((j) => (
                      <div
                        key={j.slot}
                        className={`rounded-xl border p-3 text-xs ${
                          j.slot === "sore"
                            ? "border-amber-500/40 bg-amber-500/5 text-amber-200"
                            : "border-border/70 bg-white/[0.01] text-muted-foreground"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-1">
                          <span className="font-semibold text-foreground">{j.nama}</span>
                          <span className="rounded-full bg-white/10 px-1.5 font-mono text-[10px] text-emas">{j.skor}%</span>
                        </div>
                        <p className="font-mono text-[11px] text-emas-muda">{j.jam}</p>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{j.alasan}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 5b. Riset Tren Viral AI */}
                <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
                      <TrendingUp className="size-4 text-emas" /> Riset Tren Reels Viral AI
                    </h2>
                    {merekAktif.length > 1 && (
                      <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-0.5">
                        {merekAktif.map((m) => (
                          <button
                            key={m.slug}
                            type="button"
                            onClick={() => {
                              setPilihMerek(m.slug);
                              setUsulan([]);
                              setGalatUsulan("");
                            }}
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

                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                    <p className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Lightbulb className="size-3.5 text-emas" /> 4 Pilar Rahasia Reels Viral:
                    </p>
                    <div className="grid gap-2 text-[11px] text-zinc-400 sm:grid-cols-2">
                      <div><b>1. Hook 3 Detik:</b> Sentil luka / rasa penasaran, jangan mulai dengan salam klise.</div>
                      <div><b>2. Visual Rhythm:</b> Pacing cepat (ganti adegan tiap 2–4 dtk) + sorotan visual.</div>
                      <div><b>3. Teks Layar Kontras:</b> Teks tebal terbaca jelas meski ditonton tanpa suara.</div>
                      <div><b>4. CTA Konkret:</b> Ajakan simpel (coba demo, mampir kedai, atau klik WhatsApp).</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={topikRiset}
                      onChange={(e) => setTopikRiset(e.target.value)}
                      placeholder={`Topik khusus untuk ${merekBank ? (merek.find((m) => m.slug === pilihMerek)?.nama ?? pilihMerek) : namaProduk(pilihProduk)} (opsional)`}
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

                  {galatRiset && <p className="break-words text-xs text-red-300">{galatRiset}</p>}

                  {konsepViral.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {konsepViral.map((k, idx) => (
                        <div
                          key={k.judul + idx}
                          className="flex flex-col justify-between rounded-xl border border-border/80 bg-white/[0.02] p-3.5 text-xs transition hover:border-emas/50"
                        >
                          <div className="space-y-2">
                            <span className="inline-block rounded-md bg-emas/15 px-2 py-0.5 text-[11px] font-semibold text-emas-muda">
                              {k.judul}
                            </span>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hook 3 Detik</p>
                              <p className="mt-0.5 text-xs font-medium italic text-foreground">&quot;{k.hook}&quot;</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Teks Layar &amp; Visual</p>
                              <p className="mt-0.5 text-[11px] text-zinc-400">
                                <b className="text-zinc-200">[{k.teksLayarKunci}]</b> · {k.alurVisual}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CTA</p>
                              <p className="mt-0.5 text-[11px] text-zinc-400">{k.ajakanCta}</p>
                            </div>
                          </div>

                          <div className="mt-3.5 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => pakaiKonsepViral(k.arahanStudio)}
                              className="rounded-lg border border-emas/40 bg-emas/10 py-1.5 text-center text-xs font-medium text-emas transition hover:bg-emas hover:text-background"
                            >
                              Buat AI →
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTopikFlowAwal(`${k.judul}: ${k.hook} — ${k.arahanStudio}`);
                                setTabStudio("flow");
                              }}
                              className="rounded-lg border border-sky-400/40 bg-sky-500/10 py-1.5 text-center text-xs font-medium text-sky-300 transition hover:bg-sky-500 hover:text-black"
                            >
                              Google Flow →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 5c. Pelajari Link / Video Referensi */}
                <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div>
                    <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
                      <Link2 className="size-4 text-sky-400" /> Pelajari Gaya Video Referensi
                      {daftarRef.length > 0 && (
                        <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">
                          {daftarRef.length}
                        </span>
                      )}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Unggah contoh Reels/TikTok atau tempel tautannya. AI akan membedah hook, ritme potongan, dan gaya teksnya.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-sky-400/40 bg-sky-500/5 px-4 py-3 text-center text-xs transition hover:border-sky-400 hover:bg-sky-500/10">
                      <div className="flex items-center gap-1.5 font-medium text-sky-300">
                        <Upload className="size-4" />
                        <span>
                          {berkasRef.length > 0
                            ? `${berkasRef.length} berkas dipilih (${berkasRef[0].name})`
                            : "Unggah Video Reels/TikTok (.mp4) atau 2–5 Screenshot"}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        Otomatis mengambil 5 bingkai utama dari video untuk ditonton Vision AI
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
                        placeholder="Atau tempel link TikTok / Shorts (opsional)"
                        className="h-10 rounded-lg border border-input bg-transparent px-3 text-xs"
                      />
                      <input
                        type="text"
                        value={catatanRef}
                        onChange={(e) => setCatatanRef(e.target.value)}
                        placeholder="Catatan (mis. sesuaikan menu Lek Kopi)"
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

                  {galatRef && <p className="break-words text-xs text-red-300">{galatRef}</p>}

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
                                  <span className="mr-1.5 inline-block rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
                                    {b.platform}
                                  </span>
                                  <span className="font-semibold text-foreground">{b.judul}</span>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
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
                              <p className="text-[11px] text-zinc-400"><b>Visual &amp; Teks:</b> {b.gayaVisual} · {b.gayaTeks}</p>
                              <p className="text-[10px] text-emas-muda">Preset cocok: <b>{b.presetCocok}</b> · Pacing: {b.pacing}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => tiruReferensi(r)}
                              className="mt-3 w-full rounded-lg border border-sky-400/40 bg-sky-500/10 py-1.5 text-center text-xs font-medium text-sky-300 transition hover:bg-sky-500 hover:text-white"
                            >
                              Tiru Gaya di Buat AI →
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ══════════ TAB 6: SAMBUNGAN AKUN & BOT ══════════ */}
            {tabStudio === "sambungan" && <Sambungan sesi={sesi} />}
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
        <div className="flex flex-wrap items-center gap-1.5">
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
            {t.status_tayang !== "tayang" && t.status_tayang !== "proses" && t.produk_slug !== "rutin-buka" && t.produk_slug !== "unggah-manual" && (
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
