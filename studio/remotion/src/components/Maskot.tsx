// Slot karakter/maskot di 40% bawah layar, satu per adegan (pose boleh berganti), dibingkai SETENGAH
// BADAN seperti pembicara Reels. Video karakter (.webm transparan buatan mesin dari video Veo) diputar
// berulang; gambar diam (PNG transparan) hanya bernapas & mengangguk halus saat kata diucapkan.
// Kosong → di Remotion Studio tampil kotak penanda, di render tidak tampil.
import React from 'react';
import { getRemotionEnvironment, Img, Loop, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Kata } from '../data/script';
import { H, SANS } from './dasar';

type P = { berkas?: string; atas: number; ganti?: boolean; awal?: number; kata?: Kata[]; mulaiDetik?: number; durasiVideo?: number };

/** Kuat "ketukan bicara" pada bingkai ini: 1 saat kata mulai, meluruh cepat. Murni. */
export function ketukBicara(frame: number, fps: number, kata: Kata[], mulaiDetik: number) {
  let k = 0;
  for (const w of kata) {
    const f = frame - Math.round((mulaiDetik + w.mulai) * fps);
    if (f >= 0 && f < 20) k = Math.max(k, Math.exp(-f / 4.5));
  }
  return k;
}

export const MascotOverlay: React.FC<P> = ({ berkas, atas, ganti = false, awal = 0, kata = [], mulaiDetik = 0, durasiVideo = 0 }) => {
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
  // Setengah badan: tinggi karakter ≈ 1,85× slot, kepala di atas slot, pinggang ke bawah terpotong
  // tepi video. Berkas sudah dipangkas mesin ke tubuh (gambar) / ke kotak karakter (video).
  const bingkai: React.CSSProperties = { position: 'absolute', left: '50%', top: 24, height: tinggi * 1.85, width: 'auto', maxWidth: 'none' };
  const wadah: React.CSSProperties = { position: 'absolute', left: 0, right: 0, top: atas, height: tinggi, overflow: 'hidden', opacity: Math.min(1, p * 1.5) };
  if (/\.(webm|mp4|mov)$/i.test(berkas)) {
    // Video karakter (Veo) sudah bergerak sendiri: cukup diputar berulang, tanpa gerak tambahan.
    return (
      <div style={wadah}>
        <Loop durationInFrames={Math.max(30, Math.round((durasiVideo || 8) * fps))}>
          <OffthreadVideo src={staticFile(berkas)} transparent={/\.webm$/i.test(berkas)} muted style={{ ...bingkai, transform: `translateX(-50%) translateY(${(1 - p) * 90}px)` }} />
        </Loop>
      </div>
    );
  }
  // Gambar diam: gerak dibuat halus (Kyai: goyang & angguk besar "kurang bagus") — napas pelan dan
  // anggukan kecil saat kata diucapkan, tanpa memutar badan. Waktu global supaya tak melompat antar-adegan.
  const t = frame + awal;
  const ketuk = ketukBicara(frame, fps, kata, mulaiDetik);
  const napas = 1 + Math.sin(t / 26) * 0.005 + ketuk * 0.004;
  const angguk = -ketuk * 4 + Math.sin(t / 34) * 2;
  return (
    <div style={wadah}>
      <Img src={staticFile(berkas)} style={{ ...bingkai, transform: `translateX(-50%) translateY(${(1 - p) * 90 + angguk}px) scale(${napas})`, transformOrigin: '50% 90%' }} />
    </div>
  );
};
