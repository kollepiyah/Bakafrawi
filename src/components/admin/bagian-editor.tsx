"use client";

import type { ReactNode } from "react";
import { IKON_LAYANAN, JENIS_SOSIAL, nomorWaInternasional, type Situs } from "@/content/skema";
import { namaSosial } from "@/components/situs/ikon-sosial";
import { DaftarObjek, Kolom, KolomDaftar, Pilihan } from "./kolom";
import type { Ubah } from "./editor";

type Props = { draf: Situs; ubah: Ubah };

export function Kartu({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="mb-4 font-heading text-lg">{judul}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

const NAMA_IKON: Record<(typeof IKON_LAYANAN)[number], string> = { web: "Website", aplikasi: "Aplikasi", lembaga: "Lembaga", saas: "SaaS / roket" };

export function BagianUmum({ draf, ubah }: Props) {
  return (
    <>
      <Kartu judul="Identitas">
        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label="Nama situs" value={draf.nama} onChange={(v) => ubah((d) => void (d.nama = v))} />
          <Kolom label="Tagline" value={draf.tagline} onChange={(v) => ubah((d) => void (d.tagline = v))} />
        </div>
        <Kolom label="Deskripsi (untuk Google & pratinjau saat dibagikan)" baris={3} value={draf.deskripsi} onChange={(v) => ubah((d) => void (d.deskripsi = v))} />
        <Kolom label="Status (lencana hijau di atas)" value={draf.statusProyek} onChange={(v) => ubah((d) => void (d.statusProyek = v))} petunjuk="Mis. Menerima proyek baru" />
      </Kartu>
      <Kartu judul="Bagian pembuka (hero)">
        <Kolom label="Label kecil" value={draf.hero.label} onChange={(v) => ubah((d) => void (d.hero.label = v))} />
        <Kolom label="Judul besar" value={draf.hero.judul} onChange={(v) => ubah((d) => void (d.hero.judul = v))} />
        <KolomDaftar label="Kata emas di akhir judul" value={draf.hero.sorot} onChange={(v) => ubah((d) => void (d.hero.sorot = v))} petunjuk="Satu kata per baris; ditampilkan miring berwarna emas." />
        <Kolom label="Paragraf pembuka" baris={3} value={draf.hero.isi} onChange={(v) => ubah((d) => void (d.hero.isi = v))} />
      </Kartu>
      <Kartu judul="Angka statistik">
        <DaftarObjek
          judul="Statistik"
          items={draf.statistik}
          onChange={(v) => ubah((d) => void (d.statistik = v))}
          buatBaru={() => ({ angka: "", label: "" })}
          namaButir={(s) => `${s.angka} ${s.label}`}
          render={(s, set) => (
            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <Kolom label="Angka" value={s.angka} onChange={(v) => set({ ...s, angka: v })} />
              <Kolom label="Keterangan" value={s.label} onChange={(v) => set({ ...s, label: v })} />
            </div>
          )}
        />
      </Kartu>
    </>
  );
}

export function BagianLayanan({ draf, ubah }: Props) {
  return (
    <Kartu judul="Layanan">
      <DaftarObjek
        judul="Daftar layanan"
        items={draf.layanan}
        onChange={(v) => ubah((d) => void (d.layanan = v))}
        buatBaru={(): Situs["layanan"][number] => ({ ikon: "aplikasi", judul: "", isi: "", tag: [] })}
        namaButir={(l) => l.judul || "Layanan baru"}
        render={(l, set) => (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <Kolom label="Judul" value={l.judul} onChange={(v) => set({ ...l, judul: v })} />
              <Pilihan label="Ikon" value={l.ikon} pilihan={IKON_LAYANAN.map((i) => ({ nilai: i, label: NAMA_IKON[i] }))} onChange={(v) => set({ ...l, ikon: v })} />
            </div>
            <Kolom label="Penjelasan" baris={2} value={l.isi} onChange={(v) => set({ ...l, isi: v })} />
            <KolomDaftar label="Label kecil (tag)" value={l.tag} onChange={(v) => set({ ...l, tag: v })} />
          </>
        )}
      />
    </Kartu>
  );
}

export function BagianProsesTentang({ draf, ubah }: Props) {
  return (
    <>
      <Kartu judul="Cara kami bekerja">
        <DaftarObjek
          judul="Langkah"
          items={draf.proses}
          onChange={(v) => ubah((d) => void (d.proses = v))}
          buatBaru={() => ({ judul: "", isi: "" })}
          namaButir={(p, i) => `${String(i + 1).padStart(2, "0")} ${p.judul}`}
          render={(p, set) => (
            <>
              <Kolom label="Judul" value={p.judul} onChange={(v) => set({ ...p, judul: v })} />
              <Kolom label="Penjelasan" value={p.isi} onChange={(v) => set({ ...p, isi: v })} />
            </>
          )}
        />
      </Kartu>
      <Kartu judul="Tentang">
        <Kolom label="Judul" value={draf.tentang.judul} onChange={(v) => ubah((d) => void (d.tentang.judul = v))} />
        <Kolom
          label="Isi"
          baris={7}
          value={draf.tentang.paragraf.join("\n\n")}
          onChange={(v) => ubah((d) => void (d.tentang.paragraf = v.split(/\n\s*\n/)))}
          petunjuk="Pisahkan paragraf dengan satu baris kosong."
        />
        <DaftarObjek
          judul="Kotak 'Sekilas' (email, WA, dan status ditambahkan otomatis)"
          items={draf.tentang.fakta}
          onChange={(v) => ubah((d) => void (d.tentang.fakta = v))}
          buatBaru={() => ({ label: "", isi: "" })}
          namaButir={(f) => f.label || "Baris baru"}
          render={(f, set) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Kolom label="Label" value={f.label} onChange={(v) => set({ ...f, label: v })} />
              <Kolom label="Isi" value={f.isi} onChange={(v) => set({ ...f, isi: v })} />
            </div>
          )}
        />
      </Kartu>
    </>
  );
}

export function BagianKontak({ draf, ubah }: Props) {
  return (
    <>
      <Kartu judul="Kontak">
        <div className="grid gap-4 sm:grid-cols-2">
          <Kolom label="Email" value={draf.kontak.email} onChange={(v) => ubah((d) => void (d.kontak.email = v))} />
          <Kolom
            label="Nomor WhatsApp"
            value={draf.kontak.whatsappTampil}
            onChange={(v) => ubah((d) => {
              d.kontak.whatsappTampil = v;
              d.kontak.whatsappNomor = nomorWaInternasional(v);
            })}
            petunjuk={`Tautan chat: wa.me/${draf.kontak.whatsappNomor}`}
          />
        </div>
        <Kolom label="Lokasi" value={draf.kontak.lokasi} onChange={(v) => ubah((d) => void (d.kontak.lokasi = v))} />
      </Kartu>
      <Kartu judul="Media sosial">
        <DaftarObjek
          judul="Akun"
          items={draf.kontak.sosial}
          onChange={(v) => ubah((d) => void (d.kontak.sosial = v))}
          buatBaru={(): Situs["kontak"]["sosial"][number] => ({ jenis: "instagram", url: "" })}
          namaButir={(s) => namaSosial[s.jenis]}
          render={(s, set) => (
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <Pilihan label="Jenis" value={s.jenis} pilihan={JENIS_SOSIAL.map((j) => ({ nilai: j, label: namaSosial[j] }))} onChange={(v) => set({ ...s, jenis: v })} />
              <Kolom label="Alamat (https://…)" value={s.url} onChange={(v) => set({ ...s, url: v })} />
            </div>
          )}
        />
      </Kartu>
      <Kartu judul="Analitik">
        <Kolom label="Google Analytics ID" value={draf.analitik.gaId} onChange={(v) => ubah((d) => void (d.analitik.gaId = v))} petunjuk="Mis. G-XXXXXXX; kosongkan untuk mematikan." />
      </Kartu>
    </>
  );
}
