// Adegan 1 — judul besar (kata tekanan serif miring warna utama) + diagram "manual → rapi".
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Ikon, Kartu, SANS, SERIF, usePegas } from '../components/dasar';
import type { Adegan, Naskah } from '../data/script';

type P = { a: Extract<Adegan, { jenis: 'hook' }>; merek: Naskah['merek'] };

export const Hook: React.FC<P> = ({ a, merek }) => {
  const frame = useCurrentFrame();
  const j1 = usePegas(2), j2 = usePegas(9), k1 = usePegas(22), k2 = usePegas(40);
  const garis = interpolate(frame, [30, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stabilo = interpolate(frame, [16, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const kartu = (p: number, ikon: 'buku' | 'toko', teks: string, warna: string, latar: string, coret: boolean) => (
    <Kartu style={{ width: 330, padding: '34px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, opacity: p, transform: `translateY(${(1 - p) * 60}px) scale(${0.9 + 0.1 * p})` }}>
      <div style={{ width: 120, height: 120, borderRadius: 32, background: latar, display: 'grid', placeItems: 'center', position: 'relative' }}>
        <Ikon nama={ikon} ukuran={70} warna={warna} tebal={1.8} />
        {coret ? <div style={{ position: 'absolute', width: 130, height: 8, borderRadius: 4, background: '#EF4444', transform: 'rotate(-35deg)' }} /> : null}
      </div>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 32, textAlign: 'center', color: '#27272A', lineHeight: 1.2 }}>{teks}</div>
    </Kartu>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 70 }}>
      <div style={{ textAlign: 'center', color: merek.tinta }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 124, letterSpacing: -4, lineHeight: 1, opacity: j1, transform: `translateY(${(1 - j1) * 50}px)` }}>{a.judul}</div>
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: 920, marginTop: 14, fontFamily: SERIF, fontStyle: 'italic', fontSize: 120, lineHeight: 1.02, color: merek.utama, opacity: j2, transform: `translateY(${(1 - j2) * 50}px)` }}>
          <span style={{ position: 'absolute', left: -10, right: -10, bottom: 18, height: 34, background: merek.kedua, opacity: 0.6, borderRadius: 10, transform: `scaleX(${stabilo})`, transformOrigin: 'left', zIndex: -1 }} />
          {a.tekan}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
        {kartu(k1, 'buku', a.dari, '#B91C1C', '#FEE2E2', true)}
        <svg width="130" height="60" viewBox="0 0 130 60">
          <path d="M8 30 H112" stroke={merek.utama} strokeWidth="7" strokeLinecap="round" fill="none" strokeDasharray="104" strokeDashoffset={104 * (1 - garis)} />
          <path d="M96 12 L118 30 L96 48" stroke={merek.utama} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={garis > 0.9 ? 1 : 0} />
        </svg>
        {kartu(k2, 'toko', a.ke, '#047857', '#D1FAE5', false)}
      </div>
    </div>
  );
};
