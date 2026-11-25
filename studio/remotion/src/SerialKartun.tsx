import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { SANS, SERIF, TANGAN } from './components/dasar';
import { KarakterKartun } from './components/KarakterKartun';
import { LatarKartunBawaan } from './components/LatarKartunBawaan';
import {
  contohSerialKartun,
  FPS_SERIAL,
  hitungDurasiSerialKartun,
  type AdeganSerialKartun,
  type KameraKartun,
  type PropsSerialKartun,
} from './data/serial-waktu';

export { contohSerialKartun, FPS_SERIAL, hitungDurasiSerialKartun };
export type { AdeganSerialKartun, PropsSerialKartun };

const NAMA_TOKOH_BAWAAN: Record<string, string> = {
  mas_barista: 'Mas Lek',
  mas_pelanggan: 'Mas Danu',
  mbak_pelanggan: 'Mbak Rara',
  pak_tetangga: 'Pak Budi',
  kucing_kedai: 'Cimol',
  narator: 'Cerita Lek Kopi',
};

/** Transformasi kamera 2D untuk foto latar kartun agar adegan terasa hidup. */
function gayaKamera(kamera: KameraKartun | undefined, frame: number, durasi: number): string {
  const k = kamera ?? 'zoom_masuk';
  const p = Math.min(1, Math.max(0, frame / Math.max(1, durasi)));
  if (k === 'diam') return 'scale(1.03)';
  if (k === 'zoom_keluar') {
    const s = interpolate(p, [0, 1], [1.14, 1.03]);
    return `scale(${s})`;
  }
  if (k === 'geser_kiri') {
    const x = interpolate(p, [0, 1], [24, -24]);
    return `scale(1.09) translateX(${x}px)`;
  }
  if (k === 'geser_kanan') {
    const x = interpolate(p, [0, 1], [-24, 24]);
    return `scale(1.09) translateX(${x}px)`;
  }
  if (k === 'goyang_kaget') {
    const decay = Math.max(0, 1 - frame / 18);
    const gx = Math.sin(frame * 1.9) * 14 * decay;
    const gy = Math.cos(frame * 2.3) * 10 * decay;
    return `scale(1.08) translate(${gx}px, ${gy}px)`;
  }
  const s = interpolate(p, [0, 1], [1.03, 1.13]);
  return `scale(${s})`;
}

/** Partikel bokeh hangat lembut supaya latar terasa atmosferik. */
const PartikelHangat: React.FC<{ aksen: string }> = ({ aksen }) => {
  const frame = useCurrentFrame();
  const titik = [
    { x: 140, y: 360, r: 9, v: 0.7 },
    { x: 890, y: 420, r: 12, v: 0.5 },
    { x: 320, y: 690, r: 7, v: 0.9 },
    { x: 760, y: 780, r: 10, v: 0.6 },
    { x: 540, y: 300, r: 8, v: 0.8 },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {titik.map((t, i) => {
        const dy = Math.sin(frame * 0.04 * t.v + i * 1.4) * 18;
        const op = 0.2 + 0.15 * Math.sin(frame * 0.06 + i);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: t.x,
              top: t.y + dy,
              width: t.r * 2,
              height: t.r * 2,
              borderRadius: 999,
              background: aksen,
              opacity: op,
              filter: 'blur(2px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const LapisanLatar: React.FC<{ berkas?: string; kode: string; kamera?: KameraKartun; durasi: number }> = ({
  berkas,
  kode,
  kamera,
  durasi,
}) => {
  const frame = useCurrentFrame();
  const trans = gayaKamera(kamera, frame, durasi);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#1F1610' }}>
      <div style={{ width: '100%', height: '100%', transform: trans }}>
        {berkas ? (
          <Img
            src={staticFile(berkas)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <LatarKartunBawaan kode={kode} />
        )}
      </div>
      {/* Vignette atas & bawah lembut untuk keterbacaan teks tanpa menggelapkan warna ceria */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(20,14,10,0.62) 0%, rgba(20,14,10,0.08) 22%, rgba(20,14,10,0.06) 62%, rgba(16,11,8,0.82) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const KartuIntro: React.FC<{ props: PropsSerialKartun; durasi: number }> = ({ props, durasi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pegas = spring({ frame, fps, config: { damping: 14, stiffness: 130, mass: 0.85 } });
  const keluar = interpolate(frame, [durasi - 10, durasi], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const aksen = props.gayaCerita === 'dokumenter' ? '#E3C989' : props.mood === 'komedi_ceria' ? '#18B4A8' : '#D9A441';

  return (
    <AbsoluteFill style={{ opacity: keluar }}>
      <LapisanLatar
        berkas={props.latarIntroBerkas}
        kode={props.latarIntroKode || props.adegan[0]?.latarKode || 'outdoor'}
        kamera="zoom_masuk"
        durasi={durasi}
      />
      <AbsoluteFill style={{ background: 'rgba(18, 12, 9, 0.56)', justifyContent: 'center', alignItems: 'center', padding: '0 84px' }}>
        <div
          style={{
            transform: `scale(${0.86 + 0.14 * pegas}) translateY(${interpolate(pegas, [0, 1], [32, 0])}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 22,
          }}
        >
          {/* Ikon cangkir kopi kartun SVG (stabil di Linux runner tanpa font emoji) */}
          <div
            style={{
              width: 116,
              height: 116,
              borderRadius: 32,
              background: '#FFFDF7',
              border: '5px solid #2B1D14',
              boxShadow: '0 18px 36px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 80 80" width="76" height="76">
              <path
                d={`M 28,${22 - ((frame * 0.4) % 8)} Q 22,${14 - ((frame * 0.4) % 8)} 29,7`}
                fill="none"
                stroke="#D9A441"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d={`M 44,${20 - ((frame * 0.35) % 8)} Q 50,${12 - ((frame * 0.35) % 8)} 43,6`}
                fill="none"
                stroke="#D9A441"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M 54,34 C 67,34 67,52 54,52"
                fill="none"
                stroke="#2B1D14"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M 18,30 L 56,30 L 52,58 C 50,65 24,65 22,58 Z"
                fill="#18B4A8"
                stroke="#2B1D14"
                strokeWidth="4.5"
                strokeLinejoin="round"
              />
              <ellipse cx="37" cy="30" rx="19" ry="5.5" fill="#6F4E37" stroke="#2B1D14" strokeWidth="4" />
              <path d="M 13,65 Q 37,72 61,65" fill="none" stroke="#2B1D14" strokeWidth="4.5" strokeLinecap="round" />
            </svg>
          </div>
          <div
            style={{
              background: aksen,
              color: '#14100C',
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: 2.2,
              padding: '12px 30px',
              borderRadius: 999,
              border: '3px solid #2B1D14',
              textTransform: 'uppercase',
            }}
          >
            EPISODE {props.nomorEpisode} · {props.judulSerial}
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 72,
              lineHeight: 1.1,
              color: '#FFFDF7',
              textShadow: '0 8px 28px rgba(0,0,0,0.65)',
            }}
          >
            {props.judulEpisode}
          </div>
          <div style={{ fontFamily: TANGAN, fontSize: 40, color: '#F3D58D' }}>
            {props.akun}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const KartuPenutup: React.FC<{ props: PropsSerialKartun; durasi: number }> = ({ props, durasi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pegas = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const keluar = interpolate(frame, [durasi - 8, durasi], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const aksen = props.gayaCerita === 'dokumenter' ? '#E3C989' : props.mood === 'komedi_ceria' ? '#34E0CD' : '#F3D58D';

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 50% 38%, #4A3224 0%, #241812 65%, #140D0A 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 80px',
        opacity: Math.min(pegas, keluar),
      }}
    >
      <div
        style={{
          transform: `scale(${0.9 + 0.1 * pegas})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 24,
        }}
      >
        <div
          style={{
            background: '#D9A441',
            color: '#1A120C',
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: 1.6,
            padding: '10px 28px',
            borderRadius: 999,
            textTransform: 'uppercase',
          }}
        >
          Tunggu Episode {props.nomorEpisode + 1}!
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 50,
            lineHeight: 1.25,
            color: '#FFFDF7',
          }}
        >
          {props.pertanyaanPenutup}
        </div>
        <div style={{ width: 92, height: 4, borderRadius: 99, background: aksen }} />
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 64, color: aksen }}>
          Lek Kopi
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 28, color: 'rgba(255,248,236,0.84)' }}>
          {props.infoKedai}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const AdeganPanggung: React.FC<{
  adegan: AdeganSerialKartun;
  props: PropsSerialKartun;
  durasi: number;
}> = ({ adegan, props, durasi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const masuk = interpolate(frame, [0, 7], [0, 1], { extrapolateRight: 'clamp' });
  const keluar = interpolate(frame, [durasi - 6, durasi], [1, 0.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const aksen = props.gayaCerita === 'dokumenter' ? '#E3C989' : props.mood === 'komedi_ceria' ? '#34E0CD' : '#F3D58D';

  const adaKiri = Boolean(adegan.tokohKiri);
  const adaKanan = Boolean(adegan.tokohKanan);
  const jumlahTokoh = Number(adaKiri) + Number(adaKanan);

  // Hitung kata aktif & jendela halaman (maks 12 kata/layar) agar narasi/dialog panjang tetap rapi di zona aman
  const KATA_PER_HALAMAN = 12;
  const detik = frame / fps;
  const kataList = adegan.kata ?? [];
  const indeksAktif = kataList.findIndex((k) => detik >= k.mulai - 0.04 && detik <= k.selesai + 0.06);

  let mulaiIdx = 0;
  let kataTampil = kataList;
  if (kataList.length > KATA_PER_HALAMAN) {
    let indeksTunjuk = indeksAktif;
    if (indeksTunjuk < 0) {
      const terakhir = kataList[kataList.length - 1];
      if (terakhir && detik > terakhir.selesai) {
        indeksTunjuk = kataList.length - 1;
      } else {
        const sesudah = kataList.findIndex((k) => detik < k.mulai);
        indeksTunjuk = sesudah >= 0 ? Math.max(0, sesudah - 1) : 0;
      }
    }
    const halaman = Math.floor(Math.max(0, indeksTunjuk) / KATA_PER_HALAMAN);
    mulaiIdx = halaman * KATA_PER_HALAMAN;
    kataTampil = kataList.slice(mulaiIdx, mulaiIdx + KATA_PER_HALAMAN);
  }

  let teksFallback = adegan.dialog;
  if (kataList.length === 0 && adegan.dialog) {
    const semuaKata = adegan.dialog.trim().split(/\s+/).filter(Boolean);
    if (semuaKata.length > 14) {
      const jumlahHalaman = Math.ceil(semuaKata.length / KATA_PER_HALAMAN);
      const halaman = Math.min(jumlahHalaman - 1, Math.floor((frame / Math.max(1, durasi)) * jumlahHalaman));
      teksFallback = semuaKata.slice(halaman * KATA_PER_HALAMAN, (halaman + 1) * KATA_PER_HALAMAN).join(' ');
    }
  }

  const panjangTeksTampil =
    kataTampil.length > 0 ? kataTampil.map((k) => k.teks).join(' ').length : teksFallback.length;
  const ukuranFontSubtitle = panjangTeksTampil > 75 ? 35 : 39;

  const pegasSubtitle = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ opacity: Math.min(masuk, keluar) }}>
      {/* 1. Latar kartun + efek kamera + partikel */}
      <LapisanLatar berkas={adegan.latarBerkas} kode={adegan.latarKode} kamera={adegan.kamera} durasi={durasi} />
      <PartikelHangat aksen={aksen} />

      {/* 2. Header serial konsisten di zona aman IG atas */}
      <div
        style={{
          position: 'absolute',
          top: 112,
          left: 60,
          right: 60,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            background: 'rgba(20, 14, 10, 0.68)',
            border: '1.5px solid rgba(255,255,255,0.2)',
            borderRadius: 999,
            padding: '10px 26px',
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 23,
            color: '#FFF8EB',
            letterSpacing: 0.4,
          }}
        >
          {props.akun} · {props.judulSerial} • EP {props.nomorEpisode}
        </div>
      </div>

      {/* 3. Kartu waktu / bab opsional */}
      {adegan.kartuWaktu ? (
        <div
          style={{
            position: 'absolute',
            top: 186,
            left: 60,
            right: 60,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#FFF3BF',
              color: '#2B1D14',
              border: '3px solid #2B1D14',
              borderRadius: 16,
              padding: '8px 22px',
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: 1.5,
              boxShadow: '0 8px 20px rgba(0,0,0,0.28)',
            }}
          >
            {adegan.kartuWaktu}
          </div>
        </div>
      ) : null}

      {/* 4. Panggung Tokoh Kartun 2D (disembunyikan penuh pada mode Dokumenter Murni) */}
      {jumlahTokoh > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: 430,
            height: 540,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: jumlahTokoh === 2 ? 'space-between' : 'center',
            padding: jumlahTokoh === 2 ? '0 10px' : '0',
          }}
        >
          {adegan.tokohKiri && (
            <div
              style={{
                transform: `translateY(${adegan.pembicara === 'kiri' ? -10 : 12}px)`,
                filter:
                  adegan.pembicara === 'kanan' && jumlahTokoh === 2
                    ? 'brightness(0.88)'
                    : 'drop-shadow(0 16px 24px rgba(0,0,0,0.38))',
              }}
            >
              <KarakterKartun
                tokoh={adegan.tokohKiri.id}
                ekspresi={adegan.tokohKiri.ekspresi}
                properti={adegan.tokohKiri.properti}
                efek={adegan.tokohKiri.efek}
                sedangBicara={adegan.pembicara === 'kiri'}
                kata={adegan.pembicara === 'kiri' ? adegan.kata : undefined}
                hadap={jumlahTokoh === 2 ? 'kanan' : 'kanan'}
                ukuran={jumlahTokoh === 2 ? 430 : 490}
              />
            </div>
          )}
          {adegan.tokohKanan && (
            <div
              style={{
                transform: `translateY(${adegan.pembicara === 'kanan' ? -10 : 12}px)`,
                filter:
                  adegan.pembicara === 'kiri' && jumlahTokoh === 2
                    ? 'brightness(0.88)'
                    : 'drop-shadow(0 16px 24px rgba(0,0,0,0.38))',
              }}
            >
              <KarakterKartun
                tokoh={adegan.tokohKanan.id}
                ekspresi={adegan.tokohKanan.ekspresi}
                properti={adegan.tokohKanan.properti}
                efek={adegan.tokohKanan.efek}
                sedangBicara={adegan.pembicara === 'kanan'}
                kata={adegan.pembicara === 'kanan' ? adegan.kata : undefined}
                hadap={jumlahTokoh === 2 ? 'kiri' : 'kanan'}
                ukuran={jumlahTokoh === 2 ? 430 : 490}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* 5. Balon Subtitle & Nama Pembicara (Zona aman bawah IG) */}
      {adegan.dialog ? (
        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            bottom: 240,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: `translateY(${interpolate(pegasSubtitle, [0, 1], [24, 0])}px)`,
          }}
        >
          <div
            style={{
              width: '100%',
              background: 'rgba(20, 15, 11, 0.88)',
              border: `3px solid ${aksen}`,
              borderRadius: 28,
              padding: '22px 30px 26px',
              boxShadow: '0 22px 44px rgba(0,0,0,0.52)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span
                style={{
                  background: aksen,
                  color: '#14100C',
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 22,
                  padding: '4px 16px',
                  borderRadius: 999,
                }}
              >
                {adegan.namaPembicara ||
                  NAMA_TOKOH_BAWAAN[
                    adegan.pembicara === 'kiri'
                      ? (adegan.tokohKiri?.id ?? 'narator')
                      : adegan.pembicara === 'kanan'
                      ? (adegan.tokohKanan?.id ?? 'narator')
                      : 'narator'
                  ] ||
                  'Lek Kopi'}
              </span>
            </div>

            <div
              style={{
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: ukuranFontSubtitle,
                lineHeight: 1.32,
                color: '#FFFDF7',
              }}
            >
              {kataTampil.length > 0
                ? kataTampil.map((k, idx) => {
                    const globalIdx = mulaiIdx + idx;
                    return (
                      <span
                        key={globalIdx}
                        style={{
                          color:
                            globalIdx === indeksAktif
                              ? aksen
                              : globalIdx < indeksAktif
                              ? '#FFFDF7'
                              : 'rgba(255,253,247,0.82)',
                          transition: 'color 80ms linear',
                        }}
                      >
                        {k.teks}
                        {idx < kataTampil.length - 1 ? ' ' : ''}
                      </span>
                    );
                  })
                : teksFallback}
            </div>
          </div>
        </div>
      ) : null}

      {/* 6. Audio Dialog & SFX */}
      {adegan.suaraBerkas ? <Audio src={staticFile(adegan.suaraBerkas)} volume={1.0} /> : null}
      {adegan.sfx === 'pop' && props.sfxPop ? <Audio src={staticFile(props.sfxPop)} volume={0.45} /> : null}
      {adegan.sfx === 'whoosh' && props.sfxWhoosh ? <Audio src={staticFile(props.sfxWhoosh)} volume={0.42} /> : null}
    </AbsoluteFill>
  );
};

export const SerialKartun: React.FC<PropsSerialKartun> = (props) => {
  const { introFrames, jadwal, penutupMulai, penutupFrames } = hitungDurasiSerialKartun(props);

  return (
    <AbsoluteFill style={{ background: '#1A120C' }}>
      {/* Musik latar kafe lembut sepanjang episode */}
      {props.musik ? <Audio src={staticFile(props.musik)} volume={props.musikVolume ?? 0.16} loop /> : null}

      {/* Intro Episode */}
      <Sequence from={0} durationInFrames={introFrames}>
        <KartuIntro props={props} durasi={introFrames} />
        {props.sfxChime ? <Audio src={staticFile(props.sfxChime)} volume={0.45} /> : null}
      </Sequence>

      {/* Adegan-adegan Cerita */}
      {props.adegan.map((a, idx) => {
        const seg = jadwal[idx];
        if (!seg) return null;
        return (
          <Sequence key={`${a.nomor}-${idx}`} from={seg.mulai} durationInFrames={seg.durasi}>
            <AdeganPanggung adegan={a} props={props} durasi={seg.durasi} />
          </Sequence>
        );
      })}

      {/* Penutup Episode */}
      <Sequence from={penutupMulai} durationInFrames={penutupFrames}>
        <KartuPenutup props={props} durasi={penutupFrames} />
        {props.sfxChime ? <Audio src={staticFile(props.sfxChime)} volume={0.45} /> : null}
      </Sequence>
    </AbsoluteFill>
  );
};
