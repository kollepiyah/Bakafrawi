// Adegan Penutup — lingkaran warna utama melebar memenuhi layar, judul putih tebal, tombol CTA
// mengambang (naik-turun pelan) dan info kontak.
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { SANS, SERIF, usePegas } from '../components/dasar';
import type { Adegan, Naskah } from '../data/script';

type P = { a: Extract<Adegan, { jenis: 'penutup' }>; merek: Naskah['merek']; atas: number };

export const Penutup: React.FC<P> = ({ a, merek, atas }) => {
  const frame = useCurrentFrame();
  const r = interpolate(frame, [0, 16], [0, 2300], { extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 3) });
  const logo = usePegas(10, { damping: 12 }), judul = usePegas(16), tombol = usePegas(26, { damping: 11 }), info = usePegas(34);
  const apung = Math.sin(frame / 12) * 10;
  const [kata1, ...sisa] = a.judul.split(' ');
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 540 - r, top: 900 - r, width: r * 2, height: r * 2, borderRadius: '50%', background: merek.utama }} />
      <div style={{ position: 'absolute', left: 80, right: 80, top: atas, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 46, textAlign: 'center', fontFamily: SANS, color: '#fff' }}>
        {merek.logo ? <Img src={staticFile(merek.logo)} style={{ width: 170, height: 170, borderRadius: 42, transform: `scale(${logo}) rotate(${(1 - logo) * -20}deg)` }} /> : null}
        <div style={{ fontWeight: 800, fontSize: 104, lineHeight: 1.02, letterSpacing: -3, opacity: judul, transform: `translateY(${(1 - judul) * 50}px)` }}>
          {kata1} <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, color: merek.kedua, fontSize: 116 }}>{sisa.join(' ')}</span>
        </div>
        <div style={{ background: merek.kedua, color: '#141008', borderRadius: 999, padding: '34px 64px', fontWeight: 800, fontSize: 46, boxShadow: '0 30px 60px -18px rgba(0,0,0,.5)', transform: `translateY(${apung}px) scale(${tombol})` }}>
          {a.tombol} →
        </div>
        <div style={{ fontWeight: 700, fontSize: 34, opacity: info * 0.85 }}>{a.info}</div>
      </div>
    </AbsoluteFill>
  );
};
