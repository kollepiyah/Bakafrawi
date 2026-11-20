// Komposisi video sinematik 9:16 untuk merek bank media (Lek Kopi, kafe, gaya hidup).
// Menggabungkan klip video asli (.mp4) + foto bank + B-roll gambar AI (Ken Burns) dengan color
// grading hangat kafe, transisi halus, tipografi editorial/POV-chat, dan penutup elegan.
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { SANS, SERIF, TANGAN } from './components/dasar';
import { DialMenu, hitungDurasiDial } from './DialMenu';

export const FPS_SINEMATIK = 30;

export type SegmenSinematik = {
  berkas: string;
  jenis: 'video' | 'foto';
  durasi: number; // detik
  mulaiKlip?: number; // detik mulai pada video sumber
  teksLayar?: string;
  gayaTeks?: 'judul' | 'cerita' | 'tanpa' | null;
  adeganKe: number;
  suaraBerkas?: string | null;
  narasi?: string;
};

export type PropsSinematik = {
  merek: {
    nama: string;
    sub?: string;
    aksen: string;
    logo?: string;
    info?: string;
  };
  gaya?: string;
  musik?: string | null;
  musikVolume?: number;
  segmen: SegmenSinematik[];
  penutup?: {
    durasi: number;
    ajakan?: string;
    info?: string;
  };
};

export const contohSinematik: PropsSinematik = {
  merek: {
    nama: 'Lek Kopi',
    sub: 'Waru · Sidoarjo',
    aksen: '#D9A441',
    info: 'Buka tiap hari 15.00 – 23.00 WIB · Waru',
  },
  gaya: 'sinematik-kafe',
  musik: null,
  musikVolume: 0.7,
  segmen: [
    { berkas: '', jenis: 'foto', durasi: 3, teksLayar: 'Coffee | time', gayaTeks: 'judul', adeganKe: 0 },
  ],
  penutup: { durasi: 2.2, ajakan: 'Mampir ngopi malam ini', info: 'Waru, Sidoarjo · 15.00–23.00' },
};

export function hitungDurasiSinematik(p: PropsSinematik) {
  // Mode dial-menu = keypad menu + potongan foto layar penuh bernomor (ala Happy Cake).
  if (p.gaya === 'dial-menu') return hitungDurasiDial(p);
  // Mode editorial-scroll = 1 scene tunggal laptop di meja kayu (~9–11 detik total, tanpa penutup terpisah).
  if (p.gaya === 'editorial-scroll') {
    const jumlah = Math.max(1, Math.min(4, p.segmen.length));
    const perBagian = Math.round(2.4 * FPS_SINEMATIK); // 2.4 detik per blok scroll → total ~9.6 detik
    const jadwal = p.segmen.slice(0, 4).map((_, i) => ({ mulai: i * perBagian, durasi: perBagian }));
    const total = Math.max(FPS_SINEMATIK * 7, jumlah * perBagian);
    return { jadwal, penutupMulai: total, penutupDurasi: 0, total };
  }
  let mulai = 0;
  const jadwal = p.segmen.map((s) => {
    const durasi = Math.max(15, Math.round((Number(s.durasi) || 2.5) * FPS_SINEMATIK));
    const item = { mulai, durasi };
    mulai += durasi;
    return item;
  });
  const penutupDurasi = p.penutup ? Math.max(30, Math.round((Number(p.penutup.durasi) || 2.2) * FPS_SINEMATIK)) : 0;
  return { jadwal, penutupMulai: mulai, penutupDurasi, total: Math.max(30, mulai + penutupDurasi) };
}

/** Lapisan media full-bleed 9:16: video (.mp4) atau gambar (bank/AI) dengan animasi Ken Burns halus. */
const LapisanMedia: React.FC<{ s: SegmenSinematik; durasi: number; indeks: number; gaya?: string }> = ({ s, durasi, indeks, gaya }) => {
  const frame = useCurrentFrame();
  const masuk = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const keluar = interpolate(frame, [durasi - 8, durasi], [1, 0.15], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opasitas = Math.min(masuk, keluar);

  // Ken Burns halus untuk foto/gambar AI (arah zoom & pan bergantian agar terasa dinamis).
  const arah = indeks % 2 === 0 ? 1 : -1;
  const skalaFoto = interpolate(frame, [0, durasi], arah > 0 ? [1.02, 1.13] : [1.13, 1.03], { extrapolateRight: 'clamp' });
  const geserX = interpolate(frame, [0, durasi], [arah * -18, arah * 18], { extrapolateRight: 'clamp' });
  const geserY = interpolate(frame, [0, durasi], [arah * 10, arah * -10], { extrapolateRight: 'clamp' });

  // Micro-zoom masuk untuk video agar potongan terasa hidup.
  const skalaVideo = interpolate(frame, [0, 14], [1.05, 1.0], { extrapolateRight: 'clamp' });

  const filterWarna = gaya === 'dark-keynote'
    ? 'contrast(1.12) brightness(0.84) saturate(1.05)'
    : 'contrast(1.06) brightness(0.92) saturate(1.12) sepia(0.08)';

  return (
    <AbsoluteFill style={{ background: '#0E0B09', opacity: opasitas, overflow: 'hidden' }}>
      {s.berkas ? (
        s.jenis === 'video' ? (
          <OffthreadVideo
            src={staticFile(s.berkas)}
            startFrom={Math.max(0, Math.round((Number(s.mulaiKlip) || 0) * FPS_SINEMATIK))}
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${skalaVideo})`,
              filter: filterWarna,
            }}
          />
        ) : (
          <Img
            src={staticFile(s.berkas)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${skalaFoto}) translate(${geserX}px, ${geserY}px)`,
              filter: filterWarna,
            }}
          />
        )
      ) : (
        <AbsoluteFill style={{ background: 'radial-gradient(circle at 30% 25%, #2D2118 0%, #0E0B09 75%)' }} />
      )}

      {/* Vignette sinematik atas & bawah supaya teks selalu tajam & mudah dibaca */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(10,8,6,0.58) 0%, rgba(10,8,6,0.08) 28%, rgba(10,8,6,0.12) 60%, rgba(10,8,6,0.78) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

/** Lapisan tipografi: judul editorial split ("Coffee | time"), POV chat bubble, atau teks cerita sinematik. */
const LapisanTeks: React.FC<{ s: SegmenSinematik; durasi: number; aksen: string; gaya?: string; namaMerek: string }> = ({
  s, durasi, aksen, gaya, namaMerek,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const teks = String(s.teksLayar ?? '').trim();
  if (!teks || s.gayaTeks === 'tanpa') return null;

  const pegas = spring({ frame: frame - 3, fps, config: { damping: 16, stiffness: 130, mass: 0.8 } });
  const keluar = interpolate(frame, [durasi - 9, durasi], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = Math.min(pegas, keluar);
  const naik = interpolate(pegas, [0, 1], [36, 0]);

  // 1. Gaya JUDUL (Opening Hook / Editorial Split)
  if (s.gayaTeks === 'judul') {
    const bagian = teks.split('|').map((x) => x.trim()).filter(Boolean);
    const kiri = bagian[0] ?? teks;
    const kanan = bagian[1] ?? '';
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 84px', opacity: op }}>
        <div style={{ transform: `translateY(${naik}px)`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 3, borderRadius: 99, background: aksen, opacity: 0.9 }} />
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 84, lineHeight: 1.06, color: '#FFFDF9', letterSpacing: -1.5, textShadow: '0 10px 36px rgba(0,0,0,0.55)' }}>
            {kiri}
            {kanan ? (
              <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 96, color: aksen, marginLeft: 16 }}>
                {kanan}
              </span>
            ) : null}
          </div>
          <div style={{ fontFamily: TANGAN, fontSize: 38, color: 'rgba(255,250,240,0.88)', textShadow: '0 4px 16px rgba(0,0,0,0.6)' }}>
            {namaMerek}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // 2. Gaya POV / CHAT STORY (Gelembung notifikasi elegan ala Reels viral)
  if (gaya === 'pov-chat') {
    return (
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 72px 280px', opacity: op }}>
        <div
          style={{
            transform: `translateY(${naik}px) scale(${0.94 + 0.06 * pegas})`,
            maxWidth: 880,
            background: 'rgba(18, 15, 13, 0.78)',
            backdropFilter: 'blur(14px)',
            border: `1.5px solid ${aksen}55`,
            borderRadius: 28,
            padding: '26px 34px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: aksen }} />
            <span style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: aksen }}>
              {namaMerek}
            </span>
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 42, lineHeight: 1.32, color: '#FFFDF9' }}>
            {teks}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // 3. Gaya CERITA SINEMATIK (Glass editorial pill di bawah tengah)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 78px 270px', opacity: op }}>
      <div
        style={{
          transform: `translateY(${naik}px)`,
          textAlign: 'center',
          background: 'rgba(15, 12, 10, 0.56)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 24,
          padding: '22px 34px',
          boxShadow: '0 18px 40px rgba(0,0,0,0.38)',
        }}
      >
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, lineHeight: 1.3, color: '#FFFDF9', textShadow: '0 4px 16px rgba(0,0,0,0.45)' }}>
          {teks}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Kartu penutup elegan: logo merek, ajakan mampir, lokasi & jam buka. */
const PenutupSinematik: React.FC<{ merek: PropsSinematik['merek']; penutup: NonNullable<PropsSinematik['penutup']>; durasi: number }> = ({
  merek, penutup, durasi,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const keluar = interpolate(frame, [durasi - 10, durasi], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 42%, ${merek.aksen}28 0%, #120E0B 62%, #080605 100%)`,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 88px',
        opacity: Math.min(p, keluar),
      }}
    >
      <div style={{ transform: `scale(${0.92 + 0.08 * p})`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 22 }}>
        {merek.logo ? (
          <Img src={staticFile(merek.logo)} style={{ width: 170, height: 170, objectFit: 'contain', borderRadius: 32, filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.45))' }} />
        ) : null}
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 82, color: merek.aksen, lineHeight: 1.05 }}>
          {merek.nama}
        </div>
        {penutup.ajakan ? (
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: '#FFFDF9', lineHeight: 1.25 }}>
            {penutup.ajakan}
          </div>
        ) : null}
        <div style={{ width: 72, height: 2, background: `${merek.aksen}88`, borderRadius: 99 }} />
        {(penutup.info || merek.info || merek.sub) ? (
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 30, color: 'rgba(255,248,236,0.78)', lineHeight: 1.4 }}>
            {penutup.info || merek.info || merek.sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const LAYAR_W = 920;
const LAYAR_H = 575;
const NAV_H = 54;
const BLOK_H = LAYAR_H - NAV_H; // 521px per blok scroll di dalam layar laptop
const SUB_LAPTOP = ['SPECIALTY COFFEE', 'RACIKAN KHAS', 'SEDUHAN SEGAR', 'MAMPIR MALAM INI'];
const JUDUL_CADANGAN = [
  'BANGUNKAN AROMA KOPI',
  'NIKMATI SEDUHAN TERBAIK',
  'RACIKAN SEGAR TIAP HARI',
  'WAKTUNYA NGOPI SANTAI',
];

/**
 * 1 SCENE TUNGGAL persis referensi POUR / PLAY:
 * Laptop MacBook elegan di atas meja kayu hangat dengan lampu studio redup — kamera diam (micro-zoom halus),
 * sementara halaman website kopi mewah di dalam layar laptop menggulir mulus vertikal dari atas ke bawah.
 */
const HalamanEditorialScroll: React.FC<{
  props: PropsSinematik;
  jadwal: { mulai: number; durasi: number }[];
  total: number;
}> = ({ props, jadwal, total }) => {
  const frame = useCurrentFrame();
  const { merek } = props;
  const blok = props.segmen.slice(0, 4);

  // Micro-zoom kamera yang sangat halus selama 1 scene penuh (tidak pernah cut/ganti scene!).
  const skalaKamera = interpolate(frame, [0, total], [1.0, 1.045], { extrapolateRight: 'clamp' });

  // Scroll kontinyu mulus di dalam layar laptop (berhenti tipis di tiap blok lalu meluncur mulus).
  let scrollY = 0;
  if (blok.length > 1) {
    const maksScroll = (blok.length - 1) * BLOK_H;
    // Gabungan scroll terus-menerus lembut + sedikit perlambatan di tiap blok seperti scroll trackpad asli.
    const progres = interpolate(frame, [14, total - 18], [0, blok.length - 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const idx = Math.min(blok.length - 2, Math.floor(progres));
    const frac = progres - idx;
    const halus = Easing.inOut(Easing.sin)(frac);
    scrollY = Math.min(maksScroll, (idx + halus) * BLOK_H);
  }

  const renderMediaLayar = (s: SegmenSinematik, i: number, style: React.CSSProperties) => {
    const j = jadwal[i] ?? { mulai: 0, durasi: total };
    return (
      <div style={{ overflow: 'hidden', position: 'relative', background: '#E5D6C0', ...style }}>
        {s.berkas ? (
          s.jenis === 'video' ? (
            <OffthreadVideo
              src={staticFile(s.berkas)}
              startFrom={Math.max(0, Math.round((Number(s.mulaiKlip) || 0) * FPS_SINEMATIK))}
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.06) saturate(1.1) sepia(0.05)' }}
            />
          ) : (
            <Img
              src={staticFile(s.berkas)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${interpolate(Math.max(0, frame - j.mulai), [0, j.durasi], [1.02, 1.09], { extrapolateRight: 'clamp' })})`,
                filter: 'contrast(1.06) saturate(1.1) sepia(0.05)',
              }}
            />
          )
        ) : null}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: '#1B1511', overflow: 'hidden' }}>
      {/* Seluruh 1 Scene (Ruangan Kafe + Meja Kayu + Laptop 3D) dengan micro-zoom halus */}
      <AbsoluteFill style={{ transform: `scale(${skalaKamera})`, transformOrigin: '50% 52%' }}>
        {/* 1. Dinding latar hangat bokeh + cahaya lampu meja di kanan atas */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 86% 24%, rgba(255,214,158,0.22) 0%, rgba(255,190,120,0.06) 28%, transparent 52%), linear-gradient(180deg, #473C34 0%, #312822 42%, #211914 58%, #16100C 100%)',
          }}
        />
        {/* Siluet lampu meja minimalis di kanan atas (seperti contoh POUR / PLAY) */}
        <div
          style={{
            position: 'absolute',
            right: -30,
            top: 260,
            width: 170,
            height: 110,
            borderRadius: '85px 85px 12px 12px',
            background: 'linear-gradient(180deg, #161413 0%, #24201D 100%)',
            boxShadow: '0 40px 120px 30px rgba(255,210,145,0.28)',
          }}
        />
        <div style={{ position: 'absolute', right: 48, top: 365, width: 14, height: 420, background: '#171412' }} />

        {/* 2. Permukaan meja kayu walnut hangat di separuh bawah */}
        <div
          style={{
            position: 'absolute',
            left: -60,
            right: -60,
            top: 1020,
            bottom: -60,
            background:
              'linear-gradient(180deg, #563B29 0%, #442C1D 24%, #331F14 62%, #22140C 100%)',
            borderTop: '2px solid rgba(255,220,185,0.16)',
            boxShadow: 'inset 0 28px 60px rgba(0,0,0,0.35)',
          }}
        >
          {/* Serat kayu halus */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.16,
              backgroundImage:
                'repeating-linear-gradient(178deg, rgba(255,215,175,0.14) 0px, rgba(255,215,175,0.14) 2px, transparent 2px, transparent 22px)',
            }}
          />
          {/* Bayangan laptop jatuh di atas meja kayu */}
          <div
            style={{
              position: 'absolute',
              left: 70,
              right: 40,
              top: 190,
              height: 290,
              background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 55%, transparent 78%)',
              transform: 'rotate(-2deg)',
            }}
          />
        </div>

        {/* 3. MOCKUP LAPTOP MACBOOK 3D DI TENGAH MEJA */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 495,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            perspective: 1850,
          }}
        >
          {/* Tutup & Layar Laptop (perspektif sedikit miring ke kanan persis video contoh) */}
          <div
            style={{
              width: LAYAR_W + 30,
              padding: '15px 15px 18px',
              borderRadius: '26px 26px 8px 8px',
              background: 'linear-gradient(145deg, #25272C 0%, #0E0F12 100%)',
              border: '3px solid #6F737B',
              boxShadow: '0 34px 72px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.25)',
              transform: 'rotateY(-9deg) rotateX(3deg) rotateZ(-2.2deg)',
              transformStyle: 'preserve-3d',
              position: 'relative',
            }}
          >
            {/* Camera Notch MacBook */}
            <div
              style={{
                position: 'absolute',
                top: 14,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 112,
                height: 20,
                borderRadius: '0 0 10px 10px',
                background: '#0A0B0D',
                zIndex: 30,
              }}
            />

            {/* AREA LAYAR WEBSITE (920 × 575, overflow hidden, latar krem #F4ECE0) */}
            <div
              style={{
                width: LAYAR_W,
                height: LAYAR_H,
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative',
                background: '#F4ECE0',
                color: '#1A130E',
              }}
            >
              {/* Kanvas Website Panjang yang Menggulir Mulus */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: NAV_H, transform: `translateY(${-scrollY}px)` }}>
                {blok.map((s, i) => {
                  const mentah = String(s.teksLayar ?? '').trim();
                  const bagian = mentah ? mentah.split('|').map((x) => x.trim()).filter(Boolean) : [];
                  // Bila sebelum "|" cuma 1 kata (mis. "Kopi | waktu ngopi"), gabungkan agar judul 2-3 baris gagah ala POUR/PLAY.
                  const gabungJudul = bagian.length >= 2 && bagian[0].split(/\s+/).length < 2 && bagian[1].length <= 24;
                  const judul = gabungJudul
                    ? `${bagian[0]} ${bagian[1]}`
                    : (bagian[0] || JUDUL_CADANGAN[i % JUDUL_CADANGAN.length]);
                  const sub = (!gabungJudul && bagian[1])
                    ? bagian[1]
                    : (i === blok.length - 1 ? (merek.info || 'Buka tiap hari · Waru, Sidoarjo') : `Nikmati racikan kopi segar khas ${merek.nama}.`);
                  const subLabel = SUB_LAPTOP[i % SUB_LAPTOP.length];

                  // BLOK 3 (indeks 2): Full-bleed showcase kopi lebar penuh (persis detik 00:05 POUR / PLAY!)
                  if (i === 2 && blok.length >= 3) {
                    return (
                      <div key={i} style={{ width: LAYAR_W, height: BLOK_H, position: 'relative' }}>
                        {renderMediaLayar(s, i, { width: '100%', height: '100%' })}
                        <div style={{ position: 'absolute', left: 38, top: 34 }}>
                          <span style={{ background: '#1A130E', color: '#F4ECE0', borderRadius: 999, padding: '10px 22px', fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                            {judul.slice(0, 22)} →
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // BLOK 1, 2, 4: Layout Asimetris 2 Kolom Kiri (Tipografi Serif) + Kanan (Visual Kopi)
                  const adalahHero = i === 0;
                  const adalahAkhir = i === blok.length - 1;
                  return (
                    <div
                      key={i}
                      style={{
                        width: LAYAR_W,
                        height: BLOK_H,
                        padding: '32px 42px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1.12fr',
                        gap: 30,
                        alignItems: 'center',
                        background: i % 2 === 1 ? '#EFE5D6' : '#F4ECE0',
                        borderBottom: '1px solid rgba(26,19,14,0.08)',
                      }}
                    >
                      {/* Kolom Kiri: Nomor, Sublabel, Judul Serif Besar, Deskripsi, Tombol Pil */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                          {!adalahHero ? (
                            <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 34, color: '#8C6239', lineHeight: 1 }}>
                              {i + 1}.
                            </span>
                          ) : null}
                          <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, letterSpacing: 2.4, textTransform: 'uppercase', color: '#8C6239' }}>
                            {subLabel}
                          </span>
                        </div>

                        <div
                          style={{
                            fontFamily: SERIF,
                            fontSize: judul.length > 24 ? 58 : 72,
                            lineHeight: 0.94,
                            letterSpacing: -1.2,
                            color: '#1A130E',
                            textTransform: 'uppercase',
                          }}
                        >
                          {judul}
                        </div>

                        <div style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.45, color: 'rgba(26,19,14,0.68)', maxWidth: 340 }}>
                          {sub}
                        </div>

                        <div style={{ marginTop: 10 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              background: adalahHero ? 'transparent' : '#1A130E',
                              color: adalahHero ? '#1A130E' : '#F4ECE0',
                              border: '1.5px solid #1A130E',
                              borderRadius: 999,
                              padding: '10px 22px',
                              fontFamily: SANS,
                              fontSize: 13,
                              fontWeight: 700,
                              letterSpacing: 1.4,
                              textTransform: 'uppercase',
                            }}
                          >
                            {adalahAkhir ? 'MAMPIR SEKARANG →' : adalahHero ? 'TEMUKAN KOPIMU →' : 'LIHAT MENU →'}
                          </span>
                        </div>
                      </div>

                      {/* Kolom Kanan: Visual Kopi / Video */}
                      {renderMediaLayar(s, i, {
                        width: '100%',
                        height: BLOK_H - 64,
                        borderRadius: 22,
                        boxShadow: '0 22px 44px -16px rgba(26,19,14,0.28)',
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Sticky Navbar Website di dalam Layar Laptop */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: NAV_H,
                  padding: '0 34px',
                  background: 'rgba(244,236,224,0.94)',
                  borderBottom: '1px solid rgba(26,19,14,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: SANS,
                  zIndex: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {merek.logo ? <Img src={staticFile(merek.logo)} style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'contain' }} /> : null}
                  <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: 2.5, textTransform: 'uppercase', color: '#1A130E' }}>
                    {merek.nama}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 18, fontSize: 11, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(26,19,14,0.62)' }}>
                  <span>MENU</span>
                  <span>RACIKAN</span>
                  <span>SUASANA</span>
                  <span>WARU</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, border: '1px solid rgba(26,19,14,0.35)', borderRadius: 999, padding: '5px 12px', color: '#1A130E' }}>
                  ORDER
                </span>
              </div>

              {/* Refleksi kaca halus di atas layar laptop */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background: 'linear-gradient(122deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 34%, transparent 52%)',
                  zIndex: 25,
                }}
              />
            </div>
          </div>

          {/* Deck Keyboard & Body Aluminium MacBook 3D di bawah layar */}
          <div
            style={{
              width: LAYAR_W + 76,
              height: 255,
              marginTop: -12,
              marginLeft: 52,
              borderRadius: '8px 8px 34px 34px',
              background: 'linear-gradient(180deg, #7C8088 0%, #595C63 22%, #3D4046 82%, #25272C 100%)',
              border: '2px solid #8A8E96',
              boxShadow: '0 28px 56px rgba(0,0,0,0.68)',
              transform: 'rotateY(-9deg) rotateX(62deg) rotateZ(-2.2deg)',
              transformOrigin: 'top center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '22px 64px 20px',
            }}
          >
            {/* Engsel gelap */}
            <div style={{ width: '72%', height: 10, borderRadius: 6, background: '#111215' }} />
            {/* Grid Keyboard */}
            <div style={{ width: '100%', height: 112, borderRadius: 10, background: '#1A1B1F', padding: 10, display: 'grid', gridTemplateRows: 'repeat(4, 1fr)', gap: 6 }}>
              {[0, 1, 2, 3].map((row) => (
                <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: 5 }}>
                  {Array.from({ length: 13 }).map((_, col) => (
                    <div key={col} style={{ background: '#0E0F12', borderRadius: 4, borderTop: '1px solid rgba(255,255,255,0.08)' }} />
                  ))}
                </div>
              ))}
            </div>
            {/* Trackpad */}
            <div style={{ width: 250, height: 64, borderRadius: 10, background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.12)' }} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Sinematik: React.FC<PropsSinematik> = (props) => {
  const frame = useCurrentFrame();
  const { jadwal, penutupMulai, penutupDurasi, total } = hitungDurasiSinematik(props);
  const aksen = props.merek.aksen || '#D9A441';
  const volDasar = Number(props.musikVolume) || 0.72;
  const editorial = props.gaya === 'editorial-scroll';
  const dial = props.gaya === 'dial-menu';

  return (
    <AbsoluteFill style={{ background: editorial ? '#1B1511' : dial ? '#F3EBD8' : '#0E0B09' }}>
      {dial ? (
        <DialMenu props={props} />
      ) : editorial ? (
        <HalamanEditorialScroll props={props} jadwal={jadwal} total={total} />
      ) : (
        <>
          {props.segmen.map((s, i) => (
            <Sequence key={i} from={jadwal[i].mulai} durationInFrames={jadwal[i].durasi} name={`Segmen ${i + 1}`}>
              <LapisanMedia s={s} durasi={jadwal[i].durasi} indeks={i} gaya={props.gaya} />
              <LapisanTeks s={s} durasi={jadwal[i].durasi} aksen={aksen} gaya={props.gaya} namaMerek={props.merek.nama} />
              {s.suaraBerkas ? <Audio src={staticFile(s.suaraBerkas)} /> : null}
            </Sequence>
          ))}
          {props.penutup && penutupDurasi > 0 ? (
            <Sequence from={penutupMulai} durationInFrames={penutupDurasi} name="Penutup">
              <PenutupSinematik merek={props.merek} penutup={props.penutup} durasi={penutupDurasi} />
            </Sequence>
          ) : null}
        </>
      )}

      {/* Bilah progres tipis di atas layar (disembunyikan pada editorial laptop agar bersih 100% sinematik) */}
      {!editorial && !dial ? (
        <div style={{ position: 'absolute', top: 44, left: 48, right: 48, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (frame / total) * 100)}%`, height: '100%', background: aksen, borderRadius: 99 }} />
        </div>
      ) : null}

      {/* Watermark merek halus di pojok kiri atas (khusus non-editorial; editorial sudah tampil di layar laptop) */}
      {!editorial && !dial && frame < penutupMulai ? (
        <div style={{ position: 'absolute', top: 72, left: 52, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.85 }}>
          {props.merek.logo ? (
            <Img src={staticFile(props.merek.logo)} style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain' }} />
          ) : null}
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 24, color: '#FFFDF9', letterSpacing: 0.5, textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
            {props.merek.nama}
          </span>
        </div>
      ) : null}

      {/* Musik latar dengan fade-in & fade-out halus */}
      {props.musik ? (
        <Audio
          src={staticFile(props.musik)}
          loop
          volume={(f) => {
            const masuk = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
            const keluar = interpolate(f, [total - 36, total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return volDasar * Math.min(masuk, keluar);
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
