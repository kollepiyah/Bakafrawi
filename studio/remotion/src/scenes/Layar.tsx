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
    <div style={{ position: 'relative', width: 940, height: 900, fontFamily: SANS }}>
      {/* HP */}
      <div style={{ position: 'absolute', left: HP.x, top: HP.y, width: HP.w, height: HP.h, borderRadius: 64, background: '#0B0B0F', padding: HP.tepi, boxShadow: bayangan, opacity: hp, transform: `translateY(${(1 - hp) * 120}px) rotate(${(1 - hp) * -6}deg)` }}>
        <div style={{ width: h.lebar, height: h.tinggi, borderRadius: 50, overflow: 'hidden', position: 'relative', background: '#fff' }}>
          <Img src={src} style={{ position: 'absolute', left: 0, top: -gulirKini, width: h.lebar, height: h.tinggiGambar }} />
        </div>
      </div>
      {/* Bingkai sorot: baris yang akan diperbesar, selebar layar HP */}
      <div style={{ position: 'absolute', left: kiriPita - 6, top: pitaY - 6, width: kananPita - kiriPita + 12, height: h.pita.h + 12, borderRadius: 22, border: `5px solid ${merek.kedua}`, boxShadow: `0 0 24px ${merek.kedua}66`, opacity: sorot, transform: `scale(${1.08 - 0.08 * sorot})` }} />
      {/* Garis penghubung bingkai → kotak */}
      <svg width="940" height="900" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <line x1={kananPita + 6} y1={pitaY + h.pita.h / 2} x2={KOTAK.x + 10} y2={h.kotakY + KOTAK.h / 2} stroke={merek.kedua} strokeWidth="5" strokeLinecap="round" strokeDasharray="10 10" opacity={garis} />
      </svg>
      {/* Kotak perbesaran: pita yang sama, selebar layar penuh */}
      <div style={{ position: 'absolute', left: KOTAK.x, top: h.kotakY, width: KOTAK.w, height: KOTAK.h, borderRadius: 30, overflow: 'hidden', background: '#fff', border: `5px solid ${merek.kedua}`, boxShadow: bayangan, opacity: kotak, transform: `scale(${0.6 + 0.4 * kotak}) rotate(${(1 - kotak) * 6 + 1.5}deg)`, transformOrigin: 'left center' }}>
        <Img src={src} style={{ position: 'absolute', left: 0, top: -h.atasPita * h.zoom, width: KOTAK.w, height: h.tinggiGambar * h.zoom }} />
      </div>
      {/* Label sorotan */}
      {a.sorotan ? (
        <div style={{ position: 'absolute', left: KOTAK.x + 30, top: h.kotakY - 78, background: merek.utama, color: '#fff', borderRadius: 18, padding: '14px 26px', fontWeight: 800, fontSize: 34, boxShadow: bayangan, opacity: label, transform: `translateY(${(1 - label) * 30}px) rotate(-2deg)` }}>
          {a.sorotan}
        </div>
      ) : null}
    </div>
  );
};
