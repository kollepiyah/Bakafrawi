// Adegan Alur — diagram simpul: produk di tengah tersambung garis beranimasi ke 3 kartu, penghitung
// opsional di kartu pertama (mis. stok berkurang tiap penjualan), lalu notifikasi kuning muncul.
import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { bayangan, bayanganGelap, Ikon, Kartu, SANS } from '../components/dasar';
import type { Adegan, Naskah } from '../data/script';

type P = { a: Extract<Adegan, { jenis: 'alur' }>; merek: Naskah['merek']; durasi: number; gelap?: boolean };
const IKON = ['kotak', 'lonceng', 'grafik'] as const;
// Posisi kartu relatif pusat diagram (480, 380).
const POS = [{ x: 170, y: 120 }, { x: 790, y: 120 }, { x: 480, y: 660 }];

export const Alur: React.FC<P> = ({ a, merek, durasi, gelap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (f: number) => Math.round(durasi * f);
  const pg = (m: number, o = {}) => spring({ frame: frame - m, fps, config: { damping: 15, stiffness: 150, ...o } });
  const pusat = pg(0, { damping: 12 });
  const hitung = a.hitung ? Math.round(interpolate(frame, [t(0.15), t(0.5)], [a.hitung.dari, a.hitung.ke], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })) : null;
  const notif = pg(t(0.55), { damping: 11, stiffness: 180 });
  const getar = frame > t(0.55) && frame < t(0.55) + 14 ? Math.sin(frame * 2.2) * 4 : 0;
  const warnaGaris = gelap ? merek.kedua : merek.utama;
  return (
    <div style={{ position: 'relative', width: 960, height: 780, fontFamily: SANS }}>
      <svg width="960" height="780" style={{ position: 'absolute', inset: 0 }}>
        {POS.map((p, i) => {
          const g = interpolate(frame, [t(0.06 + i * 0.07), t(0.16 + i * 0.07)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const pj = Math.hypot(p.x - 480, p.y - 380);
          return (
            <g key={i}>
              <line x1="480" y1="380" x2={p.x} y2={p.y} stroke={gelap ? 'rgba(255,255,255,0.2)' : '#D4D4D8'} strokeWidth="5" strokeDasharray="4 12" strokeLinecap="round" />
              <line x1="480" y1="380" x2={p.x} y2={p.y} stroke={warnaGaris} strokeWidth="5" strokeLinecap="round" strokeDasharray={pj} strokeDashoffset={pj * (1 - g)} />
              {/* Titik data mengalir dari pusat ke kartu */}
              {g >= 1 ? <circle r="9" fill={merek.kedua} cx={480 + (p.x - 480) * ((frame / 30 + i * 0.3) % 1)} cy={380 + (p.y - 380) * ((frame / 30 + i * 0.3) % 1)} /> : null}
            </g>
          );
        })}
      </svg>
      {/* Simpul pusat */}
      <div style={{ position: 'absolute', left: 480 - 150, top: 380 - 110, width: 300, height: 220, borderRadius: 40, background: merek.utama, boxShadow: gelap ? bayanganGelap : bayangan, border: gelap ? '2px solid rgba(255,255,255,0.2)' : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#fff', transform: `scale(${pusat})` }}>
        {merek.logo ? <Img src={staticFile(merek.logo)} style={{ width: 90, height: 90, borderRadius: 22 }} /> : null}
        <div style={{ fontWeight: 800, fontSize: 34 }}>{merek.nama}</div>
      </div>
      {a.simpul.slice(0, 3).map((s, i) => {
        const p = pg(t(0.14 + i * 0.07));
        return (
          <Kartu key={s} gelap={gelap} style={{ position: 'absolute', left: POS[i].x - 150, top: POS[i].y - 70, width: 300, height: 140, display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px', opacity: p, transform: `scale(${0.7 + 0.3 * p})` }}>
            <div style={{ width: 70, height: 70, borderRadius: 20, background: gelap ? 'rgba(255,255,255,0.1)' : '#EEF2FF', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ikon nama={IKON[i]} ukuran={42} warna={warnaGaris} /></div>
            <div style={{ fontWeight: 800, fontSize: 27, lineHeight: 1.15, color: gelap ? '#F8FAFC' : '#18181B' }}>{s}{i === 0 && a.hitung ? <div style={{ fontSize: 22, color: gelap ? '#CBD5E1' : '#71717A', fontWeight: 700 }}>{a.hitung.label}: {hitung}</div> : null}</div>
          </Kartu>
        );
      })}
      {/* Notifikasi */}
      <div style={{ position: 'absolute', left: 120, right: 120, top: -120, display: 'flex', alignItems: 'center', gap: 18, padding: '22px 28px', borderRadius: 26, background: gelap ? '#1F2937' : '#FEF3C7', border: `3px solid ${gelap ? merek.kedua : '#F59E0B'}`, boxShadow: gelap ? bayanganGelap : bayangan, opacity: notif, transform: `translateY(${(1 - notif) * -90 + getar}px) translateX(${getar}px)` }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: gelap ? merek.kedua : '#F59E0B', display: 'grid', placeItems: 'center' }}><Ikon nama="lonceng" ukuran={38} warna={gelap ? '#0A0C10' : '#fff'} /></div>
        <div style={{ fontWeight: 800, fontSize: 31, color: gelap ? '#F8FAFC' : '#78350F' }}>{a.notifikasi}</div>
      </div>
    </div>
  );
};
