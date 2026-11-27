"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Clapperboard,
  FileText,
  ImagePlus,
  Lightbulb,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import { DAFTAR_SASARAN_VIDEO, daftarSlotCepatWIB, type SasaranTayang } from "@/lib/jadwal-tayang-murni";
import {
  bersihkanKodeLokasi,
  buatAdeganKosongSerial,
  buatDrafLanjutanManual,
  buatDrafManualSerial,
  DAFTAR_TOKOH_LEKKOPI,
  episodeBerikutnya,
  estimasiDurasiNaskahSerial,
  IDE_CEPAT_SERIAL,
  konfigSerialBawaan,
  OPSI_AKSI_MOTION,
  OPSI_GAYA_KARTUN_LATAR,
  OPSI_LOKASI_LEKKOPI,
  OPSI_MOOD_SERIAL,
  OPSI_PANJANG_SERIAL,
  OPSI_TOKOH_MOTION,
  type AdeganDrafSerial,
  type AksiKarakterCerita,
  type EpisodeSerial,
  type FormatSuaraSerial,
  type GayaCeritaSerial,
  type GayaKarakterCerita,
  type GayaKartunLatar,
  type GenderNaratorSerial,
  type JenisAdeganMotion,
  type KarakterMotionDraf,
  type KonfigSerialLekKopi,
  type KonfigSuaraTokoh,
  type MoodSerial,
  type NaskahDrafSerial,
  type PanjangSerial,
  type SaranCeritaSerial,
  type TemaVisualMotion,
  type TipeKarakterCerita,
  type TokohSuaraId,
} from "@/lib/serial-kartun-murni";

type SuaraFavorit = { id: string; nama: string; catatan?: string };

type PratinjauLatarBaru = {
  dataUrlAsli: string;
  urlKartun: string;
  jalurKartun: string;
  penyedia: string;
  kode: string;
  nama: string;
  deskripsi: string;
  gayaKartun: GayaKartunLatar;
};

/** Perkecil foto asli ke sisi terpanjang ≤ 512px JPEG agar pas batas FLUX.2 Klein & cepat diunggah. */
async function perkecilFotoUntukKartun(
  berkas: File,
  maksSisi = 512,
): Promise<{ base64: string; dataUrl: string; mimeType: "image/jpeg" }> {
  const url = URL.createObjectURL(berkas);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((ok, gagal) => {
      img.onload = () => ok();
      img.onerror = () => gagal(new Error("Foto gagal dibaca oleh browser."));
    });
    const wAsli = img.naturalWidth || 512;
    const hAsli = img.naturalHeight || 512;
    const rasio = Math.min(1, maksSisi / Math.max(wAsli, hAsli));
    const lebar = Math.max(64, Math.round(wAsli * rasio));
    const tinggi = Math.max(64, Math.round(hAsli * rasio));
    const canvas = document.createElement("canvas");
    canvas.width = lebar;
    canvas.height = tinggi;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");
    ctx.drawImage(img, 0, 0, lebar, tinggi);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    return {
      base64: dataUrl.split(",")[1] ?? "",
      dataUrl,
      mimeType: "image/jpeg",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Fallback offline di browser: crop 9:16, tingkatkan saturasi, posterisasi warna, & tambah garis tepi kartun. */
async function kartunkanFotoDiBrowserCanvas(
  berkas: File,
  gaya: GayaKartunLatar,
): Promise<{ base64: string; dataUrl: string; mimeType: "image/jpeg" }> {
  const url = URL.createObjectURL(berkas);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((ok, gagal) => {
      img.onload = () => ok();
      img.onerror = () => gagal(new Error("Foto gagal dibaca."));
    });
    const W = 540;
    const H = 960;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");

    // Crop tengah ke rasio 9:16
    const rasioTarget = W / H;
    const rasioAsli = img.naturalWidth / Math.max(1, img.naturalHeight);
    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (rasioAsli > rasioTarget) {
      sw = Math.round(img.naturalHeight * rasioTarget);
      sx = Math.round((img.naturalWidth - sw) / 2);
    } else {
      sh = Math.round(img.naturalWidth / rasioTarget);
      sy = Math.round((img.naturalHeight - sh) / 2);
    }

    ctx.filter =
      gaya === "santai_sore"
        ? "saturate(1.38) contrast(1.14) brightness(0.95) sepia(0.14)"
        : "saturate(1.45) contrast(1.12) brightness(1.06)";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    ctx.filter = "none";

    // Posterisasi lembut + tepi cel-shaded sederhana
    const imgData = ctx.getImageData(0, 0, W, H);
    const d = imgData.data;
    const abu = new Uint8Array(W * H);
    const step = 36;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      abu[p] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      d[i] = Math.min(255, Math.round(r / step) * step + 12);
      d[i + 1] = Math.min(255, Math.round(g / step) * step + 10);
      d[i + 2] = Math.min(255, Math.round(b / step) * step + 8);
    }
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        const grad = Math.abs(abu[idx] - abu[idx + 1]) + Math.abs(abu[idx] - abu[idx + W]);
        if (grad > 34) {
          const di = idx * 4;
          d[di] = Math.max(24, Math.round(d[di] * 0.48));
          d[di + 1] = Math.max(18, Math.round(d[di + 1] * 0.45));
          d[di + 2] = Math.max(14, Math.round(d[di + 2] * 0.42));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return { base64: dataUrl.split(",")[1] ?? "", dataUrl, mimeType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PanelSerialKartun({
  tokenSegar,
  suaraFavorit,
  selesaiBuat,
}: {
  tokenSegar: () => Promise<string>;
  suaraFavorit: SuaraFavorit[];
  selesaiBuat: (pesan: string) => void;
}) {
  const [konfig, setKonfig] = useState<KonfigSerialLekKopi>(() => konfigSerialBawaan());
  const [suaraLokal, setSuaraLokal] = useState<SuaraFavorit[]>(suaraFavorit);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");

  // Form buat episode baru & asisten ide/draf naskah AI
  const [kataKunci, setKataKunci] = useState("");
  const [sedangMintaSaran, setSedangMintaSaran] = useState(false);
  const [saranCerita, setSaranCerita] = useState<SaranCeritaSerial[]>([]);
  const [infoPenyediaSaran, setInfoPenyediaSaran] = useState("");
  const [gayaCerita, setGayaCerita] = useState<GayaCeritaSerial>("kedai");
  const [temaVisual, setTemaVisual] = useState<TemaVisualMotion>("malam");
  const [gayaKarakter, setGayaKarakter] = useState<GayaKarakterCerita>("ilustrasi");
  const [genderNarator, setGenderNarator] = useState<GenderNaratorSerial>("pria");
  const [arahLanjutan, setArahLanjutan] = useState("");
  const [lanjutDariNomor, setLanjutDariNomor] = useState<number | null>(null);
  const refEditorDraf = useRef<HTMLDivElement | null>(null);
  const [hasilRiset, setHasilRiset] = useState("");
  const [risetOtomatisGoogle, setRisetOtomatisGoogle] = useState(true);
  const [sedangRiset, setSedangRiset] = useState(false);
  const [infoPenyediaRiset, setInfoPenyediaRiset] = useState("");
  const [ide, setIde] = useState("");
  const [mood, setMood] = useState<MoodSerial>("komedi_ceria");
  const [formatSuara, setFormatSuara] = useState<FormatSuaraSerial>("dialog");
  const [panjangNaskah, setPanjangNaskah] = useState<PanjangSerial>("sedang");
  const [bersambung, setBersambung] = useState(false);
  const [sedangBuatDraf, setSedangBuatDraf] = useState(false);
  const [drafNaskah, setDrafNaskah] = useState<NaskahDrafSerial | null>(null);
  const [infoPenyediaDraf, setInfoPenyediaDraf] = useState("");
  const [modeJadwal, setModeJadwal] = useState<"persetujuan" | "prime19" | "custom">("persetujuan");
  const [waktuJadwal, setWaktuJadwal] = useState(() => daftarSlotCepatWIB()[3]?.inputWib ?? "");
  const [sasaran, setSasaran] = useState<SasaranTayang>("reels");
  const [sedangBuatEp, setSedangBuatEp] = useState(false);

  // Form foto tempat → kartun 2D
  const [kodeLokasiPilihan, setKodeLokasiPilihan] = useState("outdoor");
  const [kodeCustom, setKodeCustom] = useState("");
  const [namaLokasi, setNamaLokasi] = useState("Area Duduk Outdoor");
  const [deskripsiLokasi, setDeskripsiLokasi] = useState("Kursi & meja outdoor di paving sisi jalan Panjunan");
  const [gayaKartun, setGayaKartun] = useState<GayaKartunLatar>("ceria_hangat");
  const [fileFoto, setFileFoto] = useState<File | null>(null);
  const [sedangKartunkan, setSedangKartunkan] = useState(false);
  const [bisaFallbackCanvas, setBisaFallbackCanvas] = useState(false);
  const [pratinjauLatar, setPratinjauLatar] = useState<PratinjauLatarBaru | null>(null);
  const [menyimpanLatar, setMenyimpanLatar] = useState(false);

  // Form kelola serial & suara tokoh
  const [editJudul, setEditJudul] = useState("");
  const [editTagline, setEditTagline] = useState("");
  const [editMood, setEditMood] = useState<MoodSerial>("komedi_ceria");
  const [editFormatSuara, setEditFormatSuara] = useState<FormatSuaraSerial>("dialog");
  const [editSuaraTokoh, setEditSuaraTokoh] = useState<KonfigSuaraTokoh>({});
  const [modeSerialBaru, setModeSerialBaru] = useState(false);
  const [menyimpanSerial, setMenyimpanSerial] = useState(false);

  const terapkanKonfigKeForm = useCallback((k: KonfigSerialLekKopi) => {
    setKonfig(k);
    const aktif = k.serial.find((s) => s.id === k.serialAktifId) ?? k.serial[0];
    if (aktif) {
      setMood(aktif.moodBawaan);
      setFormatSuara(aktif.formatSuara);
      setEditJudul(aktif.judul);
      setEditTagline(aktif.tagline);
      setEditMood(aktif.moodBawaan);
      setEditFormatSuara(aktif.formatSuara);
      setEditSuaraTokoh(aktif.suaraTokoh ?? {});
      setModeSerialBaru(false);
    }
  }, []);

  const muatData = useCallback(async () => {
    setMemuat(true);
    const tok = await tokenSegar();
    if (!tok) {
      setMemuat(false);
      return;
    }
    const res = await fetch("/api/studio/serial", {
      headers: { Authorization: `Bearer ${tok}` },
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setMemuat(false);
    if (j.ok && j.konfig) {
      terapkanKonfigKeForm(j.konfig as KonfigSerialLekKopi);
      if (Array.isArray(j.suaraFavorit)) setSuaraLokal(j.suaraFavorit as SuaraFavorit[]);
    }
  }, [tokenSegar, terapkanKonfigKeForm]);

  useEffect(() => {
    const t = setTimeout(() => void muatData(), 0);
    return () => clearTimeout(t);
  }, [muatData]);

  const serialAktif = konfig.serial.find((s) => s.id === konfig.serialAktifId) ?? konfig.serial[0];
  const nomorBerikutnya = episodeBerikutnya(serialAktif);
  const episodeTerakhir = serialAktif?.episode?.length
    ? serialAktif.episode[serialAktif.episode.length - 1]
    : null;
  const daftarSuaraPilih = suaraLokal.length > 0 ? suaraLokal : suaraFavorit;
  const opsiLatarDraf = Array.from(
    new Map(
      [
        ...konfig.latar.map((l) => [l.kode, `${l.nama} (${l.kode})`] as const),
        ...OPSI_LOKASI_LEKKOPI.map((o) => [o.kode, `${o.label} (${o.kode})`] as const),
      ],
    ).entries(),
  ).map(([kode, label]) => ({ kode, label }));

  function pilihGayaCerita(gayaBaru: GayaCeritaSerial) {
    setGayaCerita(gayaBaru);
    if (gayaBaru === "dokumenter") {
      setMood("cerita_kopi");
      setFormatSuara("narator");
      setPanjangNaskah("panjang");
    } else {
      setMood("komedi_ceria");
      setFormatSuara("dialog");
      setPanjangNaskah("sedang");
    }
  }

  async function risetCeritaGoogle() {
    if (!serialAktif) return;
    const topikRiset = ide.trim() || kataKunci.trim();
    if (!topikRiset) {
      setGalat("Isi dulu kata kunci atau ide cerita (mis. kisah Syekh Asy-Syadzili dan sejarah kopi) sebelum riset Google.");
      return;
    }
    setSedangRiset(true);
    setGalat("");
    setPesan("");
    try {
      const tok = await tokenSegar();
      if (!tok) throw new Error("Sesi login tidak ditemukan — coba muat ulang.");
      const res = await fetch("/api/studio/serial", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "riset-cerita",
          topik: topikRiset,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok || !j.teksRiset) {
        throw new Error(j.pesan ?? "AI belum berhasil meriset fakta di Google.");
      }
      setHasilRiset(String(j.teksRiset));
      setInfoPenyediaRiset(j.penyedia ? `${j.penyedia}${j.model ? ` · ${j.model}` : ""}` : "");
      setPesan("Riset fakta Google selesai — silakan periksa atau sunting ringkasan fakta sebelum menyusun naskah.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal melakukan riset fakta di Google.");
    } finally {
      setSedangRiset(false);
    }
  }

  async function mintaSaranCerita() {
    if (!serialAktif) return;
    setSedangMintaSaran(true);
    setGalat("");
    setPesan("");
    try {
      const tok = await tokenSegar();
      if (!tok) throw new Error("Sesi login tidak ditemukan — coba muat ulang.");
      const res = await fetch("/api/studio/serial", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "saran-ide",
          serialId: serialAktif.id,
          kataKunci: kataKunci.trim(),
          mood,
          panjangNaskah,
          gayaCerita,
          hasilRiset: hasilRiset.trim(),
          risetGoogle: risetOtomatisGoogle,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok || !Array.isArray(j.saran)) {
        throw new Error(j.pesan ?? "AI belum berhasil menyusun saran cerita.");
      }
      setSaranCerita(j.saran as SaranCeritaSerial[]);
      setInfoPenyediaSaran(j.penyedia ? `${j.penyedia}${j.model ? ` · ${j.model}` : ""}` : "");
      if (typeof j.teksRiset === "string" && j.teksRiset.trim()) {
        setHasilRiset(j.teksRiset);
      }
      setPesan("3 saran cerita siap dipilih — klik Pakai Ide Ini atau Langsung Buatkan Naskah.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal meminta saran cerita.");
    } finally {
      setSedangMintaSaran(false);
    }
  }

  async function buatDrafNaskah(opsi?: {
    ideOverride?: string;
    moodOverride?: MoodSerial;
    lanjutDariOverride?: number | null;
    bersambungOverride?: boolean;
    gayaCeritaOverride?: GayaCeritaSerial;
    temaVisualOverride?: TemaVisualMotion;
    formatSuaraOverride?: FormatSuaraSerial;
    panjangNaskahOverride?: PanjangSerial;
  }) {
    if (!serialAktif) return;
    setSedangBuatDraf(true);
    setGalat("");
    setPesan("");
    try {
      const tok = await tokenSegar();
      if (!tok) throw new Error("Sesi login tidak ditemukan — coba muat ulang.");
      const ideKirim = (opsi?.ideOverride ?? ide).trim();
      const moodKirim = opsi?.moodOverride ?? mood;
      const lanjutNomor = opsi?.lanjutDariOverride !== undefined ? opsi.lanjutDariOverride : lanjutDariNomor;
      const res = await fetch("/api/studio/serial", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "buat-naskah",
          serialId: serialAktif.id,
          ide: ideKirim,
          kataKunci: kataKunci.trim(),
          mood: moodKirim,
          formatSuara: opsi?.formatSuaraOverride ?? formatSuara,
          panjangNaskah: opsi?.panjangNaskahOverride ?? panjangNaskah,
          bersambung: opsi?.bersambungOverride ?? bersambung,
          gayaCerita: opsi?.gayaCeritaOverride ?? gayaCerita,
          temaVisual: opsi?.temaVisualOverride ?? temaVisual,
          gayaKarakter,
          ...(lanjutNomor ? { lanjutDariNomor: lanjutNomor } : {}),
          hasilRiset: hasilRiset.trim(),
          risetGoogle: risetOtomatisGoogle,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok || !j.naskah) {
        throw new Error(j.pesan ?? "AI belum berhasil menyusun draf naskah.");
      }
      setDrafNaskah(j.naskah as NaskahDrafSerial);
      setInfoPenyediaDraf(j.penyedia ? `${j.penyedia}${j.model ? ` · ${j.model}` : ""}` : "");
      if (typeof j.teksRiset === "string" && j.teksRiset.trim()) {
        setHasilRiset(j.teksRiset);
        setInfoPenyediaRiset((prev) => prev || "Riset otomatis Google");
      }
      setPesan(
        j.melanjutkanDari
          ? `Draf naskah Episode ${nomorBerikutnya} selesai disusun (menyambung dari Ep ${j.melanjutkanDari.nomor} "${j.melanjutkanDari.judul}") — silakan periksa atau ubah sebelum render!`
          : "Draf naskah selesai disusun — silakan periksa atau ubah dialog sebelum render video.",
      );
      setTimeout(() => refEditorDraf.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyusun draf naskah.");
    } finally {
      setSedangBuatDraf(false);
    }
  }

  function tulisNaskahEpisodeBerikutnya(epAcuan: EpisodeSerial, mode: "ai" | "manual") {
    const gayaTarget: GayaCeritaSerial = epAcuan.gayaCerita ?? gayaCerita;
    const temaTarget: TemaVisualMotion = epAcuan.temaVisual ?? temaVisual;
    const formatTarget: FormatSuaraSerial = epAcuan.formatSuara ?? formatSuara;
    const panjangTarget: PanjangSerial = epAcuan.panjangNaskah ?? panjangNaskah;
    const genderTarget: GenderNaratorSerial = epAcuan.genderNarator ?? genderNarator;
    const moodTarget: MoodSerial = epAcuan.mood ?? mood;

    setGayaCerita(gayaTarget);
    setTemaVisual(temaTarget);
    setFormatSuara(formatTarget);
    setPanjangNaskah(panjangTarget);
    setGenderNarator(genderTarget);
    setMood(moodTarget);
    setBersambung(true);
    setLanjutDariNomor(epAcuan.nomor);

    const arahanSambung = arahLanjutan.trim() || ide.trim();
    if (arahLanjutan.trim() && !ide.trim()) setIde(arahLanjutan.trim());

    if (mode === "manual") {
      setGalat("");
      const draf = buatDrafLanjutanManual({
        episodeSebelumnya: epAcuan,
        nomorEpisode: nomorBerikutnya,
        gayaCerita: gayaTarget,
        temaVisual: temaTarget,
        latarKode: konfig.latar[0]?.kode || "outdoor",
      });
      setDrafNaskah(draf);
      setInfoPenyediaDraf(`Manual · Lanjutan Ep ${epAcuan.nomor}`);
      setPesan(
        `Editor manual Episode ${nomorBerikutnya} (lanjutan Ep ${epAcuan.nomor} "${epAcuan.judul}") siap diisi!`,
      );
      setTimeout(() => refEditorDraf.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      return;
    }

    void buatDrafNaskah({
      ideOverride: arahanSambung,
      moodOverride: moodTarget,
      lanjutDariOverride: epAcuan.nomor,
      bersambungOverride: true,
      gayaCeritaOverride: gayaTarget,
      temaVisualOverride: temaTarget,
      formatSuaraOverride: formatTarget,
      panjangNaskahOverride: panjangTarget,
    });
  }

  function bukaTulisManual() {
    setGalat("");
    const draf = buatDrafManualSerial({
      judulEpisode: ide.trim().split(/\r?\n/)[0]?.slice(0, 80) || kataKunci.trim().slice(0, 80),
      nomorEpisode: nomorBerikutnya,
      gayaCerita,
      temaVisual,
      latarKode: konfig.latar[0]?.kode || "outdoor",
    });
    setDrafNaskah(draf);
    setInfoPenyediaDraf("Manual (tanpa AI)");
    setPesan(
      "Editor manual per bagian siap diisi — teks yang Anda ketik akan langsung dipakai persis apa adanya saat render video.",
    );
  }

  function ubahAdeganDraf(
    indeks: number,
    perubahan: Partial<
      Pick<
        AdeganDrafSerial,
        | "namaPembicara"
        | "latarKode"
        | "dialog"
        | "pembicara"
        | "promptVisual"
        | "kartuWaktu"
        | "jenisMotion"
        | "judulKartu"
        | "kataSorot"
        | "karakter"
      >
    >,
  ) {
    setDrafNaskah((prev) => {
      if (!prev) return prev;
      const adeganBaru = prev.adegan.map((a, idx) => (idx === indeks ? { ...a, ...perubahan } : a));
      return { ...prev, adegan: adeganBaru };
    });
  }

  function tambahAdeganDraf() {
    setDrafNaskah((prev) => {
      if (!prev || prev.adegan.length >= 16) return prev;
      const kodeDefault = prev.adegan[prev.adegan.length - 1]?.latarKode || konfig.latar[0]?.kode || "outdoor";
      const baru = buatAdeganKosongSerial(prev.adegan.length + 1, kodeDefault, gayaCerita, temaVisual);
      return { ...prev, adegan: [...prev.adegan, baru] };
    });
  }

  function hapusAdeganDraf(indeks: number) {
    setDrafNaskah((prev) => {
      if (!prev || prev.adegan.length <= 1) return prev;
      const sisa = prev.adegan
        .filter((_, idx) => idx !== indeks)
        .map((a, idx) => ({ ...a, nomor: idx + 1 }));
      return { ...prev, adegan: sisa };
    });
  }

  async function buatEpisodeSekarang(naskahPakai?: NaskahDrafSerial | null) {
    if (!serialAktif) return;
    const naskahFinal = naskahPakai === undefined ? drafNaskah : naskahPakai;
    setSedangBuatEp(true);
    setGalat("");
    setPesan("");
    try {
      const tok = await tokenSegar();
      if (!tok) throw new Error("Sesi login tidak ditemukan — coba muat ulang.");
      const res = await fetch("/api/studio/serial", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "buat-episode",
          serialId: serialAktif.id,
          ide: ide.trim(),
          mood,
          formatSuara,
          panjangNaskah,
          bersambung,
          gayaCerita,
          temaVisual,
          gayaKarakter,
          genderNarator,
          hasilRiset: hasilRiset.trim(),
          risetGoogle: risetOtomatisGoogle,
          modeJadwal,
          jadwal: modeJadwal === "custom" ? waktuJadwal : null,
          sasaran,
          ...(naskahFinal ? { naskahJadi: naskahFinal } : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.pesan ?? "Gagal membuat episode baru.");
      setIde("");
      setKataKunci("");
      setSaranCerita([]);
      setDrafNaskah(null);
      selesaiBuat(j.pesan ?? `Episode ${nomorBerikutnya} masuk antrean Studio.`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal membuat episode.");
    } finally {
      setSedangBuatEp(false);
    }
  }

  async function prosesKartunkanFoto(mode: "ai" | "canvas" | "langsung", fileOverride?: File | null) {
    const target = fileOverride ?? fileFoto;
    if (!target) {
      setGalat("Pilih foto tempat Lek Kopi terlebih dahulu.");
      return;
    }
    const kodeFinal = bersihkanKodeLokasi(
      kodeLokasiPilihan === "custom" ? kodeCustom : kodeLokasiPilihan,
      "kedai",
    );
    const namaFinal = namaLokasi.trim() || OPSI_LOKASI_LEKKOPI.find((o) => o.kode === kodeLokasiPilihan)?.label || "Sudut Lek Kopi";

    setSedangKartunkan(true);
    setGalat("");
    setPesan("");
    setBisaFallbackCanvas(false);
    try {
      const tok = await tokenSegar();
      if (!tok) throw new Error("Sesi login tidak ditemukan.");

      const siapkan =
        mode === "canvas"
          ? await kartunkanFotoDiBrowserCanvas(target, gayaKartun)
          : await perkecilFotoUntukKartun(target, mode === "langsung" ? 1080 : 512);

      const res = await fetch("/api/studio/serial/kartunkan", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          gambarBase64: siapkan.base64,
          mimeType: siapkan.mimeType,
          kodeLokasi: kodeFinal,
          namaLokasi: namaFinal,
          gayaKartun,
          mode: mode === "ai" ? "ai" : "langsung",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok || !j.urlKartun) {
        if (j.bisaFallbackCanvas) setBisaFallbackCanvas(true);
        throw new Error(j.pesan ?? "Gagal mengonversi foto menjadi kartun.");
      }

      setPratinjauLatar({
        dataUrlAsli: siapkan.dataUrl,
        urlKartun: String(j.urlKartun),
        jalurKartun: String(j.jalurKartun),
        penyedia: String(j.penyedia || mode),
        kode: kodeFinal,
        nama: namaFinal,
        deskripsi: deskripsiLokasi.trim(),
        gayaKartun,
      });
      setPesan(
        mode === "ai"
          ? `Foto berhasil disulap jadi latar kartun 2D (${j.penyedia}). Cek pratinjau lalu klik Simpan Latar!`
          : "Latar kartun siap disimpan. Cek pratinjau lalu klik Simpan Latar!",
      );
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal memproses foto.");
    } finally {
      setSedangKartunkan(false);
    }
  }

  async function simpanLatarPratinjau() {
    if (!pratinjauLatar) return;
    setMenyimpanLatar(true);
    setGalat("");
    try {
      const tok = await tokenSegar();
      const res = await fetch("/api/studio/serial", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "simpan-latar",
          kode: pratinjauLatar.kode,
          nama: pratinjauLatar.nama,
          deskripsi: pratinjauLatar.deskripsi,
          urlKartun: pratinjauLatar.urlKartun,
          jalurKartun: pratinjauLatar.jalurKartun,
          gayaKartun: pratinjauLatar.gayaKartun,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.pesan ?? "Gagal menyimpan latar.");
      terapkanKonfigKeForm(j.konfig as KonfigSerialLekKopi);
      setPratinjauLatar(null);
      setFileFoto(null);
      setPesan(j.pesan ?? "Latar kartun tersimpan.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan latar.");
    } finally {
      setMenyimpanLatar(false);
    }
  }

  async function hapusLatar(id: string) {
    setGalat("");
    const tok = await tokenSegar();
    const res = await fetch("/api/studio/serial", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "hapus-latar", id }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && j.ok) {
      terapkanKonfigKeForm(j.konfig as KonfigSerialLekKopi);
      setPesan(j.pesan ?? "Latar dihapus.");
    } else {
      setGalat(j.pesan ?? "Gagal menghapus latar.");
    }
  }

  async function pilihSerial(serialId: string) {
    setGalat("");
    const tok = await tokenSegar();
    const res = await fetch("/api/studio/serial", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "pilih-serial", serialId }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && j.ok) {
      terapkanKonfigKeForm(j.konfig as KonfigSerialLekKopi);
    }
  }

  async function simpanSerial() {
    if (!editJudul.trim()) {
      setGalat("Judul serial tidak boleh kosong.");
      return;
    }
    setMenyimpanSerial(true);
    setGalat("");
    setPesan("");
    try {
      const tok = await tokenSegar();
      const res = await fetch("/api/studio/serial", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "simpan-serial",
          serialId: modeSerialBaru ? "" : serialAktif?.id,
          judul: editJudul.trim(),
          tagline: editTagline.trim(),
          moodBawaan: editMood,
          formatSuara: editFormatSuara,
          suaraTokoh: editSuaraTokoh,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.pesan ?? "Gagal menyimpan serial.");
      terapkanKonfigKeForm(j.konfig as KonfigSerialLekKopi);
      setPesan(j.pesan ?? "Pengaturan serial tersimpan.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan serial.");
    } finally {
      setMenyimpanSerial(false);
    }
  }

  async function hapusEpisode(nomor: number) {
    if (!serialAktif) return;
    const tok = await tokenSegar();
    const res = await fetch("/api/studio/serial", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "hapus-episode", serialId: serialAktif.id, nomorEpisode: nomor }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && j.ok) {
      terapkanKonfigKeForm(j.konfig as KonfigSerialLekKopi);
      setPesan(j.pesan ?? `Riwayat episode ${nomor} dihapus.`);
    }
  }

  return (
    <div className="min-w-0 space-y-5 overflow-hidden">
      {/* Header status */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <Clapperboard className="size-5 text-emas" /> Serial Kartun 2D Lek Kopi
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Animasi 2D ceria &amp; santai otomatis di Remotion (0 kredit Google Flow) dengan suara{" "}
              <b>ElevenLabs</b> per tokoh dan latar foto asli kedai yang diubah jadi kartun.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void muatData()}
            disabled={memuat}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-muted-foreground hover:border-emas hover:text-emas"
          >
            <RefreshCw className={`size-3 ${memuat ? "animate-spin" : ""}`} /> Segarkan
          </button>
        </div>
        {pesan && <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{pesan}</p>}
        {galat && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-200">{galat}</p>}
      </div>

      {/* ── BLOK 1: Buat Episode Berikutnya ── */}
      <section className="space-y-4 rounded-2xl border border-emas/35 bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emas/15 px-2.5 py-0.5 text-[11px] font-bold text-emas">
              Episode {nomorBerikutnya} · Siap Dibuat
            </span>
            <h3 className="mt-1 font-heading text-base font-semibold text-foreground">
              {serialAktif?.judul || "Cerita di Lek Kopi"}
            </h3>
            {serialAktif?.tagline && (
              <p className="text-xs text-muted-foreground">{serialAktif.tagline}</p>
            )}
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div>Latar foto kartun: <b>{konfig.latar.length}</b></div>
            <div>Riwayat tersimpan: <b>{serialAktif?.episode.length ?? 0} ep</b></div>
          </div>
        </div>

        {/* Banner Khusus Lanjutkan Episode Berikutnya (muncul otomatis setelah ada Ep 1+) */}
        {episodeTerakhir ? (
          <div className="space-y-3 rounded-xl border border-amber-400/45 bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.04] to-transparent p-3.5 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-200">
                  <Sparkles className="size-3" /> Lanjutkan Cerita · Episode {episodeTerakhir.nomor} → Episode {nomorBerikutnya}
                </span>
                <h4 className="text-sm font-semibold text-foreground">
                  Sambung dari Ep. {episodeTerakhir.nomor}: &ldquo;{episodeTerakhir.judul}&rdquo;
                </h4>
                {episodeTerakhir.ringkasan ? (
                  <p className="text-xs leading-relaxed text-zinc-300">
                    {episodeTerakhir.ringkasan}
                  </p>
                ) : null}
              </div>
            </div>

            <input
              type="text"
              value={arahLanjutan}
              onChange={(e) => setArahLanjutan(e.target.value)}
              placeholder={`Arahan lanjutan Episode ${nomorBerikutnya} (opsional — mis. Lek Aceng lanjut perjalanan ke dataran tinggi Gayo…)`}
              className="h-9 w-full rounded-xl border border-amber-400/30 bg-background/70 px-3 text-xs text-foreground"
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => tulisNaskahEpisodeBerikutnya(episodeTerakhir, "ai")}
                disabled={sedangBuatDraf || sedangBuatEp || sedangMintaSaran}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-4 text-xs font-bold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50 sm:w-auto"
              >
                {sedangBuatDraf ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
                {sedangBuatDraf
                  ? `Menulis Naskah Episode ${nomorBerikutnya}…`
                  : `Tulis Naskah Episode ${nomorBerikutnya} (Lanjutan AI)`}
              </button>
              <button
                type="button"
                onClick={() => tulisNaskahEpisodeBerikutnya(episodeTerakhir, "manual")}
                disabled={sedangBuatDraf || sedangBuatEp}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-amber-400/45 bg-amber-500/10 px-4 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50 sm:w-auto"
              >
                <FileText className="size-3.5" />
                Tulis Manual Episode {nomorBerikutnya}
              </button>
            </div>
          </div>
        ) : null}

        {/* Pilihan Gaya Cerita */}
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-100">Gaya Cerita Episode Ini</span>
            <span className="text-[11px] text-muted-foreground">
              {gayaCerita === "dokumenter"
                ? "Mode Dokumenter Murni · Narator + Riset Google + Ilustrasi AI"
                : "Mode Cerita Kedai · Tokoh Lek Aril dkk"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => pilihGayaCerita("kedai")}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                gayaCerita === "kedai"
                  ? "border-emas bg-emas/15 text-emas-muda"
                  : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25"
              }`}
            >
              <div className="text-xs font-semibold">Komedi / Cerita Kedai</div>
              <div className="mt-0.5 text-[11px] opacity-80">
                Tokoh kartun Lek Kopi, obrolan santai Panjunan, dan promo kedai.
              </div>
            </button>
            <button
              type="button"
              onClick={() => pilihGayaCerita("dokumenter")}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                gayaCerita === "dokumenter"
                  ? "border-amber-400/70 bg-amber-400/15 text-amber-200"
                  : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25"
              }`}
            >
              <div className="text-xs font-semibold">Dokumenter / Cerita Motion</div>
              <div className="mt-0.5 text-[11px] opacity-80">
                Karakter 2D berjalan &amp; dialog + ilustrasi AI + arsip berstempel / gulungan perkamen / peta kuno.
              </div>
            </button>
          </div>

          {gayaCerita === "dokumenter" ? (
            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-muted-foreground">Tema Visual CeritaMotion</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTemaVisual("malam")}
                    className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                      temaVisual === "malam"
                        ? "border-amber-400/70 bg-amber-400/15 text-amber-200"
                        : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25"
                    }`}
                  >
                    <div className="font-semibold">Malam Sinematik</div>
                    <div className="text-[10px] opacity-75">Gelap hangat + sorot emas</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemaVisual("perkamen")}
                    className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                      temaVisual === "perkamen"
                        ? "border-amber-400/70 bg-amber-400/15 text-amber-200"
                        : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25"
                    }`}
                  >
                    <div className="font-semibold">Perkamen Sejarah</div>
                    <div className="text-[10px] opacity-75">Gulungan + peta + pil kuning</div>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-muted-foreground">
                  Gender Narator (Juga untuk Cadangan Suara)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGenderNarator("pria")}
                    className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                      genderNarator === "pria"
                        ? "border-teal-400/70 bg-teal-400/15 text-teal-200"
                        : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25"
                    }`}
                  >
                    <div className="font-semibold">Pria · Berwibawa</div>
                    <div className="text-[10px] opacity-75">Selalu jatuh ke suara pria</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenderNarator("wanita")}
                    className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                      genderNarator === "wanita"
                        ? "border-teal-400/70 bg-teal-400/15 text-teal-200"
                        : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25"
                    }`}
                  >
                    <div className="font-semibold">Wanita · Hangat</div>
                    <div className="text-[10px] opacity-75">Selalu jatuh ke suara wanita</div>
                  </button>
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <span className="block text-[11px] font-medium text-muted-foreground">
                  Gaya Visual Karakter 2D (8 Tokoh &amp; 9 Pose Anti-Monoton)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGayaKarakter("ilustrasi")}
                    className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                      gayaKarakter === "ilustrasi"
                        ? "border-amber-400/70 bg-amber-400/15 text-amber-200"
                        : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25"
                    }`}
                  >
                    <div className="font-semibold">Ilustrasi Berwarna (Disarankan)</div>
                    <div className="text-[10px] opacity-75">Petani, saudagar, santri, petualang, wajah berkedip &amp; kostum era</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGayaKarakter("siluet")}
                    className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                      gayaKarakter === "siluet"
                        ? "border-amber-400/70 bg-amber-400/15 text-amber-200"
                        : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25"
                    }`}
                  >
                    <div className="font-semibold">Siluet Emas Sinematik</div>
                    <div className="text-[10px] opacity-75">Siluet gelap ber-rimlight emas misterius</div>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Asisten Kata Kunci → 3 Saran Cerita AI */}
        <div className="space-y-2.5 rounded-xl border border-teal-500/25 bg-teal-500/[0.04] p-3 sm:p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-300">
              <Lightbulb className="size-3.5" /> Cari Ide Cerita dari Kata Kunci (AI)
            </span>
            {infoPenyediaSaran && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                AI: {infoPenyediaSaran}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={kataKunci}
              onChange={(e) => setKataKunci(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !sedangMintaSaran) {
                  e.preventDefault();
                  void mintaSaranCerita();
                }
              }}
              placeholder="Ketik kata kunci (mis. gajian telat, hujan sore, Butterscoth Latte, kucing Cimol)…"
              className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card/70 px-3 text-xs sm:text-sm"
            />
            <button
              type="button"
              onClick={() => void mintaSaranCerita()}
              disabled={sedangMintaSaran || sedangBuatDraf || sedangBuatEp}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-teal-400/40 bg-teal-500/15 px-3.5 text-xs font-semibold text-teal-200 transition hover:bg-teal-500/25 disabled:opacity-50"
            >
              {sedangMintaSaran ? <Loader2 className="size-3.5 animate-spin" /> : <Lightbulb className="size-3.5" />}
              {sedangMintaSaran ? "Meracik Saran…" : "Minta 3 Saran Cerita (AI)"}
            </button>
          </div>

          {saranCerita.length > 0 && (
            <div className="grid gap-2.5 pt-1 md:grid-cols-3">
              {saranCerita.map((s, idx) => (
                <div
                  key={`${s.judul}-${idx}`}
                  className="flex min-w-0 flex-col justify-between gap-2.5 rounded-xl border border-white/10 bg-background/70 p-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Opsi {idx + 1} · {s.mood.replace(/_/g, " ")}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-foreground">{s.judul}</h4>
                    <p className="text-[11px] leading-relaxed text-zinc-300">{s.premis}</p>
                    {s.punchline && (
                      <p className="text-[11px] leading-relaxed text-amber-200/90">
                        <b>Ending/Twist:</b> {s.punchline}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIde(s.ideLengkap);
                        setMood(s.mood);
                        setDrafNaskah(null);
                        setPesan(`Ide "${s.judul}" dipasang — silakan klik Buatkan Draf Naskah atau edit seperlunya.`);
                      }}
                      className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:border-emas hover:text-emas"
                    >
                      Pakai Ide Ini
                    </button>
                    <button
                      type="button"
                      disabled={sedangBuatDraf || sedangBuatEp}
                      onClick={() => {
                        setIde(s.ideLengkap);
                        setMood(s.mood);
                        void buatDrafNaskah({ ideOverride: s.ideLengkap, moodOverride: s.mood });
                      }}
                      className="rounded-lg bg-emas/20 px-2.5 py-1 text-[11px] font-semibold text-emas-muda hover:bg-emas/30 disabled:opacity-50"
                    >
                      Langsung Buatkan Naskah
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chip ide cepat (khusus mode cerita kedai) */}
        {gayaCerita === "kedai" ? (
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">
              Ide Cepat Komedi / Kehidupan (klik untuk langsung mengisi)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {IDE_CEPAT_SERIAL.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setIde(item.ide);
                    setMood(item.mood);
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-200 transition hover:border-emas hover:text-emas-muda"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Ide / Bahan Cerita Episode {nomorBerikutnya} (bisa ide singkat atau tempel narasi cerita panjang)
          </span>
          <textarea
            rows={4}
            value={ide}
            onChange={(e) => setIde(e.target.value)}
            placeholder={
              gayaCerita === "dokumenter"
                ? "Tulis topik sejarah/edukasi (mis. Kisah Syekh Abul Hasan Asy-Syadzili dan sejarah awal Qahwah di Yaman) atau tempel narasi contoh Anda…"
                : "Tulis ide singkat atau tempel langsung contoh cerita / narasi panjang (mis. kisah Syekh Asy-Syadzili dan kopi pertama) agar AI merangkai dialog & narasi panjang atau memecahnya ke beberapa episode…"
            }
            className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm leading-relaxed"
          />
        </label>

        {/* Panel Riset Fakta Google untuk Dokumenter Murni */}
        {gayaCerita === "dokumenter" ? (
          <div className="space-y-2.5 rounded-xl border border-amber-400/25 bg-amber-500/[0.05] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-amber-200">Riset Fakta Google</span>
                {infoPenyediaRiset ? (
                  <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                    {infoPenyediaRiset}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasilRiset.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHasilRiset("");
                      setInfoPenyediaRiset("");
                    }}
                    className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/25"
                  >
                    Hapus Riset
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={risetCeritaGoogle}
                  disabled={sedangRiset || (!ide.trim() && !kataKunci.trim())}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
                >
                  {sedangRiset ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {sedangRiset ? "Meriset di Google…" : "Riset Fakta di Google Dulu"}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[11px] text-zinc-300">
              <input
                type="checkbox"
                checked={risetOtomatisGoogle}
                onChange={(e) => setRisetOtomatisGoogle(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/20"
              />
              <span>Riset Google otomatis saat Buat Naskah jika ringkasan fakta masih kosong</span>
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] text-muted-foreground">
                Hasil Riset Fakta &amp; Sumber (dapat disunting langsung sebelum naskah dibuat)
              </span>
              <textarea
                rows={5}
                value={hasilRiset}
                onChange={(e) => setHasilRiset(e.target.value)}
                placeholder="Isi Kata Kunci atau Ide Cerita di atas lalu klik Riset Fakta di Google Dulu — atau biarkan kosong agar AI meriset otomatis saat membuat saran/naskah."
                className="w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-xs leading-relaxed"
              />
            </label>
          </div>
        ) : null}

        {/* Mood & Format Suara */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Nuansa Cerita</span>
            <div className="flex flex-wrap gap-1.5">
              {OPSI_MOOD_SERIAL.map((o) => (
                <button
                  key={o.kode}
                  type="button"
                  onClick={() => setMood(o.kode)}
                  className={`rounded-xl border px-3 py-1.5 text-left text-xs transition ${
                    mood === o.kode
                      ? "border-emas bg-emas/15 font-semibold text-emas-muda"
                      : "border-white/10 text-muted-foreground hover:border-white/25"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Format Suara</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { kode: "dialog" as const, label: "Dialog Karakter (Tektokan)" },
                { kode: "campuran" as const, label: "Narator + Dialog Tokoh" },
                { kode: "narator" as const, label: "1 Narator Bercerita" },
              ].map((f) => (
                <button
                  key={f.kode}
                  type="button"
                  onClick={() => setFormatSuara(f.kode)}
                  className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                    formatSuara === f.kode
                      ? "border-emas bg-emas/15 font-semibold text-emas-muda"
                      : "border-white/10 text-muted-foreground hover:border-white/25"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panjang Cerita & Mode Bersambung */}
        <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Panjang Cerita &amp; Kedalaman Dialog</span>
            <div className="flex flex-wrap gap-1.5">
              {OPSI_PANJANG_SERIAL.map((p) => (
                <button
                  key={p.kode}
                  type="button"
                  onClick={() => setPanjangNaskah(p.kode)}
                  title={p.ket}
                  className={`rounded-xl border px-3 py-1.5 text-left text-xs transition ${
                    panjangNaskah === p.kode
                      ? "border-teal-400/70 bg-teal-500/15 font-semibold text-teal-200"
                      : "border-white/10 text-muted-foreground hover:border-white/25"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {OPSI_PANJANG_SERIAL.find((p) => p.kode === panjangNaskah)?.ket}
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-background/50 px-3 py-2.5 text-xs sm:max-w-[260px]">
            <input
              type="checkbox"
              checked={bersambung}
              onChange={(e) => setBersambung(e.target.checked)}
              className="mt-0.5 size-4 accent-amber-400"
            />
            <span>
              <b className="block text-foreground">Cerita panjang / bersambung</b>
              <span className="text-[11px] text-muted-foreground">
                Garap bagian awal dengan utuh &amp; siapkan jembatan lanjut ke Episode {nomorBerikutnya + 1}.
              </span>
            </span>
          </label>
        </div>

        {/* Sasaran & Jadwal */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Sasaran Instagram</span>
            <div className="flex flex-wrap gap-1.5">
              {DAFTAR_SASARAN_VIDEO.map((s) => (
                <button
                  key={s.kode}
                  type="button"
                  onClick={() => setSasaran(s.kode)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                    sasaran === s.kode
                      ? "border-emas bg-emas/15 text-emas"
                      : "border-white/10 text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Jadwal Tayang</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { kode: "persetujuan" as const, label: "Cek Dulu" },
                { kode: "prime19" as const, label: "19.00 WIB" },
                { kode: "custom" as const, label: "Custom WIB" },
              ].map((j) => (
                <button
                  key={j.kode}
                  type="button"
                  onClick={() => setModeJadwal(j.kode)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                    modeJadwal === j.kode
                      ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 text-muted-foreground"
                  }`}
                >
                  {j.label}
                </button>
              ))}
              {modeJadwal === "custom" && (
                <div className="flex items-center gap-1.5 pt-1">
                  <CalendarClock className="size-3.5 text-emas" />
                  <input
                    type="datetime-local"
                    value={waktuJadwal}
                    onChange={(e) => setWaktuJadwal(e.target.value)}
                    className="h-8 rounded-lg border border-input bg-card px-2 font-mono text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => void buatDrafNaskah()}
            disabled={sedangBuatDraf || sedangBuatEp || sedangMintaSaran}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-teal-400/50 bg-teal-500/10 px-5 text-sm font-semibold text-teal-200 transition hover:bg-teal-500/20 disabled:opacity-50 sm:w-auto"
          >
            {sedangBuatDraf ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            {sedangBuatDraf ? "Menulis Draf Naskah…" : "Buatkan Draf Naskah Cerita (AI)"}
          </button>

          <button
            type="button"
            onClick={bukaTulisManual}
            disabled={sedangBuatEp || sedangBuatDraf}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-amber-400/50 bg-amber-500/10 px-5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50 sm:w-auto"
          >
            <Plus className="size-4" />
            Tulis Manual per Bagian
          </button>

          <button
            type="button"
            onClick={() => void buatEpisodeSekarang()}
            disabled={sedangBuatEp || sedangBuatDraf}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emas px-5 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-50 sm:w-auto"
          >
            {sedangBuatEp ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {sedangBuatEp
              ? `Memasukkan Episode ${nomorBerikutnya} ke Antrean…`
              : drafNaskah
              ? `Render Episode ${nomorBerikutnya} (Pakai Draf Ini)`
              : `Buat Episode ${nomorBerikutnya} Sekarang`}
          </button>
        </div>

        {/* Editor Draf Naskah Cerita sebelum render video */}
        {drafNaskah && (
          <div ref={refEditorDraf} className="space-y-4 rounded-2xl border border-emas/45 bg-background/80 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground">
                    <FileText className="size-4 text-emas" /> Editor Draf Naskah Cerita (Ep {nomorBerikutnya})
                  </h4>
                  {infoPenyediaDraf && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      Ditulis oleh {infoPenyediaDraf}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Silakan periksa atau ubah judul, pembicara, latar, dan dialog di bawah. Saat dirender, mesin memakai draf ini tanpa memanggil AI lagi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrafNaskah(null)}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" /> Tutup Draf
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">Judul Episode</span>
                <input
                  type="text"
                  value={drafNaskah.judulEpisode}
                  onChange={(e) => setDrafNaskah((p) => (p ? { ...p, judulEpisode: e.target.value } : p))}
                  className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">Tema Singkat</span>
                <input
                  type="text"
                  value={drafNaskah.tema}
                  onChange={(e) => setDrafNaskah((p) => (p ? { ...p, tema: e.target.value } : p))}
                  className="h-9 rounded-xl border border-input bg-card px-3 text-xs text-foreground"
                />
              </label>
            </div>

            <div className="space-y-2.5">
              {(() => {
                const est = estimasiDurasiNaskahSerial(drafNaskah.adegan);
                return (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Daftar Adegan (<b>{drafNaskah.adegan.length}</b> adegan · ~<b>{est.totalKata}</b> kata · estimasi{" "}
                      <b>{Math.round(est.totalDetik)} detik</b>)
                    </span>
                    {drafNaskah.adegan.length < 16 && (
                      <button
                        type="button"
                        onClick={tambahAdeganDraf}
                        className="inline-flex items-center gap-1 rounded-full border border-emas/40 bg-emas/10 px-2.5 py-1 text-[11px] font-medium text-emas-muda hover:bg-emas/20"
                      >
                        <Plus className="size-3" /> Tambah Adegan
                      </button>
                    )}
                  </div>
                );
              })()}
              {drafNaskah.adegan.map((a, idx) => {
                const adaDiOpsi = opsiLatarDraf.some((o) => o.kode === a.latarKode);
                return (
                  <div
                    key={`${a.nomor}-${idx}`}
                    className="space-y-2 rounded-xl border border-white/10 bg-card/70 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-emas/20 px-2 py-0.5 font-bold text-emas">
                          Adegan {a.nomor}
                        </span>
                        {a.kartuWaktu && (
                          <span className="rounded bg-white/10 px-2 py-0.5 text-zinc-300">{a.kartuWaktu}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {a.dialog.trim() ? `${a.dialog.trim().split(/\s+/).length} kata` : "Tanpa dialog"}
                        </span>
                        {drafNaskah.adegan.length > 1 && (
                          <button
                            type="button"
                            onClick={() => hapusAdeganDraf(idx)}
                            className="rounded p-0.5 text-muted-foreground hover:text-red-400"
                            title="Hapus adegan ini"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {gayaCerita === "dokumenter" ? (
                      <div className="grid gap-2 sm:grid-cols-3">
                        <label className="grid gap-1">
                          <span className="text-[10px] text-muted-foreground">Tampilan Bagian (CeritaMotion)</span>
                          <select
                            value={
                              a.jenisMotion ??
                              (idx === 0
                                ? "pembuka"
                                : idx === drafNaskah.adegan.length - 1 && drafNaskah.adegan.length >= 2
                                ? "penutup"
                                : temaVisual === "perkamen"
                                ? "perkamen"
                                : "ilustrasi")
                            }
                            onChange={(e) =>
                              ubahAdeganDraf(idx, { jenisMotion: e.target.value as JenisAdeganMotion })
                            }
                            className="h-8 rounded-lg border border-input bg-background/70 px-2.5 text-xs"
                          >
                            <option value="pembuka" className="bg-card">Pembuka Judul (Malam)</option>
                            <option value="ilustrasi" className="bg-card">Ilustrasi Sinematik</option>
                            <option value="perkamen" className="bg-card">Gulungan Perkamen</option>
                            <option value="arsip" className="bg-card">Close-Up Arsip Berstempel</option>
                            <option value="peta" className="bg-card">Peta Kuno (Otomatis Nusantara / Mokha)</option>
                            <option value="penutup" className="bg-card">Penutup &amp; Kredit</option>
                          </select>
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] text-muted-foreground">Judul Kartu / Gulungan</span>
                          <input
                            type="text"
                            value={a.judulKartu ?? ""}
                            onChange={(e) => ubahAdeganDraf(idx, { judulKartu: e.target.value })}
                            placeholder={idx === 0 ? "mis. Qahwah" : "mis. Buah Merah di Lereng Yaman"}
                            className="h-8 rounded-lg border border-input bg-background/70 px-2.5 text-xs"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] text-muted-foreground">Pita Era / Lencana Bagian</span>
                          <input
                            type="text"
                            value={a.kartuWaktu}
                            onChange={(e) => ubahAdeganDraf(idx, { kartuWaktu: e.target.value })}
                            placeholder={idx === 0 ? `Bagian ${nomorBerikutnya}` : "YAMAN · ABAD KE-15"}
                            className="h-8 rounded-lg border border-input bg-background/70 px-2.5 text-xs"
                          />
                        </label>
                        {a.jenisMotion !== "peta" && a.jenisMotion !== "arsip" ? (
                          <>
                            <label className="grid gap-1">
                              <span className="text-[10px] text-muted-foreground">Karakter Tokoh (Opsional)</span>
                              <select
                                value={a.karakter?.tokohUtama ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value as TipeKarakterCerita | "";
                                  const next: KarakterMotionDraf = { ...(a.karakter ?? {}) };
                                  if (val) next.tokohUtama = val;
                                  else delete next.tokohUtama;
                                  ubahAdeganDraf(idx, { karakter: Object.keys(next).length ? next : undefined });
                                }}
                                className="h-8 rounded-lg border border-input bg-background/70 px-2.5 text-xs"
                              >
                                <option value="" className="bg-card">Otomatis (Sesuai Narasi)</option>
                                {OPSI_TOKOH_MOTION.map((o) => (
                                  <option key={o.kode} value={o.kode} className="bg-card">
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="grid gap-1 sm:col-span-2">
                              <span className="text-[10px] text-muted-foreground">Aksi / Pose Karakter (Opsional)</span>
                              <select
                                value={a.karakter?.aksi ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value as AksiKarakterCerita | "";
                                  const next: KarakterMotionDraf = { ...(a.karakter ?? {}) };
                                  if (val) next.aksi = val;
                                  else delete next.aksi;
                                  ubahAdeganDraf(idx, { karakter: Object.keys(next).length ? next : undefined });
                                }}
                                className="h-8 rounded-lg border border-input bg-background/70 px-2.5 text-xs"
                              >
                                <option value="" className="bg-card">Otomatis (Anti-Monoton Bervariasi)</option>
                                {OPSI_AKSI_MOTION.map((o) => (
                                  <option key={o.kode} value={o.kode} className="bg-card">
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-3">
                        <label className="grid gap-1">
                          <span className="text-[10px] text-muted-foreground">Posisi Suara / Peran</span>
                          <select
                            value={a.pembicara}
                            onChange={(e) => {
                              const p = e.target.value as AdeganDrafSerial["pembicara"];
                              let namaSaran = a.namaPembicara;
                              if (p === "narator") {
                                namaSaran = "Narator";
                              } else if (p === "kiri" && a.tokohKiri) {
                                namaSaran = DAFTAR_TOKOH_LEKKOPI.find((t) => t.id === a.tokohKiri?.id)?.nama ?? a.namaPembicara;
                              } else if (p === "kanan" && a.tokohKanan) {
                                namaSaran = DAFTAR_TOKOH_LEKKOPI.find((t) => t.id === a.tokohKanan?.id)?.nama ?? a.namaPembicara;
                              }
                              ubahAdeganDraf(idx, { pembicara: p, namaPembicara: namaSaran });
                            }}
                            className="h-8 rounded-lg border border-input bg-background/70 px-2.5 text-xs"
                          >
                            <option value="narator" className="bg-card">Narator (VO)</option>
                            <option value="kiri" className="bg-card">Tokoh Kiri</option>
                            <option value="kanan" className="bg-card">Tokoh Kanan</option>
                            <option value="tanpa" className="bg-card">Tanpa Suara</option>
                          </select>
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] text-muted-foreground">Nama Pembicara</span>
                          <input
                            type="text"
                            value={a.namaPembicara}
                            onChange={(e) => ubahAdeganDraf(idx, { namaPembicara: e.target.value })}
                            className="h-8 rounded-lg border border-input bg-background/70 px-2.5 text-xs"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] text-muted-foreground">Latar Adegan</span>
                          <select
                            value={a.latarKode}
                            onChange={(e) => ubahAdeganDraf(idx, { latarKode: e.target.value })}
                            className="h-8 rounded-lg border border-input bg-background/70 px-2.5 text-xs"
                          >
                            {!adaDiOpsi && <option value={a.latarKode}>{a.latarKode}</option>}
                            {opsiLatarDraf.map((o) => (
                              <option key={o.kode} value={o.kode} className="bg-card">
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}

                    <label className="grid gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {gayaCerita === "dokumenter"
                          ? "Narasi Bagian Ini (diucapkan suara & tampil sebagai teks kinetik)"
                          : "Dialog / Narasi (diucapkan ElevenLabs)"}
                      </span>
                      <textarea
                        rows={3}
                        value={a.dialog}
                        onChange={(e) => ubahAdeganDraf(idx, { dialog: e.target.value })}
                        placeholder={
                          gayaCerita === "dokumenter"
                            ? "Tulis kalimat narasi bagian ini secara manual…"
                            : undefined
                        }
                        className="w-full rounded-lg border border-input bg-background/70 px-2.5 py-1.5 text-xs leading-relaxed"
                      />
                    </label>

                    {gayaCerita === "dokumenter" ? (
                      <label className="grid gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          Kata Kunci Disorot Emas/Kuning (pisah koma · kosongkan untuk otomatis)
                        </span>
                        <input
                          type="text"
                          value={(a.kataSorot ?? []).join(",")}
                          onChange={(e) =>
                            ubahAdeganDraf(idx, {
                              kataSorot: e.target.value ? e.target.value.split(",") : [],
                            })
                          }
                          placeholder="mis. kopi, doa, malam, Mokha"
                          className="h-8 rounded-lg border border-input bg-background/70 px-2.5 text-xs"
                        />
                      </label>
                    ) : null}

                    {gayaCerita === "dokumenter" || a.promptVisual ? (
                      a.jenisMotion === "peta" ? (
                        <p className="rounded-lg border border-amber-400/20 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-200/80">
                          Adegan Peta Kuno dirender otomatis sebagai peta vektor animasi tajam (tanpa gambar AI).
                        </p>
                      ) : (
                        <label className="grid gap-1">
                          <span className="text-[10px] text-amber-200/80">
                            Prompt Visual Ilustrasi AI (Inggris · opsional, kosongkan agar AI otomatis menggambar dari narasi)
                          </span>
                          <textarea
                            rows={2}
                            value={a.promptVisual ?? ""}
                            onChange={(e) => ubahAdeganDraf(idx, { promptVisual: e.target.value })}
                            placeholder="Contoh: Atmospheric dark 2D painterly illustration of 15th-century Yemeni mountain cave with warm lantern light, vertical 9:16, no text"
                            className="w-full rounded-lg border border-amber-400/25 bg-background/70 px-2.5 py-1.5 text-xs leading-relaxed"
                          />
                        </label>
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">Pertanyaan Penutup (Akhir Video)</span>
                <input
                  type="text"
                  value={drafNaskah.pertanyaanPenutup}
                  onChange={(e) => setDrafNaskah((p) => (p ? { ...p, pertanyaanPenutup: e.target.value } : p))}
                  className="h-9 rounded-xl border border-input bg-card px-3 text-xs"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">Caption Instagram</span>
                <textarea
                  rows={2}
                  value={drafNaskah.caption}
                  onChange={(e) => setDrafNaskah((p) => (p ? { ...p, caption: e.target.value } : p))}
                  className="w-full rounded-xl border border-input bg-card px-3 py-1.5 text-xs"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => void buatEpisodeSekarang(drafNaskah)}
                disabled={sedangBuatEp || sedangBuatDraf}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-emas px-4 text-xs font-semibold text-background transition hover:brightness-110 disabled:opacity-50 sm:w-auto"
              >
                {sedangBuatEp ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {`Render Video dari Naskah Ini (Ep ${nomorBerikutnya})`}
              </button>
              <button
                type="button"
                onClick={() => void buatDrafNaskah()}
                disabled={sedangBuatDraf || sedangBuatEp}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-medium text-zinc-200 hover:border-emas hover:text-emas disabled:opacity-50 sm:w-auto"
              >
                <RefreshCw className={`size-3.5 ${sedangBuatDraf ? "animate-spin" : ""}`} />
                Buat Ulang Naskah
              </button>
              <button
                type="button"
                onClick={() => setDrafNaskah(null)}
                disabled={sedangBuatEp}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 text-xs text-muted-foreground hover:text-foreground sm:w-auto"
              >
                <X className="size-3.5" /> Tutup Draf
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── BLOK 2: Foto Asli Tempat Lek Kopi → Latar Kartun 2D ── */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div>
          <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
            <Palette className="size-4 text-emas" /> Latar Tempat Lek Kopi (Foto Asli → Kartun 2D)
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Unggah foto meja bar, area outdoor, atau sudut kedai Lek Kopi. Studio menyulap foto asli menjadi
            latar kartun 2D yang konsisten. Jika belum diunggah, mesin otomatis memakai latar kartun bawaan Lek Kopi.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Kategori Lokasi</span>
            <select
              value={kodeLokasiPilihan}
              onChange={(e) => {
                const kode = e.target.value;
                setKodeLokasiPilihan(kode);
                const info = OPSI_LOKASI_LEKKOPI.find((o) => o.kode === kode);
                if (info && kode !== "custom") {
                  setNamaLokasi(info.label);
                  setDeskripsiLokasi(info.deskripsiBawaan);
                }
              }}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
            >
              {OPSI_LOKASI_LEKKOPI.map((o) => (
                <option key={o.kode} value={o.kode} className="bg-card">
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {kodeLokasiPilihan === "custom" && (
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Kode Lokasi Baru</span>
              <input
                value={kodeCustom}
                onChange={(e) => setKodeCustom(e.target.value)}
                placeholder="mis. sudut-parkir"
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
              />
            </label>
          )}

          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Nama Lokasi</span>
            <input
              value={namaLokasi}
              onChange={(e) => setNamaLokasi(e.target.value)}
              placeholder="mis. Meja Bar Lek Kopi"
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
            />
          </label>

          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Nuansa Kartun 2D</span>
            <select
              value={gayaKartun}
              onChange={(e) => setGayaKartun(e.target.value === "santai_sore" ? "santai_sore" : "ceria_hangat")}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
            >
              {OPSI_GAYA_KARTUN_LATAR.map((g) => (
                <option key={g.kode} value={g.kode} className="bg-card">
                  {g.label} — {g.ket}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Catatan Visual Singkat untuk AI Naskah (opsional)</span>
          <input
            value={deskripsiLokasi}
            onChange={(e) => setDeskripsiLokasi(e.target.value)}
            placeholder="mis. Meja bar kayu dengan mesin espresso dan lampu gantung hangat"
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-emas/40 bg-emas/10 px-4 py-2 text-xs font-semibold text-emas-muda transition hover:bg-emas/20">
            <ImagePlus className="size-4" />
            <span>{fileFoto ? fileFoto.name.slice(0, 28) : "Pilih Foto Tempat Asli…"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFileFoto(f);
                setPratinjauLatar(null);
                if (f) void prosesKartunkanFoto("ai", f);
                e.target.value = "";
              }}
            />
          </label>

          {fileFoto && (
            <>
              <button
                type="button"
                onClick={() => void prosesKartunkanFoto("ai")}
                disabled={sedangKartunkan}
                className="inline-flex items-center gap-1.5 rounded-full bg-emas px-4 py-2 text-xs font-semibold text-background hover:brightness-110 disabled:opacity-50"
              >
                {sedangKartunkan ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                {sedangKartunkan ? "Menyulap jadi Kartun…" : "Kartunkan Ulang (AI)"}
              </button>
              <button
                type="button"
                onClick={() => void prosesKartunkanFoto("canvas")}
                disabled={sedangKartunkan}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium ${
                  bisaFallbackCanvas
                    ? "border-amber-400 bg-amber-500/20 text-amber-200"
                    : "border-white/15 text-muted-foreground hover:border-white/30"
                }`}
              >
                Kartun Cepat (Browser)
              </button>
              <button
                type="button"
                onClick={() => void prosesKartunkanFoto("langsung")}
                disabled={sedangKartunkan}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-2 text-xs font-medium text-muted-foreground hover:border-white/30"
              >
                Simpan Langsung (Sudah Kartun)
              </button>
            </>
          )}
        </div>

        {/* Pratinjau Before vs After */}
        {pratinjauLatar && (
          <div className="space-y-3 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.04] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs">
                <span className="font-semibold text-emerald-300">Pratinjau Latar Kartun Siap Simpan</span>
                <span className="ml-2 text-muted-foreground">
                  ({pratinjauLatar.kode} · diproses via {pratinjauLatar.penyedia})
                </span>
              </div>
              <button
                type="button"
                onClick={() => void simpanLatarPratinjau()}
                disabled={menyimpanLatar}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-black hover:brightness-110 disabled:opacity-50"
              >
                {menyimpanLatar ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Simpan Latar ke Studio
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="space-y-1">
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Foto Asli</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pratinjauLatar.dataUrlAsli}
                  alt="Foto asli kedai"
                  className="aspect-[9/16] w-full rounded-lg border border-white/10 object-cover"
                />
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] uppercase tracking-wide text-emerald-300">Hasil Kartun 2D</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pratinjauLatar.urlKartun}
                  alt="Hasil latar kartun 2D"
                  className="aspect-[9/16] w-full rounded-lg border border-emerald-500/40 object-cover"
                />
              </div>
            </div>
          </div>
        )}

        {/* Galeri Latar Tersimpan */}
        {konfig.latar.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {konfig.latar.map((l) => (
              <div
                key={l.id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-border/80 bg-white/[0.02] p-2.5 text-xs"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={l.urlKartun}
                  alt={l.nama}
                  className="aspect-[9/16] w-full rounded-lg bg-black/40 object-cover"
                />
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{l.nama}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      kode: <code className="text-emas-muda">{l.kode}</code>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void hapusLatar(l.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-400"
                    title="Hapus latar"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Belum ada foto kedai yang dikartunkan. Sementara mesin tetap siap memakai 4 latar kartun 2D bawaan
            (Meja Bar, Area Outdoor, Meja Kopi, Depan Kedai).
          </p>
        )}
      </section>

      {/* ── BLOK 3: Pengaturan Serial, Suara ElevenLabs per Tokoh & Riwayat Episode ── */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
            <Users className="size-4 text-emas" /> Daftar Serial, Suara ElevenLabs &amp; Riwayat Episode
          </h3>
          <button
            type="button"
            onClick={() => {
              setModeSerialBaru(true);
              setEditJudul("");
              setEditTagline("");
              setEditMood("komedi_ceria");
              setEditFormatSuara("dialog");
              setEditSuaraTokoh({});
            }}
            className="inline-flex items-center gap-1 rounded-full border border-emas/40 bg-emas/10 px-3 py-1 text-xs font-medium text-emas-muda hover:bg-emas/20"
          >
            <Plus className="size-3.5" /> Serial Baru
          </button>
        </div>

        {/* Switcher Serial */}
        {konfig.serial.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {konfig.serial.map((s) => {
              const aktif = !modeSerialBaru && s.id === serialAktif?.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void pilihSerial(s.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                    aktif
                      ? "border-emas bg-emas text-background"
                      : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/25"
                  }`}
                >
                  {s.judul} ({s.episode.length} ep)
                </button>
              );
            })}
          </div>
        )}

        {/* Editor Identitas Serial */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">
              {modeSerialBaru ? "Judul Serial Baru" : "Judul Serial"}
            </span>
            <input
              value={editJudul}
              onChange={(e) => setEditJudul(e.target.value)}
              placeholder="mis. Cerita di Lek Kopi"
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Tagline Singkat</span>
            <input
              value={editTagline}
              onChange={(e) => setEditTagline(e.target.value)}
              placeholder="mis. Obrolan ringan & komedi dari Panjunan Waru"
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Mood Bawaan</span>
            <select
              value={editMood}
              onChange={(e) => setEditMood(e.target.value as MoodSerial)}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
            >
              {OPSI_MOOD_SERIAL.map((m) => (
                <option key={m.kode} value={m.kode} className="bg-card">
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Format Suara Bawaan</span>
            <select
              value={editFormatSuara}
              onChange={(e) => {
                const v = e.target.value;
                setEditFormatSuara(v === "narator" || v === "campuran" ? v : "dialog");
              }}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-xs"
            >
              <option value="dialog" className="bg-card">Dialog Karakter (Tektokan)</option>
              <option value="campuran" className="bg-card">Narator + Dialog Tokoh</option>
              <option value="narator" className="bg-card">1 Narator Bercerita</option>
            </select>
          </label>
        </div>

        {/* Mapping Suara ElevenLabs per Tokoh */}
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Volume2 className="size-3.5 text-emas" /> Suara ElevenLabs per Tokoh
          </div>
          <p className="text-[11px] text-muted-foreground">
            Pilih Voice ID favorit dari tab Sambungan untuk tiap tokoh agar suara konsisten antar episode (atau
            biarkan Otomatis agar sistem membedakan suara pria &amp; wanita). Jika akun ElevenLabs paket Free menolak
            voice komunitas (Voice Library) lewat API, mesin otomatis memakai voice bawaan ElevenLabs yang sesuai
            gender (Pria/Wanita) agar sinkron teks tetap jalan.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                { key: "mas_barista", label: "Mas Lek (Barista)" },
                { key: "mas_pelanggan", label: "Mas Danu (Pelanggan)" },
                { key: "mbak_pelanggan", label: "Mbak Rara (Hijab)" },
                { key: "pak_tetangga", label: "Pak Budi (Kopiah)" },
                { key: "narator", label: "Narator Serial" },
              ] as { key: TokohSuaraId; label: string }[]
            ).map((t) => (
              <label key={t.key} className="grid gap-1 text-[11px]">
                <span className="text-muted-foreground">{t.label}</span>
                <select
                  value={editSuaraTokoh[t.key] ?? ""}
                  onChange={(e) =>
                    setEditSuaraTokoh((prev) => ({ ...prev, [t.key]: e.target.value }))
                  }
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
                >
                  <option value="" className="bg-card">Otomatis (Sesuai Karakter)</option>
                  {daftarSuaraPilih.map((sv) => (
                    <option key={sv.id} value={sv.id} className="bg-card">
                      {sv.nama}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void simpanSerial()}
          disabled={menyimpanSerial}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          {menyimpanSerial ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {modeSerialBaru ? "Simpan Sebagai Serial Baru" : "Simpan Pengaturan Serial"}
        </button>

        {/* Info Tokoh Tetap Lek Kopi */}
        <div className="space-y-1.5 pt-1">
          <span className="block text-xs font-medium text-muted-foreground">5 Tokoh Tetap Lek Kopi</span>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DAFTAR_TOKOH_LEKKOPI.map((tk) => (
              <div key={tk.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-[11px]">
                <div className="font-semibold text-foreground">
                  {tk.nama} <span className="font-normal text-emas-muda">· {tk.peran}</span>
                </div>
                <p className="mt-0.5 text-muted-foreground">{tk.deskripsi}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Riwayat Episode */}
        <div className="space-y-2 pt-1">
          <span className="block text-xs font-medium text-muted-foreground">
            Memori Episode ({serialAktif?.episode.length ?? 0} episode tersimpan)
          </span>
          {!serialAktif?.episode.length ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              Belum ada episode yang selesai. Setelah Episode 1 selesai dirender mesin, ringkasannya otomatis
              tersimpan di sini agar Episode 2 dan seterusnya menyambung.
            </p>
          ) : (
            <div className="space-y-2">
              {serialAktif.episode.map((ep) => (
                <div
                  key={ep.nomor}
                  className="flex items-start justify-between gap-2 rounded-xl border border-border/80 bg-white/[0.02] p-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground">
                      <span className="mr-1.5 text-emas">Ep. {ep.nomor}</span>
                      {ep.judul}
                    </div>
                    {ep.ringkasan && <p className="mt-0.5 text-muted-foreground">{ep.ringkasan}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => tulisNaskahEpisodeBerikutnya(ep, "ai")}
                      disabled={sedangBuatDraf || sedangBuatEp}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                      title={`Tulis naskah Episode ${nomorBerikutnya} menyambung dari Episode ${ep.nomor}`}
                    >
                      Lanjut Ep {nomorBerikutnya}
                      <ArrowRight className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void hapusEpisode(ep.nomor)}
                      className="rounded p-1 text-muted-foreground hover:text-red-400"
                      title="Hapus memori episode"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
