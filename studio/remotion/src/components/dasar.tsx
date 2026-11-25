// Bahan bersama: huruf, pegas, tata letak, ikon. Semua adegan memakai ini supaya gaya seragam.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as jakarta } from '@remotion/google-fonts/PlusJakartaSans';
import { loadFont as serif } from '@remotion/google-fonts/InstrumentSerif';
import { loadFont as tangan } from '@remotion/google-fonts/Caveat';

export const SANS = jakarta('normal', { weights: ['500', '700', '800'], subsets: ['latin'] }).fontFamily;
export const SERIF = serif('italic', { weights: ['400'], subsets: ['latin'] }).fontFamily;
export const TANGAN = tangan('normal', { weights: ['700'], subsets: ['latin'] }).fontFamily;

export const W = 1080;
export const H = 1920;

/** Tata letak: dengan maskot, separuh bawah (40%) untuk karakter; tanpa maskot visual lebih tinggi. */
export function tataLetak(adaMaskot: boolean) {
  return adaMaskot
    ? { visualAtas: 210, visualBawah: 1000, caption: 1085, maskotAtas: H - 768 }
    : { visualAtas: 230, visualBawah: 1230, caption: 1390, maskotAtas: H };
}

/** Pegas 0→1 mulai `tunda` bingkai; redaman tinggi = tanpa memantul berlebihan (tidak kaku, tidak norak). */
export function usePegas(tunda = 0, opsi: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - tunda, fps, config: { damping: 16, stiffness: 140, mass: 0.8, ...opsi } });
}

/** Keluar halus di akhir adegan (8 bingkai terakhir). */
export function useKeluar(durasi: number) {
  const frame = useCurrentFrame();
  return interpolate(frame, [durasi - 8, durasi], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

export const bayangan = '0 30px 60px -20px rgba(15,23,42,.22), 0 8px 18px -8px rgba(15,23,42,.12)';
export const bayanganGelap = '0 24px 60px -18px rgba(0,0,0,0.65), 0 8px 20px -8px rgba(0,0,0,0.45)';

export const Kartu: React.FC<{ style?: React.CSSProperties; gelap?: boolean; children?: React.ReactNode }> = ({ style, gelap, children }) => (
  <div
    style={{
      background: gelap ? 'rgba(17,24,39,0.82)' : '#fff',
      borderRadius: 28,
      boxShadow: gelap ? bayanganGelap : bayangan,
      border: gelap ? '1.5px solid rgba(255,255,255,0.14)' : '1.5px solid #EDEDED',
      color: gelap ? '#F8FAFC' : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);

type IkonNama = 'buku' | 'toko' | 'scan' | 'lonceng' | 'grafik' | 'centang' | 'hp' | 'kotak' | 'struk' | 'panah';
const JALUR: Record<IkonNama, string> = {
  buku: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zm0 13a3 3 0 0 1 3-3h11M9 8h6M9 11h4',
  toko: 'M4 9l1.5-5h13L20 9M4 9h16M4 9v11h16V9M9 20v-6h6v6M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 9v6M10 9v6M13 9v6M16 9v6',
  lonceng: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2zM10 20a2 2 0 0 0 4 0',
  grafik: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7',
  centang: 'M5 12.5l4.5 4.5L19 7.5',
  hp: 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2',
  kotak: 'M4 8l8-4 8 4v8l-8 4-8-4V8zM4 8l8 4 8-4M12 12v8',
  struk: 'M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3zM9 8h6M9 12h6M9 16h4',
  panah: 'M5 12h14M13 6l6 6-6 6',
};

export const Ikon: React.FC<{ nama: IkonNama; ukuran?: number; warna?: string; tebal?: number }> = ({ nama, ukuran = 48, warna = 'currentColor', tebal = 2 }) => (
  <svg width={ukuran} height={ukuran} viewBox="0 0 24 24" fill="none" stroke={warna} strokeWidth={tebal} strokeLinecap="round" strokeLinejoin="round">
    <path d={JALUR[nama]} />
  </svg>
);
