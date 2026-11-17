"use client";

import { useState } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { AKSI_REKAM, KATEGORI, NAMA_AKSI, NAMA_KATEGORI, type Gambar, type Produk, type Situs, type Tautan } from "@/content/skema";
import { Kartu } from "./bagian-editor";
import { DaftarObjek, Kolom, KolomDaftar, KolomGambar, Pilihan, Saklar } from "./kolom";
import type { Ubah } from "./editor";

const produkBaru = (): Produk => ({
  slug: `produk-${Date.now().toString(36)}`,
  nama: "Produk baru",
  kategori: "pesanan",
  label: "",
  judul: "",
  deskripsi: "",
  platform: [],
  fitur: [],
  tautan: [],
  tampil: false,
});

export function BagianProduk({ draf, ubah }: { draf: Situs; ubah: Ubah }) {
  const [buka, setBuka] = useState<string | null>(null);
  const setProduk = (i: number, p: Produk) => ubah((d) => void (d.produk[i] = p));

  return (
    <Kartu judul="Produk & karya">
      <p className="text-sm text-muted-foreground">
        Produk <b>SaaS</b> dan <b>Aplikasi Bakafrawi</b> tampil di bagian “Aplikasi siap pakai”; <b>Karya pesanan</b> tampil di bagian “Dibangun khusus untuk klien”. Matikan
        “Tampil di situs” untuk menyembunyikan tanpa menghapus.
      </p>
      <DaftarObjek
        judul="Daftar produk"
        items={draf.produk}
        onChange={(v) => ubah((d) => void (d.produk = v))}
        buatBaru={produkBaru}
        namaButir={(p) => `${p.nama} · ${NAMA_KATEGORI[p.kategori]}${p.tampil ? "" : " · disembunyikan"}`}
        render={(p, set, i) => (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold">
                {p.tampil ? <Eye className="size-4 text-green-400" /> : <EyeOff className="size-4 text-redup" />} {p.nama}
              </div>
              <Saklar label="Tampil di situs" value={p.tampil} onChange={(v) => set({ ...p, tampil: v })} />
            </div>
            <button type="button" onClick={() => setBuka(buka === p.slug ? null : p.slug)} className="inline-flex w-fit items-center gap-1 text-sm text-emas">
              {buka === p.slug ? "Tutup rincian" : "Edit rincian"} <ChevronDown className={`size-4 transition ${buka === p.slug ? "rotate-180" : ""}`} />
            </button>
            {buka === p.slug && <RincianProduk p={p} set={(v) => setProduk(i, v)} />}
          </>
        )}
      />
    </Kartu>
  );
}

function RincianProduk({ p, set }: { p: Produk; set: (v: Produk) => void }) {
  const gambarHp = (g?: Gambar[]) => g ?? [];
  return (
    <div className="grid gap-4 border-t border-border pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Kolom label="Nama" value={p.nama} onChange={(v) => set({ ...p, nama: v })} />
        <Pilihan label="Kategori" value={p.kategori} pilihan={KATEGORI.map((k) => ({ nilai: k, label: NAMA_KATEGORI[k] }))} onChange={(v) => set({ ...p, kategori: v })} />
      </div>
      <Kolom label="Label kecil (lencana)" value={p.label} onChange={(v) => set({ ...p, label: v })} petunjuk="Mis. SaaS · Kasir & Stok untuk UMKM" />
      <Kolom label="Judul" value={p.judul} onChange={(v) => set({ ...p, judul: v })} />
      <Kolom label="Deskripsi" baris={3} value={p.deskripsi} onChange={(v) => set({ ...p, deskripsi: v })} />
      {p.kategori === "pesanan" && <Kolom label="Klien / lembaga pemilik" value={p.klien} onChange={(v) => set({ ...p, klien: v || undefined })} />}
      {p.kategori === "saas" && p.slug === "maktaba-pos" && (
        <Saklar label="Tampilkan tabel harga (dibaca dari database Maktaba)" value={Boolean(p.tampilHarga)} onChange={(v) => set({ ...p, tampilHarga: v })} />
      )}
      <KolomDaftar label="Platform" value={p.platform} onChange={(v) => set({ ...p, platform: v })} petunjuk="Mis. Web, Android, Desktop — satu per baris." />
      <KolomGambar label="Logo" value={p.logo} onChange={(v) => set({ ...p, logo: v })} />
      <DaftarObjek
        judul="Fitur unggulan"
        items={p.fitur}
        onChange={(v) => set({ ...p, fitur: v })}
        buatBaru={() => ({ judul: "", isi: "" })}
        namaButir={(f) => f.judul || "Fitur baru"}
        render={(f, setF) => (
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <Kolom label="Judul" value={f.judul} onChange={(v) => setF({ ...f, judul: v })} />
            <Kolom label="Penjelasan" value={f.isi} onChange={(v) => setF({ ...f, isi: v })} />
          </div>
        )}
      />
      <DaftarObjek
        judul="Tombol tautan"
        items={p.tautan}
        onChange={(v) => set({ ...p, tautan: v })}
        buatBaru={(): Tautan => ({ label: "", url: "" })}
        namaButir={(t) => t.label || "Tautan baru"}
        render={(t, setT) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Kolom label="Tulisan tombol" value={t.label} onChange={(v) => setT({ ...t, label: v })} />
              <Kolom label="Alamat (https://…)" value={t.url} onChange={(v) => setT({ ...t, url: v })} />
            </div>
            <Saklar label="Tombol utama (emas)" value={Boolean(t.utama)} onChange={(v) => setT({ ...t, utama: v })} />
          </>
        )}
      />
      <SkenarioRekam p={p} set={set} />
      <DaftarObjek
        judul="Tangkapan layar desktop (lebar)"
        items={gambarHp(p.layarDesktop)}
        onChange={(v) => set({ ...p, layarDesktop: v })}
        buatBaru={(): Gambar => ({ src: "", alt: "", lebar: 1600, tinggi: 900 })}
        namaButir={(g) => g.keterangan || "Gambar"}
        render={(g, setG) => (
          <>
            <KolomGambar label="Gambar" value={g.src ? g : undefined} onChange={(v) => setG(v ?? { ...g, src: "" })} />
            <Kolom label="Keterangan di bawah gambar" value={g.keterangan} onChange={(v) => setG({ ...g, keterangan: v || undefined })} />
          </>
        )}
      />
      <DaftarObjek
        judul="Tangkapan layar HP (tegak)"
        items={gambarHp(p.layarHp)}
        onChange={(v) => set({ ...p, layarHp: v })}
        buatBaru={(): Gambar => ({ src: "", alt: "", lebar: 540, tinggi: 1140 })}
        namaButir={(g) => g.keterangan || "Gambar"}
        render={(g, setG) => (
          <>
            <KolomGambar label="Gambar" value={g.src ? g : undefined} onChange={(v) => setG(v ?? { ...g, src: "" })} />
            <Kolom label="Keterangan" value={g.keterangan} onChange={(v) => setG({ ...g, keterangan: v || undefined })} />
          </>
        )}
      />
    </div>
  );
}

type Langkah = NonNullable<Produk["demo"]>["langkah"][number];

/** Langkah yang dijalankan robot Studio saat merekam layar aplikasi untuk video promosi. */
function SkenarioRekam({ p, set }: { p: Produk; set: (v: Produk) => void }) {
  const demo = p.demo ?? { url: "", langkah: [] };
  const setDemo = (d: NonNullable<Produk["demo"]>) => set({ ...p, demo: d.url || d.langkah.length ? d : undefined });
  return (
    <div className="grid gap-3 rounded-xl border border-emas/20 bg-emas/[.04] p-4">
      <div className="text-sm font-semibold">Skenario rekaman video (Studio AI)</div>
      <p className="text-xs text-redup">
        Robot membuka alamat ini di layar HP lalu menjalankan langkahnya sambil merekam. Pakai akun demo berisi data rekaan. Kata sandi jangan diketik di sini —
        tulis <code>{"{{RAHASIA:NAMA}}"}</code> lalu isi rahasia <code>DEMO_NAMA</code> di GitHub. Kosong = buka tombol tautan utama lalu gulir pelan.
      </p>
      <Kolom label="Alamat awal (https://…)" value={demo.url} onChange={(v) => setDemo({ ...demo, url: v })} />
      <DaftarObjek
        judul="Langkah"
        items={demo.langkah}
        onChange={(v) => setDemo({ ...demo, langkah: v })}
        buatBaru={(): Langkah => ({ aksi: "klik", target: "", detik: 2 })}
        namaButir={(l, i) => `${i + 1}. ${NAMA_AKSI[l.aksi]} ${l.target ?? ""}`}
        render={(l, setL) => (
          <>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr_110px]">
              <Pilihan label="Aksi" value={l.aksi} pilihan={AKSI_REKAM.map((a) => ({ nilai: a, label: NAMA_AKSI[a] }))} onChange={(v) => setL({ ...l, aksi: v })} />
              <Kolom
                label={l.aksi === "buka" ? "Alamat" : l.aksi === "ketik" ? "Kolom (selektor CSS)" : "Target"}
                value={l.target}
                onChange={(v) => setL({ ...l, target: v || undefined })}
                petunjuk={l.aksi === "klik" ? "Tulisan yang terlihat di tombol/menu, atau selektor CSS (#id, .kelas)." : undefined}
              />
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Jeda (detik)</span>
                <input
                  type="number"
                  min={0}
                  max={15}
                  step={0.5}
                  value={l.detik ?? 2}
                  onChange={(e) => setL({ ...l, detik: Number(e.target.value) })}
                  className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
                />
              </label>
            </div>
            {(l.aksi === "ketik" || l.aksi === "gulir") && (
              <Kolom
                label={l.aksi === "ketik" ? "Teks yang diketik" : "Jarak gulir (piksel)"}
                value={l.teks}
                onChange={(v) => setL({ ...l, teks: v || undefined })}
                petunjuk={l.aksi === "ketik" ? "Untuk kata sandi: {{RAHASIA:WASEELA_SANDI}}" : "Mis. 600"}
              />
            )}
          </>
        )}
      />
    </div>
  );
}
