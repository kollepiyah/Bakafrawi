"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2, Send } from "lucide-react";
import { IkonSosial } from "@/components/situs/ikon-sosial";

type Status = {
  siap: boolean;
  pesan?: string;
  instagram: { akun: string; kedaluwarsa: string | null; host: string } | null;
  telegram: { bot: boolean; terdaftar: boolean; webhook: { url: string; galat?: string } | null };
};

/** Kotak sambungan Instagram & Telegram di Studio. Token hanya dikirim ke server, tak pernah dibaca balik. */
export function Sambungan({ sesi }: { sesi: Session | null }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [token, setToken] = useState("");
  const [idIg, setIdIg] = useState("");
  const kepala = { Authorization: `Bearer ${sesi?.access_token ?? ""}`, "Content-Type": "application/json" };

  const muat = useCallback(async () => {
    const res = await fetch("/api/studio/sambungan", { headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}` } });
    if (res.ok) setStatus(await res.json());
  }, [sesi]);

  useEffect(() => {
    const t = setTimeout(muat, 0);
    return () => clearTimeout(t);
  }, [muat]);

  async function kirim(isi: Record<string, unknown>) {
    setSibuk(true);
    setPesan("");
    const res = await fetch("/api/studio/sambungan", { method: "POST", headers: kepala, body: JSON.stringify(isi) });
    const j = await res.json().catch(() => ({}));
    setPesan(j.pesan ?? (j.ok ? "Tersimpan." : "Gagal."));
    if (j.ok) setToken("");
    setSibuk(false);
    muat();
  }

  if (!status) return null;
  const tg = status.telegram;
  const webhookKeSini = Boolean(tg?.webhook?.url?.endsWith("/api/telegram"));
  const berlaku = status.instagram?.kedaluwarsa ? new Date(status.instagram.kedaluwarsa).toLocaleDateString("id-ID", { dateStyle: "medium" }) : null;

  return (
    <details className="mb-8 rounded-2xl border border-border bg-card p-5 sm:p-6" open={!status.instagram || !tg?.terdaftar}>
      <summary className="cursor-pointer font-heading text-lg">
        Sambungan{" "}
        <span className="font-sans text-sm text-muted-foreground">
          · Instagram {status.instagram ? `✅ ${status.instagram.akun}` : "belum"} · Telegram {tg?.terdaftar ? "✅" : "belum"}
        </span>
      </summary>
      {!status.siap ? (
        <p className="mt-4 text-sm text-amber-300">{status.pesan}</p>
      ) : (
        <div className="mt-5 grid gap-6">
          <section className="grid gap-3">
            <h3 className="flex items-center gap-2 font-semibold"><IkonSosial jenis="instagram" className="size-4 text-emas" /> Instagram</h3>
            {status.instagram ? (
              <p className="text-sm text-muted-foreground">
                Tersambung ke <b className="text-foreground">{status.instagram.akun}</b>
                {berlaku && ` · token berlaku sampai ${berlaku} (diperpanjang otomatis bila memungkinkan)`}.{" "}
                <button onClick={() => confirm("Putus sambungan Instagram?") && kirim({ putusIg: true })} className="text-red-400 underline">Putus</button>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Belum tersambung. Tempel token akses Instagram dari dasbor Meta (lihat PANDUAN-STUDIO.md).</p>
            )}
            <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={status.instagram ? "Token baru (untuk mengganti)" : "Token akses Instagram"} autoComplete="off" className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm" />
              <input value={idIg} onChange={(e) => setIdIg(e.target.value)} placeholder="ID akun IG (opsional)" className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm" />
              <button disabled={!token || sibuk} onClick={() => kirim({ igToken: token, igId: idIg })} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {sibuk ? <Loader2 className="size-4 animate-spin" /> : "Sambungkan"}
              </button>
            </div>
          </section>

          <section className="grid gap-2 text-sm">
            <h3 className="flex items-center gap-2 font-semibold"><Send className="size-4 text-emas" /> Bot Telegram</h3>
            {!tg?.bot ? (
              <p className="text-amber-300">Isi TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, dan TELEGRAM_KODE_DAFTAR di Vercel lalu deploy ulang.</p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  Webhook: {webhookKeSini ? "✅ tersambung ke situs ini" : "belum tersambung"}
                  {tg.webhook?.galat && <span className="text-red-400"> · galat terakhir: {tg.webhook.galat}</span>}
                </p>
                {!webhookKeSini && (
                  <button disabled={sibuk} onClick={() => kirim({ pasangWebhook: true })} className="w-fit rounded-full border border-white/15 px-4 py-1.5 hover:border-emas hover:text-emas">
                    Sambungkan webhook bot
                  </button>
                )}
                <p className="text-muted-foreground">
                  Pemilik: {tg.terdaftar ? "✅ terdaftar" : <>belum — kirim <code>/start KODE-DAFTAR</code> ke bot dari Telegram kyai.</>}
                </p>
              </>
            )}
          </section>
          {pesan && <p className="text-sm text-emas-muda">{pesan}</p>}
        </div>
      )}
    </details>
  );
}
