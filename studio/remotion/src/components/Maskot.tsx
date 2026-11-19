// Slot karakter/maskot di 40% bawah layar, satu per adegan (pose boleh berganti). Isi: video
// transparan .webm (VP9 alpha), .mp4, atau gambar (.png) yang "bernapas" pelan. Kosong → di Remotion
// Studio tampil kotak penanda, di render tidak tampil apa-apa (tata letak versi tanpa maskot).
import React from 'react';
import { AbsoluteFill, getRemotionEnvironment, Img, Loop, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { H, SANS } from './dasar';

type P = { berkas?: string; atas: number; ganti?: boolean; awal?: number };

export const MascotOverlay: React.FC<P> = ({ berkas, atas, ganti = false, awal = 0 }) => {
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
  // Pose baru muncul dengan pegas dari bawah; pose yang sama dengan adegan sebelumnya tetap diam.
  const p = ganti ? spring({ frame, fps, config: { damping: 13, stiffness: 170, mass: 0.7 } }) : 1;
  const masuk: React.CSSProperties = { opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 70}px)` };
  const gaya: React.CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: 0, height: tinggi, objectFit: 'contain', objectPosition: 'bottom center', width: '100%' };
  if (/\.(webm|mp4|mov)$/i.test(berkas)) {
    return (
      <AbsoluteFill style={masuk}>
        <Loop durationInFrames={10 * 30}>
          <OffthreadVideo src={staticFile(berkas)} transparent={/\.webm$/i.test(berkas)} muted style={gaya} />
        </Loop>
      </AbsoluteFill>
    );
  }
  // Gambar diam: napas pelan (naik-turun 1%) memakai waktu global supaya tak melompat antar-adegan.
  const napas = Math.sin((frame + awal) / 22) * 0.01;
  return (
    <AbsoluteFill style={masuk}>
      <Img src={staticFile(berkas)} style={{ ...gaya, transform: `scale(${1 + napas})`, transformOrigin: 'bottom center' }} />
    </AbsoluteFill>
  );
};
