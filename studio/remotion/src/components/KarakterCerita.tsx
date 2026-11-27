// Komponen animasi karakter 2D full-body untuk `CeritaMotion`:
// mendukung 2 gaya visual ('ilustrasi' berwarna storybook 2D hangat dengan wajah berkedip & kostum khas era,
// serta 'siluet' rim-light emas), 8 tipe tokoh beragam, dan 9 aksi/komposisi panggung dinamis
// (berjalan, memeriksa arsip, menunjuk, dialog 2 tokoh, duduk menyeduh, tatap horizon, ramai 3 tokoh, berdiri tenang).
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type AksiKarakterCerita =
  | 'jalan_kanan'
  | 'jalan_kiri'
  | 'periksa_arsip'
  | 'tunjuk_arsip'
  | 'dialog_dua'
  | 'duduk_seduh'
  | 'tatap_horizon'
  | 'ramai_tiga'
  | 'berdiri_tenang'
  | 'tanpa';

export type TipeKarakterCerita =
  | 'pria'
  | 'wanita'
  | 'petualang'
  | 'santri'
  | 'petani'
  | 'pedagang'
  | 'tetua'
  | 'pemuda';

export type GayaKarakterCerita = 'ilustrasi' | 'siluet';

export type EkspresiKarakterCerita = 'tenang' | 'takjub' | 'serius' | 'hangat';

export type PropertiKarakterCerita =
  | 'tanpa'
  | 'arsip'
  | 'lentera'
  | 'cangkir'
  | 'tas'
  | 'biji_kopi'
  | 'kitab';

export type KonfigPanggungKarakter = {
  aksi: AksiKarakterCerita;
  tokohUtama?: TipeKarakterCerita;
  tokohKedua?: TipeKarakterCerita;
  tokohKetiga?: TipeKarakterCerita;
  properti?: PropertiKarakterCerita;
  gaya?: GayaKarakterCerita;
  ekspresi?: EkspresiKarakterCerita;
};

type PaletTokoh = {
  kulit: string;
  kulitBayang: string;
  baju: string;
  bajuBayang: string;
  celana: string;
  kerah: string;
  rambut: string;
  aksen: string;
  sepatu: string;
};

const PALET_ILUSTRASI: Record<TipeKarakterCerita, PaletTokoh> = {
  petualang: {
    kulit: '#E6B48A',
    kulitBayang: '#C99268',
    baju: '#7C4A2D',
    bajuBayang: '#58321D',
    celana: '#3D352E',
    kerah: '#EFE0BC',
    rambut: '#2B1E18',
    aksen: '#C89246',
    sepatu: '#2F1F16',
  },
  santri: {
    kulit: '#E8BC96',
    kulitBayang: '#CA9A72',
    baju: '#F2E8D5',
    bajuBayang: '#D9CBB0',
    celana: '#1C4B47',
    kerah: '#D8B15C',
    rambut: '#1F1A17',
    aksen: '#181513',
    sepatu: '#2A221C',
  },
  wanita: {
    kulit: '#EEC39D',
    kulitBayang: '#D4A17A',
    baju: '#B5583B',
    bajuBayang: '#8C3F28',
    celana: '#6E3220',
    kerah: '#F5E5C7',
    rambut: '#E4C79B',
    aksen: '#E8C57B',
    sepatu: '#3A2319',
  },
  pria: {
    kulit: '#E3B086',
    kulitBayang: '#C58E64',
    baju: '#3D352E',
    bajuBayang: '#29231E',
    celana: '#23201E',
    kerah: '#EFE3C8',
    rambut: '#1E1A17',
    aksen: '#C49A52',
    sepatu: '#1B1714',
  },
  petani: {
    kulit: '#D89E72',
    kulitBayang: '#B87E54',
    baju: '#5E4B3A',
    bajuBayang: '#443528',
    celana: '#322921',
    kerah: '#D9C5A0',
    rambut: '#241D18',
    aksen: '#D8B26E',
    sepatu: '#3B2C20',
  },
  pedagang: {
    kulit: '#DFAB81',
    kulitBayang: '#BE8960',
    baju: '#2B4C45',
    bajuBayang: '#1D3530',
    celana: '#1D2926',
    kerah: '#E8CFA0',
    rambut: '#241C16',
    aksen: '#D8A24A',
    sepatu: '#3B2518',
  },
  tetua: {
    kulit: '#D8A780',
    kulitBayang: '#BA8862',
    baju: '#6A5D50',
    bajuBayang: '#4E4339',
    celana: '#342E28',
    kerah: '#EFE4CD',
    rambut: '#E5E1D8',
    aksen: '#C9A45C',
    sepatu: '#2C231C',
  },
  pemuda: {
    kulit: '#EBBF98',
    kulitBayang: '#CE9E76',
    baju: '#2C3A42',
    bajuBayang: '#1D272D',
    celana: '#26292E',
    kerah: '#F5EFE6',
    rambut: '#1F1B18',
    aksen: '#18B4A8',
    sepatu: '#1D2228',
  },
};

type PropsSosok = {
  tipe: TipeKarakterCerita;
  pose: 'jalan' | 'periksa' | 'tunjuk' | 'dengar' | 'berdiri' | 'duduk' | 'horizon';
  properti?: PropertiKarakterCerita;
  hadap?: 'kanan' | 'kiri';
  tema: 'malam' | 'perkamen';
  gaya?: GayaKarakterCerita;
  ekspresi?: EkspresiKarakterCerita;
  faseOffset?: number;
  skala?: number;
};

/**
 * Satu sosok manusia 2D full-body (tampak samping atau 3/4 belakang pada pose horizon)
 * dengan sendi bahu, pinggul, lutut, mata berkedip otomatis, dan kostum adaptif 8 tipe tokoh.
 */
export const SosokCerita2D: React.FC<PropsSosok> = ({
  tipe,
  pose,
  properti = 'tanpa',
  hadap = 'kanan',
  tema,
  gaya = 'ilustrasi',
  ekspresi = 'hangat',
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
  const duduk = pose === 'duduk';
  const horizon = pose === 'horizon';
  const adalahSiluet = gaya === 'siluet';

  const palet = PALET_ILUSTRASI[tipe] ?? PALET_ILUSTRASI.petualang;
  const warnaRim = tema === 'perkamen' ? '#F3D488' : '#E7C26E';
  const warnaOutline = adalahSiluet
    ? warnaRim
    : tema === 'perkamen'
    ? '#2D1C10'
    : '#18130E';

  const warnaKulit = adalahSiluet ? (tema === 'perkamen' ? '#23160E' : '#11100E') : palet.kulit;
  const warnaBaju = adalahSiluet ? (tema === 'perkamen' ? '#23160E' : '#11100E') : palet.baju;
  const warnaBelakang = adalahSiluet ? (tema === 'perkamen' ? '#362316' : '#1E1B16') : palet.bajuBayang;
  const warnaCelana = adalahSiluet ? (tema === 'perkamen' ? '#23160E' : '#11100E') : palet.celana;
  const warnaKerah = adalahSiluet ? (tema === 'perkamen' ? '#EFE0BC' : '#DFCFA8') : palet.kerah;
  const warnaSepatu = adalahSiluet ? warnaBelakang : palet.sepatu;
  const strokeUtama = adalahSiluet ? 2.3 : 2.6;

  // Siklus kedip alami untuk mode ilustrasi berwarna
  const siklusKedip = (f + (tipe.length * 13)) % 108;
  const sedangKedip = siklusKedip >= 102;

  // Siklus berjalan (sekitar 2 langkah/detik pada 30fps)
  const faseJalan = f * 0.24;
  const ayunPahaDepan = berjalan ? Math.sin(faseJalan) * 28 : duduk ? -82 : 0;
  const ayunPahaBelakang = berjalan ? Math.sin(faseJalan + Math.PI) * 28 : duduk ? -74 : 0;
  const tekukLututDepan = berjalan ? Math.max(0, -Math.cos(faseJalan)) * 34 : duduk ? 84 : 0;
  const tekukLututBelakang = berjalan ? Math.max(0, -Math.cos(faseJalan + Math.PI)) * 34 : duduk ? 78 : 0;

  // Naik-turun badan saat melangkah atau napas pelan
  const bobY = berjalan
    ? -Math.abs(Math.sin(faseJalan)) * 10
    : duduk
    ? 44 + Math.sin(f * 0.08) * 1.8
    : Math.sin(f * 0.08) * 2.5;

  // Kemiringan badan atas
  const pegasPose = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 16, stiffness: 105 } });
  const condongBadan = memeriksa
    ? interpolate(pegasPose, [0, 1], [2, 18]) + Math.sin(f * 0.07) * 1.4
    : duduk
    ? 8 + Math.sin(f * 0.07) * 1.4
    : berjalan
    ? 6 + Math.sin(faseJalan * 2) * 1.5
    : mendengar
    ? -3 + Math.sin(f * 0.06) * 1.2
    : horizon
    ? -2 + Math.sin(f * 0.06) * 1.1
    : Math.sin(f * 0.07) * 1.5;

  // Ayunan lengan depan & belakang
  const rotLenganDepan = berjalan
    ? Math.sin(faseJalan + Math.PI) * 26
    : duduk
    ? -52 + Math.sin(f * 0.11) * 6
    : menunjuk
    ? interpolate(pegasPose, [0, 1], [-10, -76]) + Math.sin(f * 0.1) * 2.5
    : memeriksa
    ? interpolate(pegasPose, [0, 1], [-8, -42]) + Math.sin(f * 0.09) * 2
    : horizon
    ? -14 + Math.sin(f * 0.06) * 2
    : properti === 'lentera'
    ? -54 + Math.sin(f * 0.09) * 3
    : properti === 'cangkir' || properti === 'arsip' || properti === 'biji_kopi' || properti === 'kitab'
    ? -46 + Math.sin(f * 0.08) * 2.5
    : Math.sin(f * 0.08) * 4;

  const rotLenganBelakang = berjalan
    ? Math.sin(faseJalan) * 24
    : duduk
    ? -34 + Math.sin(f * 0.08 + 1) * 3
    : memeriksa
    ? 14
    : -6 + Math.sin(f * 0.07 + 1) * 3;

  // Anggukan kepala halus
  const rotKepala = memeriksa
    ? 14 + Math.sin(f * 0.08) * 2.5
    : duduk
    ? 8 + Math.sin(f * 0.08) * 2
    : mendengar
    ? Math.sin(f * 0.09) * 4
    : menunjuk
    ? -3 + Math.sin(f * 0.14) * 3
    : horizon
    ? -6 + Math.sin(f * 0.06) * 2
    : Math.sin(f * 0.1) * 2;

  const kibarAngin = Math.sin(f * 0.12) * 10;
  const balikX = hadap === 'kiri' ? -1 : 1;
  const adalahWanita = tipe === 'wanita';
  const adalahSantri = tipe === 'santri';
  const adalahPetualang = tipe === 'petualang';
  const adalahPetani = tipe === 'petani';
  const adalahPedagang = tipe === 'pedagang';
  const adalahTetua = tipe === 'tetua';
  const adalahPemuda = tipe === 'pemuda';

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
          rx={berjalan ? 54 + Math.abs(Math.sin(faseJalan)) * 14 : duduk ? 64 : 48}
          ry="9"
          fill="rgba(0,0,0,0.44)"
        />

        <g transform={`translate(0, ${bobY})`}>
          {/* ── KAKI BELAKANG ── */}
          <g transform={`translate(126, 258) rotate(${ayunPahaBelakang})`}>
            <path
              d="M -11,0 L 11,0 L 9,78 L -10,78 Z"
              fill={warnaBelakang}
              stroke={warnaOutline}
              strokeOpacity={adalahSiluet ? 0.28 : 0.75}
              strokeWidth="2"
            />
            <g transform={`translate(0, 74) rotate(${tekukLututBelakang})`}>
              <path
                d="M -9,0 L 9,0 L 7,76 L -8,76 Z"
                fill={warnaBelakang}
                stroke={warnaOutline}
                strokeOpacity={adalahSiluet ? 0.28 : 0.75}
                strokeWidth="2"
              />
              <path
                d="M -10,72 L 22,72 C 27,72 28,83 20,83 L -10,83 Z"
                fill={warnaSepatu}
              />
            </g>
          </g>

          {/* ── LENGAN BELAKANG ── */}
          <g transform={`translate(124, 148) rotate(${rotLenganBelakang})`}>
            <path
              d="M -9,0 C -10,36 -8,74 -6,108 C -5,116 7,116 8,108 C 10,74 11,36 9,0 Z"
              fill={warnaBelakang}
              stroke={warnaOutline}
              strokeOpacity={adalahSiluet ? 0.32 : 0.8}
              strokeWidth="2"
            />
          </g>

          {/* ── KAKI DEPAN ── */}
          <g transform={`translate(134, 258) rotate(${ayunPahaDepan})`}>
            <path
              d="M -12,0 L 12,0 L 10,78 L -10,78 Z"
              fill={warnaCelana}
              stroke={warnaOutline}
              strokeWidth={strokeUtama}
              strokeLinejoin="round"
            />
            <g transform={`translate(0, 74) rotate(${tekukLututDepan})`}>
              <path
                d="M -10,0 L 10,0 L 8,76 L -9,76 Z"
                fill={warnaCelana}
                stroke={warnaOutline}
                strokeWidth={strokeUtama}
                strokeLinejoin="round"
              />
              <path
                d="M -10,72 L 24,72 C 30,72 30,84 22,84 L -11,84 Z"
                fill={warnaSepatu}
                stroke={warnaOutline}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
            </g>
          </g>

          {/* ── BADAN ATAS, BAJU & KEPALA (berporos di pinggul) ── */}
          <g transform={`translate(130, 262) rotate(${condongBadan}) translate(-130, -262)`}>
            {/* Selendang / kain berkibar angin saat pose tatap horizon */}
            {horizon && (
              <path
                d={`M 104,142 Q ${66 + kibarAngin * 0.5},${176 + kibarAngin * 0.4} ${42 + kibarAngin},${232 + kibarAngin * 0.5} L ${62 + kibarAngin * 0.7},${242 + kibarAngin * 0.3} Q ${86 + kibarAngin * 0.4},194 116,154 Z`}
                fill={adalahSiluet ? warnaBelakang : palet.aksen}
                stroke={warnaOutline}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
            )}

            {/* Tas selempang punggung untuk petualang / petani */}
            {(adalahPetualang || adalahPetani) && (
              <path
                d="M 84,154 C 72,158 70,216 84,232 L 104,230 L 106,154 Z"
                fill={adalahSiluet ? warnaBelakang : '#9A6338'}
                stroke={warnaOutline}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
            )}

            {/* Baju / Gamis / Jubah / Sarung sesuai 8 tipe tokoh */}
            {adalahWanita ? (
              <path
                d={`M 105,134 C 102,166 105,212 104,252 L ${92 - (berjalan ? Math.sin(faseJalan) * 10 : 0)},348 L ${172 + (berjalan ? Math.sin(faseJalan) * 10 : 0)},348 L 154,248 C 156,204 155,164 148,134 Z`}
                fill={warnaBaju}
                stroke={warnaOutline}
                strokeWidth={strokeUtama}
                strokeLinejoin="round"
              />
            ) : adalahSantri ? (
              <g>
                {/* Sarung santri */}
                <path
                  d={`M 102,248 L ${95 - (berjalan ? Math.sin(faseJalan) * 8 : 0)},338 L ${166 + (berjalan ? Math.sin(faseJalan) * 8 : 0)},338 L 160,248 Z`}
                  fill={warnaCelana}
                  stroke={warnaOutline}
                  strokeWidth={strokeUtama}
                  strokeLinejoin="round"
                />
                {!adalahSiluet && (
                  <>
                    <line x1="100" y1="286" x2="162" y2="286" stroke="#2D756E" strokeWidth="4" opacity="0.7" />
                    <line x1="98" y1="308" x2="164" y2="308" stroke="#E4C476" strokeWidth="3" opacity="0.55" />
                  </>
                )}
                {/* Baju koko putih gading */}
                <path
                  d="M 102,134 C 98,176 99,224 100,256 L 160,256 C 162,212 160,164 152,134 Z"
                  fill={warnaBaju}
                  stroke={warnaOutline}
                  strokeWidth={strokeUtama}
                  strokeLinejoin="round"
                />
              </g>
            ) : adalahPedagang ? (
              <g>
                {/* Jubah panjang saudagar pelabuhan */}
                <path
                  d={`M 100,134 C 96,178 96,232 94,334 L ${168 + (berjalan ? Math.sin(faseJalan) * 8 : 0)},334 L 162,238 C 162,196 160,162 154,134 Z`}
                  fill={warnaBaju}
                  stroke={warnaOutline}
                  strokeWidth={strokeUtama}
                  strokeLinejoin="round"
                />
                {!adalahSiluet && (
                  <path
                    d="M 99,224 L 162,224 L 160,242 L 98,242 Z"
                    fill={palet.aksen}
                    stroke={warnaOutline}
                    strokeWidth="2"
                  />
                )}
              </g>
            ) : (
              /* Baju / Kemeja / Rompi pria, petualang, petani, tetua, pemuda */
              <g>
                <path
                  d="M 102,134 C 98,174 102,226 104,268 L 158,268 C 162,222 162,174 154,134 Z"
                  fill={warnaBaju}
                  stroke={warnaOutline}
                  strokeWidth={strokeUtama}
                  strokeLinejoin="round"
                />
                {/* Apron barista teal untuk pemuda */}
                {adalahPemuda && !adalahSiluet && (
                  <path
                    d="M 118,162 L 158,162 L 160,276 L 114,276 Z"
                    fill={palet.aksen}
                    stroke={warnaOutline}
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                )}
                {/* Sabuk & detail rompi untuk petualang */}
                {adalahPetualang && !adalahSiluet && (
                  <rect x="103" y="236" width="56" height="12" rx="3" fill={palet.aksen} stroke={warnaOutline} strokeWidth="2" />
                )}
              </g>
            )}

            {/* Aksen kerah terang */}
            <path
              d="M 134,132 L 148,141 L 139,151 Z"
              fill={warnaKerah}
              opacity="0.92"
            />

            {/* Rim-light lembut di tepi dada pada mode ilustrasi malam */}
            {!adalahSiluet && tema === 'malam' && (
              <path
                d="M 153,136 C 159,174 160,218 157,264"
                fill="none"
                stroke={warnaRim}
                strokeWidth="2.2"
                strokeOpacity="0.65"
                strokeLinecap="round"
              />
            )}

            {/* Leher */}
            <rect
              x="122"
              y="112"
              width="18"
              height="25"
              rx="6"
              fill={warnaKulit}
              stroke={warnaOutline}
              strokeWidth="2.2"
            />

            {/* ── KEPALA TAMPAK SAMPING / 3/4 ── */}
            <g transform={`translate(131, 114) rotate(${rotKepala}) translate(-131, -114)`}>
              {/* Profil wajah (hidung & dagu menghadap kanan) */}
              <path
                d={
                  horizon
                    ? 'M 106,82 C 106,56 124,46 140,48 C 154,50 162,64 160,82 C 158,104 148,116 134,116 C 118,116 106,104 106,82 Z'
                    : 'M 108,82 C 108,58 124,48 140,50 C 154,52 161,64 160,78 L 166,89 L 159,93 C 159,103 154,114 142,116 C 126,118 112,110 108,96 Z'
                }
                fill={warnaKulit}
                stroke={warnaOutline}
                strokeWidth={strokeUtama}
                strokeLinejoin="round"
              />

              {/* Detail wajah hidup (mata berkedip, alis ekspresif, pipi, mulut) khusus mode ilustrasi & bukan tampak belakang */}
              {!adalahSiluet && !horizon && (
                <g>
                  {/* Rona pipi hangat */}
                  <ellipse cx="144" cy="92" rx="6" ry="3.5" fill="#E07A5F" opacity="0.28" />
                  {/* Alis sesuai ekspresi */}
                  {ekspresi === 'serius' ? (
                    <line x1="142" y1="69" x2="155" y2="73" stroke="#241912" strokeWidth="2.8" strokeLinecap="round" />
                  ) : ekspresi === 'takjub' ? (
                    <path d="M 141,69 Q 149,63 156,69" fill="none" stroke="#241912" strokeWidth="2.6" strokeLinecap="round" />
                  ) : (
                    <path d="M 142,71 Q 149,68 155,71" fill="none" stroke="#241912" strokeWidth="2.5" strokeLinecap="round" />
                  )}
                  {/* Mata berkedip */}
                  {sedangKedip ? (
                    <path d="M 144,79 Q 149,82 154,79" fill="none" stroke="#1E1712" strokeWidth="2.4" strokeLinecap="round" />
                  ) : (
                    <>
                      <ellipse cx="149" cy="79" rx="3.4" ry={ekspresi === 'takjub' ? 4.5 : 3.6} fill="#1E1712" />
                      <circle cx="148" cy="77.8" r="1.2" fill="#FFFDF7" />
                    </>
                  )}
                  {/* Mulut / senyum halus */}
                  {ekspresi === 'takjub' ? (
                    <ellipse cx="155" cy="101" rx="3" ry="3.8" fill="#7D2E28" />
                  ) : ekspresi === 'serius' ? (
                    <line x1="150" y1="101" x2="158" y2="101" stroke="#4A2A1E" strokeWidth="2.3" strokeLinecap="round" />
                  ) : (
                    <path d="M 149,99 Q 154,104 159,99" fill="none" stroke="#4A2A1E" strokeWidth="2.3" strokeLinecap="round" />
                  )}
                </g>
              )}

              {/* Jenggot putih bijak untuk tetua */}
              {adalahTetua && !horizon && (
                <path
                  d="M 140,104 C 148,104 160,100 162,108 C 162,122 152,130 140,126 C 134,122 136,110 140,104 Z"
                  fill={adalahSiluet ? warnaKulit : palet.rambut}
                  stroke={warnaOutline}
                  strokeWidth="2"
                />
              )}

              {/* Hijab / kerudung wanita */}
              {adalahWanita && (
                <path
                  d="M 103,84 C 102,54 122,44 142,46 C 156,48 161,58 158,68 C 146,62 134,66 130,80 C 128,96 134,118 148,138 L 98,142 C 94,120 96,100 103,84 Z"
                  fill={adalahSiluet ? warnaBaju : palet.rambut}
                  stroke={warnaOutline}
                  strokeWidth={strokeUtama}
                  strokeLinejoin="round"
                />
              )}

              {/* Kopiah / peci hitam untuk santri & tetua */}
              {(adalahSantri || adalahTetua) && (
                <g>
                  <path
                    d="M 106,82 C 102,64 114,50 136,50 C 122,60 116,74 114,90 Z"
                    fill={adalahSiluet ? warnaBaju : palet.rambut}
                  />
                  <path
                    d="M 106,66 L 111,42 C 120,38 148,38 157,44 L 160,66 C 145,69 120,69 106,66 Z"
                    fill="#14110F"
                    stroke={warnaOutline}
                    strokeWidth={strokeUtama}
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {/* Caping bambu anyaman khas petani Nusantara */}
              {adalahPetani && (
                <g>
                  <path
                    d="M 82,68 L 134,28 L 186,68 Q 134,76 82,68 Z"
                    fill={adalahSiluet ? warnaBaju : palet.aksen}
                    stroke={warnaOutline}
                    strokeWidth={strokeUtama}
                    strokeLinejoin="round"
                  />
                  {!adalahSiluet && (
                    <path d="M 96,66 Q 134,58 172,66" fill="none" stroke="#9A7234" strokeWidth="2.5" />
                  )}
                </g>
              )}

              {/* Sorban / ikat kepala saudagar untuk pedagang */}
              {adalahPedagang && (
                <g>
                  <path
                    d="M 102,68 C 100,42 122,34 144,36 C 160,38 166,52 162,68 C 146,72 118,72 102,68 Z"
                    fill={adalahSiluet ? warnaBaju : palet.kerah}
                    stroke={warnaOutline}
                    strokeWidth={strokeUtama}
                    strokeLinejoin="round"
                  />
                  {!adalahSiluet && (
                    <path d="M 106,56 Q 134,46 161,56" fill="none" stroke={palet.aksen} strokeWidth="4" strokeLinecap="round" />
                  )}
                </g>
              )}

              {/* Topi petualang */}
              {adalahPetualang && (
                <g>
                  <path
                    d="M 104,64 L 112,44 C 122,40 146,40 154,46 L 158,64 Z"
                    fill={adalahSiluet ? warnaBaju : '#5A3A24'}
                    stroke={warnaOutline}
                    strokeWidth={strokeUtama}
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 94,65 Q 134,58 174,66 Q 134,72 94,65 Z"
                    fill={adalahSiluet ? warnaBaju : '#6E482C'}
                    stroke={warnaOutline}
                    strokeWidth="2.2"
                  />
                </g>
              )}

              {/* Rambut pria & pemuda modern */}
              {(tipe === 'pria' || adalahPemuda) && (
                <path
                  d="M 106,82 C 102,58 116,42 140,44 C 155,45 166,55 162,68 C 150,60 134,62 124,72 C 118,78 114,88 106,82 Z"
                  fill={adalahSiluet ? warnaBaju : palet.rambut}
                  stroke={warnaOutline}
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
              )}
            </g>

            {/* ── LENGAN DEPAN + PROPERTI TANGAN ── */}
            <g transform={`translate(132, 150) rotate(${rotLenganDepan})`}>
              <path
                d="M -10,0 C -11,38 -9,76 -7,112 C -6,120 7,120 8,112 C 10,76 11,38 10,0 Z"
                fill={warnaBaju}
                stroke={warnaOutline}
                strokeWidth={strokeUtama}
                strokeLinejoin="round"
              />
              {/* Tangan / kepalan */}
              <circle cx="1" cy="116" r="9" fill={warnaKulit} stroke={warnaOutline} strokeWidth="2.2" />

              {/* Properti: Lembar Arsip / Surat */}
              {properti === 'arsip' && (
                <g transform={`translate(8, 114) rotate(${-rotLenganDepan - condongBadan})`}>
                  <rect x="-4" y="-26" width="68" height="44" rx="4" fill="#F2E7C9" stroke="#5B442A" strokeWidth="2.4" />
                  <rect x="4" y="-17" width="16" height="18" rx="2" fill="#3B3025" opacity="0.78" />
                  <line x1="27" y1="-13" x2="56" y2="-13" stroke="#6E5A42" strokeWidth="3.2" strokeLinecap="round" />
                  <line x1="27" y1="-4" x2="52" y2="-4" stroke="#6E5A42" strokeWidth="2.8" strokeLinecap="round" />
                  <line x1="27" y1="5" x2="46" y2="5" stroke="#8C2A20" strokeWidth="2.8" strokeLinecap="round" />
                </g>
              )}

              {/* Properti: Kitab / Buku Kuno */}
              {properti === 'kitab' && (
                <g transform={`translate(8, 114) rotate(${-rotLenganDepan - condongBadan})`}>
                  <rect x="-4" y="-22" width="52" height="36" rx="4" fill="#5A281E" stroke="#2D140E" strokeWidth="2.4" />
                  <rect x="3" y="-16" width="38" height="24" rx="2" fill="none" stroke="#E8C57B" strokeWidth="2" />
                  <line x1="-2" y1="14" x2="46" y2="14" stroke="#F4E9CF" strokeWidth="4" />
                </g>
              )}

              {/* Properti: Biji / Ceri Kopi Merah */}
              {properti === 'biji_kopi' && (
                <g transform={`translate(10, 114) rotate(${-rotLenganDepan - condongBadan})`}>
                  <path d="M -8,4 Q 16,24 40,4 Z" fill="#8C5A34" stroke="#2D1A0E" strokeWidth="2.4" />
                  <circle cx="8" cy="2" r="7" fill="#B92B27" stroke="#3B110E" strokeWidth="2" />
                  <circle cx="20" cy="0" r="7" fill="#D43B34" stroke="#3B110E" strokeWidth="2" />
                  <circle cx="30" cy="3" r="6.5" fill="#9E221E" stroke="#3B110E" strokeWidth="2" />
                  <ellipse cx="14" cy="-6" rx="6" ry="3.5" fill="#3D7A4A" transform="rotate(-20 14 -6)" />
                </g>
              )}

              {/* Properti: Lentera bercahaya hangat */}
              {properti === 'lentera' && (
                <g transform={`translate(6, 122) rotate(${-rotLenganDepan - condongBadan})`}>
                  <circle cx="0" cy="24" r={54 * kedipApi} fill="#F5BD4E" opacity={0.18 * kedipApi} />
                  <circle cx="0" cy="24" r={28 * kedipApi} fill="#FFE699" opacity={0.34 * kedipApi} />
                  <path d="M -8,0 C -8,-10 8,-10 8,0" fill="none" stroke={warnaRim} strokeWidth="2.5" />
                  <rect x="-12" y="2" width="24" height="7" rx="3" fill="#2A1E16" stroke={warnaRim} strokeWidth="2" />
                  <rect x="-10" y="9" width="20" height="28" rx="4" fill="#FCE29C" stroke={warnaRim} strokeWidth="2.2" />
                  <ellipse cx="0" cy="23" rx="5" ry={8 * kedipApi} fill="#FFFDF0" />
                  <rect x="-13" y="37" width="26" height="6" rx="3" fill="#2A1E16" stroke={warnaRim} strokeWidth="2" />
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

/** Meja kayu hangat + teko seduh & bangku untuk adegan `duduk_seduh`. */
const MejaSeduhKayu: React.FC<{ tema: 'malam' | 'perkamen'; frame: number }> = ({ tema, frame }) => {
  const uap = (frame * 0.65) % 20;
  const kayuAtas = tema === 'perkamen' ? '#8C5832' : '#5B3922';
  const kayuKaki = tema === 'perkamen' ? '#633B1F' : '#3C2415';
  const garis = tema === 'perkamen' ? '#361E0F' : '#D9B15F';
  return (
    <svg width="310" height="210" viewBox="0 0 310 210" style={{ overflow: 'visible' }}>
      {/* Meja kayu */}
      <rect x="64" y="84" width="186" height="18" rx="6" fill={kayuAtas} stroke={garis} strokeWidth="2.5" />
      <rect x="86" y="102" width="16" height="94" rx="4" fill={kayuKaki} stroke={garis} strokeWidth="2" />
      <rect x="212" y="102" width="16" height="94" rx="4" fill={kayuKaki} stroke={garis} strokeWidth="2" />
      {/* Teko kopi & cangkir di atas meja */}
      <path d={`M 134,${44 - uap * 0.5} Q 128,${32 - uap * 0.5} 135,${22 - uap * 0.5}`} fill="none" stroke="#FFF4D2" strokeWidth="2.6" strokeLinecap="round" opacity={0.8 - uap / 26} />
      <path d={`M 186,${56 - uap * 0.4} Q 192,${45 - uap * 0.4} 185,${35 - uap * 0.4}`} fill="none" stroke="#FFF4D2" strokeWidth="2.4" strokeLinecap="round" opacity={0.75 - uap / 26} />
      <path d="M 118,84 L 124,48 L 148,48 L 154,84 Z" fill="#B57B45" stroke="#2D1A0E" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M 148,56 C 162,56 162,74 150,74" fill="none" stroke="#2D1A0E" strokeWidth="3" />
      <rect x="174" y="60" width="26" height="24" rx="6" fill="#F2E4C6" stroke="#2D1A0E" strokeWidth="2.4" />
      <path d="M 200,66 C 209,66 209,78 200,78" fill="none" stroke="#2D1A0E" strokeWidth="2.6" />
      {/* Bangku kecil tempat karakter duduk */}
      <rect x="0" y="128" width="66" height="14" rx="4" fill={kayuAtas} stroke={garis} strokeWidth="2" />
      <rect x="10" y="142" width="12" height="54" rx="3" fill={kayuKaki} />
      <rect x="44" y="142" width="12" height="54" rx="3" fill={kayuKaki} />
    </svg>
  );
};

/**
 * Panggung karakter 2D untuk `CeritaMotion`:
 * menempatkan 1–3 karakter dengan gaya ilustrasi berwarna atau siluet,
 * spotlight hangat, dan 9 variasi komposisi/aksi dinamis agar tiap adegan tidak monoton.
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
  const tokohKedua: TipeKarakterCerita = konfig.tokohKedua ?? (tokohUtama === 'wanita' ? 'pria' : 'petani');
  const tokohKetiga: TipeKarakterCerita =
    konfig.tokohKetiga ?? (tokohUtama === 'pedagang' ? 'tetua' : 'pedagang');
  const properti: PropertiKarakterCerita = konfig.properti ?? 'tanpa';
  const gaya: GayaKarakterCerita = konfig.gaya ?? 'ilustrasi';
  const ekspresi: EkspresiKarakterCerita = konfig.ekspresi ?? 'hangat';

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
      {/* Cahaya spotlight hangat halus di belakang karakter */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 18,
          width: 820,
          height: 520,
          transform: 'translateX(-50%)',
          background:
            tema === 'perkamen'
              ? 'radial-gradient(ellipse at 50% 58%, rgba(255,241,200,0.34) 0%, rgba(240,204,132,0.12) 45%, rgba(0,0,0,0) 74%)'
              : 'radial-gradient(ellipse at 50% 58%, rgba(246,204,116,0.28) 0%, rgba(212,155,62,0.1) 44%, rgba(0,0,0,0) 74%)',
        }}
      />

      {/* Garis lantai pijakan tipis */}
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
            gaya={gaya}
            ekspresi={ekspresi}
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
            gaya={gaya}
            ekspresi={ekspresi}
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
            gaya={gaya}
            ekspresi="serius"
            skala={1.08}
          />
        </div>
      )}

      {/* Mode 4: Menunjukkan arsip / biji kopi / cangkir / lentera */}
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
            gaya={gaya}
            ekspresi={ekspresi}
            skala={1.08}
          />
        </div>
      )}

      {/* Mode 5: Dua tokoh berhadapan berdialog */}
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
              gaya={gaya}
              ekspresi={ekspresi}
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
              gaya={gaya}
              ekspresi="hangat"
              faseOffset={18}
              skala={1.02}
            />
          </div>
        </>
      )}

      {/* Mode 6: Duduk di meja kayu menyeduh kopi / mencatat */}
      {konfig.aksi === 'duduk_seduh' && (
        <div
          style={{
            position: 'absolute',
            left: 295,
            bottom: 12,
            opacity: masuk,
            transform: `translateY(${interpolate(masuk, [0, 1], [22, 0])}px)`,
          }}
        >
          <div style={{ position: 'relative', width: 460, height: 420 }}>
            <div style={{ position: 'absolute', left: 0, bottom: 0 }}>
              <SosokCerita2D
                tipe={tokohUtama}
                pose="duduk"
                properti={properti === 'tanpa' ? 'cangkir' : properti}
                hadap="kanan"
                tema={tema}
                gaya={gaya}
                ekspresi="hangat"
                skala={1.02}
              />
            </div>
            <div style={{ position: 'absolute', left: 108, bottom: 6 }}>
              <MejaSeduhKayu tema={tema} frame={frame} />
            </div>
          </div>
        </div>
      )}

      {/* Mode 7: Tampak tiga-perempat/belakang menatap jauh ke pemandangan latar */}
      {konfig.aksi === 'tatap_horizon' && (
        <div
          style={{
            position: 'absolute',
            left: 165,
            bottom: 8,
            opacity: masuk,
            transform: `translateX(${interpolate(masuk, [0, 1], [-30, 0])}px) scale(${interpolate(progres, [0, 1], [0.98, 1.03])})`,
          }}
        >
          <SosokCerita2D
            tipe={tokohUtama}
            pose="horizon"
            properti={properti === 'lentera' ? 'lentera' : 'tanpa'}
            hadap="kanan"
            tema={tema}
            gaya={gaya}
            ekspresi="takjub"
            skala={1.04}
          />
        </div>
      )}

      {/* Mode 8: Ramai 3 tokoh berkumpul (pasar, kebun, majelis, atau diskusi) */}
      {konfig.aksi === 'ramai_tiga' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 398,
              bottom: 24,
              opacity: masuk * 0.92,
              filter: 'brightness(0.9)',
            }}
          >
            <SosokCerita2D
              tipe={tokohKetiga}
              pose="berdiri"
              properti="tanpa"
              hadap="kiri"
              tema={tema}
              gaya={gaya}
              ekspresi="tenang"
              faseOffset={32}
              skala={0.92}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 130,
              bottom: 8,
              opacity: masuk,
              transform: `translateX(${interpolate(masuk, [0, 1], [-46, 0])}px)`,
            }}
          >
            <SosokCerita2D
              tipe={tokohUtama}
              pose="tunjuk"
              properti={properti === 'tanpa' ? 'biji_kopi' : properti}
              hadap="kanan"
              tema={tema}
              gaya={gaya}
              ekspresi={ekspresi}
              skala={1.03}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              right: 128,
              bottom: 8,
              opacity: masuk,
              transform: `translateX(${interpolate(masuk, [0, 1], [46, 0])}px)`,
            }}
          >
            <SosokCerita2D
              tipe={tokohKedua}
              pose="dengar"
              properti="cangkir"
              hadap="kiri"
              tema={tema}
              gaya={gaya}
              ekspresi="hangat"
              faseOffset={16}
              skala={1.01}
            />
          </div>
        </>
      )}

      {/* Mode 9: Berdiri tenang sinematik (pembuka / penutup) */}
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
            gaya={gaya}
            ekspresi={ekspresi}
            skala={1.06}
          />
        </div>
      )}
    </div>
  );
};
