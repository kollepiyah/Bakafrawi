"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SUBJEK = "Permintaan Konsultasi — bakafrawi.com";
// Kunci Web3Forms boleh publik (memang dikirim dari browser); kosong → otomatis jatuh ke WhatsApp.
const KUNCI = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "";

export function FormKontak({ whatsappNomor }: { whatsappNomor: string }) {
  const [status, setStatus] = useState("");
  const [kirim, setKirim] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const keWhatsapp = () => {
      const teks = `Halo Bakafrawi, saya ${d.nama}.\n\n${d.pesan}\n\nEmail: ${d.email}${d.wa ? `\nWA: ${d.wa}` : ""}`;
      window.open(`https://wa.me/${whatsappNomor}?text=${encodeURIComponent(teks)}`, "_blank", "noopener");
      setStatus("Membuka WhatsApp…");
    };
    if (!KUNCI) return keWhatsapp();
    setKirim(true);
    setStatus("Mengirim…");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ access_key: KUNCI, subject: SUBJEK, from_name: "Website bakafrawi.com", name: d.nama, email: d.email, whatsapp: d.wa, message: d.pesan, botcheck: d.botcheck }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message);
      form.reset();
      setStatus("Terima kasih! Pesan Anda terkirim. Kami akan membalas secepatnya.");
    } catch {
      keWhatsapp();
    } finally {
      setKirim(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative mx-auto grid max-w-xl gap-4 text-left">
      <input type="checkbox" name="botcheck" className="hidden" tabIndex={-1} autoComplete="off" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="f-nama" className="text-xs text-redup">Nama</Label>
          <Input id="f-nama" name="nama" required placeholder="Nama Anda" className="h-11 rounded-xl" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="f-wa" className="text-xs text-redup">WhatsApp (opsional)</Label>
          <Input id="f-wa" name="wa" inputMode="tel" placeholder="08xx xxxx xxxx" className="h-11 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="f-email" className="text-xs text-redup">Email</Label>
        <Input id="f-email" name="email" type="email" required placeholder="email@anda.com" className="h-11 rounded-xl" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="f-pesan" className="text-xs text-redup">Kebutuhan Anda</Label>
        <Textarea id="f-pesan" name="pesan" required rows={5} placeholder="Ceritakan singkat website, aplikasi, atau sistem yang Anda butuhkan…" className="rounded-xl" />
      </div>
      <button
        type="submit"
        disabled={kirim}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:bg-emas-muda disabled:opacity-60"
      >
        Kirim Pesan <Send className="size-4" />
      </button>
      <p role="status" aria-live="polite" className="min-h-5 text-center text-sm text-emas-muda">
        {status}
      </p>
    </form>
  );
}
