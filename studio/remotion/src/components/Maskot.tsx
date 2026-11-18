// Slot karakter/maskot di 40% bawah layar. Isi: video transparan .webm (VP9 alpha), .mp4, atau
// gambar (.png) yang "bernapas" pelan. Kosong → di Remotion Studio tampil kotak penanda, di render
// tidak tampil apa-apa (tata letak sudah memakai versi tanpa maskot).
import React from 'react';
import { AbsoluteFill, getRemotionEnvironment, Img, Loop, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { H, SANS } from './dasar';

export const MascotOverlay: React.FC<{ berkas?: string; atas: number }> = ({ berkas, atas }) => {
  const frame = useCurrentFrame();
  const tinggi = H - atas;
  if (!berkas) {
    if (!getRemotionEnvironment().isStudio) return null;
    return (
      <div style={{ position: 'absolute', left: 140, right: 140, top: atas + 40, bottom: 60, border: '4px dashed #C4C4CC', borderRadius: 40, display: 'grid', placeItems: 'center', fontFamily: SANS, fontSize: 34, color: '#A1A1AA' }}>
        &lt;MascotOverlay /&gt; — isi naskah.maskot
      </div>
    );
  }
  const gaya: React.CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: 0, height: tinggi, objectFit: 'contain', objectPosition: 'bottom center', width: '100%' };
  if (/\.(webm|mp4|mov)$/i.test(berkas)) {
    return (
      <AbsoluteFill>
        <Loop durationInFrames={10 * 30}>
          <OffthreadVideo src={staticFile(berkas)} transparent={/\.webm$/i.test(berkas)} muted style={gaya} />
        </Loop>
      </AbsoluteFill>
    );
  }
  // Gambar diam: napas pelan (naik-turun 1%) supaya tidak terasa tempelan.
  const napas = Math.sin(frame / 22) * 0.01;
  return <Img src={staticFile(berkas)} style={{ ...gaya, transform: `scale(${1 + napas})`, transformOrigin: 'bottom center' }} />;
};
