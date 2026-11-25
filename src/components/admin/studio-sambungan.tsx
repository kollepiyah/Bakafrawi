"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Cpu, Loader2, Send, Trash2, Volume2 } from "lucide-react";
import { IkonSosial } from "@/components/situs/ikon-sosial";

type AkunMerek = {
  merek: string;
  nama: string;
  aktif: boolean;
  akun: { akun: string; kedaluwarsa: string | null; host: string } | null;
  tiktok: { akun: string; kedaluwarsa: string | null } | null;
};
type SuaraFavorit = {
  id: string;
  nama: string;
  catatan?: string;
};
type StatusPenyediaAi = {
  claudeDimatikan: boolean;
  daftar: { nama: string; aktif: boolean; gratis: boolean; peran: string }[];
};
type Status = {
  siap: boolean;
  pesan?: string;
  instagram: AkunMerek[];
  tiktokSiap: boolean;
  suaraFavorit?: SuaraFavorit[];
  penyediaAi?: StatusPenyediaAi;
  telegram: { bot: boolean; terdaftar: boolean; webhook: { url: string; galat?: string } | null };
};

/** Kotak sambungan Instagram (per merek), Telegram, & daftar Voice ID favorit ElevenLabs. Token tak pernah dibaca balik. */
export function Sambungan({ sesi, onSuaraBerubah }: { sesi: Session | null; onSuaraBerubah?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [token, setToken] = useState("");
  const [idIg, setIdIg] = useState("");
  const [merek, setMerek] = useState("bakafrawi");
  const [namaSuara, setNamaSuara] = useState("");
  const [voiceIdBaru, setVoiceIdBaru] = useState("");
  const [catatanSuara, setCatatanSuara] = useState("");
  const kepala = { Authorization: `Bearer ${sesi?.access_token ?? ""}`, "Content-Type": "application/json" };

  const muat = useCallback(async () => {
    const res = await fetch("/api/studio/sambungan", { headers: { Authorization: `Bearer ${sesi?.access_token ?? ""}` } });
    if (res.ok) setStatus(await res.json());
  }, [sesi]);

  useEffect(() => {
    const t = setTimeout(muat, 0);
    return () => clearTimeout(t);
  }, [muat]);

  async function kirim(isi: Record<string, unknown>, opsi?: { segarkanSuara?: boolean }) {
    setSibuk(true);
    setPesan("");
    const res = await fetch("/api/studio/sambungan", { method: "POST", headers: kepala, body: JSON.stringify(isi) });
    const j = await res.json().catch(() => ({}));
    if (j.ok && j.url) return void window.location.assign(j.url); // izin TikTok: pindah ke halaman TikTok
    setPesan(j.pesan ?? (j.ok ? "Tersimpan." : "Gagal."));
    if (j.ok) {
      setToken("");
      if (opsi?.segarkanSuara) {
        setNamaSuara("");
        setVoiceIdBaru("");
        setCatatanSuara("");
        onSuaraBerubah?.();
      }
    }
    setSibuk(false);
    muat();
  }

  if (!status) return null;
  const tg = status.telegram;
  const webhookKeSini = Boolean(tg?.webhook?.url?.endsWith("/api/telegram"));
  const daftarIg = status.instagram ?? [];
  const daftarSuara = status.suaraFavorit ?? [];
  const igUtama = daftarIg.find((m) => m.merek === "bakafrawi")?.akun;
  const dipilih = daftarIg.find((m) => m.merek === merek);
  const tanggal = (s: string | null) => (s ? new Date(s).toLocaleDateString("id-ID", { dateStyle: "medium" }) : null);

  return (
    <details className="mb-8 rounded-2xl border border-border bg-card p-5 sm:p-6" open={!igUtama || !tg?.terdaftar || daftarSuara.length > 0}>
      <summary className="cursor-pointer font-heading text-lg">
        Sambungan{" "}
        <span className="font-sans text-sm text-muted-foreground">
          · Instagram {daftarIg.filter((m) => m.akun).length}/{daftarIg.length} merek · Telegram {tg?.terdaftar ? "✅" : "belum"}
          {daftarSuara.length > 0 ? ` · Suara ${daftarSuara.length}` : ""}
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

          <section className="grid gap-3 text-sm">
            <h3 className="flex items-center gap-2 font-semibold"><Volume2 className="size-4 text-emas" /> Suara Favorit ElevenLabs</h3>
            <p className="text-xs text-redup">
              Simpan beberapa Voice ID favorit agar bisa dipilih langsung di <b>Buat Konten AI</b> atau dirotasi otomatis saat pilih <b>Otomatis</b>.{" "}
              (<code>ELEVENLABS_API_KEY</code> tetap disimpan aman di GitHub Secrets, bukan di sini.)
            </p>
            {daftarSuara.length > 0 ? (
              <ul className="grid gap-1.5">
                {daftarSuara.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <b className="text-foreground">{s.nama}</b>{" "}
                      <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-emas-muda">{s.id}</code>
                      {s.catatan && <span className="ml-2 text-muted-foreground">· {s.catatan}</span>}
                    </div>
                    <button
                      type="button"
                      disabled={sibuk}
                      onClick={() => kirim({ hapusSuaraId: s.id }, { segarkanSuara: true })}
                      className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 disabled:opacity-50"
                      title="Hapus suara favorit"
                    >
                      <Trash2 className="size-3.5" /> Hapus
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Belum ada suara favorit tersimpan. Tambahkan Voice ID di bawah.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-[160px_1fr_1fr_auto]">
              <input
                value={namaSuara}
                onChange={(e) => setNamaSuara(e.target.value)}
                placeholder="Mis. Narator Hangat"
                className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
              />
              <input
                value={voiceIdBaru}
                onChange={(e) => setVoiceIdBaru(e.target.value)}
                placeholder="Voice ID ElevenLabs (mis. EXAVITQu4vr4...)"
                autoComplete="off"
                className="h-10 rounded-lg border border-input bg-transparent px-3 font-mono text-xs"
              />
              <input
                value={catatanSuara}
                onChange={(e) => setCatatanSuara(e.target.value)}
                placeholder="Catatan (opsional, mis. promo/Jawa)"
                className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
              />
              <button
                type="button"
                disabled={!voiceIdBaru.trim() || sibuk}
                onClick={() => kirim({ tambahSuara: { nama: namaSuara, id: voiceIdBaru, catatan: catatanSuara } }, { segarkanSuara: true })}
                className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {sibuk ? <Loader2 className="size-4 animate-spin" /> : "Tambah Suara"}
              </button>
            </div>
          </section>

          {status.penyediaAi && (
            <section className="grid gap-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Cpu className="size-4 text-emas" /> Urutan Penyedia AI Naskah (Hemat Biaya)
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    status.penyediaAi.claudeDimatikan
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {status.penyediaAi.claudeDimatikan
                    ? "Claude Studio Nonaktif (STUDIO_TANPA_CLAUDE=1)"
                    : "Claude sebagai cadangan terakhir (Haiku)"}
                </span>
              </div>
              <p className="text-xs text-redup">
                Studio mencoba AI gratis lebih dulu secara berurutan (<code>Groq → NVIDIA → Gemini → OpenRouter → Cloudflare → Claude</code>).
                Untuk hemat 100% saldo Claude di Studio, isi <code>GROQ_API_KEY</code> atau <code>OPENROUTER_API_KEY</code> dan set{" "}
                <code>STUDIO_TANPA_CLAUDE=1</code> di Vercel &amp; GitHub Secrets.
              </p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {status.penyediaAi.daftar.map((item, idx) => (
                  <li
                    key={item.nama}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold uppercase text-foreground">
                          {idx + 1}. {item.nama}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            item.gratis ? "bg-teal-500/15 text-teal-300" : "bg-white/10 text-zinc-300"
                          }`}
                        >
                          {item.gratis ? "Gratis" : "Berbayar"}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{item.peran}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        item.aktif
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/5 text-muted-foreground"
                      }`}
                    >
                      {item.aktif
                        ? "Siap"
                        : item.nama === "claude" && status.penyediaAi?.claudeDimatikan
                        ? "Dimatikan"
                        : "Belum diisi"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {pesan && <p className="text-sm text-emas-muda">{pesan}</p>}
        </div>
      )}
    </details>
  );
}
