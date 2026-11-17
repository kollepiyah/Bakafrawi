"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/gudang-admin";

// Tujuan tautan "Lupa kata sandi": supabase-js membaca token pemulihan dari URL secara otomatis.
export default function AturSandi() {
  const [pesan, setPesan] = useState("");

  async function simpan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const sandi = String(new FormData(e.currentTarget).get("sandi"));
    if (sandi.length < 10) return setPesan("Kata sandi minimal 10 karakter.");
    const { error } = await supabase().auth.updateUser({ password: sandi });
    setPesan(error ? error.message : "Kata sandi diperbarui. Silakan kembali ke /admin.");
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={simpan} className="w-full max-w-sm space-y-4">
        <h1 className="font-heading text-2xl">Atur kata sandi baru</h1>
        <Input name="sandi" type="password" autoComplete="new-password" placeholder="Kata sandi baru" className="h-11" />
        <button className="h-11 w-full rounded-full bg-primary font-semibold text-primary-foreground">Simpan</button>
        {pesan && <p className="text-sm text-emas-muda">{pesan}</p>}
        <a href="/admin" className="block text-sm text-muted-foreground underline">Kembali ke admin</a>
      </form>
    </main>
  );
}
