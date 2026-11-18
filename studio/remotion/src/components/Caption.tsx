// Caption kinetik kata-per-kata: waktu tiap kata dari edge-tts (bukan dibagi rata), tampil 1 frasa
// (≤ 3 kata) sekaligus; tiap kata muncul dengan pegas tepat saat diucapkan. Kata kunci diberi
// stabilo warna kedua dan huruf warna utama.
import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Kata } from '../data/script';
import { SANS, W } from './dasar';

const pokok = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Frasa ≤ maks kata; tanda baca memotong; dibagi rata supaya tak ada kata yatim. Murni. */
export function frasa(kata: Kata[], maks = 3): Kata[][] {
  const potong: Kata[][] = [];
  let f: Kata[] = [];
  for (const k of kata) {
    f.push(k);
    if (/[.,!?]$/.test(k.teks)) { potong.push(f); f = []; }
  }
  if (f.length) potong.push(f);
  return potong.flatMap((p) => {
    const n = Math.ceil(p.length / maks);
    const hasil: Kata[][] = [];
    let i = 0;
    for (let j = 0; j < n; j++) {
      const u = Math.floor(p.length / n) + (j < p.length % n ? 1 : 0);
      hasil.push(p.slice(i, i + u));
      i += u;
    }
    return hasil;
  });
}

export const Caption: React.FC<{ kata: Kata[]; mulaiDetik: number; kunci: string[]; y: number; utama: string; kedua: string; tinta: string; terang?: boolean }> = ({ kata, mulaiDetik, kunci, y, utama, kedua, tinta, terang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - mulaiDetik;
  const daftar = frasa(kata);
  const kini = daftar.findLast((p) => t >= p[0].mulai - 0.05);
  if (!kini) return null;
  const iKini = daftar.indexOf(kini);
  const akhir = daftar[iKini + 1]?.[0].mulai ?? kini.at(-1)!.selesai + 0.6;
  if (t > akhir) return null;
  const set = new Set(kunci.flatMap((k) => k.split(/\s+/)).map(pokok));
  return (
    <div style={{ position: 'absolute', left: 90, width: W - 180, top: y, transform: 'translateY(-50%)', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 22px', fontFamily: SANS, fontWeight: 800, fontSize: 84, lineHeight: 1.12, letterSpacing: -1.5 }}>
      {kini.map((k, i) => {
        const p = spring({ frame: frame - Math.round((mulaiDetik + k.mulai) * fps), fps, config: { damping: 14, stiffness: 220, mass: 0.6 } });
        const sorot = set.has(pokok(k.teks));
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-block', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 26}px) scale(${0.85 + 0.15 * p})`, color: sorot ? (terang ? kedua : utama) : terang ? '#fff' : tinta }}>
            {sorot && !terang ? (
              // Stabilo: sapuan warna kedua di belakang setengah bawah kata, melebar dari kiri.
              <span style={{ position: 'absolute', left: -8, right: -8, bottom: 6, height: '42%', background: kedua, opacity: 0.55, borderRadius: 8, transformOrigin: 'left', transform: `scaleX(${p})`, zIndex: -1 }} />
            ) : null}
            {k.teks.replace(/[.,!;:]$/, '')}
          </span>
        );
      })}
    </div>
  );
};
