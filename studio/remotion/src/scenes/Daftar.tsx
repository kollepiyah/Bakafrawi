// Adegan Daftar — kartu angka besar yang menghitung naik (bila berupa angka), grafik batang tumbuh,
// garis tren tergambar, lalu daftar centang muncul berurutan.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Ikon, Kartu, SANS } from '../components/dasar';
import type { Adegan, Naskah } from '../data/script';

type P = { a: Extract<Adegan, { jenis: 'daftar' }>; merek: Naskah['merek']; durasi: number; gelap?: boolean };
const BATANG = [0.35, 0.5, 0.42, 0.62, 0.55, 0.78, 0.95];
const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

export const Daftar: React.FC<P> = ({ a, merek, durasi, gelap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (f: number) => Math.round(durasi * f);
  const pg = (m: number, o = {}) => spring({ frame: frame - m, fps, config: { damping: 15, stiffness: 150, ...o } });
  const kartu = pg(0, { damping: 18 });
  // Angka berawalan Rp dihitung naik; teks lain (mis. "1.248 santri") tampil apa adanya.
  const target = /^Rp\s?[\d.]+$/.test(a.angka.trim()) ? Number(a.angka.replace(/\D/g, '')) : null;
  const hitung = interpolate(frame, [t(0.04), t(0.32)], [0, target ?? 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 3) });
  const tren = interpolate(frame, [t(0.2), t(0.4)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titik = BATANG.map((b, i) => `${40 + i * 120},${300 - b * 260}`).join(' ');
  const warnaGaris = gelap ? merek.kedua : merek.utama;
  return (
    <div style={{ width: 940, display: 'flex', flexDirection: 'column', gap: 30, fontFamily: SANS }}>
      <Kartu gelap={gelap} style={{ padding: 34, opacity: kartu, transform: `translateY(${(1 - kartu) * 80}px)` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 28, color: gelap ? '#94A3B8' : '#71717A' }}>{a.labelAngka}</div>
            <div style={{ fontWeight: 800, fontSize: 72, letterSpacing: -2, color: warnaGaris }}>{target === null ? a.angka : rupiah(hitung)}</div>
          </div>
          {a.catatan ? <div style={{ background: gelap ? 'rgba(16,185,129,0.2)' : '#DCFCE7', color: gelap ? '#6EE7B7' : '#166534', borderRadius: 999, padding: '10px 20px', fontWeight: 800, fontSize: 26, opacity: tren }}>{a.catatan}</div> : null}
        </div>
        <svg width="872" height="320" viewBox="0 0 800 320" style={{ marginTop: 12 }}>
          {BATANG.map((b, i) => {
            const p = pg(t(0.08 + i * 0.03));
            const h = b * 260 * p;
            return <rect key={i} x={10 + i * 120} y={300 - h} width="60" height={h} rx="12" fill={i === BATANG.length - 1 ? merek.kedua : gelap ? 'rgba(255,255,255,0.16)' : '#E0E7FF'} />;
          })}
          <polyline points={titik} fill="none" stroke={warnaGaris} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - tren} />
        </svg>
      </Kartu>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {a.daftar.slice(0, 3).map((d, i) => {
          const p = pg(t(0.42 + i * 0.12));
          const c = interpolate(frame, [t(0.42 + i * 0.12) + 4, t(0.42 + i * 0.12) + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <Kartu key={d} gelap={gelap} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '22px 28px', opacity: p, transform: `translateX(${(1 - p) * -120}px)` }}>
              <div style={{ width: 54, height: 54, borderRadius: 16, background: c > 0 ? '#16A34A' : (gelap ? 'rgba(255,255,255,0.14)' : '#E4E4E7'), display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <svg width="34" height="34" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - c} /></svg>
              </div>
              <div style={{ fontWeight: 800, fontSize: 33, color: gelap ? '#F8FAFC' : '#18181B' }}>{d}</div>
              {i === 2 ? <div style={{ marginLeft: 'auto' }}><Ikon nama="hp" ukuran={44} warna={warnaGaris} /></div> : null}
            </Kartu>
          );
        })}
      </div>
    </div>
  );
};
