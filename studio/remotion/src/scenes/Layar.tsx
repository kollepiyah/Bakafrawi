// Adegan Layar — tangkapan layar ASLI aplikasi di dalam HP: layar bergulir pelan ke bagian yang
// disorot, cincin berdenyut menandai titiknya, lalu kotak perbesaran (1,8×) melompat keluar ke kanan
// dengan label sorotan. Dipakai untuk semua produk supaya iklan menampilkan tampilan yang sungguhan.
import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { bayangan, SANS } from '../components/dasar';
import type { Adegan, Layar as LayarT, Naskah } from '../data/script';

type P = { a: Extract<Adegan, { jenis: 'layar' }>; merek: Naskah['merek']; durasi: number; layar: LayarT[] };

const HP = { x: 40, y: 0, w: 430, h: 900, tepi: 16 };
const KOTAK = { x: 470, y: 250, w: 450, h: 330, zoom: 1.8 };

/** Posisi gulir & potongan perbesaran supaya titik fokus terlihat. Murni (diuji di mesin). */
export function hitungLayar(l: { lebar: number; tinggi: number }, fx: number, fy: number) {
  const lebar = HP.w - HP.tepi * 2;
  const tinggi = HP.h - HP.tepi * 2;
  const tinggiGambar = (lebar * l.tinggi) / l.lebar;
  const gulir = Math.max(0, Math.min(tinggiGambar - tinggi, fy * tinggiGambar - tinggi * 0.45));
  const titik = { x: HP.tepi + fx * lebar, y: HP.tepi + fy * tinggiGambar - gulir };
  const lebarBesar = lebar * KOTAK.zoom;
  const tinggiBesar = tinggiGambar * KOTAK.zoom;
  const geser = {
    // Titik fokus diletakkan di 30% dari kiri kotak: teks UI rata kiri, jadi awal label/angka tak terpotong.
    x: -Math.max(0, Math.min(lebarBesar - KOTAK.w, fx * lebarBesar - KOTAK.w * 0.3)),
    y: -Math.max(0, Math.min(tinggiBesar - KOTAK.h, fy * tinggiBesar - KOTAK.h / 2)),
  };
  return { lebar, tinggi, tinggiGambar, gulir, titik, lebarBesar, tinggiBesar, geser };
}

export const Layar: React.FC<P> = ({ a, merek, durasi, layar }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = layar[((Math.trunc(a.layar) || 0) % layar.length + layar.length) % layar.length];
  if (!l) return null;
  const t = (f: number) => Math.round(durasi * f);
  const pg = (m: number, o = {}) => spring({ frame: frame - m, fps, config: { damping: 16, stiffness: 140, ...o } });
  const fx = Math.min(1, Math.max(0, a.fokus_x)), fy = Math.min(1, Math.max(0, a.fokus_y));
  const h = hitungLayar(l, fx, fy);
  const hp = pg(0, { damping: 18 });
  const gulir = interpolate(frame, [t(0.08), t(0.32)], [0, h.gulir], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 3) });
  const cincin = pg(t(0.3), { damping: 9 });
  const denyut = 1 + Math.sin(frame / 5) * 0.08;
  const kotak = pg(t(0.38), { damping: 13, stiffness: 170 });
  const label = pg(t(0.46));
  const garis = interpolate(frame, [t(0.36), t(0.44)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const src = staticFile(l.berkas);
  const titik = { x: HP.x + h.titik.x, y: HP.y + h.titik.y };
  return (
    <div style={{ position: 'relative', width: 940, height: 900, fontFamily: SANS }}>
      {/* HP */}
      <div style={{ position: 'absolute', left: HP.x, top: HP.y, width: HP.w, height: HP.h, borderRadius: 64, background: '#0B0B0F', padding: HP.tepi, boxShadow: bayangan, opacity: hp, transform: `translateY(${(1 - hp) * 120}px) rotate(${(1 - hp) * -6}deg)` }}>
        <div style={{ width: h.lebar, height: h.tinggi, borderRadius: 50, overflow: 'hidden', position: 'relative', background: '#fff' }}>
          <Img src={src} style={{ position: 'absolute', left: 0, top: -gulir, width: h.lebar, height: h.tinggiGambar }} />
        </div>
      </div>
      {/* Garis penghubung titik → kotak */}
      <svg width="940" height="900" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <line x1={titik.x} y1={titik.y} x2={KOTAK.x + 20} y2={KOTAK.y + KOTAK.h / 2} stroke={merek.kedua} strokeWidth="5" strokeLinecap="round" strokeDasharray="10 10" pathLength={1} opacity={garis} />
      </svg>
      {/* Cincin berdenyut di titik fokus */}
      <div style={{ position: 'absolute', left: titik.x - 70, top: titik.y - 70, width: 140, height: 140, borderRadius: 70, border: `6px solid ${merek.kedua}`, boxShadow: `0 0 0 10px ${merek.kedua}33`, transform: `scale(${cincin * denyut})`, opacity: cincin }} />
      {/* Kotak perbesaran */}
      <div style={{ position: 'absolute', left: KOTAK.x, top: KOTAK.y, width: KOTAK.w, height: KOTAK.h, borderRadius: 34, overflow: 'hidden', background: '#fff', border: `5px solid ${merek.kedua}`, boxShadow: bayangan, opacity: kotak, transform: `scale(${0.6 + 0.4 * kotak}) rotate(${(1 - kotak) * 6 + 1.5}deg)`, transformOrigin: 'left center' }}>
        <Img src={src} style={{ position: 'absolute', left: h.geser.x, top: h.geser.y, width: h.lebarBesar, height: h.tinggiBesar }} />
      </div>
      {/* Label sorotan */}
      {a.sorotan ? (
        <div style={{ position: 'absolute', left: KOTAK.x + 30, top: KOTAK.y - 78, background: merek.utama, color: '#fff', borderRadius: 18, padding: '14px 26px', fontWeight: 800, fontSize: 34, boxShadow: bayangan, opacity: label, transform: `translateY(${(1 - label) * 30}px) rotate(-2deg)` }}>
          {a.sorotan}
        </div>
      ) : null}
    </div>
  );
};
