"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { ExternalLink, Loader2, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jalurGudang, supabase } from "@/lib/gudang-admin";
import { Editor } from "./editor";
import { Studio } from "./studio";

type Status = "memuat" | "keluar" | "bukan-admin" | "admin";

export function AplikasiAdmin() {
  const [status, setStatus] = useState<Status>(jalurGudang === "lokal" ? "admin" : "memuat");
  const [sesi, setSesi] = useState<Session | null>(null);
  const [halaman, setHalaman] = useState<"konten" | "studio">("konten");

  useEffect(() => {
    if (jalurGudang !== "supabase") return;
    const sb = supabase();
    const periksa = async (s: Session | null) => {
      setSesi(s);
      if (!s) return setStatus("keluar");
      const { data } = await sb.rpc("is_admin");
      setStatus(data === true ? "admin" : "bukan-admin");
    };
    sb.auth.getSession().then(({ data }) => periksa(data.session));
    const { data: langganan } = sb.auth.onAuthStateChange((_e, s) => {
      // Token yang diperbarui otomatis tak perlu memeriksa ulang status admin.
      if (_e === "TOKEN_REFRESHED") setSesi(s);
      else if (_e === "SIGNED_IN" || _e === "SIGNED_OUT") periksa(s);
    });
    return () => langganan.subscription.unsubscribe();
  }, []);

  if (jalurGudang === "tidak-ada") {
    return (
      <Layar>
        <h1 className="font-heading text-2xl">Panel admin belum tersambung</h1>
        <p className="text-muted-foreground">
          Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di pengaturan Vercel, lalu deploy ulang.
        </p>
      </Layar>
    );
  }
  if (status === "memuat") return <Layar><Loader2 className="mx-auto size-6 animate-spin text-emas" /></Layar>;
  if (status === "keluar") return <FormMasuk />;
  if (status === "bukan-admin") {
    return (
      <Layar>
        <h1 className="font-heading text-2xl">Akun ini bukan admin</h1>
        <p className="text-muted-foreground">Masuk sebagai {sesi?.user.email}, tetapi belum terdaftar di tabel admin.</p>
        <button onClick={() => supabase().auth.signOut()} className="text-sm text-emas underline">Keluar</button>
      </Layar>
    );
  }
  const kepala = (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4">
        <nav className="flex items-center gap-1">
          {(["konten", "studio"] as const).map((h) => (
            <button
              key={h}
              onClick={() => setHalaman(h)}
              className={`rounded-full px-3.5 py-1.5 text-sm ${halaman === h ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {h === "konten" ? "Konten" : "Studio AI"}
            </button>
          ))}
          <a href="/" target="_blank" className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emas">
            Lihat situs <ExternalLink className="size-3" />
          </a>
        </nav>
        {jalurGudang === "supabase" ? (
          <button onClick={() => supabase().auth.signOut()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="size-4" /> <span className="hidden sm:inline">Keluar</span>
          </button>
        ) : (
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">Mode uji lokal</span>
        )}
      </div>
    </header>
  );
  // Editor tetap terpasang saat pindah ke Studio supaya draf yang belum disimpan tidak hilang.
  return (
    <>
      <div hidden={halaman !== "konten"}><Editor sesi={sesi} kepala={kepala} /></div>
      {halaman === "studio" && <Studio sesi={sesi} kepala={kepala} />}
    </>
  );
}

function Layar({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm space-y-4 text-center">{children}</div>
    </main>
  );
}

function FormMasuk() {
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function masuk(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setSibuk(true);
    setPesan("");
    const { error } = await supabase().auth.signInWithPassword({ email: String(d.get("email")), password: String(d.get("sandi")) });
    setSibuk(false);
    if (error) setPesan(error.message === "Invalid login credentials" ? "Email atau kata sandi salah." : error.message);
  }

  async function lupa(e: React.MouseEvent<HTMLButtonElement>) {
    const email = (e.currentTarget.form?.elements.namedItem("email") as HTMLInputElement | null)?.value;
    if (!email) return setPesan("Isi email dulu, lalu klik Lupa kata sandi.");
    const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/admin/sandi` });
    setPesan(error ? error.message : "Tautan atur ulang kata sandi sudah dikirim ke email.");
  }

  return (
    <Layar>
      <h1 className="font-heading text-3xl">Admin Bakafrawi</h1>
      <form onSubmit={masuk} className="space-y-4 text-left">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="username" className="h-11" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sandi">Kata sandi</Label>
          <Input id="sandi" name="sandi" type="password" required autoComplete="current-password" className="h-11" />
        </div>
        <button disabled={sibuk} className="h-11 w-full rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-60">
          {sibuk ? "Masuk…" : "Masuk"}
        </button>
        <button type="button" onClick={lupa} className="w-full text-center text-sm text-muted-foreground hover:text-emas">
          Lupa kata sandi?
        </button>
        {pesan && <p role="alert" className="text-center text-sm text-emas-muda">{pesan}</p>}
      </form>
    </Layar>
  );
}
