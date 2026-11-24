"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { situsBawaan } from "@/content/situs";
import { skemaSitus, type Situs } from "@/content/skema";
import { muatKonten, simpanKonten } from "@/lib/gudang-admin";
import { BagianKontak, BagianLayanan, BagianProsesTentang, BagianUmum } from "./bagian-editor";
import { BagianProduk } from "./editor-produk";

export type Ubah = (fn: (draf: Situs) => void) => void;

export function Editor({ sesi, kepala }: { sesi: Session | null; kepala: ReactNode }) {
  const [asli, setAsli] = useState<Situs | null>(null);
  const [draf, setDraf] = useState<Situs | null>(null);
  const [dariBawaan, setDariBawaan] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: "ok" | "galat"; teks: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    muatKonten()
      .then((k) => {
        // Database masih kosong → mulai dari isi bawaan; simpan pertama akan mengisinya.
        const awal = k ?? situsBawaan;
        setDariBawaan(!k);
        setAsli(awal);
        setDraf(structuredClone(awal));
      })
      .catch((e) => setPesan({ jenis: "galat", teks: `Gagal memuat isi: ${e.message}` }));
  }, []);

  const berubah = asli !== null && draf !== null && JSON.stringify(asli) !== JSON.stringify(draf);

  useEffect(() => {
    if (!berubah) return;
    const cegah = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", cegah);
    return () => window.removeEventListener("beforeunload", cegah);
  }, [berubah]);

  const ubah: Ubah = (fn) => {
    // Pesan lama ("Tersimpan…" / galat) tak berlaku lagi begitu ada perubahan baru.
    setPesan(null);
    setDraf((d) => {
      if (!d) return d;
      const salinan = structuredClone(d);
      fn(salinan);
      return salinan;
    });
  };

  async function simpan() {
    if (!draf) return;
    const hasil = skemaSitus.safeParse(draf);
    if (!hasil.success) {
      const m = hasil.error.issues[0];
      setPesan({ jenis: "galat", teks: `${m.message} (bagian: ${m.path.join(" › ")})` });
      return;
    }
    setSibuk(true);
    setPesan(null);
    try {
      await simpanKonten(hasil.data, sesi);
      setAsli(hasil.data);
      setDraf(structuredClone(hasil.data));
      setDariBawaan(false);
      setPesan({ jenis: "ok", teks: "Tersimpan dan sudah tayang di situs." });
    } catch (e) {
      setPesan({ jenis: "galat", teks: e instanceof Error ? e.message : "Gagal menyimpan." });
    } finally {
      setSibuk(false);
    }
  }

  if (!draf) {
    return (
      <div className="grid min-h-dvh place-items-center text-muted-foreground">
        {pesan ? <p className="text-red-400">{pesan.teks}</p> : <Loader2 className="size-6 animate-spin text-emas" />}
      </div>
    );
  }

  return (
    <div className="pb-28">
      {kepala}

      <main className="mx-auto w-full max-w-[1600px] px-4 pt-6 sm:px-6 lg:px-8">
        {dariBawaan && (
          <p className="mb-5 rounded-xl border border-emas/30 bg-emas/10 p-4 text-sm text-emas-muda">
            Database masih kosong — yang tampil adalah isi bawaan situs. Tekan <b>Simpan</b> sekali untuk memindahkannya ke database.
          </p>
        )}
        <Tabs defaultValue="umum">
          <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="umum">Umum</TabsTrigger>
            <TabsTrigger value="layanan">Layanan</TabsTrigger>
            <TabsTrigger value="produk">Produk</TabsTrigger>
            <TabsTrigger value="tentang">Proses & Tentang</TabsTrigger>
            <TabsTrigger value="kontak">Kontak</TabsTrigger>
          </TabsList>
          <TabsContent value="umum"><BagianUmum draf={draf} ubah={ubah} /></TabsContent>
          <TabsContent value="layanan"><BagianLayanan draf={draf} ubah={ubah} /></TabsContent>
          <TabsContent value="produk"><BagianProduk draf={draf} ubah={ubah} /></TabsContent>
          <TabsContent value="tentang"><BagianProsesTentang draf={draf} ubah={ubah} /></TabsContent>
          <TabsContent value="kontak"><BagianKontak draf={draf} ubah={ubah} /></TabsContent>
        </Tabs>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p role="status" className={`min-w-0 flex-1 truncate text-sm ${pesan?.jenis === "galat" ? "text-red-400" : "text-emas-muda"}`}>
            {pesan?.teks ?? (berubah ? "Ada perubahan yang belum disimpan." : "Semua perubahan sudah tersimpan.")}
          </p>
          <div className="flex shrink-0 gap-2">
            {berubah && (
              <button onClick={() => { setDraf(structuredClone(asli!)); setPesan(null); }} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                <RotateCcw className="size-4" /> Batalkan
              </button>
            )}
            <button
              onClick={simpan}
              disabled={sibuk || (!berubah && !dariBawaan)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
