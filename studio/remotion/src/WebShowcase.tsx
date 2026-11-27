// Komposisi Remotion `WebShowcase` (1080×1920, 30 FPS) — Video Promo Website & Aplikasi Custom Kelas Agency.
// 5 Babak: (1) Kinetic Hook + Ketik URL Address Bar → (2) 3D Laptop Full-Page Scroll Web Asli →
// (3) Dual-Device Desktop + HP Responsive → (4) Spotlight Fitur + Kursor Interaktif → (5) Penutup CTA Bakafrawi.
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { SANS } from './components/dasar';
import {
  contohWebShowcase,
  FPS_SHOWCASE,
  hitungDurasiWebShowcase,
  JEDA_AWAL_SHOWCASE,
  type KataShowcase,
  type PropsWebShowcase,
} from './data/web-showcase';

const pokok = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function kataRataShowcase(narasi: string, detik: number): KataShowcase[] {
  const kata = String(narasi ?? '').split(/\s+/).filter(Boolean);
  const total = kata.reduce((n, k) => n + k.length + 2, 0) || 1;
  let t = 0;
  return kata.map((teks) => {
    const d = ((teks.length + 2) / total) * Math.max(1.5, detik);
    const k = { teks, mulai: t, selesai: t + d };
    t += d;
    return k;
  });
}

function volumeMusikShowcase(frame: number, kataGlobal: { mulai: number; selesai: number }[]) {
  const t = frame / FPS_SHOWCASE;
  const bicara = kataGlobal.some((k) => t >= k.mulai - 0.15 && t <= k.selesai + 0.25);
  const masuk = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  return masuk * (bicara ? 0.11 : 0.3);
}

/** Latar gelap agency mewah: 2 aurora orb bergerak, kisi perspektif halus, dan partikel cahaya. */
const LatarAgency: React.FC<{ aksen: string; aksenKedua: string }> = ({ aksen, aksenKedua }) => {
  const frame = useCurrentFrame();
  const x1 = 76 + Math.sin(frame / 58) * 10;
  const y1 = 16 + Math.cos(frame / 64) * 7;
  const x2 = 20 + Math.cos(frame / 52) * 10;
  const y2 = 82 + Math.sin(frame / 60) * 6;
  const geserKisi = (frame * 0.45) % 72;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${x1}% ${y1}%, ${aksen}33 0%, transparent 46%), radial-gradient(circle at ${x2}% ${y2}%, ${aksenKedua}28 0%, transparent 50%), linear-gradient(170deg, #090E16 0%, #06080D 55%, #05070B 100%)`,
        overflow: 'hidden',
      }}
    >
      {/* Kisi geometris bergerak sangat halus */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.045) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(255,255,255,0.045) 1.5px, transparent 1.5px)`,
          backgroundSize: '72px 72px',
          backgroundPosition: `${geserKisi}px ${geserKisi}px`,
          WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 50% 44%, black 32%, transparent 100%)',
        }}
      />
      {/* Partikel bokeh lembut */}
      {[
        { x: 140, y: 360, s: 7, v: 0.55 },
        { x: 920, y: 520, s: 9, v: 0.45 },
        { x: 240, y: 1220, s: 6, v: 0.6 },
        { x: 860, y: 1440, s: 8, v: 0.5 },
        { x: 520, y: 260, s: 5, v: 0.4 },
      ].map((pt, idx) => {
        const y = ((pt.y - frame * pt.v) % 1920 + 1920) % 1920;
        const op = 0.22 + 0.18 * Math.sin(frame / 22 + idx * 1.7);
        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: pt.x,
              top: y,
              width: pt.s,
              height: pt.s,
              borderRadius: 99,
              background: idx % 2 === 0 ? aksenKedua : aksen,
              boxShadow: `0 0 18px ${idx % 2 === 0 ? aksenKedua : aksen}`,
              opacity: op,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Header atas (Zona Aman Reels): 5 segmen progress bar ala Story + identitas Bakafrawi. */
const BilahAtas: React.FC<{
  babak: { mulai: number; durasi: number }[];
  merek: PropsWebShowcase['merek'];
}> = ({ babak, merek }) => {
  const frame = useCurrentFrame();
  const idxKini = Math.max(0, babak.findLastIndex((b) => frame >= b.mulai));

  return (
    <div style={{ position: 'absolute', left: 56, right: 56, top: 68, zIndex: 40, fontFamily: SANS }}>
      {/* 5 segmen progress bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
        {babak.map((b, i) => {
          const isi = interpolate(frame, [b.mulai, b.mulai + b.durasi], [0, 100], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${isi}%`,
                  height: '100%',
                  borderRadius: 99,
                  background: `linear-gradient(90deg, ${merek.aksen} 0%, ${merek.aksenKedua} 100%)`,
                  boxShadow: `0 0 12px ${merek.aksenKedua}88`,
                }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 18px',
            borderRadius: 999,
            background: 'rgba(15,23,42,0.72)',
            border: '1px solid rgba(255,255,255,0.14)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 99, background: '#22C55E', boxShadow: '0 0 10px #22C55E' }} />
          <span style={{ fontSize: 22, fontWeight: 700, color: '#E2E8F0', letterSpacing: 0.4 }}>{merek.domain}</span>
          <span style={{ fontSize: 19, fontWeight: 700, color: merek.aksenKedua, marginLeft: 4 }}>
            0{idxKini + 1}/05
          </span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 18px',
            borderRadius: 999,
            background: 'rgba(15,23,42,0.72)',
            border: `1px solid ${merek.aksenKedua}44`,
          }}
        >
          {merek.logo ? <Img src={staticFile(merek.logo)} style={{ width: 32, height: 32, borderRadius: 8 }} /> : null}
          <span style={{ fontSize: 22, fontWeight: 800, color: '#F8FAFC', letterSpacing: 0.5 }}>Bakafrawi</span>
        </div>
      </div>
    </div>
  );
};

/** Subtitle kinetik modern di zona aman bawah (maks 5 kata per jendela, sorot kata kunci bercahaya). */
const SubtitleKinetik: React.FC<{
  kata: KataShowcase[];
  kataSorot: string[];
  aksen: string;
}> = ({ kata, kataSorot, aksen }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!kata.length) return null;
  const t = frame / fps - JEDA_AWAL_SHOWCASE;
  if (t < -0.1) return null;

  const setSorot = new Set(kataSorot.flatMap((k) => k.split(/\s+/)).map(pokok).filter(Boolean));
  let idxAktif = kata.findLastIndex((k) => t >= k.mulai - 0.05);
  if (idxAktif < 0) idxAktif = 0;
  const ukuranJendela = 5;
  const grup = Math.floor(idxAktif / ukuranJendela);
  const jendela = kata.slice(grup * ukuranJendela, (grup + 1) * ukuranJendela);
  const terakhir = kata.at(-1);
  if (terakhir && t > terakhir.selesai + 0.55) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 64,
        right: 64,
        bottom: 220,
        zIndex: 45,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          rowGap: 10,
          columnGap: 22,
          maxWidth: 940,
          padding: '18px 34px',
          borderRadius: 26,
          background: 'rgba(7, 10, 16, 0.8)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 22px 48px rgba(0,0,0,0.52)',
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 46,
          lineHeight: 1.28,
          letterSpacing: 0,
        }}
      >
        {jendela.map((k, i) => {
          const aktif = t >= k.mulai - 0.05 && t <= k.selesai + 0.12;
          const sorot = setSorot.has(pokok(k.teks));
          const p = spring({
            frame: frame - Math.round((JEDA_AWAL_SHOWCASE + k.mulai) * fps),
            fps,
            config: { damping: 14, stiffness: 220, mass: 0.6 },
          });
          const sudah = t >= k.mulai - 0.08;
          return (
            <span
              key={`${grup}-${i}`}
              style={{
                display: 'inline-block',
                padding: '0 3px',
                color: sorot || aktif ? aksen : '#F8FAFC',
                opacity: sudah ? 1 : 0.55,
                transform: `scale(${aktif ? 1.04 : 0.97 + 0.03 * p}) translateY(${aktif ? -2 : 0}px)`,
                textShadow: sorot || aktif ? `0 0 24px ${aksen}66, 0 4px 14px rgba(0,0,0,0.75)` : '0 4px 12px rgba(0,0,0,0.75)',
              }}
            >
              {k.teks}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Kursor panah modern + efek ripple klik bercahaya. */
const KursorKlik: React.FC<{ x: number; y: number; klikFrame: number; aksen: string }> = ({ x, y, klikFrame, aksen }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sudahKlik = frame >= klikFrame;
  const pRipple = sudahKlik
    ? interpolate(frame, [klikFrame, klikFrame + 22], [0, 1], { extrapolateRight: 'clamp' })
    : 0;
  const tekan = sudahKlik
    ? spring({ frame: frame - klikFrame, fps, config: { damping: 12, stiffness: 260 } })
    : 0;
  const skala = sudahKlik ? 1 - 0.16 * Math.sin(tekan * Math.PI) : 1;

  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 60, pointerEvents: 'none' }}>
      {sudahKlik && pRipple < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: -46,
            top: -46,
            width: 92,
            height: 92,
            borderRadius: 99,
            border: `4px solid ${aksen}`,
            opacity: 1 - pRipple,
            transform: `scale(${0.3 + pRipple * 1.5})`,
            boxShadow: `0 0 24px ${aksen}`,
          }}
        />
      ) : null}
      <svg
        width="54"
        height="54"
        viewBox="0 0 36 36"
        style={{
          transform: `scale(${skala})`,
          filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.6))',
        }}
      >
        <path
          d="M5 3 L30 17 L18 20 L13 32 Z"
          fill="#FFFFFF"
          stroke="#090D16"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

/** Wrapper transisi masuk/keluar sinematik per babak. */
const PanggungBabak: React.FC<{ durasi: number; children: React.ReactNode }> = ({ durasi, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const masuk = spring({ frame, fps, config: { damping: 16, stiffness: 125 } });
  const keluar = interpolate(frame, [durasi - 10, durasi], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const op = Math.min(masuk, keluar);
  const geserY = (1 - masuk) * 42 - (1 - keluar) * 26;
  const skala = 0.95 + 0.05 * masuk - (1 - keluar) * 0.03;

  return (
    <AbsoluteFill
      style={{
        opacity: op,
        transform: `translateY(${geserY}px) scale(${skala})`,
        fontFamily: SANS,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Babak 1: Kinetic Hook + Address Bar mengetik URL `almansur.id` huruf demi huruf + kursor klik! */
const BabakHook: React.FC<{ p: PropsWebShowcase; durasi: number }> = ({ p, durasi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { hook, merek } = p;
  const urlTampil = `https://${merek.domain}`;
  const ketikJumlah = Math.round(
    interpolate(frame, [18, Math.min(durasi - 36, 74)], [0, urlTampil.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const teksKetik = urlTampil.slice(0, ketikJumlah);
  const kedip = Math.floor(frame / 10) % 2 === 0;
  const klikFrame = Math.min(durasi - 24, 82);
  const kursorX = interpolate(frame, [52, klikFrame - 4], [760, 815], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const kursorY = interpolate(frame, [52, klikFrame - 4], [1160, 1020], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const kataJudul = hook.judul.split(/\s+/).filter(Boolean);
  const sorotLower = hook.sorotKata.toLowerCase();

  return (
    <PanggungBabak durasi={durasi}>
      <div style={{ position: 'absolute', left: 72, right: 72, top: 270, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Badge Sektor */}
        <div style={{ display: 'flex' }}>
          <div
            style={{
              padding: '12px 24px',
              borderRadius: 999,
              background: `${merek.aksen}22`,
              border: `1.5px solid ${merek.aksenKedua}66`,
              color: merek.aksenKedua,
              fontWeight: 800,
              fontSize: 24,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            ✦ {hook.badge}
          </div>
        </div>

        {/* Headline besar bertingkat */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px 22px',
            fontWeight: 900,
            fontSize: 92,
            lineHeight: 1.02,
            letterSpacing: -2.8,
            color: '#FFFFFF',
            textTransform: 'uppercase',
          }}
        >
          {kataJudul.map((k, i) => {
            const sp = spring({ frame: frame - 3 - i * 3, fps, config: { damping: 14, stiffness: 170 } });
            const kena = Boolean(sorotLower) && k.toLowerCase().includes(sorotLower);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  opacity: sp,
                  transform: `translateY(${(1 - sp) * 38}px) ${kena ? `rotate(${-1.8 * sp}deg)` : ''}`,
                  ...(kena
                    ? {
                        background: `linear-gradient(120deg, ${merek.aksen} 0%, ${merek.aksenKedua} 100%)`,
                        color: '#061014',
                        padding: '4px 22px 10px',
                        borderRadius: 20,
                        boxShadow: `0 18px 42px -12px ${merek.aksenKedua}99`,
                      }
                    : {}),
                }}
              >
                {k}
              </span>
            );
          })}
        </div>

        <div style={{ fontSize: 34, fontWeight: 500, lineHeight: 1.4, color: '#CBD5E1', maxWidth: 880 }}>
          {hook.sub}
        </div>
      </div>

      {/* 3D Glass Address Bar Mengetik URL */}
      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          top: 965,
          padding: '22px 26px',
          borderRadius: 28,
          background: 'rgba(15, 23, 42, 0.88)',
          border: `2px solid ${merek.aksenKedua}66`,
          boxShadow: `0 28px 70px rgba(0,0,0,0.6), 0 0 42px ${merek.aksen}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              background: 'rgba(34,197,94,0.16)',
              border: '1.5px solid rgba(34,197,94,0.45)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 24,
            }}
          >
            🔒
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#F8FAFC', letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {teksKetik}
            {kedip && ketikJumlah < urlTampil.length ? (
              <span style={{ color: merek.aksenKedua }}>|</span>
            ) : null}
          </div>
        </div>

        <div
          style={{
            padding: '14px 28px',
            borderRadius: 18,
            background: `linear-gradient(120deg, ${merek.aksen} 0%, ${merek.aksenKedua} 100%)`,
            color: '#061014',
            fontWeight: 800,
            fontSize: 26,
            flexShrink: 0,
            transform: frame >= klikFrame && frame <= klikFrame + 8 ? 'scale(0.92)' : 'scale(1)',
          }}
        >
          Buka →
        </div>
      </div>

      {/* Preview kartu mini situs langsung jelas di bawah address bar */}
      {p.media.desktopHero || p.media.desktopMid ? (
        <div
          style={{
            position: 'absolute',
            left: 88,
            right: 88,
            top: 1098,
            height: 390,
            borderRadius: 24,
            overflow: 'hidden',
            border: `2px solid ${merek.aksenKedua}55`,
            boxShadow: `0 30px 70px rgba(0,0,0,0.68), 0 0 36px ${merek.aksen}24`,
            background: '#0F172A',
            opacity: interpolate(frame, [10, Math.min(klikFrame + 12, 56)], [0.62, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            transform: `translateY(${interpolate(frame, [10, Math.min(klikFrame + 12, 56)], [22, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
          }}
        >
          <Img
            src={staticFile(p.media.desktopHero || p.media.desktopMid || '')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
          />
        </div>
      ) : null}

      {frame >= 50 ? <KursorKlik x={kursorX} y={kursorY} klikFrame={klikFrame} aksen={merek.aksenKedua} /> : null}
    </PanggungBabak>
  );
};

/** Babak 2: 3D Studio Browser — Live Full-Page Scroll website asli (`desktopFull`). */
const BabakBrowserScroll: React.FC<{ p: PropsWebShowcase; durasi: number }> = ({ p, durasi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { merek, media, browser } = p;

  const winW = 956;
  const barH = 54;
  const viewH = 640;
  const rasioTinggi = media.desktopFullLebar && media.desktopFullTinggi
    ? media.desktopFullTinggi / media.desktopFullLebar
    : 2.6;
  const tinggiGambar = Math.max(viewH, Math.round(winW * rasioTinggi));
  const maksScroll = Math.max(0, tinggiGambar - viewH);
  const progresScroll = interpolate(frame, [16, Math.max(24, durasi - 18)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const scrollY = maksScroll * progresScroll;

  const rotY = interpolate(frame, [0, durasi], [-4, 3], { extrapolateRight: 'clamp' });
  const rotX = interpolate(frame, [0, durasi], [3, 1], { extrapolateRight: 'clamp' });
  const kilauX = interpolate(frame, [0, durasi], [-320, 1180], { extrapolateRight: 'clamp' });
  const gambarSrc = media.desktopFull || media.desktopHero || media.desktopMid;

  return (
    <PanggungBabak durasi={durasi}>
      {/* Judul + Chips Fitur */}
      <div style={{ position: 'absolute', left: 68, right: 68, top: 220, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 54, fontWeight: 900, color: '#FFFFFF', letterSpacing: -1.4, lineHeight: 1.08 }}>
          {browser.judulBagian}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {browser.chips.slice(0, 3).map((chip, i) => {
            const sp = spring({ frame: frame - 8 - i * 8, fps, config: { damping: 14, stiffness: 165 } });
            return (
              <div
                key={i}
                style={{
                  padding: '10px 20px',
                  borderRadius: 999,
                  background: 'rgba(15, 23, 42, 0.78)',
                  border: `1.5px solid ${merek.aksenKedua}55`,
                  color: '#F1F5F9',
                  fontSize: 24,
                  fontWeight: 700,
                  opacity: sp,
                  transform: `translateY(${(1 - sp) * 20}px)`,
                }}
              >
                <span style={{ color: merek.aksenKedua, marginRight: 8 }}>●</span>
                {chip}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3D Browser Window */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 435,
          display: 'flex',
          justifyContent: 'center',
          perspective: 1800,
        }}
      >
        <div
          style={{
            width: winW,
            borderRadius: 28,
            overflow: 'hidden',
            background: '#0F141E',
            border: '2px solid rgba(255,255,255,0.2)',
            boxShadow: `0 44px 96px rgba(0,0,0,0.75), 0 0 60px ${merek.aksen}26`,
            transform: `rotateY(${rotY}deg) rotateX(${rotX}deg)`,
            position: 'relative',
          }}
        >
          {/* Chrome-less MacOS Header Bar */}
          <div
            style={{
              height: barH,
              background: '#161B26',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              padding: '0 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ width: 14, height: 14, borderRadius: 99, background: '#EF4444' }} />
              <span style={{ width: 14, height: 14, borderRadius: 99, background: '#F59E0B' }} />
              <span style={{ width: 14, height: 14, borderRadius: 99, background: '#22C55E' }} />
            </div>
            <div
              style={{
                padding: '6px 24px',
                borderRadius: 99,
                background: 'rgba(255,255,255,0.06)',
                fontSize: 20,
                fontWeight: 600,
                color: '#CBD5E1',
              }}
            >
              🔒 {merek.domain}
            </div>
            <div style={{ width: 62 }} />
          </div>

          {/* Viewport Scroll Web Asli */}
          <div style={{ width: winW, height: viewH, overflow: 'hidden', position: 'relative', background: '#0B0F17' }}>
            {gambarSrc ? (
              <Img
                src={staticFile(gambarSrc)}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: -scrollY,
                  width: winW,
                  height: tinggiGambar,
                  objectFit: 'cover',
                  objectPosition: 'top',
                }}
              />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#94A3B8', fontSize: 32 }}>
                Pratinjau {merek.domain}
              </div>
            )}

            {/* Scrollbar kanan bercahaya */}
            <div style={{ position: 'absolute', right: 8, top: 14, bottom: 14, width: 6, borderRadius: 99, background: 'rgba(0,0,0,0.3)' }}>
              <div
                style={{
                  position: 'absolute',
                  top: `${progresScroll * 76}%`,
                  width: 6,
                  height: '24%',
                  borderRadius: 99,
                  background: merek.aksenKedua,
                  boxShadow: `0 0 12px ${merek.aksenKedua}`,
                }}
              />
            </div>

            {/* Kilau kaca diagonal halus */}
            <div
              style={{
                position: 'absolute',
                top: -80,
                bottom: -80,
                left: kilauX,
                width: 170,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                transform: 'skewX(-18deg)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Kaki Laptop Tipis */}
      <div
        style={{
          position: 'absolute',
          left: 90,
          right: 90,
          top: 1122,
          height: 18,
          borderRadius: '0 0 24px 24px',
          background: 'linear-gradient(90deg, #1E293B 0%, #64748B 50%, #1E293B 100%)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.75)',
          opacity: 0.9,
        }}
      />

      {/* Indikator Live Scroll */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1175, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            padding: '10px 24px',
            borderRadius: 999,
            background: 'rgba(15,23,42,0.75)',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: 22,
            fontWeight: 700,
            color: '#94A3B8',
          }}
        >
          LIVE WEBSITE PREVIEW · <span style={{ color: merek.aksenKedua }}>{Math.round(progresScroll * 100)}%</span>
        </div>
      </div>
    </PanggungBabak>
  );
};

/** Babak 3: Dual-Device 3D — Desktop di belakang + iPhone Frame di depan menggulir versi Mobile asli! */
const BabakResponsive: React.FC<{ p: PropsWebShowcase; durasi: number }> = ({ p, durasi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { merek, media, responsive } = p;

  const hpMasuk = spring({ frame: frame - 8, fps, config: { damping: 14, stiffness: 120 } });
  const hpW = 340;
  const hpH = 690;
  const mobRasio = media.mobileFullLebar && media.mobileFullTinggi
    ? media.mobileFullTinggi / media.mobileFullLebar
    : 3.1;
  const mobImgH = Math.max(hpH - 28, Math.round((hpW - 24) * mobRasio));
  const maksMobScroll = Math.max(0, mobImgH - (hpH - 28));
  const mobScroll = maksMobScroll * interpolate(frame, [18, Math.max(28, durasi - 16)], [0, 0.72], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.sin),
  });

  const deskSrc = media.desktopHero || media.desktopFull;
  const mobSrc = media.mobileFull || media.mobileHero || deskSrc;

  return (
    <PanggungBabak durasi={durasi}>
      <div style={{ position: 'absolute', left: 68, right: 68, top: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: merek.aksenKedua, fontWeight: 800, fontSize: 24, letterSpacing: 2.2, textTransform: 'uppercase' }}>
          ◈ {responsive.badge}
        </div>
        <div style={{ fontSize: 58, fontWeight: 900, color: '#FFFFFF', letterSpacing: -1.6, lineHeight: 1.06 }}>
          {responsive.judul}
        </div>
      </div>

      {/* Panggung Dual Device 3D */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 410, height: 740, perspective: 1800 }}>
        {/* Layar Desktop di Kiri Belakang */}
        <div
          style={{
            position: 'absolute',
            left: 48,
            top: 40,
            width: 730,
            height: 470,
            borderRadius: 24,
            overflow: 'hidden',
            background: '#111827',
            border: '2px solid rgba(255,255,255,0.2)',
            boxShadow: '0 36px 80px rgba(0,0,0,0.72)',
            transform: `rotateY(10deg) rotateX(3deg) translateY(${Math.sin(frame / 28) * 6}px)`,
          }}
        >
          <div style={{ height: 36, background: '#1E293B', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: '#EF4444' }} />
            <span style={{ width: 10, height: 10, borderRadius: 99, background: '#F59E0B' }} />
            <span style={{ width: 10, height: 10, borderRadius: 99, background: '#22C55E' }} />
            <span style={{ marginLeft: 12, fontSize: 15, color: '#94A3B8', fontWeight: 600 }}>Desktop · {merek.domain}</span>
          </div>
          {deskSrc ? (
            <Img src={staticFile(deskSrc)} style={{ width: '100%', height: 434, objectFit: 'cover', objectPosition: 'top' }} />
          ) : null}
        </div>

        {/* Mockup iPhone Titanium + Dynamic Island di Kanan Depan */}
        <div
          style={{
            position: 'absolute',
            right: 54,
            top: 20,
            width: hpW,
            height: hpH,
            borderRadius: 56,
            padding: 12,
            background: 'linear-gradient(145deg, #475569 0%, #0F172A 48%, #334155 100%)',
            border: '2px solid rgba(255,255,255,0.28)',
            boxShadow: `0 42px 88px rgba(0,0,0,0.82), 0 0 42px ${merek.aksenKedua}28`,
            opacity: hpMasuk,
            transform: `translateY(${(1 - hpMasuk) * 90 + Math.cos(frame / 24) * 7}px) rotateY(-10deg) rotateZ(2deg)`,
          }}
        >
          <div style={{ width: '100%', height: '100%', borderRadius: 44, overflow: 'hidden', position: 'relative', background: '#090D16' }}>
            {/* Dynamic Island */}
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 96,
                height: 24,
                borderRadius: 99,
                background: '#05070B',
                zIndex: 20,
              }}
            />
            {mobSrc ? (
              <Img
                src={staticFile(mobSrc)}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: -mobScroll,
                  width: '100%',
                  height: mobImgH,
                  objectFit: 'cover',
                  objectPosition: 'top',
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* 3 Poin Responsif di Bawah */}
      <div style={{ position: 'absolute', left: 68, right: 68, top: 1160, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {responsive.poin.slice(0, 3).map((poin, i) => {
          const sp = spring({ frame: frame - 14 - i * 8, fps, config: { damping: 14, stiffness: 170 } });
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 24px',
                borderRadius: 20,
                background: 'rgba(15, 23, 42, 0.78)',
                border: '1px solid rgba(255,255,255,0.12)',
                opacity: sp,
                transform: `translateX(${(1 - sp) * -36}px)`,
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: `${merek.aksenKedua}24`,
                  color: merek.aksenKedua,
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 900,
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#F1F5F9' }}>{poin}</span>
            </div>
          );
        })}
      </div>
    </PanggungBabak>
  );
};

/** Babak 4: Spotlight Fitur + Kursor Interaktif + 3 Kartu Manfaat Glassmorphism. */
const BabakSpotlight: React.FC<{ p: PropsWebShowcase; durasi: number }> = ({ p, durasi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { merek, media, spotlight } = p;
  const gambar = media.desktopMid || media.desktopHero || media.desktopFull;
  const zoom = interpolate(frame, [0, durasi], [1.02, 1.14], { extrapolateRight: 'clamp' });
  const klikFrame = Math.min(durasi - 30, 38);
  const kx = interpolate(frame, [10, klikFrame - 4], [780, 560], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const ky = interpolate(frame, [10, klikFrame - 4], [820, 650], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const pill = spring({ frame: frame - klikFrame, fps, config: { damping: 13, stiffness: 180 } });

  return (
    <PanggungBabak durasi={durasi}>
      <div style={{ position: 'absolute', left: 68, right: 68, top: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: merek.aksenKedua, fontWeight: 800, fontSize: 24, letterSpacing: 2, textTransform: 'uppercase' }}>
          ★ {spotlight.badge}
        </div>
        <div style={{ fontSize: 56, fontWeight: 900, color: '#FFFFFF', letterSpacing: -1.5, lineHeight: 1.06 }}>
          {spotlight.judul}
        </div>
      </div>

      {/* Kartu Preview Spotlight */}
      <div
        style={{
          position: 'absolute',
          left: 68,
          right: 68,
          top: 410,
          height: 510,
          borderRadius: 30,
          overflow: 'hidden',
          border: `2px solid ${merek.aksenKedua}66`,
          boxShadow: `0 34px 80px rgba(0,0,0,0.75), 0 0 48px ${merek.aksen}2A`,
          background: '#0F172A',
        }}
      >
        {gambar ? (
          <Img
            src={staticFile(gambar)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
              transform: `scale(${zoom})`,
            }}
          />
        ) : null}
        <AbsoluteFill
          style={{
            background: 'linear-gradient(180deg, transparent 50%, rgba(6,9,15,0.72) 100%)',
          }}
        />
        {/* Badge hasil klik */}
        <div
          style={{
            position: 'absolute',
            left: 32,
            bottom: 28,
            padding: '12px 24px',
            borderRadius: 16,
            background: `linear-gradient(120deg, ${merek.aksen} 0%, ${merek.aksenKedua} 100%)`,
            color: '#061014',
            fontWeight: 900,
            fontSize: 26,
            opacity: pill,
            transform: `translateY(${(1 - pill) * 24}px)`,
            boxShadow: `0 14px 32px ${merek.aksenKedua}66`,
          }}
        >
          ⚡ {spotlight.labelKlik}
        </div>
      </div>

      {frame >= 8 ? <KursorKlik x={kx} y={ky} klikFrame={klikFrame} aksen={merek.aksenKedua} /> : null}

      {/* 3 Kartu Fitur Utama */}
      <div style={{ position: 'absolute', left: 68, right: 68, top: 960, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {spotlight.daftar.slice(0, 3).map((item, i) => {
          const sp = spring({ frame: frame - 16 - i * 10, fps, config: { damping: 14, stiffness: 165 } });
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '20px 26px',
                borderRadius: 22,
                background: 'rgba(15, 23, 42, 0.84)',
                border: `1.5px solid ${i === 0 ? `${merek.aksenKedua}66` : 'rgba(255,255,255,0.12)'}`,
                opacity: sp,
                transform: `translateY(${(1 - sp) * 28}px)`,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${merek.aksen} 0%, ${merek.aksenKedua} 100%)`,
                  color: '#061014',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 900,
                  fontSize: 24,
                  flexShrink: 0,
                }}
              >
                0{i + 1}
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#F8FAFC', lineHeight: 1.25 }}>{item}</div>
            </div>
          );
        })}
      </div>
    </PanggungBabak>
  );
};

/** Babak 5: Penutup Agency CTA Bakafrawi dengan Medali Logo & Tombol Shimmer. */
const BabakPenutup: React.FC<{ p: PropsWebShowcase; durasi: number }> = ({ p, durasi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { merek, penutup } = p;
  const sp = spring({ frame, fps, config: { damping: 14, stiffness: 130 } });
  const shimmer = interpolate(frame, [18, durasi - 10], [-220, 720], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <PanggungBabak durasi={durasi}>
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 78px 140px',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, transform: `scale(${0.92 + 0.08 * sp})` }}>
          {/* Medali Logo Bakafrawi */}
          <div
            style={{
              width: 196,
              height: 196,
              borderRadius: 48,
              background: 'rgba(15, 23, 42, 0.85)',
              border: `2.5px solid ${merek.aksenKedua}88`,
              boxShadow: `0 0 80px ${merek.aksen}55, 0 28px 60px rgba(0,0,0,0.7)`,
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
            }}
          >
            {merek.logo ? (
              <Img src={staticFile(merek.logo)} style={{ width: 128, height: 128, borderRadius: 28, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 64, fontWeight: 900, color: merek.aksenKedua }}>B</span>
            )}
          </div>

          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 3,
              color: merek.aksenKedua,
              textTransform: 'uppercase',
            }}
          >
            BAKAFRAWI PROJECT · STUDIO SOFTWARE &amp; WEB
          </div>

          <div style={{ fontSize: 70, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.08, letterSpacing: -2, maxWidth: 880 }}>
            {penutup.judul}
          </div>

          {/* Tombol CTA dengan efek Shimmer */}
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              padding: '24px 54px',
              borderRadius: 999,
              background: `linear-gradient(120deg, ${merek.aksen} 0%, ${merek.aksenKedua} 100%)`,
              color: '#061014',
              fontSize: 38,
              fontWeight: 900,
              boxShadow: `0 22px 54px ${merek.aksenKedua}66`,
              marginTop: 8,
            }}
          >
            {penutup.tombol} →
            <div
              style={{
                position: 'absolute',
                top: -20,
                bottom: -20,
                left: shimmer,
                width: 90,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                transform: 'skewX(-22deg)',
              }}
            />
          </div>

          <div
            style={{
              marginTop: 6,
              padding: '14px 32px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)',
              fontSize: 28,
              fontWeight: 700,
              color: '#E2E8F0',
            }}
          >
            {merek.info}
          </div>
        </div>
      </AbsoluteFill>
    </PanggungBabak>
  );
};

export const WebShowcase: React.FC<PropsWebShowcase> = (props) => {
  const { babak, total } = hitungDurasiWebShowcase(props);
  const narasiBabak = [
    { narasi: props.hook.narasi, sorot: props.hook.kataSorot },
    { narasi: props.browser.narasi, sorot: props.browser.kataSorot },
    { narasi: props.responsive.narasi, sorot: props.responsive.kataSorot },
    { narasi: props.spotlight.narasi, sorot: props.spotlight.kataSorot },
    { narasi: props.penutup.narasi, sorot: props.penutup.kataSorot },
  ];

  const kataGlobal = babak.flatMap((b, i) => {
    const k = props.suara?.[i]?.kata ?? [];
    return k.map((w) => ({
      mulai: b.mulai / FPS_SHOWCASE + JEDA_AWAL_SHOWCASE + w.mulai,
      selesai: b.mulai / FPS_SHOWCASE + JEDA_AWAL_SHOWCASE + w.selesai,
    }));
  });

  const renderBabak = (i: number, durasi: number) => {
    if (i === 0) return <BabakHook p={props} durasi={durasi} />;
    if (i === 1) return <BabakBrowserScroll p={props} durasi={durasi} />;
    if (i === 2) return <BabakResponsive p={props} durasi={durasi} />;
    if (i === 3) return <BabakSpotlight p={props} durasi={durasi} />;
    return <BabakPenutup p={props} durasi={durasi} />;
  };

  return (
    <AbsoluteFill style={{ background: '#06080D', fontFamily: SANS }}>
      <LatarAgency aksen={props.merek.aksen} aksenKedua={props.merek.aksenKedua} />
      <BilahAtas babak={babak} merek={props.merek} />

      {babak.map((b, i) => {
        const s = props.suara?.[i];
        const kataPakai = s?.kata?.length
          ? s.kata
          : kataRataShowcase(narasiBabak[i].narasi, b.durasi / FPS_SHOWCASE - JEDA_AWAL_SHOWCASE - 0.4);
        const sfxTransisi = i === 0 ? props.sfx?.pop : i === 4 ? props.sfx?.chime : props.sfx?.whoosh;
        return (
          <Sequence key={i} from={b.mulai} durationInFrames={b.durasi} name={`Babak ${i + 1}`}>
            {renderBabak(i, b.durasi)}
            <SubtitleKinetik kata={kataPakai} kataSorot={narasiBabak[i].sorot} aksen={props.merek.aksenKedua} />
            {s?.berkas ? (
              <Sequence from={Math.round(JEDA_AWAL_SHOWCASE * FPS_SHOWCASE)} layout="none">
                <Audio src={staticFile(s.berkas)} />
              </Sequence>
            ) : null}
            {sfxTransisi ? <Audio src={staticFile(sfxTransisi)} volume={0.38} /> : null}
          </Sequence>
        );
      })}

      {props.musik ? (
        <Audio src={staticFile(props.musik)} volume={(f) => volumeMusikShowcase(f, kataGlobal)} loop />
      ) : null}
    </AbsoluteFill>
  );
};

export { hitungDurasiWebShowcase, FPS_SHOWCASE, contohWebShowcase };
export type { PropsWebShowcase };
