// Adegan 1 — pembuka gaya karosel IG yang ramai (#claudecode, Nov 2026): label pil hitam + nomor
// halaman, judul kapital raksasa bertumpuk dengan satu frasa di kotak warna miring, sub kalimat,
// coretan tangan berpanah, dua ikon bertegel putih "dari → ke".
import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { bayangan, Ikon, SANS, TANGAN, usePegas } from '../components/dasar';
import type { Adegan, Naskah } from '../data/script';

type P = { a: Extract<Adegan, { jenis: 'hook' }>; merek: Naskah['merek']; jumlah: number };

/** Judul dipecah per kata; kata-kata yang termasuk `tekan` disatukan jadi satu kotak warna. Murni. */
export function pecahJudul(judul: string, tekan: string) {
  const i = tekan ? judul.toLowerCase().indexOf(tekan.toLowerCase()) : -1;
  const kata = (s: string) => s.split(/\s+/).filter(Boolean).map((t) => ({ teks: t, tekan: false }));
  if (i < 0) return kata(judul);
  return [...kata(judul.slice(0, i)), { teks: judul.slice(i, i + tekan.length), tekan: true }, ...kata(judul.slice(i + tekan.length))];
}

export const Hook: React.FC<P> = ({ a, merek, jumlah }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const potong = pecahJudul(a.judul, a.tekan);
  const label = usePegas(0), sub = usePegas(10 + potong.length * 2), tegel1 = usePegas(18), tegel2 = usePegas(26), coret = usePegas(34);
  const panah = interpolate(frame, [22, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tegel = (p: number, isi: React.ReactNode, teks: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, opacity: p, transform: `translateY(${(1 - p) * 50}px) scale(${0.85 + 0.15 * p})` }}>
      <div style={{ width: 150, height: 150, borderRadius: 40, background: '#fff', boxShadow: bayangan, border: '1.5px solid #EDEDED', display: 'grid', placeItems: 'center' }}>{isi}</div>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, color: '#52525B' }}>{teks}</div>
    </div>
  );
  return (
    <div style={{ width: 900, display: 'flex', flexDirection: 'column', fontFamily: SANS, color: merek.tinta }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: label, transform: `translateY(${(1 - label) * -20}px)` }}>
        <div style={{ background: merek.tinta, color: '#fff', borderRadius: 10, padding: '10px 20px', fontWeight: 800, fontSize: 24, letterSpacing: 2.5, textTransform: 'uppercase' }}>⚠ {a.label}</div>
        <div style={{ border: '2.5px solid #A1A1AA', borderRadius: 999, padding: '6px 18px', fontWeight: 700, fontSize: 22, color: '#52525B', fontVariantNumeric: 'tabular-nums' }}>01 / {String(jumlah).padStart(2, '0')}</div>
      </div>
      {/* Judul: tiap kata/kotak muncul bergiliran dengan pegas, baris dibungkus otomatis. */}
      <div style={{ marginTop: 34, display: 'flex', flexWrap: 'wrap', gap: '0 26px', fontWeight: 800, fontSize: 112, lineHeight: 0.95, letterSpacing: -4, textTransform: 'uppercase' }}>
        {potong.map((k, i) => {
          const p = spring({ frame: frame - 4 - i * 2, fps, config: { damping: 14, stiffness: 180 } });
          return k.tekan ? (
            <span key={i} style={{ display: 'inline-block', background: merek.utama, color: '#fff', borderRadius: 22, padding: '6px 22px 12px', margin: '8px 0', boxShadow: `0 18px 40px -16px ${merek.utama}`, opacity: p, transform: `rotate(${-2.5 * p}deg) scale(${0.7 + 0.3 * p})` }}>{k.teks}</span>
          ) : (
            <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>{k.teks}</span>
          );
        })}
      </div>
      <div style={{ marginTop: 30, fontWeight: 500, fontSize: 36, color: '#3F3F46', opacity: sub }}>{a.sub}</div>
      <div style={{ position: 'relative', marginTop: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36 }}>
        {tegel(tegel1, <Ikon nama="buku" ukuran={92} warna="#B91C1C" tebal={1.6} />, a.dari)}
        <svg width="110" height="50" viewBox="0 0 110 50" style={{ marginBottom: 44 }}>
          <path d="M6 25 H92" stroke={merek.utama} strokeWidth="8" strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - panah} />
          <path d="M78 8 L100 25 L78 42" stroke={merek.utama} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={panah > 0.9 ? 1 : 0} />
        </svg>
        {tegel(tegel2, merek.logo ? <Img src={staticFile(merek.logo)} style={{ width: 120, height: 120, borderRadius: 30 }} /> : <Ikon nama="toko" ukuran={92} warna="#047857" />, a.ke)}
        {/* Coretan tangan berpanah ke ikon tujuan */}
        <div style={{ position: 'absolute', right: -10, top: -70, fontFamily: TANGAN, fontWeight: 700, fontSize: 40, color: '#3F3F46', lineHeight: 1, textAlign: 'right', transform: `rotate(-6deg) scale(${coret})`, transformOrigin: 'right top' }}>
          {a.coretan}
          <svg width="80" height="70" viewBox="0 0 80 70" style={{ display: 'block', marginLeft: 'auto', marginRight: 40 }}>
            <path d="M60 6 C 66 34, 50 52, 22 58" fill="none" stroke="#3F3F46" strokeWidth="4" strokeLinecap="round" />
            <path d="M34 48 L20 59 L36 66" fill="none" stroke="#3F3F46" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
};
