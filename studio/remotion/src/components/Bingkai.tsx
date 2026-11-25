// Lapisan tetap di semua adegan: latar berkisi, bilah progres kiri, lencana langkah, nama merek.
import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Naskah } from '../data/script';
import { SANS } from './dasar';

export const Latar: React.FC<{ merek: Naskah['merek']; gaya?: string; latarGambar?: string }> = ({ merek, gaya, latarGambar }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const gelap = gaya !== 'clean-ui';
  const zoom = interpolate(frame, [0, Math.max(1, durationInFrames)], [1, 1.12], { extrapolateRight: 'clamp' });
  const latarGelap = gaya === 'split-hook'
    ? `radial-gradient(circle at 82% 14%, ${merek.kedua}24 0%, transparent 45%), radial-gradient(circle at 18% 82%, #1E3A8A4D 0%, transparent 50%), linear-gradient(165deg, #111827 0%, #0D1017 100%)`
    : gaya === 'pov-chat'
    ? `radial-gradient(circle at 78% 16%, rgba(34,197,94,0.18) 0%, transparent 46%), radial-gradient(circle at 20% 85%, ${merek.utama}40 0%, transparent 50%), linear-gradient(165deg, #131B24 0%, #0F1419 100%)`
    : `radial-gradient(circle at 80% 12%, ${merek.kedua}2E 0%, transparent 48%), radial-gradient(circle at 18% 85%, ${merek.utama}44 0%, transparent 52%), linear-gradient(165deg, #0E131B 0%, #0A0C10 100%)`;

  return (
    <AbsoluteFill
      style={{
        background: gelap ? latarGelap : merek.latar,
      }}
    >
      {latarGambar ? (
        <AbsoluteFill style={{ overflow: 'hidden', opacity: gelap ? 0.36 : 0.26 }}>
          <Img
            src={staticFile(latarGambar)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${zoom})`,
              filter: 'blur(2px) saturate(1.15)',
            }}
          />
          <AbsoluteFill
            style={{
              background: gelap
                ? 'linear-gradient(180deg, rgba(10,12,16,0.68) 0%, rgba(10,12,16,0.42) 50%, rgba(10,12,16,0.82) 100%)'
                : 'linear-gradient(180deg, rgba(250,250,250,0.66) 0%, rgba(250,250,250,0.45) 50%, rgba(250,250,250,0.8) 100%)',
            }}
          />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${gelap ? merek.kisi || 'rgba(255,255,255,0.05)' : merek.kisi} 2px, transparent 2px), linear-gradient(90deg, ${gelap ? merek.kisi || 'rgba(255,255,255,0.05)' : merek.kisi} 2px, transparent 2px)`,
          backgroundSize: '72px 72px',
          backgroundPosition: '-1px -1px',
          // Kisi memudar ke tepi supaya mata tertuju ke tengah.
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

/** Bilah progres tegak di kiri: terisi sesuai waktu, dengan titik tiap pergantian adegan. */
export const Progres: React.FC<{ waktu: { mulai: number; durasi: number }[]; total: number; warna: string; gelap?: boolean }> = ({ waktu, total, warna, gelap }) => {
  const frame = useCurrentFrame();
  const atas = 230, tinggi = 1460;
  const isi = interpolate(frame, [0, total], [0, tinggi], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 34, top: atas, width: 8, height: tinggi, borderRadius: 8, background: gelap ? 'rgba(255,255,255,0.14)' : '#E4E4E7' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 8, height: isi, borderRadius: 8, background: warna }} />
      {waktu.map((w, i) => {
        const y = (w.mulai / total) * tinggi;
        const lewat = frame >= w.mulai;
        return <div key={i} style={{ position: 'absolute', left: -6, top: y - 10, width: 20, height: 20, borderRadius: 10, background: lewat ? warna : (gelap ? '#111827' : '#fff'), border: `3px solid ${lewat ? warna : (gelap ? 'rgba(255,255,255,0.28)' : '#D4D4D8')}` }} />;
      })}
    </div>
  );
};

/** Lencana langkah (kiri atas) — nomor + nama langkah, berganti dengan pegas tiap adegan. */
export const Lencana: React.FC<{ nomor: number; teks: string; warna: string; mulai: number; gelap?: boolean }> = ({ nomor, teks, warna, mulai, gelap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - mulai - 4, fps, config: { damping: 15, stiffness: 160 } });
  return (
    <div style={{ position: 'absolute', left: 80, top: 92, display: 'flex', alignItems: 'center', gap: 16, fontFamily: SANS, transform: `translateY(${(1 - p) * -30}px)`, opacity: p }}>
      <div style={{ width: 62, height: 62, borderRadius: 31, background: warna, color: gelap ? '#0B0B0F' : '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 32 }}>{nomor}</div>
      <div style={{ background: gelap ? 'rgba(255,255,255,0.08)' : '#fff', border: `2px solid ${gelap ? 'rgba(255,255,255,0.18)' : '#E4E4E7'}`, borderRadius: 999, padding: '12px 28px', fontWeight: 700, fontSize: 32, color: gelap ? '#F8FAFC' : '#18181B' }}>{teks}</div>
    </div>
  );
};

/** Pita judul menetap di atas untuk gaya `split-hook` (gaya Reels edukasi/SaaS viral). */
export const PitaHook: React.FC<{ teks: string; warna: string; aksen: string }> = ({ teks, warna, aksen }) => (
  <div style={{ position: 'absolute', left: 76, right: 64, top: 174, display: 'flex', justifyContent: 'center' }}>
    <div style={{ background: warna, color: '#fff', border: `2px solid ${aksen}`, borderRadius: 18, padding: '12px 26px', fontFamily: SANS, fontWeight: 800, fontSize: 28, textAlign: 'center', boxShadow: '0 14px 32px rgba(0,0,0,0.22)' }}>
      <span style={{ color: aksen, marginRight: 10 }}>⚡</span>{teks}
    </div>
  </div>
);

/** Kartu notifikasi gaya chat WA untuk preset `pov-chat`. */
export const NotifPov: React.FC<{ pengirim: string; pesan: string; aksen: string }> = ({ pengirim, pesan, aksen }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 4, fps, config: { damping: 15, stiffness: 150 } });
  return (
    <div style={{ position: 'absolute', left: 82, right: 64, top: 172, opacity: p, transform: `translateY(${(1 - p) * -22}px)` }}>
      <div style={{ background: '#111827', color: '#F9FAFB', borderRadius: 22, padding: '14px 24px', borderLeft: `6px solid ${aksen}`, boxShadow: '0 18px 36px rgba(15,23,42,0.24)', fontFamily: SANS }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: aksen, marginBottom: 4 }}>POV · {pengirim}</div>
        <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.25 }}>{pesan}</div>
      </div>
    </div>
  );
};

export const Merek: React.FC<{ merek: Naskah['merek']; terang?: boolean }> = ({ merek, terang }) => (
  <div style={{ position: 'absolute', right: 64, top: 98, display: 'flex', alignItems: 'center', gap: 14, fontFamily: SANS, fontWeight: 800, fontSize: 34, color: terang ? '#fff' : merek.tinta }}>
    {merek.logo ? <Img src={staticFile(merek.logo)} style={{ width: 54, height: 54, borderRadius: 14 }} /> : null}
    {merek.nama}
  </div>
);
