// Komposisi Remotion khusus Story Jam Buka AI Lek Kopi (9:16, 9 detik, 30 fps — 3 adegan).
// Identitas visual KHAS Lek Kopi (berbeda dari grid teknis Bakafrawi):
// latar editorial kafe minimalis elegan (tanpa kisi kotak), lengkung halus cincin kopi & bingkai hairline,
// tipografi serif + sans bersih, 1 menu asli Lek Kopi, penutup estetik (logo proporsional + ikon delivery kecil opsional).
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const FPS_OPENING = 30;
export const DURASI_ADEGAN = 90; // 3 detik per adegan

export type GayaOpening = 'hangat-kafe' | 'terang-modern' | 'minimalis-gelap';

export type ItemMenuOpening = {
  nama: string;
  harga: string;
  ket: string;
  /** Mis. "#1 TERLARIS KEMARIN" atau "PILIHAN HARI INI" */
  lencana?: string;
  /** Nama berkas foto produk di public-dir (opsional). */
  foto?: string;
};

export type PropsOpening = {
  merek: string;
  hari: string;
  jamBuka: string;
  jamTutup: string;
  hariBuka: string;
  judul: string;
  sub: string;
  /** Daftar 1–3 menu pilihan (diutamakan 3 menu terlaris hari sebelumnya dari aplikasi Lek Kopi). */
  daftarMenu?: ItemMenuOpening[];
  /** Fallback kompatibilitas 1 menu bila daftarMenu tidak dikirim. */
  menuNama: string;
  menuHarga: string;
  menuKet: string;
  situs: string;
  alamat: string;
  aksen: string;
  gaya: GayaOpening;
  /** Tampilkan baris ikon kecil GoFood / GrabFood / ShopeeFood di penutup (opsional, tidak harus selalu). */
  tampilDelivery?: boolean;
  /** Nama berkas gambar produk/menu di public-dir (foto asli Lek Kopi App atau foto AI). */
  fotoLatar?: string;
  /** Nama berkas musik di public-dir (opsional). */
  musik?: string;
  /** Efek suara halus (whoosh transisi, pop kartu, chime penutup). */
  sfx?: { whoosh?: string; pop?: string; chime?: string };
};

export function daftarMenuEfektif(p: PropsOpening): ItemMenuOpening[] {
  if (Array.isArray(p.daftarMenu) && p.daftarMenu.length > 0) {
    return p.daftarMenu.slice(0, 3);
  }
  return [
    {
      nama: p.menuNama,
      harga: p.menuHarga,
      ket: p.menuKet,
      lencana: 'Pilihan Hari Ini',
      foto: p.fotoLatar,
    },
  ];
}

export function hitungDurasiOpening(p: PropsOpening): number {
  const jmlMenu = daftarMenuEfektif(p).length;
  // Pembuka (3 dtk) + Menu (3 dtk x jumlahMenu) + Penutup (3 dtk)
  return DURASI_ADEGAN * (2 + jmlMenu);
}

export const DURASI_OPENING = DURASI_ADEGAN * 5; // default 15 detik (3 menu terlaris)

export const contohOpening: PropsOpening = {
  merek: 'LEK KOPI',
  hari: 'SABTU',
  jamBuka: '09:00',
  jamTutup: '23:00',
  hariBuka: 'Senin – Sabtu',
  judul: 'WE ARE\nOPEN.',
  sub: 'Seduhan segar sudah siap menemani harimu.',
  daftarMenu: [
    {
      nama: 'Es Kopi Susu Lek',
      harga: 'Rp12.000',
      ket: 'Espresso segar & susu creamy manis pas — paling dicari kemarin.',
      lencana: '#1 Terlaris Kemarin',
    },
    {
      nama: 'Iced Matcha Latte',
      harga: 'Rp14.000',
      ket: 'Matcha lembut berpadu susu dingin yang menyegarkan.',
      lencana: '#2 Terlaris Kemarin',
    },
    {
      nama: 'Iced Americano',
      harga: 'Rp10.000',
      ket: 'Kopi hitam dingin ringan & segar, pas buat teman kerja.',
      lencana: '#3 Terlaris Kemarin',
    },
  ],
  menuNama: 'Es Kopi Susu Lek',
  menuHarga: 'Rp12.000',
  menuKet: 'Espresso segar & susu creamy manis pas — favorit di Lek Kopi.',
  situs: 'lek-kopi.web.app',
  alamat: 'Panjunan, Waru, Sidoarjo',
  aksen: '#D6A668',
  gaya: 'hangat-kafe',
  tampilDelivery: true,
};

const TEMA: Record<
  GayaOpening,
  {
    bg: string;
    aura1: string;
    aura2: string;
    ring: string;
    bingkai: string;
    teks: string;
    sub: string;
    kartuBg: string;
    kartuBorder: string;
    pilBg: string;
    lencanaBg: string;
    lencanaTeks: string;
  }
> = {
  // Khas Lek Kopi: Roasted Espresso editorial — hangat, dalam, simpel, elegan
  'hangat-kafe': {
    bg: 'radial-gradient(ellipse at 20% 15%, #241A14 0%, #140F0C 52%, #0D0A08 100%)',
    aura1: 'rgba(214, 166, 104, 0.16)',
    aura2: 'rgba(148, 98, 56, 0.12)',
    ring: 'rgba(214, 166, 104, 0.13)',
    bingkai: 'rgba(245, 239, 230, 0.11)',
    teks: '#F5EFE6',
    sub: '#B8ACA0',
    kartuBg: 'rgba(28, 21, 17, 0.88)',
    kartuBorder: 'rgba(214, 166, 104, 0.24)',
    pilBg: 'rgba(245, 239, 230, 0.06)',
    lencanaBg: '#F5EFE6',
    lencanaTeks: '#140F0C',
  },
  // Linen Oat Latte editorial — terang hangat organik, bukan putih grid
  'terang-modern': {
    bg: 'radial-gradient(ellipse at 82% 14%, #F7F1E6 0%, #EDE5D8 58%, #E6DDD0 100%)',
    aura1: 'rgba(186, 134, 74, 0.15)',
    aura2: 'rgba(120, 82, 48, 0.08)',
    ring: 'rgba(92, 66, 44, 0.12)',
    bingkai: 'rgba(32, 24, 18, 0.11)',
    teks: '#1C1612',
    sub: '#665A4F',
    kartuBg: 'rgba(255, 252, 247, 0.92)',
    kartuBorder: 'rgba(32, 24, 18, 0.1)',
    pilBg: 'rgba(32, 24, 18, 0.05)',
    lencanaBg: '#1C1612',
    lencanaTeks: '#F7F1E6',
  },
  // Charcoal Coffee Bar — gelap monokrom elegan (matching logo hitam-putih Lek Kopi)
  'minimalis-gelap': {
    bg: 'radial-gradient(ellipse at 50% 10%, #1F1E1C 0%, #111110 55%, #090909 100%)',
    aura1: 'rgba(255, 255, 255, 0.07)',
    aura2: 'rgba(214, 166, 104, 0.09)',
    ring: 'rgba(255, 255, 255, 0.09)',
    bingkai: 'rgba(255, 255, 255, 0.1)',
    teks: '#F7F7F5',
    sub: '#A3A19C',
    kartuBg: 'rgba(24, 24, 22, 0.9)',
    kartuBorder: 'rgba(255, 255, 255, 0.12)',
    pilBg: 'rgba(255, 255, 255, 0.06)',
    lencanaBg: '#F7F7F5',
    lencanaTeks: '#111110',
  },
};

function useOpasitasAdegan(durasi: number) {
  const frame = useCurrentFrame();
  const masuk = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const keluar = interpolate(frame, [durasi - 8, durasi], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return Math.min(masuk, keluar);
}

/** Ilustrasi gelas es kopi minimalis vektor (cadangan bila tidak ada foto produk). */
const IlustrasiKopi: React.FC<{ aksen: string; gelap: boolean }> = ({ aksen, gelap }) => (
  <svg width="210" height="210" viewBox="0 0 220 220" fill="none">
    <circle cx="110" cy="110" r="94" fill={aksen} fillOpacity={gelap ? '0.12' : '0.16'} />
    <path d="M126 34L118 82" stroke={gelap ? '#F5EFE6' : '#1C1612'} strokeWidth="6.5" strokeLinecap="round" />
    <rect x="64" y="72" width="92" height="13" rx="6.5" fill={gelap ? '#F5EFE6' : '#1C1612'} />
    <path
      d="M72 85H148L139 172C138.3 178.8 132.6 184 125.8 184H94.2C87.4 184 81.7 178.8 81 172L72 85Z"
      fill={gelap ? '#261D17' : '#EFE7DB'}
      stroke={gelap ? '#F5EFE6' : '#1C1612'}
      strokeWidth="4.5"
    />
    <path
      d="M78 122H142L136.5 170C136 174.5 132.2 178 127.7 178H92.3C87.8 178 84 174.5 83.5 170L78 122Z"
      fill={aksen}
      fillOpacity="0.9"
    />
    <rect x="91" y="99" width="17" height="17" rx="4" transform="rotate(-12 91 99)" fill="#FFFFFF" fillOpacity="0.82" />
    <rect x="114" y="102" width="15" height="15" rx="4" transform="rotate(14 114 102)" fill="#FFFFFF" fillOpacity="0.68" />
  </svg>
);

/** Ikon kecil & rapi untuk GoFood, GrabFood, ShopeeFood di penutup. */
const BarisDelivery: React.FC<{ gelap: boolean }> = ({ gelap }) => {
  const pillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 18px',
    borderRadius: 999,
    background: gelap ? 'rgba(255,255,255,0.05)' : 'rgba(28,22,18,0.05)',
    border: `1.5px solid ${gelap ? 'rgba(255,255,255,0.1)' : 'rgba(28,22,18,0.09)'}`,
    fontSize: 20,
    fontWeight: 700,
    color: gelap ? '#E7E2DA' : '#29231E',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.5 }}>
        Pesan Online
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={pillStyle}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#EE2737" />
            <path d="M9 7.5V16.5M9 12.5C7.6 12.5 7 11.4 7 10V7.5M11 7.5V10C11 11.4 10.4 12.5 9 12.5M15.5 7.5V16.5M15.5 7.5C17 7.5 17.5 9 17.5 10.8C17.5 12 16.7 12.6 15.5 12.6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>GoFood</span>
        </div>
        <div style={pillStyle}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#00B14F" />
            <path d="M8 10.5H16L15.2 16.2C15.1 16.9 14.5 17.4 13.8 17.4H10.2C9.5 17.4 8.9 16.9 8.8 16.2L8 10.5Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M10 10.5V9C10 7.9 10.9 7 12 7C13.1 7 14 7.9 14 9V10.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>GrabFood</span>
        </div>
        <div style={pillStyle}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#EE4D2D" />
            <path d="M8.2 10H15.8L15.2 16.3C15.1 17 14.5 17.5 13.8 17.5H10.2C9.5 17.5 8.9 17 8.8 16.3L8.2 10Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M10 10V8.8C10 7.7 10.9 6.8 12 6.8C13.1 6.8 14 7.7 14 8.8V10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>ShopeeFood</span>
        </div>
      </div>
    </div>
  );
};

// ── ADEGAN 1 (0–3 dtk): PEMBUKA EDITORIAL KAFE ──
const AdeganPembuka: React.FC<{ p: PropsOpening; t: (typeof TEMA)[GayaOpening]; aksen: string }> = ({ p, t, aksen }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = useOpasitasAdegan(90);

  const sPil = spring({ frame: frame - 3, fps, config: { damping: 14, stiffness: 125 } });
  const sJudul = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 112 } });
  const sSub = spring({ frame: frame - 22, fps, config: { damping: 15, stiffness: 108 } });
  const denyut = 0.72 + 0.28 * Math.sin((frame / fps) * Math.PI * 2.4);
  const garis = interpolate(frame, [14, 42], [0, 96], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const baris = p.judul.split('\n').filter(Boolean);

  return (
    <AbsoluteFill
      style={{
        opacity: op,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: '0 96px',
        gap: 36,
      }}
    >
      {/* Status Live kecil & elegan */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 26px',
          borderRadius: 999,
          background: t.pilBg,
          border: `1.5px solid ${t.kartuBorder}`,
          opacity: sPil,
          transform: `translateY(${(1 - sPil) * 20}px)`,
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#22C55E',
            boxShadow: `0 0 ${14 * denyut}px #22C55E`,
          }}
        />
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.18em', color: t.sub }}>
          {p.merek} · {p.hari}
        </span>
      </div>

      {/* Tipografi Editorial Simpel & Elegan */}
      <div
        style={{
          opacity: sJudul,
          transform: `translateY(${(1 - sJudul) * 38}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {baris.map((b, i) => (
          <div
            key={i}
            style={{
              fontSize: i === baris.length - 1 ? 124 : 92,
              lineHeight: 0.98,
              fontWeight: i === baris.length - 1 ? 800 : 600,
              fontFamily: i === baris.length - 1 ? "'Georgia', 'Times New Roman', serif" : 'inherit',
              fontStyle: i === baris.length - 1 ? 'italic' : 'normal',
              letterSpacing: i === baris.length - 1 ? '-0.02em' : '0.08em',
              color: i === baris.length - 1 ? aksen : t.teks,
            }}
          >
            {b}
          </div>
        ))}
        <div style={{ marginTop: 22, width: garis, height: 3, borderRadius: 999, background: aksen, opacity: 0.85 }} />
      </div>

      {/* 1 kalimat sapaan singkat */}
      <p
        style={{
          margin: 0,
          fontSize: 33,
          lineHeight: 1.5,
          color: t.sub,
          fontWeight: 500,
          maxWidth: 720,
          opacity: sSub,
          transform: `translateY(${(1 - sSub) * 22}px)`,
        }}
      >
        {p.sub}
      </p>
    </AbsoluteFill>
  );
};

// ── ADEGAN MENU (3 dtk per menu): KARTU EDITORIAL BERSIH UNTUK TIAP MENU TERLARIS ──
const AdeganMenu: React.FC<{
  item: ItemMenuOpening;
  indeks: number;
  totalMenu: number;
  t: (typeof TEMA)[GayaOpening];
  aksen: string;
  gelap: boolean;
}> = ({ item, indeks, totalMenu, t, aksen, gelap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = useOpasitasAdegan(DURASI_ADEGAN);

  const sKartu = spring({ frame: frame - 4, fps, config: { damping: 15, stiffness: 115 } });
  const sIsi = spring({ frame: frame - 16, fps, config: { damping: 15, stiffness: 110 } });
  const zoomFoto = interpolate(frame, [0, DURASI_ADEGAN], [1.0, 1.07], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        opacity: op,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 88px',
        gap: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          borderRadius: 38,
          background: t.kartuBg,
          border: `1.5px solid ${t.kartuBorder}`,
          boxShadow: gelap ? '0 36px 90px rgba(0,0,0,0.55)' : '0 28px 70px rgba(28,22,18,0.09)',
          overflow: 'hidden',
          opacity: sKartu,
          transform: `translateY(${(1 - sKartu) * 44}px) scale(${0.96 + sKartu * 0.04})`,
        }}
      >
        {/* Area Visual Menu (Foto Asli Lek Kopi / Foto AI / Ilustrasi Minimalis) */}
        <div
          style={{
            height: 560,
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: gelap ? 'radial-gradient(circle at 50% 45%, #2A1F18 0%, #19120E 100%)' : 'radial-gradient(circle at 50% 45%, #F6EFE4 0%, #EAE0D0 100%)',
          }}
        >
          {item.foto ? (
            <Img
              src={staticFile(item.foto)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${zoomFoto})`,
              }}
            />
          ) : (
            <div style={{ transform: `scale(${0.94 + sKartu * 0.1})` }}>
              <IlustrasiKopi aksen={aksen} gelap={gelap} />
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              top: 28,
              left: 28,
              padding: '9px 22px',
              borderRadius: 999,
              background: t.lencanaBg,
              color: t.lencanaTeks,
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            {item.lencana || 'Pilihan Hari Ini'}
          </div>

          {totalMenu > 1 && (
            <div
              style={{
                position: 'absolute',
                top: 28,
                right: 28,
                padding: '8px 18px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.45)',
                color: '#F5EFE6',
                fontSize: 19,
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              0{indeks + 1} / 0{totalMenu}
            </div>
          )}
        </div>

        {/* Detail Menu Ringkas */}
        <div
          style={{
            padding: '40px 44px 46px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            opacity: sIsi,
            transform: `translateY(${(1 - sIsi) * 18}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em' }}>{item.nama}</span>
            {item.harga && (
              <span
                style={{
                  padding: '9px 22px',
                  borderRadius: 999,
                  background: aksen,
                  color: '#140F0C',
                  fontSize: 26,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {item.harga}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 28, lineHeight: 1.45, color: t.sub, fontWeight: 500 }}>{item.ket}</p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── ADEGAN 3 (6–9 dtk): PENUTUP ESTETIK (Logo Proporsional + Jam Buka + Ikon Delivery Kecil Opsional) ──
const AdeganPenutup: React.FC<{ p: PropsOpening; t: (typeof TEMA)[GayaOpening]; aksen: string; gelap: boolean }> = ({ p, t, aksen, gelap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const masuk = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sMerek = spring({ frame: frame - 4, fps, config: { damping: 15, stiffness: 120 } });
  const sJam = spring({ frame: frame - 14, fps, config: { damping: 14, stiffness: 115 } });
  const sBawah = spring({ frame: frame - 26, fps, config: { damping: 16, stiffness: 105 } });

  return (
    <AbsoluteFill
      style={{
        opacity: masuk,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '240px 88px 185px',
        textAlign: 'center',
      }}
    >
      {/* Merek Proporsional & Estetik (TIDAK kebesaran) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          opacity: sMerek,
          transform: `translateY(${(1 - sMerek) * 22}px)`,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: t.lencanaBg,
            color: t.lencanaTeks,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: gelap ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 26px rgba(28,22,18,0.12)',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <ellipse cx="12" cy="12" rx="7" ry="9.5" transform="rotate(-24 12 12)" stroke="currentColor" strokeWidth="2" />
            <path d="M9.5 4.5C11.5 8 11 12 14.5 19.5" stroke={aksen} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '0.22em' }}>{p.merek}</span>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '0.26em', color: t.sub }}>EST. 2025</span>
        </div>
      </div>

      {/* Jam Operasional & Alamat */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          opacity: sJam,
          transform: `translateY(${(1 - sJam) * 28}px)`,
        }}
      >
        <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: '0.2em', color: aksen, textTransform: 'uppercase' }}>
          Buka Hari Ini
        </span>
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            fontFamily: "'Georgia', 'Times New Roman', serif",
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.05,
          }}
        >
          {p.jamBuka} — {p.jamTutup}
        </div>
        <div style={{ fontSize: 27, color: t.sub, fontWeight: 500 }}>
          {p.hariBuka} · {p.alamat}
        </div>
        <div
          style={{
            marginTop: 8,
            padding: '11px 30px',
            borderRadius: 999,
            background: t.pilBg,
            border: `1.5px solid ${t.kartuBorder}`,
            fontSize: 23,
            fontWeight: 600,
            color: t.teks,
            letterSpacing: '0.03em',
          }}
        >
          {p.situs}
        </div>
      </div>

      {/* Ikon Delivery Kecil & Opsional */}
      <div
        style={{
          minHeight: 88,
          display: 'flex',
          alignItems: 'center',
          opacity: sBawah,
          transform: `translateY(${(1 - sBawah) * 18}px)`,
        }}
      >
        {p.tampilDelivery ? <BarisDelivery gelap={gelap} /> : <span style={{ fontSize: 22, color: t.sub }}>Sampai jumpa di kedai ☕</span>}
      </div>
    </AbsoluteFill>
  );
};

export const OpeningStory: React.FC<PropsOpening> = (p) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = TEMA[p.gaya] ?? TEMA['hangat-kafe'];
  const gelap = p.gaya !== 'terang-modern';
  const aksen = p.aksen || '#D6A668';
  const progres = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateRight: 'clamp' });
  // Gerakan rotasi & geser sangat lambat pada lengkung cincin kopi organik
  const putar = interpolate(frame, [0, durationInFrames], [0, 14]);

  return (
    <AbsoluteFill
      style={{
        background: t.bg,
        fontFamily: "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif",
        color: t.teks,
        overflow: 'hidden',
      }}
    >
      {/* Latar KHAS Lek Kopi: Aura hangat organik + lengkung tipis cincin kopi (TANPA kisi kotak Bakafrawi) */}
      <div
        style={{
          position: 'absolute',
          top: -180,
          left: -140,
          width: 760,
          height: 760,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${t.aura1} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -200,
          right: -160,
          width: 820,
          height: 820,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${t.aura2} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Lengkung cincin kopi tipis elegan yang bergerak sangat pelan */}
      <svg
        width="1080"
        height="1920"
        viewBox="0 0 1080 1920"
        fill="none"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: `rotate(${putar * 0.25}deg)` }}
      >
        <circle cx="960" cy="280" r="390" stroke={t.ring} strokeWidth="1.8" />
        <circle cx="960" cy="280" r="450" stroke={t.ring} strokeWidth="1" strokeDasharray="10 14" />
        <circle cx="110" cy="1660" r="420" stroke={t.ring} strokeWidth="1.8" />
        <circle cx="110" cy="1660" r="330" stroke={t.ring} strokeWidth="1" />
      </svg>

      {/* Bingkai editorial hairline tipis di sekeliling kanvas */}
      <div
        style={{
          position: 'absolute',
          inset: 44,
          borderRadius: 34,
          border: `1.5px solid ${t.bingkai}`,
          pointerEvents: 'none',
        }}
      />

      {/* Bilah progres tipis di atas */}
      <div style={{ position: 'absolute', top: 76, left: 88, right: 88, height: 4, borderRadius: 999, background: t.pilBg, overflow: 'hidden', zIndex: 10 }}>
        <div style={{ width: `${progres}%`, height: '100%', background: aksen, borderRadius: 999 }} />
      </div>

      {/* Adegan Pembuka + 1–3 Adegan Menu Terlaris + Penutup Estetik */}
      <Sequence from={0} durationInFrames={DURASI_ADEGAN}>
        <AdeganPembuka p={p} t={t} aksen={aksen} />
      </Sequence>
      {daftarMenuEfektif(p).map((item, idx, arr) => (
        <Sequence key={idx} from={DURASI_ADEGAN * (idx + 1)} durationInFrames={DURASI_ADEGAN}>
          <AdeganMenu item={item} indeks={idx} totalMenu={arr.length} t={t} aksen={aksen} gelap={gelap} />
        </Sequence>
      ))}
      <Sequence from={DURASI_ADEGAN * (1 + daftarMenuEfektif(p).length)} durationInFrames={DURASI_ADEGAN}>
        <AdeganPenutup p={p} t={t} aksen={aksen} gelap={gelap} />
      </Sequence>

      {/* Efek suara (SFX) halus pada transisi & pop-up kartu */}
      {p.sfx?.pop && (
        <Sequence from={8} durationInFrames={12}>
          <Audio src={staticFile(p.sfx.pop)} volume={0.32} />
        </Sequence>
      )}
      {daftarMenuEfektif(p).map((_, idx) => (
        <React.Fragment key={`sfx-${idx}`}>
          {p.sfx?.whoosh && (
            <Sequence from={DURASI_ADEGAN * (idx + 1) - 5} durationInFrames={16}>
              <Audio src={staticFile(p.sfx.whoosh)} volume={0.28} />
            </Sequence>
          )}
          {p.sfx?.pop && (
            <Sequence from={DURASI_ADEGAN * (idx + 1) + 6} durationInFrames={12}>
              <Audio src={staticFile(p.sfx.pop)} volume={0.3} />
            </Sequence>
          )}
        </React.Fragment>
      ))}
      {p.sfx?.whoosh && (
        <Sequence from={DURASI_ADEGAN * (1 + daftarMenuEfektif(p).length) - 5} durationInFrames={16}>
          <Audio src={staticFile(p.sfx.whoosh)} volume={0.28} />
        </Sequence>
      )}
      {p.sfx?.chime && (
        <Sequence from={DURASI_ADEGAN * (1 + daftarMenuEfektif(p).length) + 6} durationInFrames={36}>
          <Audio src={staticFile(p.sfx.chime)} volume={0.35} />
        </Sequence>
      )}

      {/* Musik latar adaptif (sesuai mood tema visual & berganti setiap hari) */}
      {p.musik && (
        <Audio
          src={staticFile(p.musik)}
          volume={(f) =>
            interpolate(f, [0, 20, durationInFrames - 28, durationInFrames], [0, 0.36, 0.36, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      )}
    </AbsoluteFill>
  );
};
