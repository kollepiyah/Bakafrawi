// Adegan Layar — tangkapan layar ASLI aplikasi di dalam HP: layar bergulir pelan ke bagian yang
// disorot, bingkai sorot menandai satu baris di HP, lalu kotak perbesaran melompat keluar ke kanan
// berisi BARIS YANG SAMA SELEBAR LAYAR (UI HP tersusun kartu selebar layar; potongan mendatar dari
// titik fokus Claude yang hanya perkiraan sempat memotong judul "Laporan & Grafik", 19 Nov 2026).
import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { bayangan, SANS } from '../components/dasar';
import type { Adegan, Layar as LayarT, Naskah } from '../data/script';

type P = { a: Extract<Adegan, { jenis: 'layar' }>; merek: Naskah['merek']; durasi: number; layar: LayarT[] };

const HP = { x: 30, y: 0, w: 430, h: 900, tepi: 16 };
const KOTAK = { x: 360, w: 570, h: 300 };
const POSISI_FOKUS = 0.42; // titik fokus diletakkan sedikit di atas tengah pita (judul kartu + isinya)

/** Gulir HP, pita yang diperbesar, dan letak kotak supaya titik fokus terlihat. Murni. */
export function hitungLayar(l: { lebar: number; tinggi: number }, fy: number) {
  const lebar = HP.w - HP.tepi * 2;
  const tinggi = HP.h - HP.tepi * 2;
  const tinggiGambar = (lebar * l.tinggi) / l.lebar;
  const gulir = Math.max(0, Math.min(tinggiGambar - tinggi, fy * tinggiGambar - tinggi * 0.45));
  const zoom = KOTAK.w / lebar;
  const tinggiPita = KOTAK.h / zoom; // tinggi pita di HP yang tampil di kotak
  const atasPita = Math.max(0, Math.min(tinggiGambar - tinggiPita, fy * tinggiGambar - tinggiPita * POSISI_FOKUS));
  const pita = { y: HP.y + HP.tepi + atasPita - gulir, h: tinggiPita }; // dalam koordinat adegan
  const kotakY = Math.max(110, Math.min(HP.h - KOTAK.h, pita.y + pita.h / 2 - KOTAK.h / 2));
  return { lebar, tinggi, tinggiGambar, gulir, zoom, atasPita, pita, kotakY };
}

export const Layar: React.FC<P> = ({ a, merek, durasi, layar }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = layar[((Math.trunc(a.layar) || 0) % layar.length + layar.length) % layar.length];
  if (!l) return null;
  const t = (f: number) => Math.round(durasi * f);
  const pg = (m: number, o = {}) => spring({ frame: frame - m, fps, config: { damping: 16, stiffness: 140, ...o } });
  const fy = Math.min(1, Math.max(0, a.fokus_y));
  const h = hitungLayar(l, fy);
  const hp = pg(0, { damping: 18 });
  const gulirKini = interpolate(frame, [t(0.08), t(0.32)], [0, h.gulir], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 3) });
  const sorot = pg(t(0.3), { damping: 14 });
  const kotak = pg(t(0.38), { damping: 13, stiffness: 170 });
  const label = pg(t(0.46));
  const garis = interpolate(frame, [t(0.36), t(0.44)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const src = staticFile(l.berkas);
  // Bingkai sorot mengikuti gulir yang sedang berjalan (tiba di tempatnya saat gulir selesai).
  const pitaY = h.pita.y + (h.gulir - gulirKini);
  const kiriPita = HP.x + HP.tepi, kananPita = HP.x + HP.w - HP.tepi;
  return (
    <div style={{ position: 'relative', width: 940, height: 900, fontFamily: SANS, perspective: 1600 }}>
      {/* HP Bezel Titanium Modern + Dynamic Island */}
      <div style={{ position: 'absolute', left: HP.x, top: HP.y, width: HP.w, height: HP.h, borderRadius: 64, background: 'linear-gradient(145deg, #334155 0%, #0B0E14 52%, #1E293B 100%)', border: '2px solid rgba(255,255,255,0.22)', padding: HP.tepi, boxShadow: `${bayangan}, 0 0 42px ${merek.kedua}22`, opacity: hp, transform: `translateY(${(1 - hp) * 110}px) rotateY(${(1 - hp) * -10 + 4}deg) rotate(${(1 - hp) * -5}deg)` }}>
        <div style={{ width: h.lebar, height: h.tinggi, borderRadius: 50, overflow: 'hidden', position: 'relative', background: '#0B0F17' }}>
          <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', width: 108, height: 26, borderRadius: 99, background: '#05070B', zIndex: 15 }} />
          <Img src={src} style={{ position: 'absolute', left: 0, top: -gulirKini, width: h.lebar, height: h.tinggiGambar }} />
        </div>
      </div>
      {/* Bingkai sorot bercahaya */}
      <div style={{ position: 'absolute', left: kiriPita - 6, top: pitaY - 6, width: kananPita - kiriPita + 12, height: h.pita.h + 12, borderRadius: 22, border: `4px solid ${merek.kedua}`, boxShadow: `0 0 28px ${merek.kedua}88`, opacity: sorot, transform: `scale(${1.06 - 0.06 * sorot})` }} />
      {/* Garis penghubung halus */}
      <svg width="940" height="900" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <line x1={kananPita + 6} y1={pitaY + h.pita.h / 2} x2={KOTAK.x + 10} y2={h.kotakY + KOTAK.h / 2} stroke={merek.kedua} strokeWidth="4" strokeLinecap="round" opacity={garis * 0.85} />
        <circle cx={kananPita + 6} cy={pitaY + h.pita.h / 2} r="7" fill={merek.kedua} opacity={garis} />
      </svg>
      {/* Kotak perbesaran Glassmorphism */}
      <div style={{ position: 'absolute', left: KOTAK.x, top: h.kotakY, width: KOTAK.w, height: KOTAK.h, borderRadius: 30, overflow: 'hidden', background: '#0B0F17', border: `4px solid ${merek.kedua}`, boxShadow: `${bayangan}, 0 0 42px ${merek.kedua}44`, opacity: kotak, transform: `scale(${0.66 + 0.34 * kotak}) rotate(${(1 - kotak) * 5 + 1}deg)`, transformOrigin: 'left center' }}>
        <Img src={src} style={{ position: 'absolute', left: 0, top: -h.atasPita * h.zoom, width: KOTAK.w, height: h.tinggiGambar * h.zoom }} />
      </div>
      {/* Label sorotan */}
      {a.sorotan ? (
        <div style={{ position: 'absolute', left: KOTAK.x + 24, top: h.kotakY - 76, background: `linear-gradient(120deg, ${merek.utama} 0%, ${merek.kedua} 100%)`, color: '#061014', borderRadius: 18, padding: '12px 26px', fontWeight: 900, fontSize: 32, boxShadow: `0 16px 36px ${merek.kedua}55`, opacity: label, transform: `translateY(${(1 - label) * 28}px) rotate(-1.5deg)` }}>
          ✦ {a.sorotan}
        </div>
      ) : null}
    </div>
  );
};
