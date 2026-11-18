"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2, Send } from "lucide-react";
import { IkonSosial } from "@/components/situs/ikon-sosial";

type AkunMerek = {
  merek: string;
  nama: string;
  aktif: boolean;
  akun: { akun: string; kedaluwarsa: string | null; host: string } | null;
  tiktok: { akun: string; kedaluwarsa: string | null } | null;
};
type Status = {
  siap: boolean;
  pesan?: string;
  instagram: AkunMerek[];
  tiktokSiap: boolean;
  telegram: { bot: boolean; terdaftar: boolean; webhook: { url: string; galat?: string } | null };
};

/** Kotak sambungan Instagram (per merek) & Telegram di Studio. Token hanya dikirim ke server, tak pernah dibaca balik. */
export function Sambungan({ sesi }: { sesi: Session | null }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [token, setToken] = useState("");
  const [idIg, setIdIg] = useState("");
  const [merek, setMerek] = useState("bakafrawi");
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
    if (j.ok && j.url) return void window.location.assign(j.url); // izin TikTok: pindah ke halaman TikTok
    setPesan(j.pesan ?? (j.ok ? "Tersimpan." : "Gagal."));
    if (j.ok) setToken("");
    setSibuk(false);
    muat();
  }

  if (!status) return null;
  const tg = status.telegram;
  const webhookKeSini = Boolean(tg?.webhook?.url?.endsWith("/api/telegram"));
  const daftarIg = status.instagram ?? [];
  const igUtama = daftarIg.find((m) => m.merek === "bakafrawi")?.akun;
  const dipilih = daftarIg.find((m) => m.merek === merek);
  const tanggal = (s: string | null) => (s ? new Date(s).toLocaleDateString("id-ID", { dateStyle: "medium" }) : null);

  return (
    <details className="mb-8 rounded-2xl border border-border bg-card p-5 sm:p-6" open={!igUtama || !tg?.terdaftar}>
      <summary className="cursor-pointer font-heading text-lg">
        Sambungan{" "}
        <span className="font-sans text-sm text-muted-foreground">
          · Instagram {daftarIg.filter((m) => m.akun).length}/{daftarIg.length} merek · Telegram {tg?.terdaftar ? "✅" : "belum"}
        </span>
      </summary>
      {!status.siap ? (
        <p className="mt-4 text-sm text-amber-300">{status.pesan}</p>
      ) : (
        <div className="mt-5 grid gap-6">
          <section className="grid gap-3">
            <h3 className="flex items-center gap-2 font-semibold"><IkonSosial jenis="instagram" className="size-4 text-emas" /> Instagram & TikTok per merek</h3>
            <ul className="grid gap-1.5 text-sm text-muted-foreground">
              {daftarIg.map((m) => (
                <li key={m.merek}>
                  <b className="text-foreground">{m.nama}</b>
                  {m.merek !== "bakafrawi" && (
                    <button
                      onClick={() => confirm(`${m.aktif ? "Nonaktifkan" : "Aktifkan"} merek ${m.nama} di Studio?`) && kirim({ merek: m.merek, aktif: !m.aktif })}
                      className="ml-1.5 rounded-full border border-white/15 px-2 py-0.5 text-xs hover:border-emas hover:text-emas"
                    >
                      {m.aktif ? "aktif · nonaktifkan" : "belum aktif · aktifkan"}
                    </button>
                  )}:{" "}
                  {m.akun ? (
                    <>
                      ✅ {m.akun.akun}
                      {tanggal(m.akun.kedaluwarsa) && ` · token sampai ${tanggal(m.akun.kedaluwarsa)}`}{" "}
                      <button onClick={() => confirm(`Putus Instagram ${m.nama}?`) && kirim({ merek: m.merek, putusIg: true })} className="text-red-400 underline">Putus</button>
                    </>
                  ) : (
                    "IG belum tersambung"
                  )}
                  {status.tiktokSiap && (
                    <span className="ml-2">
                      · TikTok:{" "}
                      {m.tiktok ? (
                        <>
                          ✅ {m.tiktok.akun}{" "}
                          <button onClick={() => confirm(`Putus TikTok ${m.nama}?`) && kirim({ merek: m.merek, putusTiktok: true })} className="text-red-400 underline">Putus</button>
                        </>
                      ) : (
                        <button onClick={() => kirim({ merek: m.merek, mulaiTiktok: true })} className="text-emas underline">Sambungkan</button>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-redup">Tempel token akses Instagram dari dasbor Meta (lihat PANDUAN-STUDIO.md). Token baru menggantikan yang lama.</p>
            <div className="grid gap-2 sm:grid-cols-[150px_1fr_180px_auto]">
              <select value={merek} onChange={(e) => setMerek(e.target.value)} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm">
                {daftarIg.map((m) => <option key={m.merek} value={m.merek} className="bg-card">{m.nama}</option>)}
              </select>
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={dipilih?.akun ? "Token baru (untuk mengganti)" : "Token akses Instagram"} autoComplete="off" className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm" />
              <input value={idIg} onChange={(e) => setIdIg(e.target.value)} placeholder="ID akun IG (opsional)" className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm" />
              <button disabled={!token || sibuk} onClick={() => kirim({ merek, igToken: token, igId: idIg })} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
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
