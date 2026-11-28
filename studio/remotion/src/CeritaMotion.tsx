// Komposisi Remotion `CeritaMotion`: video vertikal 9:16 (1080×1920, 30fps)
// memadukan gaya Perkamen Sejarah (ala @motionformat) & Malam Sinematik (ala @waktunya.malam)
// dengan subtitle kinetik sinkron waktu kata, gulungan perkamen animasi, dan peta kuno SVG.
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont as loadJakarta } from '@remotion/google-fonts/PlusJakartaSans';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import {
  FPS_MOTION,
  buatWaktuKataProporsional,
  contohCeritaMotion,
  hitungDurasiCeritaMotion,
  type AdeganCeritaMotion,
  type KataWaktuMotion,
  type PropsCeritaMotion,
} from './data/cerita-motion';
import { PanggungKarakterCerita } from './components/KarakterCerita';

export { FPS_MOTION, contohCeritaMotion, hitungDurasiCeritaMotion, type PropsCeritaMotion };

const FONT_SANS = loadJakarta('normal', { weights: ['500', '700', '800'], subsets: ['latin'] }).fontFamily;
const FONT_SERIF = loadPlayfair('normal', { weights: ['700', '800'], subsets: ['latin'] }).fontFamily;
const FONT_SERIF_ITALIC = loadPlayfair('italic', { weights: ['500', '600'], subsets: ['latin'] }).fontFamily;

function pegasHalus(frame: number, fps: number, tunda = 0, damping = 16, stiffness = 125) {
  return spring({
    frame: Math.max(0, frame - tunda),
    fps,
    config: { damping, stiffness, mass: 0.85 },
  });
}

function bersihkanKata(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9\u00c0-\u024f]/gi, '');
}

/** Partikel cahaya emas/debu melayang lembut untuk nuansa sinematik hidup. */
const PartikelCahaya: React.FC<{ warna?: string; jumlah?: number; intensitas?: number }> = ({
  warna = '#F5CA6A',
  jumlah = 18,
  intensitas = 0.55,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: jumlah }).map((_, i) => {
        const benih = (i * 97 + 31) % 100;
        const xDasar = ((i * 173 + 67) % 940) + 70;
        const yMulai = ((i * 251 + 113) % 1450) + 180;
        const laju = 0.45 + (benih % 7) * 0.12;
        const y = ((yMulai - frame * laju) % 1650 + 1650) % 1650;
        const x = xDasar + Math.sin(frame * 0.03 + i * 1.7) * (16 + (benih % 18));
        const ukuran = 4 + (benih % 7);
        const kedip = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame * 0.065 + i * 2.1));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: ukuran,
              height: ukuran,
              borderRadius: '50%',
              background: warna,
              opacity: kedip * intensitas,
              boxShadow: `0 0 ${ukuran * 3}px ${warna}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Lapisan grain halus & bingkai vignette sinematik tipis. */
const BingkaiSinematik: React.FC<{ gelap?: boolean }> = ({ gelap = true }) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: gelap
        ? 'radial-gradient(ellipse at 50% 38%, rgba(0,0,0,0) 42%, rgba(5,7,10,0.68) 100%)'
        : 'radial-gradient(ellipse at 50% 45%, rgba(255,244,218,0) 52%, rgba(44,28,14,0.38) 100%)',
    }}
  />
);

/** Watermark akun bersih di pojok atas aman. */
const WatermarkAkun: React.FC<{ akun: string; terang?: boolean }> = ({ akun, terang = true }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 14], [0, 0.78], { extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        top: 96,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        opacity: op,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          width: 24,
          height: 2,
          borderRadius: 2,
          background: terang ? 'rgba(242,199,92,0.75)' : 'rgba(122,42,30,0.7)',
        }}
      />
      <span
        style={{
          fontFamily: FONT_SANS,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: terang ? 'rgba(248,242,228,0.88)' : 'rgba(46,29,16,0.84)',
          textShadow: terang ? '0 2px 10px rgba(0,0,0,0.6)' : 'none',
        }}
      >
        {akun}
      </span>
      <span
        style={{
          width: 24,
          height: 2,
          borderRadius: 2,
          background: terang ? 'rgba(242,199,92,0.75)' : 'rgba(122,42,30,0.7)',
        }}
      />
    </div>
  );
};

/** Latar ilustrasi penuh dengan gerak kamera perlahan (Ken Burns). */
const LatarIlustrasi: React.FC<{
  berkas?: string;
  kamera?: AdeganCeritaMotion['kamera'];
  durasiBingkai: number;
  warnaCadangan: string;
}> = ({ berkas, kamera = 'zoom_masuk', durasiBingkai, warnaCadangan }) => {
  const frame = useCurrentFrame();
  const progres = interpolate(frame, [0, durasiBingkai], [0, 1], { extrapolateRight: 'clamp' });
  let skala = 1.0;
  let geserX = 0;
  let geserY = 0;
  if (kamera === 'zoom_masuk') {
    skala = 1.0 + progres * 0.11;
    geserY = -progres * 18;
  } else if (kamera === 'zoom_keluar') {
    skala = 1.1 - progres * 0.09;
  } else if (kamera === 'geser_kanan') {
    skala = 1.07;
    geserX = -18 + progres * 36;
  } else if (kamera === 'geser_kiri') {
    skala = 1.07;
    geserX = 18 - progres * 36;
  } else if (kamera === 'goyang_kaget') {
    const decay = Math.max(0, 1 - frame / 20);
    skala = 1.06;
    geserX = Math.sin(frame * 1.9) * 12 * decay;
    geserY = Math.cos(frame * 2.3) * 8 * decay;
  }

  return (
    <AbsoluteFill style={{ background: warnaCadangan, overflow: 'hidden' }}>
      {berkas ? (
        <Img
          src={staticFile(berkas)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${skala}) translate(${geserX}px, ${geserY}px)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Subtitle kinetik (Type Motion) bergulir 5–7 kata per kelompok, muncul mengikuti
 * waktu tiap kata dan menyorot kata kunci dengan warna emas / pil kuning.
 */
const TeksKinetik: React.FC<{
  narasi: string;
  durasiDetik: number;
  kata?: KataWaktuMotion[];
  kataSorot?: string[];
  gaya: 'malam' | 'perkamen';
  bottom: number;
  ukuranFont?: number;
}> = ({ narasi, durasiDetik, kata, kataSorot = [], gaya, bottom, ukuranFont = 52 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const detik = frame / fps;

  const daftarKata =
    Array.isArray(kata) && kata.length > 0 ? kata : buatWaktuKataProporsional(narasi, durasiDetik);
  if (!daftarKata.length) return null;

  const setSorot = new Set(kataSorot.map((k) => bersihkanKata(k)).filter(Boolean));

  // Bagi menjadi kelompok 6 kata agar selalu ringkas (1–2 baris) & mudah dibaca di HP
  const ukuranKelompok = 6;
  const kelompok: KataWaktuMotion[][] = [];
  for (let i = 0; i < daftarKata.length; i += ukuranKelompok) {
    kelompok.push(daftarKata.slice(i, i + ukuranKelompok));
  }

  let indeksKelompok = 0;
  for (let g = 0; g < kelompok.length; g++) {
    const awalG = kelompok[g][0].mulai;
    if (detik >= awalG - 0.08) indeksKelompok = g;
  }
  const aktif = kelompok[indeksKelompok] ?? kelompok[0];

  return (
    <div
      style={{
        position: 'absolute',
        left: 72,
        right: 72,
        bottom,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        columnGap: 14,
        rowGap: 10,
        pointerEvents: 'none',
      }}
    >
      {aktif.map((item, idx) => {
        const sudahMulai = detik >= item.mulai - 0.04;
        const sedangDiucap = detik >= item.mulai - 0.04 && detik <= item.selesai + 0.14;
        const frameMulai = Math.max(0, Math.round((item.mulai - 0.04) * fps));
        const p = spring({
          frame: Math.max(0, frame - frameMulai),
          fps,
          config: { damping: 15, stiffness: 210, mass: 0.6 },
        });
        const disorot = setSorot.has(bersihkanKata(item.kata));

        if (!sudahMulai) return null;

        const y = interpolate(p, [0, 1], [14, 0]);
        const skala = sedangDiucap ? interpolate(p, [0, 1], [0.92, 1.05]) : 1.0;

        if (gaya === 'perkamen' && disorot) {
          return (
            <span
              key={`${indeksKelompok}-${idx}`}
              style={{
                fontFamily: FONT_SANS,
                fontSize: ukuranFont,
                fontWeight: 800,
                lineHeight: 1.2,
                color: '#1C130B',
                background: 'linear-gradient(180deg, #F8D66D 0%, #E7B645 100%)',
                borderRadius: 12,
                padding: '3px 14px 5px',
                boxShadow: '0 8px 22px rgba(0,0,0,0.42)',
                transform: `translateY(${y}px) scale(${skala})`,
                display: 'inline-block',
              }}
            >
              {item.kata}
            </span>
          );
        }

        return (
          <span
            key={`${indeksKelompok}-${idx}`}
            style={{
              fontFamily: FONT_SANS,
              fontSize: ukuranFont,
              fontWeight: 800,
              lineHeight: 1.24,
              letterSpacing: '-0.015em',
              color: disorot ? '#F5BD4E' : '#FBF8F1',
              textShadow:
                '0 4px 18px rgba(0,0,0,0.88), 0 2px 6px rgba(0,0,0,0.95)',
              transform: `translateY(${y}px) scale(${skala})`,
              display: 'inline-block',
            }}
          >
            {item.kata}
          </span>
        );
      })}
    </div>
  );
};

/** Gulungan perkamen animasi (membuka dari tengah) ala @motionformat. */
const GulunganPerkamen: React.FC<{
  barisSatu: string;
  barisDua?: string;
  pitaEra?: string;
}> = ({ barisSatu, barisDua, pitaEra }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const buka = pegasHalus(frame, fps, 4, 15, 110);
  const munculPita = pegasHalus(frame, fps, 16, 15, 130);
  const lebarIsi = interpolate(buka, [0, 1], [60, 840]);
  const opTeks = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const kayuStyle: React.CSSProperties = {
    width: 34,
    height: 268,
    borderRadius: 14,
    background: 'linear-gradient(90deg, #6A3E1D 0%, #B77C46 42%, #7D4B24 100%)',
    border: '2px solid #442510',
    boxShadow: '0 14px 28px rgba(0,0,0,0.45)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0',
    position: 'relative',
    zIndex: 3,
  };

  const knopStyle: React.CSSProperties = {
    width: 24,
    height: 18,
    borderRadius: 9,
    background: 'linear-gradient(180deg, #B53B2D 0%, #6D1B12 100%)',
    border: '2px solid #3B130D',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 158,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Gulungan kertas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={kayuStyle}>
          <div style={{ ...knopStyle, transform: 'translateY(-12px)' }} />
          <div style={{ ...knopStyle, transform: 'translateY(12px)' }} />
        </div>
        <div
          style={{
            width: lebarIsi,
            height: 236,
            marginLeft: -8,
            marginRight: -8,
            overflow: 'hidden',
            background: 'linear-gradient(180deg, #F6ECD4 0%, #EADAB3 100%)',
            borderTop: '4px solid #6F4E2E',
            borderBottom: '4px solid #6F4E2E',
            boxShadow: '0 18px 40px rgba(0,0,0,0.42), inset 0 0 28px rgba(133,93,48,0.28)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '16px 28px',
            position: 'relative',
          }}
        >
          {/* Garis ornamen dalam */}
          <div
            style={{
              position: 'absolute',
              inset: 14,
              border: '1.5px solid rgba(138,94,48,0.42)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              opacity: opTeks,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            <div
              style={{
                fontFamily: FONT_SERIF_ITALIC,
                fontSize: 52,
                fontWeight: 600,
                color: '#2B1B10',
                lineHeight: 1.1,
              }}
            >
              {barisSatu}
            </div>
            {barisDua ? (
              <div
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize: 74,
                  fontWeight: 800,
                  color: '#91291E',
                  lineHeight: 1.06,
                  marginTop: 4,
                  letterSpacing: '-0.01em',
                }}
              >
                {barisDua}
              </div>
            ) : null}
          </div>
        </div>
        <div style={kayuStyle}>
          <div style={{ ...knopStyle, transform: 'translateY(-12px)' }} />
          <div style={{ ...knopStyle, transform: 'translateY(12px)' }} />
        </div>
      </div>

      {/* Pita Era & Lokasi merah bata */}
      {pitaEra ? (
        <div
          style={{
            marginTop: 22,
            transform: `scale(${interpolate(munculPita, [0, 1], [0.82, 1])}) translateY(${interpolate(
              munculPita,
              [0, 1],
              [-14, 0],
            )}px)`,
            opacity: munculPita,
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, #A12D22 0%, #741C14 100%)',
            padding: '13px 44px',
            borderTop: '2.5px solid #E8C57B',
            borderBottom: '2.5px solid #E8C57B',
            boxShadow: '0 12px 26px rgba(0,0,0,0.42)',
            clipPath: 'polygon(0% 0%, 100% 0%, 96% 50%, 100% 100%, 0% 100%, 4% 50%)',
          }}
        >
          <span
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 31,
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: '#FAF0D8',
            }}
          >
            {pitaEra}
          </span>
        </div>
      ) : null}
    </div>
  );
};

/** Adegan 1: Pembuka Editorial Malam Sinematik (ala @waktunya.malam). */
const AdeganPembuka: React.FC<{ adegan: AdeganCeritaMotion; durasiBingkai: number; akun: string }> = ({
  adegan,
  durasiBingkai,
  akun,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pPil = pegasHalus(frame, fps, 10);
  const pJudul = pegasHalus(frame, fps, 16);
  const pSub = pegasHalus(frame, fps, 24);
  const panjangJudul = (adegan.judulKartu ?? '').trim().length;
  const ukuranJudul = panjangJudul > 20 ? 70 : panjangJudul > 12 ? 86 : 114;

  return (
    <AbsoluteFill style={{ background: '#080A0D' }}>
      <LatarIlustrasi
        berkas={adegan.gambarBerkas}
        kamera={adegan.kamera ?? 'zoom_masuk'}
        durasiBingkai={durasiBingkai}
        warnaCadangan="#080A0D"
      />
      <PartikelCahaya warna="#F3BC58" jumlah={20} intensitas={0.62} />
      {/* Gradasi gelap halus ke area bawah editorial */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(6,8,12,0.52) 0%, rgba(6,8,12,0.06) 24%, rgba(6,8,12,0.18) 44%, rgba(8,10,13,0.9) 66%, #080A0D 80%)',
        }}
      />
      <BingkaiSinematik gelap />
      <WatermarkAkun akun={akun} terang />

      {/* Animasi karakter 2D ekspresif & pindah posisi di panggung tengah */}
      {adegan.karakter ? (
        <PanggungKarakterCerita
          konfig={adegan.karakter}
          durasiBingkai={durasiBingkai}
          tema="malam"
          bottomLantai={760}
          kata={adegan.kata}
        />
      ) : null}

      {/* Hook teks kinetik di atas kartu judul dengan jarak aman anti-tabrakan */}
      <TeksKinetik
        narasi={adegan.narasi}
        durasiDetik={adegan.durasi}
        kata={adegan.kata}
        kataSorot={adegan.kataSorot}
        gaya="malam"
        bottom={660}
        ukuranFont={48}
      />

      {/* Kartu Judul Editorial di bawah (ala @waktunya.malam) */}
      <div
        style={{
          position: 'absolute',
          left: 64,
          right: 64,
          bottom: 185,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {adegan.lencanaBagian ? (
          <div
            style={{
              transform: `scale(${interpolate(pPil, [0, 1], [0.8, 1])})`,
              opacity: pPil,
              background: '#EFE5CF',
              color: '#17130F',
              fontFamily: FONT_SANS,
              fontSize: 22,
              fontWeight: 800,
              padding: '6px 24px',
              borderRadius: 999,
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              marginBottom: 14,
              maxWidth: '92%',
            }}
          >
            {adegan.lencanaBagian}
          </div>
        ) : null}

        {adegan.judulKartu ? (
          <div
            style={{
              transform: `translateY(${interpolate(pJudul, [0, 1], [24, 0])}px)`,
              opacity: pJudul,
              fontFamily: FONT_SERIF,
              fontSize: ukuranJudul,
              fontWeight: 800,
              lineHeight: 1.04,
              color: '#F7EFE0',
              letterSpacing: '-0.015em',
              textShadow: '0 10px 32px rgba(0,0,0,0.85)',
            }}
          >
            {adegan.judulKartu}
          </div>
        ) : null}

        {adegan.subjudulKartu ? (
          <div
            style={{
              marginTop: 12,
              transform: `translateY(${interpolate(pSub, [0, 1], [16, 0])}px)`,
              opacity: pSub,
              fontFamily: FONT_SERIF_ITALIC,
              fontSize: 38,
              fontWeight: 500,
              color: '#E5BC5B',
              textShadow: '0 4px 18px rgba(0,0,0,0.85)',
            }}
          >
            {adegan.subjudulKartu}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** Adegan 2: Gaya Perkamen Sejarah (ala @motionformat). */
const AdeganPerkamen: React.FC<{ adegan: AdeganCeritaMotion; durasiBingkai: number; akun: string }> = ({
  adegan,
  durasiBingkai,
  akun,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const munculPita = pegasHalus(frame, fps, 10, 15, 130);
  const punyaJudul = Boolean(adegan.judulKartu?.trim());

  return (
    <AbsoluteFill style={{ background: '#E9DBB9' }}>
      <LatarIlustrasi
        berkas={adegan.gambarBerkas}
        kamera={adegan.kamera ?? 'zoom_masuk'}
        durasiBingkai={durasiBingkai}
        warnaCadangan="#E9DBB9"
      />
      <PartikelCahaya warna="#FFF1C9" jumlah={14} intensitas={0.42} />
      {/* Scrim bawah lembut agar teks kinetik sangat kontras */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(245,233,204,0.22) 0%, rgba(0,0,0,0) 26%, rgba(16,10,6,0.06) 62%, rgba(16,10,6,0.84) 84%, rgba(12,8,5,0.94) 100%)',
        }}
      />
      <BingkaiSinematik gelap={false} />
      <WatermarkAkun akun={akun} terang={false} />

      {/* Animasi karakter 2D ekspresif di bawah gulungan perkamen */}
      {adegan.karakter ? (
        <PanggungKarakterCerita
          konfig={adegan.karakter}
          durasiBingkai={durasiBingkai}
          tema="perkamen"
          bottomLantai={500}
          kata={adegan.kata}
        />
      ) : null}

      {punyaJudul ? (
        <GulunganPerkamen
          barisSatu={adegan.judulKartu || 'Kisah Sejarah'}
          barisDua={adegan.judulBarisKedua}
          pitaEra={adegan.pitaEra}
        />
      ) : adegan.pitaEra ? (
        <div
          style={{
            position: 'absolute',
            top: 175,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            transform: `scale(${interpolate(munculPita, [0, 1], [0.85, 1])})`,
            opacity: munculPita,
          }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #A12D22 0%, #741C14 100%)',
              padding: '12px 42px',
              borderTop: '2.5px solid #E8C57B',
              borderBottom: '2.5px solid #E8C57B',
              boxShadow: '0 12px 26px rgba(0,0,0,0.42)',
              clipPath: 'polygon(0% 0%, 100% 0%, 96% 50%, 100% 100%, 0% 100%, 4% 50%)',
            }}
          >
            <span
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: '0.16em',
                color: '#FAF0D8',
              }}
            >
              {adegan.pitaEra}
            </span>
          </div>
        </div>
      ) : null}

      <TeksKinetik
        narasi={adegan.narasi}
        durasiDetik={adegan.durasi}
        kata={adegan.kata}
        kataSorot={adegan.kataSorot}
        gaya="perkamen"
        bottom={228}
        ukuranFont={48}
      />
    </AbsoluteFill>
  );
};

/** Adegan Tengah Sinematik (tema Malam): ilustrasi penuh + lencana era opsional + subtitle kinetik fokus. */
const AdeganIlustrasi: React.FC<{ adegan: AdeganCeritaMotion; durasiBingkai: number; akun: string }> = ({
  adegan,
  durasiBingkai,
  akun,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pEra = pegasHalus(frame, fps, 8);
  const eraTeks = adegan.pitaEra || adegan.judulKartu;

  return (
    <AbsoluteFill style={{ background: '#080A0D' }}>
      <LatarIlustrasi
        berkas={adegan.gambarBerkas}
        kamera={adegan.kamera ?? 'zoom_masuk'}
        durasiBingkai={durasiBingkai}
        warnaCadangan="#080A0D"
      />
      <PartikelCahaya warna="#F3BC58" jumlah={18} intensitas={0.55} />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(6,8,12,0.62) 0%, rgba(6,8,12,0.06) 24%, rgba(6,8,12,0.08) 56%, rgba(8,10,13,0.88) 79%, #080A0D 94%)',
        }}
      />
      <BingkaiSinematik gelap />
      <WatermarkAkun akun={akun} terang />

      {/* Animasi karakter 2D ekspresif & pindah posisi */}
      {adegan.karakter ? (
        <PanggungKarakterCerita
          konfig={adegan.karakter}
          durasiBingkai={durasiBingkai}
          tema="malam"
          bottomLantai={510}
          kata={adegan.kata}
        />
      ) : null}

      {eraTeks ? (
        <div
          style={{
            position: 'absolute',
            top: 168,
            left: 72,
            right: 72,
            display: 'flex',
            justifyContent: 'center',
            opacity: pEra,
            transform: `translateY(${interpolate(pEra, [0, 1], [-12, 0])}px)`,
          }}
        >
          <div
            style={{
              background: 'rgba(13, 16, 22, 0.78)',
              border: '1.5px solid rgba(235, 194, 98, 0.55)',
              borderRadius: 999,
              padding: '10px 30px',
              boxShadow: '0 10px 26px rgba(0,0,0,0.48)',
            }}
          >
            <span
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: '#F3D27E',
              }}
            >
              {eraTeks}
            </span>
          </div>
        </div>
      ) : null}

      <TeksKinetik
        narasi={adegan.narasi}
        durasiDetik={adegan.durasi}
        kata={adegan.kata}
        kataSorot={adegan.kataSorot}
        gaya="malam"
        bottom={245}
        ukuranFont={54}
      />
    </AbsoluteFill>
  );
};

/** Adegan 3: Peta Kuno SVG Animasi Rute Bercahaya (mendukung wilayah Mokha & Nusantara, ala @motionformat). */
const AdeganPetaKuno: React.FC<{ adegan: AdeganCeritaMotion; durasiBingkai: number; akun: string }> = ({
  adegan,
  durasiBingkai,
  akun,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pHeader = pegasHalus(frame, fps, 4);
  const pPlakat = pegasHalus(frame, fps, 22);
  const zoomPeta = interpolate(frame, [0, durasiBingkai], [1.0, 1.07], { extrapolateRight: 'clamp' });
  const rotasiKompas = interpolate(frame, [0, durasiBingkai], [-8, 18]);

  const adalahNusantara = adegan.wilayahPeta === 'nusantara';
  const pusat = adalahNusantara
    ? { x: 425, y: 1125, nama: 'Jawa' }
    : { x: 470, y: 1090, nama: 'Mokha' };

  const rute = adalahNusantara
    ? [
        {
          nama: 'Aceh · Gayo',
          path: 'M 425 1125 Q 250 1005 150 795',
          panjang: 460,
          tunda: 14,
          x: 150,
          y: 795,
          labelDx: 18,
          labelDy: -18,
        },
        {
          nama: 'Sumatera',
          path: 'M 425 1125 Q 320 1055 260 950',
          panjang: 260,
          tunda: 22,
          x: 260,
          y: 950,
          labelDx: -135,
          labelDy: 34,
        },
        {
          nama: 'Bali',
          path: 'M 425 1125 Q 525 1165 612 1152',
          panjang: 210,
          tunda: 30,
          x: 612,
          y: 1152,
          labelDx: -16,
          labelDy: 40,
        },
        {
          nama: 'Sulawesi',
          path: 'M 425 1125 Q 615 1045 775 940',
          panjang: 430,
          tunda: 38,
          x: 775,
          y: 940,
          labelDx: 18,
          labelDy: -16,
        },
        {
          nama: 'Maluku',
          path: 'M 425 1125 Q 725 1095 935 965',
          panjang: 560,
          tunda: 48,
          x: 935,
          y: 965,
          labelDx: -98,
          labelDy: -22,
        },
      ]
    : [
        {
          nama: 'Kairo',
          path: 'M 470 1090 Q 385 950 325 795',
          panjang: 360,
          tunda: 14,
          x: 325,
          y: 795,
          labelDx: -14,
          labelDy: -24,
        },
        {
          nama: 'Istanbul',
          path: 'M 470 1090 Q 445 865 395 650',
          panjang: 480,
          tunda: 26,
          x: 395,
          y: 650,
          labelDx: 18,
          labelDy: -20,
        },
        {
          nama: 'Eropa',
          path: 'M 470 1090 Q 320 830 165 620',
          panjang: 590,
          tunda: 38,
          x: 165,
          y: 620,
          labelDx: 14,
          labelDy: -22,
        },
        {
          nama: 'Nusantara',
          path: 'M 470 1090 Q 715 1190 925 1135',
          panjang: 520,
          tunda: 48,
          x: 925,
          y: 1135,
          labelDx: -96,
          labelDy: -26,
        },
      ];

  const denyutPusat = 1 + 0.14 * Math.sin(frame * 0.14);
  const judulPeta = adegan.judulKartu || (adalahNusantara ? 'NUSANTARA' : 'MOKHA');
  const ukuranJudulPeta = judulPeta.length > 10 ? 78 : judulPeta.length > 7 ? 92 : 108;

  return (
    <AbsoluteFill style={{ background: '#162421', overflow: 'hidden' }}>
      {/* Peta Kuno SVG dengan gerak kamera halus */}
      <AbsoluteFill style={{ transform: `scale(${zoomPeta})` }}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          <defs>
            <radialGradient id="lautKuno" cx="46%" cy="56%" r="65%">
              <stop offset="0%" stopColor="#35524C" />
              <stop offset="55%" stopColor="#243935" />
              <stop offset="100%" stopColor="#131E1C" />
            </radialGradient>
            <linearGradient id="daratanKuno" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#B1764F" />
              <stop offset="55%" stopColor="#8F5537" />
              <stop offset="100%" stopColor="#6D3D27" />
            </linearGradient>
            <linearGradient id="sinarMokha" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#FFE9A3" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#F5BD4E" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#F5BD4E" stopOpacity="0" />
            </linearGradient>
            <filter id="pendarEmas" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Samudra Kuno */}
          <rect width="1080" height="1920" fill="url(#lautKuno)" />

          {/* Garis lintang & bujur kartografi tipis */}
          {[540, 720, 900, 1080, 1260, 1440].map((y) => (
            <line key={`lat-${y}`} x1={0} y1={y} x2={1080} y2={y} stroke="rgba(232,209,154,0.12)" strokeWidth={1.5} />
          ))}
          {[180, 360, 540, 720, 900].map((x) => (
            <line key={`lon-${x}`} x1={x} y1={420} x2={x} y2={1600} stroke="rgba(232,209,154,0.12)" strokeWidth={1.5} />
          ))}

          {/* Garis rhumb radial halus dari titik pusat */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={`rhumb-${deg}`}
                x1={pusat.x}
                y1={pusat.y}
                x2={pusat.x + Math.cos(rad) * 760}
                y2={pusat.y + Math.sin(rad) * 760}
                stroke="rgba(243,213,141,0.08)"
                strokeWidth={1.2}
              />
            );
          })}

          {adalahNusantara ? (
            <g>
              {/* Semenanjung Malaya (konteks utara) */}
              <path
                d="M 245 520 Q 290 610 355 715 L 395 700 Q 345 600 315 520 Z"
                fill="url(#daratanKuno)"
                fillOpacity="0.65"
                stroke="#DFB87A"
                strokeOpacity="0.35"
                strokeWidth={2}
              />
              {/* Pulau Sumatera (Aceh/Gayo di utara sampai Lampung) */}
              <path
                d="M 118 765 Q 165 755 210 815 L 335 968 Q 368 1020 345 1072 L 305 1084 Q 245 1025 188 942 L 108 825 Z"
                fill="#A66542"
                stroke="#F2CD7E"
                strokeOpacity="0.68"
                strokeWidth={3}
              />
              {/* Pulau Jawa (Batavia, Priangan, Parakan, Jawa Timur) */}
              <path
                d="M 358 1098 Q 445 1092 548 1118 L 585 1134 L 574 1166 Q 475 1164 362 1136 Z"
                fill="#A66542"
                stroke="#F2CD7E"
                strokeOpacity="0.72"
                strokeWidth={3}
              />
              {/* Bali & Nusa Tenggara */}
              <path
                d="M 594 1138 Q 624 1134 636 1152 L 614 1168 L 592 1156 Z"
                fill="#A66542"
                stroke="#F2CD7E"
                strokeOpacity="0.65"
                strokeWidth={2.5}
              />
              <path
                d="M 652 1152 Q 722 1152 810 1164 L 802 1184 Q 715 1178 650 1170 Z"
                fill="url(#daratanKuno)"
                stroke="#DFB87A"
                strokeOpacity="0.48"
                strokeWidth={2}
              />
              {/* Pulau Kalimantan */}
              <path
                d="M 485 752 Q 585 710 665 758 L 692 845 Q 684 940 622 985 L 512 978 Q 458 925 462 842 Z"
                fill="url(#daratanKuno)"
                stroke="#DFB87A"
                strokeOpacity="0.52"
                strokeWidth={2.5}
              />
              {/* Pulau Sulawesi (bentuk K khas) */}
              <path
                d="M 738 830 Q 805 805 858 835 L 822 868 Q 785 885 795 925 L 842 968 L 818 1005 L 772 958 L 768 1030 L 732 1022 L 736 932 Z"
                fill="#A66542"
                stroke="#F2CD7E"
                strokeOpacity="0.65"
                strokeWidth={2.5}
              />
              {/* Kepulauan Maluku & Halmahera */}
              <path
                d="M 915 842 Q 952 852 962 908 L 938 925 L 912 885 Z M 902 958 Q 948 948 982 968 L 972 992 Q 930 988 902 978 Z"
                fill="url(#daratanKuno)"
                stroke="#DFB87A"
                strokeOpacity="0.55"
                strokeWidth={2}
              />
              {/* Label laut halus */}
              <text
                x={468}
                y={1046}
                fill="rgba(232,216,176,0.36)"
                fontFamily={FONT_SERIF_ITALIC}
                fontSize={24}
                letterSpacing="4"
              >
                Laut Jawa
              </text>
              <text
                x={518}
                y={882}
                fill="rgba(255,240,206,0.38)"
                fontFamily={FONT_SERIF}
                fontSize={22}
                letterSpacing="5"
              >
                BORNEO
              </text>
            </g>
          ) : (
            <g>
              {/* Daratan bergaya peta kuno: Eropa Selatan & Anatolia */}
              <path
                d="M -20 510 L 140 535 L 230 600 L 295 585 L 350 645 L 485 655 L 550 615 L 660 660 L 820 580 L 1090 540 L 1090 420 L -20 420 Z"
                fill="url(#daratanKuno)"
                stroke="#DFB87A"
                strokeOpacity="0.45"
                strokeWidth={2.5}
              />

              {/* Afrika Timur Laut, Mesir & Tanduk Afrika */}
              <path
                d="M -20 745 L 220 755 L 345 785 L 378 860 L 420 985 L 448 1110 L 495 1175 L 435 1290 L 340 1440 L -20 1460 Z"
                fill="url(#daratanKuno)"
                stroke="#DFB87A"
                strokeOpacity="0.45"
                strokeWidth={2.5}
              />

              {/* Jazirah Arab & Yaman (Pusat Qahwah) */}
              <path
                d="M 380 770 L 495 725 L 610 750 L 675 835 L 725 945 L 640 1055 L 520 1120 L 462 1102 L 432 1015 L 395 900 Z"
                fill="#A66542"
                stroke="#F2CD7E"
                strokeOpacity="0.65"
                strokeWidth={3}
              />

              {/* Pesisir India Barat */}
              <path
                d="M 785 735 L 915 780 L 945 895 L 870 1020 L 815 920 L 795 825 Z"
                fill="url(#daratanKuno)"
                stroke="#DFB87A"
                strokeOpacity="0.4"
                strokeWidth={2}
              />

              {/* Kepulauan Nusantara (kanan bawah) */}
              <g fill="url(#daratanKuno)" stroke="#DFB87A" strokeOpacity="0.55" strokeWidth={2}>
                <path d="M 855 1085 Q 890 1115 918 1148 L 896 1164 Q 865 1130 842 1098 Z" />
                <path d="M 922 1160 Q 968 1168 1010 1164 L 1008 1184 Q 964 1190 920 1178 Z" />
                <path d="M 945 1068 Q 985 1072 1002 1108 L 972 1134 Q 938 1118 935 1082 Z" />
              </g>

              {/* Label wilayah halus pada peta */}
              <text
                x={548}
                y={945}
                fill="rgba(255,240,206,0.45)"
                fontFamily={FONT_SERIF}
                fontSize={26}
                letterSpacing="6"
              >
                ARABIA
              </text>
              <text
                x={378}
                y={962}
                fill="rgba(232,216,176,0.38)"
                fontFamily={FONT_SERIF_ITALIC}
                fontSize={22}
                transform="rotate(68 378 962)"
              >
                Laut Merah
              </text>
            </g>
          )}

          {/* Rute dagang bercahaya emas yang menggambar sendiri */}
          {rute.map((r) => {
            const p = interpolate(frame, [r.tunda, r.tunda + 40], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const dashOffset = r.panjang * (1 - p);
            const pinMuncul = pegasHalus(frame, fps, r.tunda + 30, 14, 160);
            return (
              <g key={r.nama}>
                {/* Aura lembut */}
                <path
                  d={r.path}
                  fill="none"
                  stroke="#F7C95C"
                  strokeOpacity={0.38}
                  strokeWidth={11}
                  strokeLinecap="round"
                  strokeDasharray={r.panjang}
                  strokeDashoffset={dashOffset}
                  filter="url(#pendarEmas)"
                />
                {/* Garis rute utama */}
                <path
                  d={r.path}
                  fill="none"
                  stroke="#FFF2C6"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={r.panjang}
                  strokeDashoffset={dashOffset}
                />
                {/* Pin & nama kota saat rute sampai */}
                {pinMuncul > 0.02 ? (
                  <g opacity={pinMuncul}>
                    <circle cx={r.x} cy={r.y} r={14 * pinMuncul} fill="#F5BD4E" opacity={0.35} />
                    <circle cx={r.x} cy={r.y} r={7.5} fill="#FFF5D6" stroke="#8C261C" strokeWidth={3} />
                    <text
                      x={r.x + r.labelDx}
                      y={r.y + r.labelDy}
                      fill="#FAF0D7"
                      fontFamily={FONT_SERIF}
                      fontSize={28}
                      fontWeight={700}
                      style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.9))' }}
                    >
                      {r.nama}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}

          {/* Pilar cahaya emas & suar pusat */}
          <polygon
            points={`${pusat.x - 16},${pusat.y} ${pusat.x + 16},${pusat.y} ${pusat.x + 5},${pusat.y - 310} ${pusat.x - 5},${pusat.y - 310}`}
            fill="url(#sinarMokha)"
          />
          <circle cx={pusat.x} cy={pusat.y} r={42 * denyutPusat} fill="none" stroke="#F5CA6A" strokeWidth={2.5} opacity={0.45} />
          <circle cx={pusat.x} cy={pusat.y} r={24 * denyutPusat} fill="#F5CA6A" opacity={0.32} />
          <circle cx={pusat.x} cy={pusat.y} r={11} fill="#FFF7DC" stroke="#A63222" strokeWidth={3.5} filter="url(#pendarEmas)" />
          <text
            x={pusat.x + 24}
            y={pusat.y + 8}
            fill="#FFE8A3"
            fontFamily={FONT_SERIF}
            fontSize={32}
            fontWeight={800}
            style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.95))' }}
          >
            {pusat.nama}
          </text>

          {/* Kompas Kuno berputar perlahan di kanan bawah peta */}
          <g transform={`translate(880, 1345) rotate(${rotasiKompas})`} opacity={0.78}>
            <circle cx={0} cy={0} r={88} fill="rgba(19,44,39,0.55)" stroke="#E3C07B" strokeWidth={2.5} />
            <circle cx={0} cy={0} r={74} fill="none" stroke="#E3C07B" strokeWidth={1.2} strokeDasharray="5 5" />
            <polygon points="0,-82 14,-14 0,0 -14,-14" fill="#F2CD7E" />
            <polygon points="0,82 14,14 0,0 -14,14" fill="#A67C3E" />
            <polygon points="82,0 14,14 0,0 14,-14" fill="#D4AC5D" />
            <polygon points="-82,0 -14,14 0,0 -14,-14" fill="#A67C3E" />
            <circle cx={0} cy={0} r={9} fill="#162421" stroke="#F5D78E" strokeWidth={2.5} />
          </g>
        </svg>
      </AbsoluteFill>

      {/* Gradasi gelap atas & bawah untuk keterbacaan tipografi */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(10,12,11,0.96) 0%, rgba(10,12,11,0.92) 21%, rgba(10,12,11,0) 35%, rgba(10,12,11,0) 68%, rgba(9,12,11,0.9) 84%, rgba(8,10,10,0.98) 100%)',
        }}
      />
      <PartikelCahaya warna="#F5CA6A" jumlah={14} intensitas={0.45} />
      <WatermarkAkun akun={akun} terang />

      {/* Header Editorial Peta ala @motionformat */}
      <div
        style={{
          position: 'absolute',
          top: 158,
          left: 60,
          right: 60,
          textAlign: 'center',
          transform: `translateY(${interpolate(pHeader, [0, 1], [18, 0])}px)`,
          opacity: pHeader,
        }}
      >
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: ukuranJudulPeta,
            fontWeight: 800,
            letterSpacing: '0.09em',
            background: 'linear-gradient(180deg, #FCE39E 0%, #D49B3E 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.0,
          }}
        >
          {judulPeta}
        </div>
        <div
          style={{
            marginTop: 10,
            color: '#D8B160',
            fontSize: 22,
            letterSpacing: '0.5em',
          }}
        >
          · ♦ ·
        </div>
        {adegan.subjudulKartu ? (
          <div
            style={{
              marginTop: 8,
              fontFamily: FONT_SERIF,
              fontSize: 38,
              fontWeight: 700,
              color: '#F5EBD6',
              textShadow: '0 4px 16px rgba(0,0,0,0.8)',
            }}
          >
            {adegan.subjudulKartu}
          </div>
        ) : null}
      </div>

      {/* Plakat lokasi & abad hijau zamrud-emas (ala "±1293 Trowulan") */}
      {adegan.plakatTahun || adegan.plakatTempat ? (
        <div
          style={{
            position: 'absolute',
            left: 84,
            bottom: 486,
            transform: `translateY(${interpolate(pPlakat, [0, 1], [20, 0])}px)`,
            opacity: pPlakat,
            background: 'rgba(18, 53, 46, 0.92)',
            border: '2.5px solid #D6B15C',
            borderRadius: 10,
            padding: '16px 28px',
            boxShadow: '0 16px 34px rgba(0,0,0,0.55)',
          }}
        >
          {adegan.plakatTahun ? (
            <div
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 30,
                fontWeight: 800,
                color: '#F3CF78',
              }}
            >
              {adegan.plakatTahun}
            </div>
          ) : null}
          {adegan.plakatTempat ? (
            <div
              style={{
                marginTop: 2,
                fontFamily: FONT_SERIF,
                fontSize: 34,
                fontWeight: 700,
                color: '#FAF1DD',
              }}
            >
              {adegan.plakatTempat}
            </div>
          ) : null}
        </div>
      ) : null}

      <TeksKinetik
        narasi={adegan.narasi}
        durasiDetik={adegan.durasi}
        kata={adegan.kata}
        kataSorot={adegan.kataSorot}
        gaya="malam"
        bottom={220}
        ukuranFont={48}
      />
    </AbsoluteFill>
  );
};

/** Adegan Close-Up Arsip / Dokumen Kuno dengan stempel merah animasi ala @unrealunfold. */
const AdeganArsip: React.FC<{ adegan: AdeganCeritaMotion; durasiBingkai: number; akun: string }> = ({
  adegan,
  durasiBingkai,
  akun,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pKertas = pegasHalus(frame, fps, 4, 15, 108);
  const pStempel = pegasHalus(frame, fps, 24, 10, 210);
  const miring = interpolate(frame, [0, durasiBingkai], [-1.4, 0.8], { extrapolateRight: 'clamp' });

  // Pecah narasi menjadi 2–3 baris kutipan singkat pada lembar arsip
  const kalimat = String(adegan.narasi ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  const judulDok = (adegan.judulKartu || 'CATATAN ARSIP').toUpperCase();
  const stempel = (adegan.stempelArsip || adegan.pitaEra || 'TERCATAT').toUpperCase().slice(0, 24);

  return (
    <AbsoluteFill style={{ background: '#07090B' }}>
      <LatarIlustrasi
        berkas={adegan.gambarBerkas}
        kamera={adegan.kamera ?? 'zoom_masuk'}
        durasiBingkai={durasiBingkai}
        warnaCadangan="#07090B"
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 44%, rgba(28,22,15,0.45) 0%, rgba(7,9,11,0.88) 65%, #060709 100%)',
        }}
      />
      <PartikelCahaya warna="#F5CA6A" jumlah={12} intensitas={0.35} />
      <WatermarkAkun akun={akun} terang />

      {/* Lembar dokumen / arsip kuno di tengah layar */}
      <div
        style={{
          position: 'absolute',
          left: 112,
          right: 112,
          top: 450,
          transform: `translateY(${interpolate(pKertas, [0, 1], [65, 0])}px) rotate(${miring}deg) scale(${interpolate(
            pKertas,
            [0, 1],
            [0.92, 1],
          )})`,
          opacity: pKertas,
          background: 'linear-gradient(165deg, #F6EED9 0%, #E7DAB8 100%)',
          borderRadius: 8,
          padding: '54px 56px 64px',
          boxShadow: '0 28px 70px rgba(0,0,0,0.75), inset 0 0 42px rgba(122,86,44,0.22)',
          border: '2px solid rgba(112,78,42,0.42)',
        }}
      >
        <div
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 44,
            fontWeight: 800,
            color: '#1E1610',
            textAlign: 'center',
            letterSpacing: '0.07em',
            lineHeight: 1.12,
          }}
        >
          {judulDok}
        </div>
        {adegan.pitaEra ? (
          <div
            style={{
              marginTop: 10,
              fontFamily: FONT_SANS,
              fontSize: 22,
              fontWeight: 700,
              color: '#5B4631',
              textAlign: 'center',
              letterSpacing: '0.14em',
            }}
          >
            {adegan.pitaEra}
          </div>
        ) : null}

        <div
          style={{
            height: 2,
            background: 'rgba(84,60,36,0.45)',
            margin: '26px 0 32px',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {kalimat.map((baris, i) => (
            <div
              key={i}
              style={{
                fontFamily: i === 0 ? FONT_SERIF : FONT_SERIF_ITALIC,
                fontSize: i === 0 ? 34 : 31,
                fontWeight: i === 0 ? 700 : 500,
                color: '#2A1E15',
                lineHeight: 1.38,
              }}
            >
              {baris}
            </div>
          ))}
        </div>

        {/* Stempel merah berbingkai menghantam dengan pegas */}
        <div
          style={{
            marginTop: 40,
            display: 'flex',
            justifyContent: 'center',
            opacity: interpolate(pStempel, [0, 1], [0, 0.9]),
            transform: `rotate(-4deg) scale(${interpolate(pStempel, [0, 1], [1.65, 1])})`,
          }}
        >
          <div
            style={{
              border: '5px solid #B53126',
              borderRadius: 6,
              padding: '10px 30px',
              fontFamily: FONT_SERIF,
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: '#B53126',
              boxShadow: 'inset 0 0 0 2px rgba(181,49,38,0.22)',
            }}
          >
            {stempel}
          </div>
        </div>
      </div>

      <TeksKinetik
        narasi={adegan.narasi}
        durasiDetik={adegan.durasi}
        kata={adegan.kata}
        kataSorot={adegan.kataSorot}
        gaya="malam"
        bottom={220}
        ukuranFont={48}
      />
    </AbsoluteFill>
  );
};

/** Adegan 4: Penutup Sinematik + Kredit Brand. */
const AdeganPenutup: React.FC<{
  adegan: AdeganCeritaMotion;
  durasiBingkai: number;
  akun: string;
  kredit?: string;
  ajakan?: string;
}> = ({ adegan, durasiBingkai, akun, kredit, ajakan }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pPenutup = pegasHalus(frame, fps, 14);

  return (
    <AbsoluteFill style={{ background: '#090A0C' }}>
      <LatarIlustrasi
        berkas={adegan.gambarBerkas}
        kamera={adegan.kamera ?? 'zoom_keluar'}
        durasiBingkai={durasiBingkai}
        warnaCadangan="#090A0C"
      />
      <PartikelCahaya warna="#F5C76B" jumlah={22} intensitas={0.6} />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(8,9,11,0.55) 0%, rgba(8,9,11,0.08) 28%, rgba(8,9,11,0.18) 48%, rgba(8,9,11,0.9) 70%, #08090B 85%)',
        }}
      />
      <BingkaiSinematik gelap />
      <WatermarkAkun akun={akun} terang />

      {/* Animasi karakter 2D penutup sinematik */}
      {adegan.karakter ? (
        <PanggungKarakterCerita
          konfig={adegan.karakter}
          durasiBingkai={durasiBingkai}
          tema="malam"
          bottomLantai={720}
          kata={adegan.kata}
        />
      ) : null}

      <TeksKinetik
        narasi={adegan.narasi}
        durasiDetik={adegan.durasi}
        kata={adegan.kata}
        kataSorot={adegan.kataSorot}
        gaya="malam"
        bottom={545}
        ukuranFont={50}
      />

      {/* Kartu Kredit Editorial */}
      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          bottom: 205,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          opacity: pPenutup,
          transform: `translateY(${interpolate(pPenutup, [0, 1], [18, 0])}px)`,
        }}
      >
        <div
          style={{
            width: 140,
            height: 2,
            background: 'linear-gradient(90deg, transparent, #E4BC62, transparent)',
            marginBottom: 22,
          }}
        />
        {adegan.judulKartu ? (
          <div
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 58,
              fontWeight: 800,
              color: '#F7EFE0',
              lineHeight: 1.12,
              textShadow: '0 6px 24px rgba(0,0,0,0.85)',
            }}
          >
            {adegan.judulKartu}
          </div>
        ) : null}
        {ajakan ? (
          <div
            style={{
              marginTop: 14,
              fontFamily: FONT_SERIF_ITALIC,
              fontSize: 34,
              color: '#E5BC5B',
            }}
          >
            {ajakan}
          </div>
        ) : null}
        {kredit ? (
          <div
            style={{
              marginTop: 22,
              fontFamily: FONT_SANS,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(246,238,220,0.72)',
            }}
          >
            {kredit}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** Pembungkus fade-in & fade-out halus antar adegan. */
const LapisanTransisi: React.FC<{ durasiBingkai: number; indeks: number; children: React.ReactNode }> = ({
  durasiBingkai,
  indeks,
  children,
}) => {
  const frame = useCurrentFrame();
  const masuk = indeks === 0 ? 1 : interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const keluar = interpolate(frame, [durasiBingkai - 9, durasiBingkai], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{ opacity: Math.min(masuk, keluar) }}>{children}</AbsoluteFill>;
};

export const CeritaMotion: React.FC<PropsCeritaMotion> = (props) => {
  const jadwal = hitungDurasiCeritaMotion(props);
  const musikVol = props.musikVolume ?? 0.16;

  return (
    <AbsoluteFill style={{ background: '#080A0D' }}>
      {props.musik ? (
        <Audio
          src={staticFile(props.musik)}
          volume={(f) => {
            const masuk = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
            const keluar = interpolate(f, [jadwal.total - 30, jadwal.total], [1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return musikVol * Math.min(masuk, keluar);
          }}
        />
      ) : null}

      {props.adegan.map((adegan, idx) => {
        const slot = jadwal.adegan[idx];
        if (!slot) return null;
        return (
          <Sequence key={adegan.nomor ?? idx} from={slot.mulai} durationInFrames={slot.durasi}>
            {adegan.suaraBerkas ? <Audio src={staticFile(adegan.suaraBerkas)} volume={1.0} /> : null}
            {idx > 0 && props.sfxWhoosh ? <Audio src={staticFile(props.sfxWhoosh)} volume={0.28} /> : null}
            <LapisanTransisi durasiBingkai={slot.durasi} indeks={idx}>
              {adegan.jenis === 'pembuka' ? (
                <AdeganPembuka adegan={adegan} durasiBingkai={slot.durasi} akun={props.akun} />
              ) : adegan.jenis === 'perkamen' ? (
                <AdeganPerkamen adegan={adegan} durasiBingkai={slot.durasi} akun={props.akun} />
              ) : adegan.jenis === 'peta' ? (
                <AdeganPetaKuno adegan={adegan} durasiBingkai={slot.durasi} akun={props.akun} />
              ) : adegan.jenis === 'arsip' ? (
                <AdeganArsip adegan={adegan} durasiBingkai={slot.durasi} akun={props.akun} />
              ) : adegan.jenis === 'penutup' ? (
                <AdeganPenutup
                  adegan={adegan}
                  durasiBingkai={slot.durasi}
                  akun={props.akun}
                  kredit={props.kreditPenutup}
                  ajakan={props.ajakanPenutup}
                />
              ) : (
                <AdeganIlustrasi adegan={adegan} durasiBingkai={slot.durasi} akun={props.akun} />
              )}
            </LapisanTransisi>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
