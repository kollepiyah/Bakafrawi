"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Gambar } from "@/content/skema";
import { unggahGambar } from "@/lib/gudang-admin";

// Bahan formulir panel admin. Semua terkendali (value + onChange) supaya editor memegang satu draf.

export function Kolom({ label, value, onChange, petunjuk, baris }: { label: string; value: string | undefined; onChange: (v: string) => void; petunjuk?: string; baris?: number }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {baris ? (
        <Textarea rows={baris} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-10" />
      )}
      {petunjuk && <span className="text-xs text-redup">{petunjuk}</span>}
    </label>
  );
}

/** Daftar teks pendek: satu baris = satu butir. */
export function KolomDaftar({ label, value, onChange, petunjuk }: { label: string; value: string[]; onChange: (v: string[]) => void; petunjuk?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Textarea
        rows={Math.max(2, value.length + 1)}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        onBlur={() => onChange(value.map((v) => v.trim()).filter(Boolean))}
      />
      <span className="text-xs text-redup">{petunjuk ?? "Satu baris untuk satu butir."}</span>
    </label>
  );
}

export function Saklar({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <Switch checked={value} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

export function Pilihan<T extends string>({ label, value, pilihan, onChange }: { label: string; value: T; pilihan: { nilai: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm">
        {pilihan.map((p) => (
          <option key={p.nilai} value={p.nilai} className="bg-card">
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Daftar objek yang bisa ditambah, dihapus, dan diurutkan. */
export function DaftarObjek<T>({ judul, items, onChange, buatBaru, render, namaButir }: {
  judul: string;
  items: T[];
  onChange: (v: T[]) => void;
  buatBaru: () => T;
  render: (item: T, ubah: (v: T) => void, i: number) => ReactNode;
  namaButir?: (item: T, i: number) => string;
}) {
  const pindah = (i: number, arah: -1 | 1) => {
    const j = i + arah;
    if (j < 0 || j >= items.length) return;
    const baru = [...items];
    [baru[i], baru[j]] = [baru[j], baru[i]];
    onChange(baru);
  };
  return (
    <div className="grid gap-3">
      <div className="text-sm font-semibold">{judul}</div>
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-border bg-white/[.02] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="truncate text-xs text-redup">{namaButir ? namaButir(item, i) : `#${i + 1}`}</span>
            <div className="flex shrink-0 gap-1">
              <TombolIkon label="Naikkan" onClick={() => pindah(i, -1)} disabled={i === 0}><ArrowUp className="size-4" /></TombolIkon>
              <TombolIkon label="Turunkan" onClick={() => pindah(i, 1)} disabled={i === items.length - 1}><ArrowDown className="size-4" /></TombolIkon>
              <TombolIkon
                label="Hapus"
                onClick={() => confirm(`Hapus ${namaButir ? namaButir(item, i) : "butir ini"}?`) && onChange(items.filter((_, k) => k !== i))}
              >
                <Trash2 className="size-4 text-red-400" />
              </TombolIkon>
            </div>
          </div>
          <div className="grid gap-3">{render(item, (v) => onChange(items.map((x, k) => (k === i ? v : x))), i)}</div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, buatBaru()])} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-white/20 px-4 py-2 text-sm text-muted-foreground hover:border-emas hover:text-emas">
        <Plus className="size-4" /> Tambah
      </button>
    </div>
  );
}

function TombolIkon({ label, children, ...rest }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} className="rounded-md p-1.5 hover:bg-white/10 disabled:opacity-30" {...rest}>
      {children}
    </button>
  );
}

export function KolomGambar({ label, value, onChange, petunjuk }: { label: string; value: Gambar | undefined; onChange: (v: Gambar | undefined) => void; petunjuk?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  async function pilih(berkas: File | undefined) {
    if (!berkas) return;
    setSibuk(true);
    setGalat("");
    try {
      const hasil = await unggahGambar(berkas);
      onChange({ alt: value?.alt ?? "", keterangan: value?.keterangan, ...hasil });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal mengunggah.");
    } finally {
      setSibuk(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-start gap-3">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-black/30">
          {value?.src ? (
            <Image src={value.src} alt="" width={value.lebar} height={value.tinggi} className="max-h-24 w-auto object-contain" unoptimized />
          ) : (
            <ImagePlus className="size-6 text-redup" />
          )}
        </div>
        <div className="grid flex-1 gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => input.current?.click()} disabled={sibuk} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs hover:border-emas hover:text-emas">
              {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />} {value?.src ? "Ganti" : "Unggah"}
            </button>
            {value?.src && (
              <button type="button" onClick={() => onChange(undefined)} className="rounded-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                Hapus
              </button>
            )}
          </div>
          {value?.src && <Input value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} placeholder="Teks alternatif (untuk SEO & pembaca layar)" className="h-9 text-xs" />}
          {galat && <span className="text-xs text-red-400">{galat}</span>}
          {petunjuk && <span className="text-xs text-redup">{petunjuk}</span>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => pilih(e.target.files?.[0])} />
    </div>
  );
}
