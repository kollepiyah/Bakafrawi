// Lapisan tetap di semua adegan: latar berkisi, bilah progres kiri, lencana langkah, nama merek.
import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Naskah } from '../data/script';
import { SANS } from './dasar';

export const Latar: React.FC<{ merek: Naskah['merek'] }> = ({ merek }) => (
  <AbsoluteFill style={{ background: merek.latar }}>
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${merek.kisi} 2px, transparent 2px), linear-gradient(90deg, ${merek.kisi} 2px, transparent 2px)`,
        backgroundSize: '72px 72px',
        backgroundPosition: '-1px -1px',
        // Kisi memudar ke tepi supaya mata tertuju ke tengah.
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 100%)',
      }}
    />
  </AbsoluteFill>
);

/** Bilah progres tegak di kiri: terisi sesuai waktu, dengan titik tiap pergantian adegan. */
export const Progres: React.FC<{ waktu: { mulai: number; durasi: number }[]; total: number; warna: string }> = ({ waktu, total, warna }) => {
  const frame = useCurrentFrame();
  const atas = 230, tinggi = 1460;
  const isi = interpolate(frame, [0, total], [0, tinggi], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 34, top: atas, width: 8, height: tinggi, borderRadius: 8, background: '#E4E4E7' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 8, height: isi, borderRadius: 8, background: warna }} />
      {waktu.map((w, i) => {
        const y = (w.mulai / total) * tinggi;
        const lewat = frame >= w.mulai;
        return <div key={i} style={{ position: 'absolute', left: -6, top: y - 10, width: 20, height: 20, borderRadius: 10, background: lewat ? warna : '#fff', border: `3px solid ${lewat ? warna : '#D4D4D8'}` }} />;
      })}
    </div>
  );
};

/** Lencana langkah (kiri atas) — nomor + nama langkah, berganti dengan pegas tiap adegan. */
export const Lencana: React.FC<{ nomor: number; teks: string; warna: string; mulai: number }> = ({ nomor, teks, warna, mulai }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - mulai - 4, fps, config: { damping: 15, stiffness: 160 } });
  return (
    <div style={{ position: 'absolute', left: 80, top: 92, display: 'flex', alignItems: 'center', gap: 16, fontFamily: SANS, transform: `translateY(${(1 - p) * -30}px)`, opacity: p }}>
      <div style={{ width: 62, height: 62, borderRadius: 31, background: warna, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 32 }}>{nomor}</div>
      <div style={{ background: '#fff', border: '2px solid #E4E4E7', borderRadius: 999, padding: '12px 28px', fontWeight: 700, fontSize: 32, color: '#18181B' }}>{teks}</div>
    </div>
  );
};

export const Merek: React.FC<{ merek: Naskah['merek']; terang?: boolean }> = ({ merek, terang }) => (
  <div style={{ position: 'absolute', right: 64, top: 98, display: 'flex', alignItems: 'center', gap: 14, fontFamily: SANS, fontWeight: 800, fontSize: 34, color: terang ? '#fff' : merek.tinta }}>
    {merek.logo ? <Img src={staticFile(merek.logo)} style={{ width: 54, height: 54, borderRadius: 14 }} /> : null}
    {merek.nama}
  </div>
);
