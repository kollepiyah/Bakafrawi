// Komposisi video sinematik 9:16 untuk merek bank media (Lek Kopi, kafe, gaya hidup).
// Menggabungkan klip video asli (.mp4) + foto bank + B-roll gambar AI (Ken Burns) dengan color
// grading hangat kafe, transisi halus, tipografi editorial/POV-chat, dan penutup elegan.
import React from 'react';
import {
  AbsoluteFill,
  Audio,
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

export const Sinematik: React.FC<PropsSinematik> = (props) => {
  const frame = useCurrentFrame();
  const { jadwal, penutupMulai, penutupDurasi, total } = hitungDurasiSinematik(props);
  const aksen = props.merek.aksen || '#D9A441';
  const volDasar = Number(props.musikVolume) || 0.72;

  return (
    <AbsoluteFill style={{ background: '#0E0B09' }}>
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

      {/* Bilah progres tipis di atas layar */}
      <div style={{ position: 'absolute', top: 44, left: 48, right: 48, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (frame / total) * 100)}%`, height: '100%', background: aksen, borderRadius: 99 }} />
      </div>

      {/* Watermark merek halus di pojok kiri atas (hilang saat penutup) */}
      {frame < penutupMulai ? (
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
