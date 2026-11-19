// Slot karakter/maskot di 40% bawah layar, satu per adegan (pose boleh berganti). Gambar (PNG
// transparan, sudah dipangkas ke tubuh oleh mesin) dibingkai SETENGAH BADAN seperti pembicara Reels
// dan "hidup": bergoyang, bernapas, dan mengangguk kecil tiap kata diucapkan. Video .webm transparan
// diputar apa adanya. Kosong → di Remotion Studio tampil kotak penanda, di render tidak tampil.
import React from 'react';
import { AbsoluteFill, getRemotionEnvironment, Img, Loop, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Kata } from '../data/script';
import { H, SANS } from './dasar';

type P = { berkas?: string; atas: number; ganti?: boolean; awal?: number; kata?: Kata[]; mulaiDetik?: number };

/** Kuat "ketukan bicara" pada bingkai ini: 1 saat kata mulai, meluruh cepat. Murni. */
export function ketukBicara(frame: number, fps: number, kata: Kata[], mulaiDetik: number) {
  let k = 0;
  for (const w of kata) {
    const f = frame - Math.round((mulaiDetik + w.mulai) * fps);
    if (f >= 0 && f < 20) k = Math.max(k, Math.exp(-f / 4.5));
  }
  return k;
}

export const MascotOverlay: React.FC<P> = ({ berkas, atas, ganti = false, awal = 0, kata = [], mulaiDetik = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tinggi = H - atas;
  if (!berkas) {
    if (!getRemotionEnvironment().isStudio) return null;
    return (
      <div style={{ position: 'absolute', left: 140, right: 140, top: atas + 40, bottom: 60, border: '4px dashed #C4C4CC', borderRadius: 40, display: 'grid', placeItems: 'center', fontFamily: SANS, fontSize: 34, color: '#A1A1AA' }}>
        &lt;MascotOverlay /&gt; — isi naskah.maskot
      </div>
    );
  }
  // Pose baru muncul dengan pegas dari bawah; pose yang sama dengan adegan sebelumnya tetap di tempat.
  const p = ganti ? spring({ frame, fps, config: { damping: 13, stiffness: 170, mass: 0.7 } }) : 1;
  if (/\.(webm|mp4|mov)$/i.test(berkas)) {
    return (
      <AbsoluteFill style={{ opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 70}px)` }}>
        <Loop durationInFrames={10 * 30}>
          <OffthreadVideo src={staticFile(berkas)} transparent={/\.webm$/i.test(berkas)} muted style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: tinggi, width: '100%', objectFit: 'contain', objectPosition: 'bottom center' }} />
        </Loop>
      </AbsoluteFill>
    );
  }
  // Waktu global supaya goyangan tak melompat saat adegan berganti dengan pose yang sama.
  const t = frame + awal;
  const ketuk = ketukBicara(frame, fps, kata, mulaiDetik);
  const goyang = Math.sin(t / 45) * 1.2 + ketuk * 0.8;
  const napas = 1 + Math.sin(t / 22) * 0.008 + ketuk * 0.012;
  const angguk = -ketuk * 12 + Math.sin(t / 30) * 4;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: atas, height: tinggi, overflow: 'hidden', opacity: Math.min(1, p * 1.5) }}>
      {/* Setengah badan: tinggi gambar ≈ 1,85× slot, kepala di atas slot, pinggang ke bawah terpotong tepi video. */}
      <Img
        src={staticFile(berkas)}
        style={{
          position: 'absolute', left: '50%', top: 24, height: tinggi * 1.85, width: 'auto', maxWidth: 'none',
          transform: `translateX(-50%) translateY(${(1 - p) * 90 + angguk}px) rotate(${goyang}deg) scale(${napas})`,
          transformOrigin: '50% 85%',
        }}
      />
    </div>
  );
};
