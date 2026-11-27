// Komponen animasi karakter 2D full-body tampak samping (side-profile silhouette + rim-light emas)
// untuk CeritaMotion (gaya storytelling sinematik ala @unrealunfold):
// mendukung animasi berjalan (walk cycle 2 sendi kaki + ayunan lengan), membungkuk memeriksa arsip,
// mengulurkan surat/lentera/kopi, dan dialog dua tokoh berhadapan di atas garis lantai.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type AksiKarakterCerita =
  | 'jalan_kanan'
  | 'jalan_kiri'
  | 'periksa_arsip'
  | 'tunjuk_arsip'
  | 'dialog_dua'
  | 'berdiri_tenang'
  | 'tanpa';

export type TipeKarakterCerita = 'pria' | 'wanita' | 'petualang' | 'santri';

export type PropertiKarakterCerita = 'tanpa' | 'arsip' | 'lentera' | 'cangkir' | 'tas';

export type KonfigPanggungKarakter = {
  aksi: AksiKarakterCerita;
  tokohUtama?: TipeKarakterCerita;
  tokohKedua?: TipeKarakterCerita;
  properti?: PropertiKarakterCerita;
};

type PropsSosok = {
  tipe: TipeKarakterCerita;
  pose: 'jalan' | 'periksa' | 'tunjuk' | 'dengar' | 'berdiri';
  properti?: PropertiKarakterCerita;
  hadap?: 'kanan' | 'kiri';
  tema: 'malam' | 'perkamen';
  faseOffset?: number;
  skala?: number;
};

/**
 * Satu sosok manusia 2D full-body tampak samping dengan sendi bahu, pinggul, & lutut
 * serta rim-light hangat di tepi siluet agar menyatu sinematik di atas latar cerita.
 */
export const SosokCerita2D: React.FC<PropsSosok> = ({
  tipe,
  pose,
  properti = 'tanpa',
  hadap = 'kanan',
  tema,
  faseOffset = 0,
  skala = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const f = frame + faseOffset;
  const berjalan = pose === 'jalan';
  const memeriksa = pose === 'periksa';
  const menunjuk = pose === 'tunjuk';
  const mendengar = pose === 'dengar';

  // Warna siluet + rim-light emas adaptif tema
  const warnaIsi = tema === 'perkamen' ? '#23160E' : '#11100E';
  const warnaBelakang = tema === 'perkamen' ? '#362316' : '#1E1B16';
  const warnaRim = tema === 'perkamen' ? '#F3D488' : '#E7C26E';
  const warnaKerah = tema === 'perkamen' ? '#EFE0BC' : '#DFCFA8';

  // Siklus berjalan (sekitar 2 langkah/detik pada 30fps)
  const faseJalan = f * 0.24;
  const ayunPahaDepan = berjalan ? Math.sin(faseJalan) * 28 : 0;
  const ayunPahaBelakang = berjalan ? Math.sin(faseJalan + Math.PI) * 28 : 0;
  const tekukLututDepan = berjalan ? Math.max(0, -Math.cos(faseJalan)) * 34 : 0;
  const tekukLututBelakang = berjalan ? Math.max(0, -Math.cos(faseJalan + Math.PI)) * 34 : 0;

  // Naik-turun badan saat melangkah (bounce natural) atau napas pelan saat berdiri
  const bobY = berjalan
    ? -Math.abs(Math.sin(faseJalan)) * 10
    : Math.sin(f * 0.08) * 2.5;

  // Kemiringan badan atas (membungkuk saat memeriksa arsip seperti referensi @unrealunfold)
  const pegasPose = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 16, stiffness: 105 } });
  const condongBadan = memeriksa
    ? interpolate(pegasPose, [0, 1], [2, 18]) + Math.sin(f * 0.07) * 1.4
    : berjalan
    ? 6 + Math.sin(faseJalan * 2) * 1.5
    : mendengar
    ? -3 + Math.sin(f * 0.06) * 1.2
    : Math.sin(f * 0.07) * 1.5;

  // Ayunan lengan depan & belakang
  const rotLenganDepan = berjalan
    ? Math.sin(faseJalan + Math.PI) * 26
    : menunjuk
    ? interpolate(pegasPose, [0, 1], [-10, -76]) + Math.sin(f * 0.1) * 2.5
    : memeriksa
    ? interpolate(pegasPose, [0, 1], [-8, -42]) + Math.sin(f * 0.09) * 2
    : properti === 'lentera'
    ? -54 + Math.sin(f * 0.09) * 3
    : properti === 'cangkir' || properti === 'arsip'
    ? -46 + Math.sin(f * 0.08) * 2
    : Math.sin(f * 0.08) * 4;

  const rotLenganBelakang = berjalan
    ? Math.sin(faseJalan) * 24
    : memeriksa
    ? 14
    : -6 + Math.sin(f * 0.07 + 1) * 3;

  // Anggukan kepala halus
  const rotKepala = memeriksa
    ? 14 + Math.sin(f * 0.08) * 2.5
    : mendengar
    ? Math.sin(f * 0.09) * 4
    : menunjuk
    ? -3 + Math.sin(f * 0.14) * 3
    : Math.sin(f * 0.1) * 2;

  const balikX = hadap === 'kiri' ? -1 : 1;
  const adalahWanita = tipe === 'wanita';
  const adalahSantri = tipe === 'santri';
  const adalahPetualang = tipe === 'petualang';

  // Posisi ujung tangan depan (untuk menempelkan properti arsip/lentera/cangkir)
  const uapY = (f * 0.7) % 18;
  const kedipApi = 0.85 + 0.15 * Math.sin(f * 0.35);

  return (
    <svg
      width={260 * skala}
      height={440 * skala}
      viewBox="0 0 260 440"
      style={{ overflow: 'visible' }}
    >
      <g transform={`translate(130, 0) scale(${balikX}, 1) translate(-130, 0)`}>
        {/* Bayangan pijakan kaki di garis lantai */}
        <ellipse
          cx="130"
          cy="418"
          rx={berjalan ? 54 + Math.abs(Math.sin(faseJalan)) * 14 : 48}
          ry="9"
          fill="rgba(0,0,0,0.48)"
        />

        <g transform={`translate(0, ${bobY})`}>
          {/* ── KAKI BELAKANG (lebih redup) ── */}
          <g transform={`translate(126, 258) rotate(${ayunPahaBelakang})`}>
            <path
              d="M -11,0 L 11,0 L 9,78 L -10,78 Z"
              fill={warnaBelakang}
              stroke={warnaRim}
              strokeOpacity="0.28"
              strokeWidth="1.8"
            />
            <g transform={`translate(0, 74) rotate(${tekukLututBelakang})`}>
              <path
                d="M -9,0 L 9,0 L 7,76 L -8,76 Z"
                fill={warnaBelakang}
                stroke={warnaRim}
                strokeOpacity="0.28"
                strokeWidth="1.8"
              />
              {/* Sepatu belakang */}
              <path
                d="M -10,72 L 22,72 C 27,72 28,83 20,83 L -10,83 Z"
                fill={warnaBelakang}
              />
            </g>
          </g>

          {/* ── LENGAN BELAKANG ── */}
          <g transform={`translate(124, 148) rotate(${rotLenganBelakang})`}>
            <path
              d="M -9,0 C -10,36 -8,74 -6,108 C -5,116 7,116 8,108 C 10,74 11,36 9,0 Z"
              fill={warnaBelakang}
              stroke={warnaRim}
              strokeOpacity="0.32"
              strokeWidth="1.8"
            />
          </g>

          {/* ── KAKI DEPAN (rim-light emas tegas di tepi depan) ── */}
          <g transform={`translate(134, 258) rotate(${ayunPahaDepan})`}>
            <path
              d="M -12,0 L 12,0 L 10,78 L -10,78 Z"
              fill={warnaIsi}
              stroke={warnaRim}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <g transform={`translate(0, 74) rotate(${tekukLututDepan})`}>
              <path
                d="M -10,0 L 10,0 L 8,76 L -9,76 Z"
                fill={warnaIsi}
                stroke={warnaRim}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Sepatu depan */}
              <path
                d="M -10,72 L 24,72 C 30,72 30,84 22,84 L -11,84 Z"
                fill={warnaIsi}
                stroke={warnaRim}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>
          </g>

          {/* ── BADAN ATAS, BAJU & KEPALA (berporos di pinggul) ── */}
          <g transform={`translate(130, 262) rotate(${condongBadan}) translate(-130, -262)`}>
            {/* Tas selempang punggung untuk petualang */}
            {adalahPetualang && (
              <path
                d="M 86,154 C 74,158 72,216 86,232 L 104,230 L 106,154 Z"
                fill={warnaBelakang}
                stroke={warnaRim}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
            )}

            {/* Rok / gamis panjang wanita atau sarung/koko santri */}
            {adalahWanita ? (
              <path
                d={`M 105,134 C 102,166 105,212 104,252 L ${92 - (berjalan ? Math.sin(faseJalan) * 10 : 0)},348 L ${172 + (berjalan ? Math.sin(faseJalan) * 10 : 0)},348 L 154,248 C 156,204 155,164 148,134 Z`}
                fill={warnaIsi}
                stroke={warnaRim}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
            ) : adalahSantri ? (
              <path
                d={`M 102,134 C 98,176 99,224 98,266 L ${94 - (berjalan ? Math.sin(faseJalan) * 8 : 0)},330 L ${166 + (berjalan ? Math.sin(faseJalan) * 8 : 0)},330 L 160,256 C 162,210 160,164 152,134 Z`}
                fill={warnaIsi}
                stroke={warnaRim}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
            ) : (
              /* Jas / Kemeja pria ramping ala @unrealunfold */
              <path
                d="M 102,134 C 98,174 102,226 104,268 L 158,268 C 162,222 162,174 154,134 Z"
                fill={warnaIsi}
                stroke={warnaRim}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
            )}

            {/* Aksen kerah putih tipis (seperti karakter referensi @unrealunfold) */}
            <path
              d="M 134,132 L 147,140 L 139,149 Z"
              fill={warnaKerah}
              opacity="0.9"
            />

            {/* Leher */}
            <rect
              x="122"
              y="112"
              width="18"
              height="25"
              rx="6"
              fill={warnaIsi}
              stroke={warnaRim}
              strokeWidth="2"
            />

            {/* ── KEPALA TAMPAK SAMPING ── */}
            <g transform={`translate(131, 114) rotate(${rotKepala}) translate(-131, -114)`}>
              {/* Profil wajah (hidung & dagu menghadap kanan) */}
              <path
                d="M 108,82 C 108,58 124,48 140,50 C 154,52 161,64 160,78 L 166,89 L 159,93 C 159,103 154,114 142,116 C 126,118 112,110 108,96 Z"
                fill={warnaIsi}
                stroke={warnaRim}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />

              {/* Hijab / rambut wanita */}
              {adalahWanita && (
                <path
                  d="M 103,84 C 102,54 122,44 142,46 C 156,48 161,58 158,68 C 146,62 134,66 130,80 C 128,96 134,118 148,138 L 98,142 C 94,120 96,100 103,84 Z"
                  fill={warnaIsi}
                  stroke={warnaRim}
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
              )}

              {/* Kopiah / peci santri */}
              {adalahSantri && (
                <path
                  d="M 106,66 L 111,42 C 120,38 148,38 157,44 L 160,66 C 145,69 120,69 106,66 Z"
                  fill="#0D0B0A"
                  stroke={warnaRim}
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
              )}

              {/* Topi petualang / kopiah lapangan */}
              {adalahPetualang && (
                <g>
                  <path
                    d="M 104,64 L 112,44 C 122,40 146,40 154,46 L 158,64 Z"
                    fill={warnaIsi}
                    stroke={warnaRim}
                    strokeWidth="2.3"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 94,65 Q 134,58 174,66 Q 134,72 94,65 Z"
                    fill={warnaIsi}
                    stroke={warnaRim}
                    strokeWidth="2.2"
                  />
                </g>
              )}

              {/* Rambut pria kasual */}
              {tipe === 'pria' && (
                <path
                  d="M 106,82 C 102,60 116,44 140,45 C 154,46 164,56 161,68 C 150,61 134,62 124,72 C 118,78 114,88 106,82 Z"
                  fill={warnaIsi}
                  stroke={warnaRim}
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
              )}
            </g>

            {/* ── LENGAN DEPAN + PROPERTI TANGAN ── */}
            <g transform={`translate(132, 150) rotate(${rotLenganDepan})`}>
              <path
                d="M -10,0 C -11,38 -9,76 -7,112 C -6,120 7,120 8,112 C 10,76 11,38 10,0 Z"
                fill={warnaIsi}
                stroke={warnaRim}
                strokeWidth="2.3"
                strokeLinejoin="round"
              />
              {/* Tangan / kepalan */}
              <circle cx="1" cy="116" r="9" fill={warnaIsi} stroke={warnaRim} strokeWidth="2" />

              {/* Properti: Lembar Arsip / Surat (seperti @unrealunfold menyerahkan dokumen!) */}
              {properti === 'arsip' && (
                <g transform={`translate(8, 114) rotate(${-rotLenganDepan - condongBadan})`}>
                  <rect
                    x="-4"
                    y="-26"
                    width="68"
                    height="44"
                    rx="4"
                    fill="#F2E7C9"
                    stroke="#5B442A"
                    strokeWidth="2.4"
                  />
                  <rect x="4" y="-17" width="16" height="18" rx="2" fill="#3B3025" opacity="0.78" />
                  <line x1="27" y1="-13" x2="56" y2="-13" stroke="#6E5A42" strokeWidth="3.2" strokeLinecap="round" />
                  <line x1="27" y1="-4" x2="52" y2="-4" stroke="#6E5A42" strokeWidth="2.8" strokeLinecap="round" />
                  <line x1="27" y1="5" x2="46" y2="5" stroke="#8C2A20" strokeWidth="2.8" strokeLinecap="round" />
                </g>
              )}

              {/* Properti: Lentera bercahaya hangat */}
              {properti === 'lentera' && (
                <g transform={`translate(6, 122) rotate(${-rotLenganDepan - condongBadan})`}>
                  {/* Pendar cahaya lentera */}
                  <circle cx="0" cy="24" r={54 * kedipApi} fill="#F5BD4E" opacity={0.18 * kedipApi} />
                  <circle cx="0" cy="24" r={28 * kedipApi} fill="#FFE699" opacity={0.32 * kedipApi} />
                  {/* Pegangan & badan lentera */}
                  <path d="M -8,0 C -8,-10 8,-10 8,0" fill="none" stroke={warnaRim} strokeWidth="2.5" />
                  <rect x="-12" y="2" width="24" height="7" rx="3" fill={warnaIsi} stroke={warnaRim} strokeWidth="2" />
                  <rect x="-10" y="9" width="20" height="28" rx="4" fill="#FCE29C" stroke={warnaRim} strokeWidth="2.2" />
                  <ellipse cx="0" cy="23" rx="5" ry={8 * kedipApi} fill="#FFFDF0" />
                  <rect x="-13" y="37" width="26" height="6" rx="3" fill={warnaIsi} stroke={warnaRim} strokeWidth="2" />
                </g>
              )}

              {/* Properti: Cangkir Kopi Berasap */}
              {properti === 'cangkir' && (
                <g transform={`translate(8, 114) rotate(${-rotLenganDepan - condongBadan})`}>
                  <path
                    d={`M 6,${-18 - uapY * 0.45} Q 1,${-27 - uapY * 0.45} 7,${-35 - uapY * 0.45}`}
                    fill="none"
                    stroke="#FFF4D2"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity={0.75 - uapY / 26}
                  />
                  <path
                    d={`M 15,${-16 - uapY * 0.4} Q 20,${-25 - uapY * 0.4} 14,${-33 - uapY * 0.4}`}
                    fill="none"
                    stroke="#FFF4D2"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity={0.75 - uapY / 26}
                  />
                  <path d="M 22,-4 C 31,-4 31,10 22,10" fill="none" stroke={warnaRim} strokeWidth="3" />
                  <rect x="-2" y="-12" width="25" height="28" rx="6" fill="#F2E4C6" stroke="#3B2718" strokeWidth="2.4" />
                  <ellipse cx="10.5" cy="-12" rx="12.5" ry="3.5" fill="#6F4E37" stroke="#3B2718" strokeWidth="2" />
                </g>
              )}
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
};

/**
 * Panggung karakter 2D untuk `CeritaMotion`:
 * menempatkan karakter di atas garis lantai dengan spotlight lembut & jalur gerak
 * sesuai jenis aksi (berjalan melintas layar, memeriksa arsip, atau dialog 2 tokoh).
 */
export const PanggungKarakterCerita: React.FC<{
  konfig: KonfigPanggungKarakter;
  durasiBingkai: number;
  tema: 'malam' | 'perkamen';
  bottomLantai?: number;
}> = ({ konfig, durasiBingkai, tema, bottomLantai = 505 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!konfig || konfig.aksi === 'tanpa') return null;

  const progres = interpolate(frame, [0, Math.max(1, durasiBingkai)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const masuk = spring({ frame, fps, config: { damping: 16, stiffness: 110 } });

  const tokohUtama: TipeKarakterCerita = konfig.tokohUtama ?? 'petualang';
  const tokohKedua: TipeKarakterCerita = konfig.tokohKedua ?? (tokohUtama === 'wanita' ? 'pria' : 'wanita');
  const properti: PropertiKarakterCerita = konfig.properti ?? 'tanpa';

  // Posisi horizontal untuk aksi berjalan (melintasi area aman tengah layar 1080px)
  const xJalanKanan = interpolate(progres, [0, 1], [150, 670]);
  const xJalanKiri = interpolate(progres, [0, 1], [670, 150]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomLantai,
        height: 490,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {/* Cahaya spotlight hangat halus di belakang karakter (seperti @unrealunfold) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 18,
          width: 780,
          height: 520,
          transform: 'translateX(-50%)',
          background:
            tema === 'perkamen'
              ? 'radial-gradient(ellipse at 50% 58%, rgba(255,241,200,0.34) 0%, rgba(240,204,132,0.12) 45%, rgba(0,0,0,0) 74%)'
              : 'radial-gradient(ellipse at 50% 58%, rgba(246,204,116,0.28) 0%, rgba(212,155,62,0.1) 44%, rgba(0,0,0,0) 74%)',
        }}
      />

      {/* Garis lantai pijakan tipis agar karakter berpijak kokoh */}
      <div
        style={{
          position: 'absolute',
          left: 76,
          right: 76,
          bottom: 24,
          height: 2,
          background:
            tema === 'perkamen'
              ? 'linear-gradient(90deg, transparent 0%, rgba(92,58,28,0.6) 18%, rgba(92,58,28,0.6) 82%, transparent 100%)'
              : 'linear-gradient(90deg, transparent 0%, rgba(235,198,118,0.45) 18%, rgba(235,198,118,0.45) 82%, transparent 100%)',
        }}
      />

      {/* Mode 1: Berjalan dari kiri ke kanan */}
      {konfig.aksi === 'jalan_kanan' && (
        <div
          style={{
            position: 'absolute',
            left: xJalanKanan,
            bottom: 8,
            opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <SosokCerita2D
            tipe={tokohUtama}
            pose="jalan"
            properti={properti}
            hadap="kanan"
            tema={tema}
            skala={1.06}
          />
        </div>
      )}

      {/* Mode 2: Berjalan dari kanan ke kiri */}
      {konfig.aksi === 'jalan_kiri' && (
        <div
          style={{
            position: 'absolute',
            left: xJalanKiri,
            bottom: 8,
            opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <SosokCerita2D
            tipe={tokohUtama}
            pose="jalan"
            properti={properti}
            hadap="kiri"
            tema={tema}
            skala={1.06}
          />
        </div>
      )}

      {/* Mode 3: Membungkuk memeriksa arsip / penemuan */}
      {konfig.aksi === 'periksa_arsip' && (
        <div
          style={{
            position: 'absolute',
            left: 345,
            bottom: 8,
            opacity: masuk,
            transform: `translateX(${interpolate(masuk, [0, 1], [-44, 0])}px)`,
          }}
        >
          <SosokCerita2D
            tipe={tokohUtama}
            pose="periksa"
            properti={properti === 'tanpa' ? 'lentera' : properti}
            hadap="kanan"
            tema={tema}
            skala={1.08}
          />
        </div>
      )}

      {/* Mode 4: Menunjukkan arsip / cangkir / lentera */}
      {konfig.aksi === 'tunjuk_arsip' && (
        <div
          style={{
            position: 'absolute',
            left: 390,
            bottom: 8,
            opacity: masuk,
            transform: `translateY(${interpolate(masuk, [0, 1], [16, 0])}px)`,
          }}
        >
          <SosokCerita2D
            tipe={tokohUtama}
            pose="tunjuk"
            properti={properti === 'tanpa' ? 'arsip' : properti}
            hadap="kanan"
            tema={tema}
            skala={1.08}
          />
        </div>
      )}

      {/* Mode 5: Dua tokoh berhadapan berdialog / menyerahkan arsip (persis @unrealunfold) */}
      {konfig.aksi === 'dialog_dua' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 190,
              bottom: 8,
              opacity: masuk,
              transform: `translateX(${interpolate(masuk, [0, 1], [-48, 0])}px)`,
            }}
          >
            <SosokCerita2D
              tipe={tokohUtama}
              pose="tunjuk"
              properti={properti === 'tanpa' ? 'arsip' : properti}
              hadap="kanan"
              tema={tema}
              skala={1.04}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              right: 190,
              bottom: 8,
              opacity: masuk,
              transform: `translateX(${interpolate(masuk, [0, 1], [48, 0])}px)`,
            }}
          >
            <SosokCerita2D
              tipe={tokohKedua}
              pose="dengar"
              properti="tanpa"
              hadap="kiri"
              tema={tema}
              faseOffset={18}
              skala={1.02}
            />
          </div>
        </>
      )}

      {/* Mode 6: Berdiri tenang sinematik (pembuka / penutup) */}
      {konfig.aksi === 'berdiri_tenang' && (
        <div
          style={{
            position: 'absolute',
            left: 410,
            bottom: 8,
            opacity: masuk,
            transform: `translateY(${interpolate(masuk, [0, 1], [18, 0])}px)`,
          }}
        >
          <SosokCerita2D
            tipe={tokohUtama}
            pose="berdiri"
            properti={properti}
            hadap="kanan"
            tema={tema}
            skala={1.06}
          />
        </div>
      )}
    </div>
  );
};
