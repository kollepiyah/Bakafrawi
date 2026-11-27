// Komponen animasi karakter 2D ekspresif untuk `CeritaMotion`:
// - Mode `ilustrasi`: karakter 2D tampak 3/4-depan (`PotretKarakter34`) besar & jelas dengan cel-shading 2-nada,
//   2 mata berkedip + pupil melirik, alis ekspresif, mulut lip-sync mengikuti audio, tangan & properti hidup,
//   serta sistem multi-beat otomatis (shot closeup/medium/wide + posisi pindah kiri/tengah/kanan di tengah adegan!).
// - Mode `wide` & `siluet`: tetap mendukung `SosokCerita2D` full-body (jalan, duduk seduh, tatap horizon, ramai 3 tokoh).
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

export type EkspresiKarakterCerita = 'tenang' | 'takjub' | 'serius' | 'hangat' | 'tegang';

export type ShotKarakterCerita = 'closeup' | 'medium' | 'wide';

export type PosisiKarakterCerita = 'kiri' | 'tengah' | 'kanan';

export type PropertiKarakterCerita =
  | 'tanpa'
  | 'arsip'
  | 'lentera'
  | 'cangkir'
  | 'tas'
  | 'biji_kopi'
  | 'kitab';

export type BeatKarakterCerita = {
  shot?: ShotKarakterCerita;
  posisi?: PosisiKarakterCerita;
  hadap?: 'kanan' | 'kiri';
  ekspresi?: EkspresiKarakterCerita;
  mulaiRasio?: number;
};

export type KonfigPanggungKarakter = {
  aksi: AksiKarakterCerita;
  tokohUtama?: TipeKarakterCerita;
  tokohKedua?: TipeKarakterCerita;
  tokohKetiga?: TipeKarakterCerita;
  properti?: PropertiKarakterCerita;
  gaya?: GayaKarakterCerita;
  ekspresi?: EkspresiKarakterCerita;
  shot?: ShotKarakterCerita;
  posisi?: PosisiKarakterCerita;
  hadap?: 'kanan' | 'kiri';
  beatKedua?: BeatKarakterCerita;
};

type KataRingkas = { mulai: number; selesai: number };

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
    kulit: '#EAB88E',
    kulitBayang: '#C58A60',
    baju: '#7E4B2E',
    bajuBayang: '#512D19',
    celana: '#3D352E',
    kerah: '#F2E3BF',
    rambut: '#261A14',
    aksen: '#D49A4A',
    sepatu: '#2F1F16',
  },
  santri: {
    kulit: '#ECC19B',
    kulitBayang: '#C7966F',
    baju: '#F5ECDA',
    bajuBayang: '#D4C4A5',
    celana: '#1B4B46',
    kerah: '#DFB65E',
    rambut: '#1C1714',
    aksen: '#1F6A5F',
    sepatu: '#2A221C',
  },
  wanita: {
    kulit: '#F1C7A2',
    kulitBayang: '#D09D75',
    baju: '#B9583B',
    bajuBayang: '#873A24',
    celana: '#6E3220',
    kerah: '#F7E8CB',
    rambut: '#E6CA9E',
    aksen: '#E8C57B',
    sepatu: '#3A2319',
  },
  pria: {
    kulit: '#E6B48A',
    kulitBayang: '#C0885E',
    baju: '#3E3630',
    bajuBayang: '#26201C',
    celana: '#23201E',
    kerah: '#F1E5CA',
    rambut: '#1D1815',
    aksen: '#C99E54',
    sepatu: '#1B1714',
  },
  petani: {
    kulit: '#DCA276',
    kulitBayang: '#B57A50',
    baju: '#624E3B',
    bajuBayang: '#423326',
    celana: '#322921',
    kerah: '#DECAA6',
    rambut: '#231C17',
    aksen: '#DCB46C',
    sepatu: '#3B2C20',
  },
  pedagang: {
    kulit: '#E3AF84',
    kulitBayang: '#BC865C',
    baju: '#264E46',
    bajuBayang: '#17332D',
    celana: '#1D2926',
    kerah: '#EED6A8',
    rambut: '#231B15',
    aksen: '#DFA74C',
    sepatu: '#3B2518',
  },
  tetua: {
    kulit: '#DDA982',
    kulitBayang: '#B6825B',
    baju: '#6D6052',
    bajuBayang: '#4A4036',
    celana: '#342E28',
    kerah: '#F2E7D0',
    rambut: '#EAE6DD',
    aksen: '#CFA85D',
    sepatu: '#2C231C',
  },
  pemuda: {
    kulit: '#EEC39C',
    kulitBayang: '#CB9971',
    baju: '#2B3B44',
    bajuBayang: '#1A252C',
    celana: '#26292E',
    kerah: '#F6F0E6',
    rambut: '#1E1A17',
    aksen: '#18B4A8',
    sepatu: '#1D2228',
  },
};

/** Hitung apakah karakter sedang mengucapkan suku kata (untuk lip-sync mulut alami). */
function hitungStatusBicara(detik: number, kata?: KataRingkas[], frame = 0) {
  if (Array.isArray(kata) && kata.length > 0) {
    const aktif = kata.some((k) => detik >= k.mulai - 0.03 && detik <= k.selesai + 0.08);
    if (!aktif) return { bicara: false, buka: 0 };
    const denyut = Math.abs(Math.sin(frame * 0.62) * Math.cos(frame * 0.27));
    return { bicara: true, buka: 0.28 + denyut * 0.72 };
  }
  // Cadangan alami bila timestamp kata tidak tersedia: bicara dalam frasa 2,5 detik lalu jeda napas singkat
  const siklus = frame % 78;
  const aktif = siklus < 64;
  if (!aktif) return { bicara: false, buka: 0 };
  const denyut = Math.abs(Math.sin(frame * 0.56) * Math.cos(frame * 0.23));
  return { bicara: true, buka: 0.25 + denyut * 0.7 };
}

/**
 * Potret karakter kartun 2D tampak 3/4-depan (`closeup` & `medium`) dengan outline kartun tegas,
 * cel-shading 2-nada, 2 mata ekspresif berkedip + pupil melirik, alis beremosi, mulut lip-sync,
 * tangan berakting, dan properti besar bercahaya (terinspirasi gaya animasi cerita rakyat modern).
 */
const PotretKarakter34: React.FC<{
  tipe: TipeKarakterCerita;
  ekspresi: EkspresiKarakterCerita;
  properti: PropertiKarakterCerita;
  hadap: 'kanan' | 'kiri';
  tema: 'malam' | 'perkamen';
  bicara: boolean;
  bukaMulut: number;
  gestur: 'cerita' | 'tunjuk' | 'doa' | 'periksa' | 'dengar';
  faseOffset?: number;
  lebarPx: number;
}> = ({
  tipe,
  ekspresi,
  properti,
  hadap,
  tema,
  bicara,
  bukaMulut,
  gestur,
  faseOffset = 0,
  lebarPx,
}) => {
  const frame = useCurrentFrame();
  const f = frame + faseOffset;
  const palet = PALET_ILUSTRASI[tipe] ?? PALET_ILUSTRASI.petualang;
  const balikX = hadap === 'kiri' ? -1 : 1;

  const outline = '#16110D';
  const rimCahaya = tema === 'perkamen' ? '#FFF1C6' : '#F8CA6B';
  const warnaBayangSisi = tema === 'perkamen' ? 'rgba(84,48,22,0.18)' : 'rgba(12,20,38,0.42)';

  // Napas, anggukan bicara, dan lirikan mata hidup
  const napasY = Math.sin(f * 0.085) * 3.8;
  const rotKepala =
    (bicara ? Math.sin(f * 0.19) * 2.8 : Math.sin(f * 0.07) * 1.4) +
    (ekspresi === 'serius' || ekspresi === 'tegang' ? 2.5 : ekspresi === 'takjub' ? -3 : 0);
  const rotBahu = Math.sin(f * 0.085 + 0.6) * 1.2 + (bicara ? Math.sin(f * 0.14) * 1.1 : 0);

  // Kedip alami & lirikan pupil
  const siklusKedip = (f + tipe.length * 17) % 102;
  const sedangKedip = siklusKedip >= 96;
  const lirikX = Math.sin(f * 0.045) * 2.4 + (ekspresi === 'tegang' ? Math.sin(f * 0.18) * 1.8 : 0);
  const lirikY = ekspresi === 'takjub' ? -1.4 : ekspresi === 'serius' ? 0.8 : Math.cos(f * 0.038) * 1.1;

  // Gerak tangan & properti
  const ayunTangan = Math.sin(f * 0.11) * 4.5 + (bicara ? Math.sin(f * 0.24) * 3.5 : 0);
  const kedipApi = 0.86 + 0.14 * Math.sin(f * 0.34);
  const uapY = (f * 0.75) % 24;
  const keringatY = (f * 0.9) % 26;

  const adalahWanita = tipe === 'wanita';
  const adalahSantri = tipe === 'santri';
  const adalahPetualang = tipe === 'petualang';
  const adalahPetani = tipe === 'petani';
  const adalahPedagang = tipe === 'pedagang';
  const adalahTetua = tipe === 'tetua';
  const adalahPemuda = tipe === 'pemuda';

  // ID unik gradien untuk menghindari bentrok bila 2 tokoh tampil bersamaan
  const uid = `k34-${tipe}-${faseOffset}`;
  const tinggiPx = Math.round(lebarPx * (520 / 420));

  return (
    <svg
      width={lebarPx}
      height={tinggiPx}
      viewBox="0 0 420 520"
      style={{ overflow: 'visible', filter: 'drop-shadow(0 18px 28px rgba(0,0,0,0.48))' }}
    >
      <defs>
        <linearGradient id={`${uid}-baju`} x1="0%" y1="0%" x2="100%" y2="20%">
          <stop offset="0%" stopColor={palet.bajuBayang} />
          <stop offset="48%" stopColor={palet.baju} />
          <stop offset="100%" stopColor={palet.baju} />
        </linearGradient>
        <radialGradient id={`${uid}-cahaya-lentera`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF0B3" stopOpacity="0.88" />
          <stop offset="42%" stopColor="#F5B841" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#F5B841" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-wajah-clip`}>
          <path d="M 142,164 C 142,110 176,82 218,84 C 260,86 286,118 284,168 C 282,216 258,252 218,256 C 174,258 142,222 142,164 Z" />
        </clipPath>
      </defs>

      <g transform={`translate(210, 0) scale(${balikX}, 1) translate(-210, 0)`}>
        <g transform={`translate(0, ${napasY})`}>
          {/* ── BADAN & BAHU (3/4 DEPAN) ── */}
          <g transform={`translate(210, 355) rotate(${rotBahu}) translate(-210, -355)`}>
            {/* Syal / kain belakang berkibar ringan untuk petualang */}
            {adalahPetualang && (
              <path
                d={`M 134,296 Q ${96 + Math.sin(f * 0.1) * 8},354 ${80 + Math.sin(f * 0.1) * 12},426 L 136,418 Q 144,364 166,312 Z`}
                fill="#8C3123"
                stroke={outline}
                strokeWidth="4"
                strokeLinejoin="round"
              />
            )}

            {/* Lengan kiri (belakang) */}
            <path
              d="M 118,312 C 88,334 78,402 82,492 L 146,492 L 154,328 Z"
              fill={palet.bajuBayang}
              stroke={outline}
              strokeWidth="4.2"
              strokeLinejoin="round"
            />

            {/* Tubuh utama / baju / jubah */}
            <path
              d="M 118,308 C 148,284 274,284 304,312 C 324,334 334,406 336,512 L 84,512 C 86,406 96,334 118,308 Z"
              fill={`url(#${uid}-baju)`}
              stroke={outline}
              strokeWidth="4.5"
              strokeLinejoin="round"
            />

            {/* Cel-shading bayangan baju sisi kiri (menjauh dari cahaya) */}
            <path
              d="M 118,308 C 138,292 162,288 182,290 L 166,510 L 86,510 C 88,406 98,334 118,308 Z"
              fill={warnaBayangSisi}
            />

            {/* Detail kerah & aksen pakaian per tipe tokoh */}
            {adalahSantri ? (
              <g>
                {/* Plaket kancing koko + sorban bahu hijau zamrud */}
                <path d="M 186,288 L 244,288 L 236,334 L 194,334 Z" fill={palet.kerah} stroke={outline} strokeWidth="3.2" />
                <line x1="216" y1="334" x2="216" y2="438" stroke={outline} strokeWidth="3" opacity="0.55" />
                <circle cx="216" cy="356" r="4" fill="#B58E43" />
                <circle cx="216" cy="382" r="4" fill="#B58E43" />
                <circle cx="216" cy="408" r="4" fill="#B58E43" />
                <path
                  d="M 116,308 C 138,318 158,368 164,512 L 112,512 C 106,396 102,340 116,308 Z"
                  fill={palet.aksen}
                  stroke={outline}
                  strokeWidth="3.8"
                  strokeLinejoin="round"
                />
                <line x1="126" y1="322" x2="146" y2="508" stroke="#E5C068" strokeWidth="4" opacity="0.8" />
              </g>
            ) : adalahPemuda ? (
              <g>
                {/* Kerah kemeja + apron barista teal khas Lek Kopi */}
                <path d="M 176,286 L 214,330 L 252,286" fill={palet.kerah} stroke={outline} strokeWidth="3.5" />
                <path
                  d="M 152,356 L 274,356 L 284,512 L 142,512 Z"
                  fill={palet.aksen}
                  stroke={outline}
                  strokeWidth="4"
                  strokeLinejoin="round"
                />
                <line x1="168" y1="296" x2="168" y2="358" stroke="#107A72" strokeWidth="10" />
                <line x1="258" y1="296" x2="258" y2="358" stroke="#107A72" strokeWidth="10" />
                <rect x="176" y="408" width="76" height="44" rx="8" fill="#138E84" stroke={outline} strokeWidth="3" />
              </g>
            ) : adalahPedagang ? (
              <g>
                {/* Rompi saudagar & selempang emas */}
                <path d="M 178,286 L 215,348 L 252,286" fill={palet.kerah} stroke={outline} strokeWidth="3.5" />
                <path d="M 164,292 L 266,292 L 256,510 L 174,510 Z" fill="none" stroke={palet.aksen} strokeWidth="6" opacity="0.82" />
              </g>
            ) : adalahWanita ? (
              <g>
                {/* Selendang/hijab menjuntai anggun di dada */}
                <path
                  d="M 122,290 C 154,274 268,274 294,296 C 304,358 278,424 214,432 C 148,426 116,364 122,290 Z"
                  fill={palet.rambut}
                  stroke={outline}
                  strokeWidth="4.2"
                  strokeLinejoin="round"
                />
                <path
                  d="M 134,370 Q 214,404 282,368"
                  fill="none"
                  stroke={palet.aksen}
                  strokeWidth="3.5"
                  opacity="0.7"
                />
              </g>
            ) : (
              <g>
                {/* Kerah V hangat + syal/selempang petualang/petani/pria/tetua */}
                <path d="M 174,286 L 218,342 L 258,286 Z" fill={palet.kerah} stroke={outline} strokeWidth="3.6" strokeLinejoin="round" />
                {(adalahPetualang || adalahPetani) && (
                  <path
                    d="M 142,296 L 286,472 L 260,502 L 122,324 Z"
                    fill={palet.aksen}
                    stroke={outline}
                    strokeWidth="3.6"
                    strokeLinejoin="round"
                  />
                )}
              </g>
            )}

            {/* Rim-light emas di tepi bahu kanan */}
            <path
              d="M 294,308 C 318,332 326,396 328,488"
              fill="none"
              stroke={rimCahaya}
              strokeWidth="4"
              strokeOpacity={tema === 'malam' ? 0.72 : 0.45}
              strokeLinecap="round"
            />
          </g>

          {/* ── LEHER ── */}
          <path
            d="M 186,238 L 242,238 L 246,294 C 230,308 196,308 182,294 Z"
            fill={palet.kulit}
            stroke={outline}
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          {/* Bayangan dagu di atas leher */}
          <path d="M 188,244 C 204,268 232,268 244,250 L 242,238 L 188,238 Z" fill={palet.kulitBayang} opacity="0.72" />

          {/* ── KEPALA & WAJAH 3/4 EKSPRESIF ── */}
          <g transform={`translate(212, 246) rotate(${rotKepala}) translate(-212, -246)`}>
            {/* Rambut belakang / hijab belakang */}
            {adalahWanita ? (
              <path
                d="M 122,172 C 118,98 164,62 222,64 C 276,66 304,108 300,178 C 296,246 286,292 268,312 L 138,312 C 122,276 122,226 122,172 Z"
                fill={palet.rambut}
                stroke={outline}
                strokeWidth="4.5"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M 134,176 C 128,112 162,72 220,72 C 274,72 298,110 292,168 L 274,174 L 142,190 Z"
                fill={palet.rambut}
                stroke={outline}
                strokeWidth="4.2"
                strokeLinejoin="round"
              />
            )}

            {/* Telinga kiri (sisi dekat) */}
            {!adalahWanita && (
              <g>
                <ellipse cx="141" cy="176" rx="14" ry="20" fill={palet.kulit} stroke={outline} strokeWidth="4" />
                <path d="M 137,168 Q 144,176 138,186" fill="none" stroke={palet.kulitBayang} strokeWidth="3.2" strokeLinecap="round" />
              </g>
            )}

            {/* Bentuk wajah utama 3/4 */}
            <path
              d="M 142,164 C 142,110 176,82 218,84 C 260,86 286,118 284,168 C 282,216 258,252 218,256 C 174,258 142,222 142,164 Z"
              fill={palet.kulit}
              stroke={outline}
              strokeWidth="4.5"
              strokeLinejoin="round"
            />

            {/* Cel-shading bayangan dramatis di sisi kiri wajah (seperti pencahayaan lentera di film animasi) */}
            <g clipPath={`url(#${uid}-wajah-clip)`}>
              <path
                d="M 132,80 L 194,80 C 176,126 174,186 196,258 L 132,258 Z"
                fill={warnaBayangSisi}
              />
              {/* Pendar hangat di pipi kanan bila membawa lentera di tema malam */}
              {properti === 'lentera' && tema === 'malam' && (
                <ellipse cx="268" cy="186" rx="44" ry="62" fill="#FFCA63" opacity="0.24" />
              )}
            </g>

            {/* Garis rim-light hangat di pipi kanan */}
            <path
              d="M 278,136 C 284,168 278,208 258,236"
              fill="none"
              stroke={rimCahaya}
              strokeWidth="3.4"
              strokeOpacity={tema === 'malam' ? 0.72 : 0.4}
              strokeLinecap="round"
            />

            {/* Rona pipi hangat */}
            <ellipse cx="182" cy="196" rx="14" ry="7" fill="#E07658" opacity="0.24" />
            <ellipse cx="264" cy="196" rx="12" ry="6.5" fill="#E07658" opacity="0.28" />

            {/* ── DUA MATA BESAR EKSPRESIF (KIRI & KANAN PERSPEKTIF 3/4) ── */}
            {sedangKedip ? (
              <g>
                <path d="M 176,168 Q 194,178 210,168" fill="none" stroke={outline} strokeWidth="4.2" strokeLinecap="round" />
                <path d="M 238,168 Q 254,178 268,168" fill="none" stroke={outline} strokeWidth="4.2" strokeLinecap="round" />
              </g>
            ) : (
              <g>
                {/* Mata kiri (lebih lebar) */}
                <ellipse
                  cx="194"
                  cy="167"
                  rx="16"
                  ry={ekspresi === 'takjub' || ekspresi === 'tegang' ? 19 : 16}
                  fill="#FFFDF8"
                  stroke={outline}
                  strokeWidth="3.8"
                />
                <circle
                  cx={197 + lirikX}
                  cy={168 + lirikY}
                  r={ekspresi === 'tegang' ? 7.2 : 9.2}
                  fill="#1C1410"
                />
                <circle cx={193 + lirikX * 0.6} cy={163 + lirikY * 0.6} r="3.4" fill="#FFFFFF" />
                <circle cx={200 + lirikX * 0.6} cy={172 + lirikY * 0.6} r="1.6" fill="#FFFFFF" opacity="0.85" />

                {/* Mata kanan (sedikit lebih ramping karena perspektif 3/4) */}
                <ellipse
                  cx="253"
                  cy="167"
                  rx="13.5"
                  ry={ekspresi === 'takjub' || ekspresi === 'tegang' ? 18 : 15.5}
                  fill="#FFFDF8"
                  stroke={outline}
                  strokeWidth="3.8"
                />
                <circle
                  cx={255 + lirikX}
                  cy={168 + lirikY}
                  r={ekspresi === 'tegang' ? 6.6 : 8.4}
                  fill="#1C1410"
                />
                <circle cx={251 + lirikX * 0.6} cy={163 + lirikY * 0.6} r="3" fill="#FFFFFF" />
                <circle cx={258 + lirikX * 0.6} cy={172 + lirikY * 0.6} r="1.5" fill="#FFFFFF" opacity="0.85" />

                {/* Bulu mata lentik khusus tokoh wanita */}
                {adalahWanita && (
                  <>
                    <path d="M 176,158 L 169,152" stroke={outline} strokeWidth="3.2" strokeLinecap="round" />
                    <path d="M 267,158 L 274,152" stroke={outline} strokeWidth="3.2" strokeLinecap="round" />
                  </>
                )}

                {/* Kelopak atas tegas pada ekspresi serius */}
                {ekspresi === 'serius' && (
                  <>
                    <path d="M 177,156 L 211,160" stroke={outline} strokeWidth="4" strokeLinecap="round" />
                    <path d="M 239,160 L 268,156" stroke={outline} strokeWidth="4" strokeLinecap="round" />
                  </>
                )}
              </g>
            )}

            {/* ── DUA ALIS EKSPRESIF ── */}
            {ekspresi === 'serius' ? (
              <g stroke={outline} strokeWidth="5.4" strokeLinecap="round" fill="none">
                <path d="M 173,142 L 212,150" />
                <path d="M 238,150 L 270,141" />
              </g>
            ) : ekspresi === 'tegang' ? (
              <g stroke={outline} strokeWidth="5.2" strokeLinecap="round" fill="none">
                <path d="M 174,148 Q 194,136 211,146" />
                <path d="M 238,146 Q 254,136 269,147" />
              </g>
            ) : ekspresi === 'takjub' ? (
              <g stroke={outline} strokeWidth="5" strokeLinecap="round" fill="none">
                <path d="M 174,140 Q 194,126 212,139" />
                <path d="M 238,139 Q 254,126 269,139" />
              </g>
            ) : (
              <g stroke={outline} strokeWidth="5" strokeLinecap="round" fill="none">
                <path d="M 174,144 Q 194,136 212,143" />
                <path d="M 238,143 Q 254,136 269,143" />
              </g>
            )}

            {/* Hidung 3/4 kartun halus */}
            <path
              d="M 228,176 C 234,186 236,193 226,197"
              fill="none"
              stroke={outline}
              strokeWidth="3.6"
              strokeLinecap="round"
            />

            {/* Kumis & jenggot putih bijak untuk Tetua */}
            {adalahTetua && (
              <g>
                <path
                  d="M 176,226 C 184,264 212,282 238,274 C 262,266 274,244 274,224 C 254,238 202,240 176,226 Z"
                  fill={palet.rambut}
                  stroke={outline}
                  strokeWidth="3.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M 198,214 Q 224,202 254,214 Q 224,224 198,214 Z"
                  fill={palet.rambut}
                  stroke={outline}
                  strokeWidth="3.2"
                />
              </g>
            )}

            {/* ── MULUT LIP-SYNC HIDUP ── */}
            {bicara && bukaMulut > 0.36 ? (
              <g>
                <ellipse
                  cx="226"
                  cy="222"
                  rx={12 + bukaMulut * 6}
                  ry={5 + bukaMulut * 9.5}
                  fill="#6E2220"
                  stroke={outline}
                  strokeWidth="3.6"
                />
                {/* Gigi atas & lidah saat mulut terbuka lebar */}
                <path
                  d={`M ${216 - bukaMulut * 3},${219 - bukaMulut * 3} Q 226,${222 - bukaMulut * 2} ${236 + bukaMulut * 3},${219 - bukaMulut * 3}`}
                  fill="none"
                  stroke="#FFFDF6"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <ellipse cx="226" cy={225 + bukaMulut * 4} rx={7 + bukaMulut * 2} ry={3.2} fill="#C85B52" />
              </g>
            ) : ekspresi === 'takjub' ? (
              <ellipse cx="227" cy="222" rx="9.5" ry="11" fill="#6E2220" stroke={outline} strokeWidth="3.6" />
            ) : ekspresi === 'tegang' ? (
              <path
                d="M 208,224 Q 226,216 244,224"
                fill="none"
                stroke={outline}
                strokeWidth="4"
                strokeLinecap="round"
              />
            ) : ekspresi === 'serius' ? (
              <path
                d="M 209,222 Q 226,220 243,222"
                fill="none"
                stroke={outline}
                strokeWidth="4"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M 204,217 Q 226,232 248,216"
                fill="none"
                stroke={outline}
                strokeWidth="4.2"
                strokeLinecap="round"
              />
            )}

            {/* Tetes keringat animasi saat ekspresi tegang */}
            {ekspresi === 'tegang' && (
              <path
                d={`M 164,${132 + keringatY * 0.5} C 158,${144 + keringatY * 0.5} 158,${152 + keringatY * 0.5} 164,${152 + keringatY * 0.5} C 170,${152 + keringatY * 0.5} 170,${144 + keringatY * 0.5} 164,${132 + keringatY * 0.5} Z`}
                fill="#A8E4FF"
                stroke="#1C4663"
                strokeWidth="2.4"
                opacity={1 - keringatY / 32}
              />
            )}

            {/* ── RAMBUT DEPAN & PENUTUP KEPALA KHAS 8 TIPE TOKOH ── */}
            {adalahWanita ? (
              /* Bingkai hijab atas rapi membingkai dahi */
              <path
                d="M 138,168 C 142,110 176,80 222,82 C 266,84 288,114 288,162 C 270,126 242,108 214,108 C 178,108 152,130 138,168 Z"
                fill={palet.rambut}
                stroke={outline}
                strokeWidth="4.2"
                strokeLinejoin="round"
              />
            ) : adalahSantri || adalahTetua ? (
              /* Peci hitam beludru rapi */
              <g>
                <path
                  d="M 142,136 C 144,104 176,84 222,86 C 264,88 286,108 286,136 C 264,124 238,118 214,118 C 184,118 158,124 142,136 Z"
                  fill={palet.rambut}
                />
                <path
                  d="M 138,118 L 148,58 C 168,46 258,46 280,60 L 288,118 C 254,126 174,126 138,118 Z"
                  fill="#181513"
                  stroke={outline}
                  strokeWidth="4.4"
                  strokeLinejoin="round"
                />
                <path d="M 152,106 Q 214,114 276,106" fill="none" stroke="#E5C068" strokeWidth="3.2" opacity="0.72" />
              </g>
            ) : adalahPetani ? (
              /* Caping bambu lebar anyaman Nusantara */
              <g>
                <path
                  d="M 76,124 L 214,34 L 352,124 Q 214,144 76,124 Z"
                  fill={palet.aksen}
                  stroke={outline}
                  strokeWidth="4.5"
                  strokeLinejoin="round"
                />
                <path d="M 106,118 Q 214,102 322,118" fill="none" stroke="#8C6226" strokeWidth="3.6" />
                <path d="M 144,94 Q 214,82 284,94" fill="none" stroke="#8C6226" strokeWidth="3" />
                <path d="M 164,132 Q 212,262 260,134" fill="none" stroke="#5A3A1E" strokeWidth="2.8" opacity="0.65" />
              </g>
            ) : adalahPedagang ? (
              /* Sorban lilit saudagar pelabuhan */
              <g>
                <path
                  d="M 130,126 C 122,68 168,42 222,44 C 276,46 304,76 296,126 C 262,136 164,136 130,126 Z"
                  fill={palet.kerah}
                  stroke={outline}
                  strokeWidth="4.4"
                  strokeLinejoin="round"
                />
                <path d="M 138,98 Q 216,74 292,100" fill="none" stroke={palet.aksen} strokeWidth="7" strokeLinecap="round" />
                <circle cx="242" cy="86" r="10" fill="#B53126" stroke={outline} strokeWidth="3" />
              </g>
            ) : adalahPetualang ? (
              /* Ikat kepala penjelajah / destar Nusantara ala tokoh petualang + rambut mencuat */
              <g>
                <path
                  d="M 138,144 C 134,94 172,62 224,64 C 272,66 298,96 292,140 C 268,118 242,108 214,110 C 180,112 154,124 138,144 Z"
                  fill={palet.rambut}
                  stroke={outline}
                  strokeWidth="4.2"
                  strokeLinejoin="round"
                />
                {/* Ikat kepala kain cokelat-emas khas Nusantara (mengingatkan karakter Bujang!) */}
                <path
                  d="M 134,116 Q 216,96 294,114 L 290,82 Q 214,66 138,84 Z"
                  fill="#6D4126"
                  stroke={outline}
                  strokeWidth="4.2"
                  strokeLinejoin="round"
                />
                <path d="M 142,100 Q 214,86 286,98" fill="none" stroke={palet.aksen} strokeWidth="4" opacity="0.85" />
                {/* Simpul ikat kepala di sisi kiri */}
                <path d="M 136,102 L 106,124 L 122,134 L 140,114 Z" fill="#58321C" stroke={outline} strokeWidth="3.4" />
              </g>
            ) : (
              /* Rambut pria klasik & pemuda modern berponi rapi */
              <path
                d="M 136,154 C 128,94 168,58 224,62 C 274,66 300,98 292,144 C 274,118 250,104 222,106 C 194,108 168,118 152,146 Z"
                fill={palet.rambut}
                stroke={outline}
                strokeWidth="4.2"
                strokeLinejoin="round"
              />
            )}
          </g>

          {/* ── LENGAN DEPAN + TANGAN BERAKTING + PROPERTI BESAR ── */}
          <g transform={`translate(282, 344) rotate(${ayunTangan}) translate(-282, -344)`}>
            {properti === 'lentera' ? (
              <g>
                {/* Pendar cahaya lentera hangat menerangi panggung */}
                <circle cx="348" cy="272" r={118 * kedipApi} fill={`url(#${uid}-cahaya-lentera)`} />
                {/* Lengan terangkat memegang lentera (outline luar dulu, isi baju di atas agar mulus) */}
                <path
                  d="M 278,346 C 304,358 336,332 346,294"
                  fill="none"
                  stroke={outline}
                  strokeWidth="44"
                  strokeLinecap="round"
                />
                <path
                  d="M 278,346 C 304,358 336,332 346,294"
                  fill="none"
                  stroke={palet.baju}
                  strokeWidth="35"
                  strokeLinecap="round"
                />
                {/* Kepalan tangan */}
                <circle cx="346" cy="288" r="19" fill={palet.kulit} stroke={outline} strokeWidth="4" />
                {/* Lentera besar berkilau */}
                <g transform="translate(348, 296)">
                  <path d="M -14,-8 C -14,-24 14,-24 14,-8" fill="none" stroke="#E5B95B" strokeWidth="4" />
                  <rect x="-22" y="-4" width="44" height="12" rx="5" fill="#2A1E15" stroke={outline} strokeWidth="3.5" />
                  <rect x="-18" y="8" width="36" height="54" rx="7" fill="#FCE08B" stroke={outline} strokeWidth="3.8" />
                  <ellipse cx="0" cy="36" rx="10" ry={16 * kedipApi} fill="#FFFDF2" />
                  <rect x="-24" y="62" width="48" height="11" rx="5" fill="#2A1E15" stroke={outline} strokeWidth="3.5" />
                </g>
              </g>
            ) : properti === 'cangkir' ? (
              <g>
                {/* Lengan mengangkat cangkir kopi hangat */}
                <path
                  d="M 278,358 C 296,408 326,408 336,368"
                  fill="none"
                  stroke={outline}
                  strokeWidth="44"
                  strokeLinecap="round"
                />
                <path
                  d="M 278,358 C 296,408 326,408 336,368"
                  fill="none"
                  stroke={palet.baju}
                  strokeWidth="35"
                  strokeLinecap="round"
                />
                <circle cx="336" cy="366" r="19" fill={palet.kulit} stroke={outline} strokeWidth="4" />
                <g transform="translate(336, 332)">
                  <path
                    d={`M -6,${-14 - uapY * 0.7} Q -14,${-32 - uapY * 0.7} -4,${-48 - uapY * 0.7}`}
                    fill="none"
                    stroke="#FFF4D4"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity={0.85 - uapY / 30}
                  />
                  <path
                    d={`M 10,${-10 - uapY * 0.6} Q 18,${-28 - uapY * 0.6} 8,${-44 - uapY * 0.6}`}
                    fill="none"
                    stroke="#FFF4D4"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity={0.8 - uapY / 30}
                  />
                  <path d="M 24,6 C 40,6 40,32 24,32" fill="none" stroke="#F4E7C8" strokeWidth="6" />
                  <rect x="-22" y="-6" width="48" height="50" rx="10" fill="#F4E7C8" stroke={outline} strokeWidth="4" />
                  <ellipse cx="2" cy="-6" rx="24" ry="6" fill="#6B442A" stroke={outline} strokeWidth="3.5" />
                </g>
              </g>
            ) : properti === 'arsip' || properti === 'kitab' ? (
              <g>
                {/* Tangan memegang gulungan naskah atau kitab */}
                <path
                  d="M 278,356 C 298,402 324,404 334,368"
                  fill="none"
                  stroke={outline}
                  strokeWidth="44"
                  strokeLinecap="round"
                />
                <path
                  d="M 278,356 C 298,402 324,404 334,368"
                  fill="none"
                  stroke={palet.baju}
                  strokeWidth="35"
                  strokeLinecap="round"
                />
                <g transform="translate(324, 344) rotate(-8)">
                  {properti === 'kitab' ? (
                    <>
                      <rect x="-32" y="-26" width="76" height="60" rx="7" fill="#6B2B1F" stroke={outline} strokeWidth="4" />
                      <rect x="-22" y="-16" width="56" height="40" rx="3" fill="none" stroke="#E8C57B" strokeWidth="3" />
                      <line x1="-28" y1="32" x2="40" y2="32" stroke="#F6EBD0" strokeWidth="6" />
                    </>
                  ) : (
                    <>
                      <rect x="-34" y="-24" width="84" height="58" rx="6" fill="#F4E8CA" stroke={outline} strokeWidth="4" />
                      <line x1="-20" y1="-8" x2="36" y2="-8" stroke="#6E5438" strokeWidth="4" strokeLinecap="round" />
                      <line x1="-20" y1="6" x2="32" y2="6" stroke="#6E5438" strokeWidth="3.8" strokeLinecap="round" />
                      <circle cx="28" cy="20" r="9" fill="#B53126" stroke={outline} strokeWidth="2.6" />
                    </>
                  )}
                </g>
                <circle cx="316" cy="368" r="18" fill={palet.kulit} stroke={outline} strokeWidth="4" />
              </g>
            ) : properti === 'biji_kopi' ? (
              <g>
                <path
                  d="M 278,358 C 298,402 326,400 338,364"
                  fill="none"
                  stroke={outline}
                  strokeWidth="44"
                  strokeLinecap="round"
                />
                <path
                  d="M 278,358 C 298,402 326,400 338,364"
                  fill="none"
                  stroke={palet.baju}
                  strokeWidth="35"
                  strokeLinecap="round"
                />
                <circle cx="336" cy="364" r="19" fill={palet.kulit} stroke={outline} strokeWidth="4" />
                <g transform="translate(340, 336)">
                  <ellipse cx="-8" cy="-16" rx="16" ry="8" fill="#3D7F4B" stroke={outline} strokeWidth="3" transform="rotate(-24 -8 -16)" />
                  <circle cx="-8" cy="6" r="13" fill="#B82925" stroke={outline} strokeWidth="3.5" />
                  <circle cx="12" cy="2" r="13" fill="#D83B33" stroke={outline} strokeWidth="3.5" />
                  <circle cx="2" cy="18" r="12" fill="#9E201C" stroke={outline} strokeWidth="3.5" />
                  <circle cx="-11" cy="2" r="3" fill="#FF9E96" opacity="0.7" />
                  <circle cx="9" cy="-2" r="3" fill="#FF9E96" opacity="0.7" />
                </g>
              </g>
            ) : gestur === 'doa' ? (
              /* Kedua tangan menangkup hormat di depan dada */
              <g transform="translate(216, 396)">
                <ellipse cx="-14" cy="0" rx="18" ry="26" fill={palet.kulit} stroke={outline} strokeWidth="4" transform="rotate(-14 -14 0)" />
                <ellipse cx="14" cy="0" rx="18" ry="26" fill={palet.kulit} stroke={outline} strokeWidth="4" transform="rotate(14 14 0)" />
              </g>
            ) : gestur === 'tunjuk' ? (
              /* Tangan terangkat menjelaskan penuh semangat */
              <g>
                <path
                  d="M 280,356 C 304,368 334,344 344,310"
                  fill="none"
                  stroke={outline}
                  strokeWidth="44"
                  strokeLinecap="round"
                />
                <path
                  d="M 280,356 C 304,368 334,344 344,310"
                  fill="none"
                  stroke={palet.baju}
                  strokeWidth="35"
                  strokeLinecap="round"
                />
                <circle cx="344" cy="304" r="18" fill={palet.kulit} stroke={outline} strokeWidth="4" />
                <path d="M 346,292 L 358,264" stroke={outline} strokeWidth="16" strokeLinecap="round" />
                <path d="M 346,292 L 358,264" stroke={palet.kulit} strokeWidth="10" strokeLinecap="round" />
              </g>
            ) : null}
          </g>
        </g>
      </g>
    </svg>
  );
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
 * Satu sosok manusia 2D full-body (untuk shot `wide`: jalan melintas, duduk menyeduh, tatap horizon,
 * ramai 3 tokoh, dan mode `siluet`).
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
    : '#16110D';

  const warnaKulit = adalahSiluet ? (tema === 'perkamen' ? '#23160E' : '#11100E') : palet.kulit;
  const warnaBaju = adalahSiluet ? (tema === 'perkamen' ? '#23160E' : '#11100E') : palet.baju;
  const warnaBelakang = adalahSiluet ? (tema === 'perkamen' ? '#362316' : '#1E1B16') : palet.bajuBayang;
  const warnaCelana = adalahSiluet ? (tema === 'perkamen' ? '#23160E' : '#11100E') : palet.celana;
  const warnaKerah = adalahSiluet ? (tema === 'perkamen' ? '#EFE0BC' : '#DFCFA8') : palet.kerah;
  const warnaSepatu = adalahSiluet ? warnaBelakang : palet.sepatu;
  const strokeUtama = adalahSiluet ? 2.4 : 3.2;

  const siklusKedip = (f + tipe.length * 13) % 108;
  const sedangKedip = siklusKedip >= 102;

  const faseJalan = f * 0.24;
  const ayunPahaDepan = berjalan ? Math.sin(faseJalan) * 28 : duduk ? -82 : 0;
  const ayunPahaBelakang = berjalan ? Math.sin(faseJalan + Math.PI) * 28 : duduk ? -74 : 0;
  const tekukLututDepan = berjalan ? Math.max(0, -Math.cos(faseJalan)) * 34 : duduk ? 84 : 0;
  const tekukLututBelakang = berjalan ? Math.max(0, -Math.cos(faseJalan + Math.PI)) * 34 : duduk ? 78 : 0;

  const bobY = berjalan
    ? -Math.abs(Math.sin(faseJalan)) * 10
    : duduk
    ? 44 + Math.sin(f * 0.08) * 1.8
    : Math.sin(f * 0.08) * 2.5;

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
    <svg width={260 * skala} height={440 * skala} viewBox="0 0 260 440" style={{ overflow: 'visible' }}>
      <g transform={`translate(130, 0) scale(${balikX}, 1) translate(-130, 0)`}>
        <ellipse
          cx="130"
          cy="418"
          rx={berjalan ? 54 + Math.abs(Math.sin(faseJalan)) * 14 : duduk ? 64 : 48}
          ry="9"
          fill="rgba(0,0,0,0.44)"
        />
        <g transform={`translate(0, ${bobY})`}>
          <g transform={`translate(126, 258) rotate(${ayunPahaBelakang})`}>
            <path d="M -11,0 L 11,0 L 9,78 L -10,78 Z" fill={warnaBelakang} stroke={warnaOutline} strokeOpacity={adalahSiluet ? 0.28 : 0.78} strokeWidth="2.2" />
            <g transform={`translate(0, 74) rotate(${tekukLututBelakang})`}>
              <path d="M -9,0 L 9,0 L 7,76 L -8,76 Z" fill={warnaBelakang} stroke={warnaOutline} strokeOpacity={adalahSiluet ? 0.28 : 0.78} strokeWidth="2.2" />
              <path d="M -10,72 L 22,72 C 27,72 28,83 20,83 L -10,83 Z" fill={warnaSepatu} />
            </g>
          </g>
          <g transform={`translate(124, 148) rotate(${rotLenganBelakang})`}>
            <path d="M -9,0 C -10,36 -8,74 -6,108 C -5,116 7,116 8,108 C 10,74 11,36 9,0 Z" fill={warnaBelakang} stroke={warnaOutline} strokeOpacity={adalahSiluet ? 0.32 : 0.82} strokeWidth="2.2" />
          </g>
          <g transform={`translate(134, 258) rotate(${ayunPahaDepan})`}>
            <path d="M -12,0 L 12,0 L 10,78 L -10,78 Z" fill={warnaCelana} stroke={warnaOutline} strokeWidth={strokeUtama} strokeLinejoin="round" />
            <g transform={`translate(0, 74) rotate(${tekukLututDepan})`}>
              <path d="M -10,0 L 10,0 L 8,76 L -9,76 Z" fill={warnaCelana} stroke={warnaOutline} strokeWidth={strokeUtama} strokeLinejoin="round" />
              <path d="M -10,72 L 24,72 C 30,72 30,84 22,84 L -11,84 Z" fill={warnaSepatu} stroke={warnaOutline} strokeWidth="2.4" strokeLinejoin="round" />
            </g>
          </g>
          <g transform={`translate(130, 262) rotate(${condongBadan}) translate(-130, -262)`}>
            {horizon && (
              <path
                d={`M 104,142 Q ${66 + kibarAngin * 0.5},${176 + kibarAngin * 0.4} ${42 + kibarAngin},${232 + kibarAngin * 0.5} L ${62 + kibarAngin * 0.7},${242 + kibarAngin * 0.3} Q ${86 + kibarAngin * 0.4},194 116,154 Z`}
                fill={adalahSiluet ? warnaBelakang : palet.aksen}
                stroke={warnaOutline}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
            )}
            {(adalahPetualang || adalahPetani) && (
              <path d="M 84,154 C 72,158 70,216 84,232 L 104,230 L 106,154 Z" fill={adalahSiluet ? warnaBelakang : '#9A6338'} stroke={warnaOutline} strokeWidth="2.6" strokeLinejoin="round" />
            )}
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
                <path d="M 102,134 C 98,176 99,224 100,256 L 160,256 C 162,212 160,164 152,134 Z" fill={warnaBaju} stroke={warnaOutline} strokeWidth={strokeUtama} strokeLinejoin="round" />
              </g>
            ) : adalahPedagang ? (
              <g>
                <path
                  d={`M 100,134 C 96,178 96,232 94,334 L ${168 + (berjalan ? Math.sin(faseJalan) * 8 : 0)},334 L 162,238 C 162,196 160,162 154,134 Z`}
                  fill={warnaBaju}
                  stroke={warnaOutline}
                  strokeWidth={strokeUtama}
                  strokeLinejoin="round"
                />
                {!adalahSiluet && <path d="M 99,224 L 162,224 L 160,242 L 98,242 Z" fill={palet.aksen} stroke={warnaOutline} strokeWidth="2.2" />}
              </g>
            ) : (
              <g>
                <path d="M 102,134 C 98,174 102,226 104,268 L 158,268 C 162,222 162,174 154,134 Z" fill={warnaBaju} stroke={warnaOutline} strokeWidth={strokeUtama} strokeLinejoin="round" />
                {adalahPemuda && !adalahSiluet && (
                  <path d="M 118,162 L 158,162 L 160,276 L 114,276 Z" fill={palet.aksen} stroke={warnaOutline} strokeWidth="2.4" strokeLinejoin="round" />
                )}
                {adalahPetualang && !adalahSiluet && (
                  <rect x="103" y="236" width="56" height="12" rx="3" fill={palet.aksen} stroke={warnaOutline} strokeWidth="2.2" />
                )}
              </g>
            )}
            <path d="M 134,132 L 148,141 L 139,151 Z" fill={warnaKerah} opacity="0.92" />
            {!adalahSiluet && tema === 'malam' && (
              <path d="M 153,136 C 159,174 160,218 157,264" fill="none" stroke={warnaRim} strokeWidth="2.6" strokeOpacity="0.72" strokeLinecap="round" />
            )}
            <rect x="122" y="112" width="18" height="25" rx="6" fill={warnaKulit} stroke={warnaOutline} strokeWidth="2.4" />
            <g transform={`translate(131, 114) rotate(${rotKepala}) translate(-131, -114)`}>
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
              {!adalahSiluet && !horizon && (
                <g>
                  <ellipse cx="144" cy="92" rx="6" ry="3.5" fill="#E07A5F" opacity="0.28" />
                  {ekspresi === 'serius' || ekspresi === 'tegang' ? (
                    <line x1="142" y1="69" x2="155" y2="73" stroke="#241912" strokeWidth="3" strokeLinecap="round" />
                  ) : ekspresi === 'takjub' ? (
                    <path d="M 141,69 Q 149,63 156,69" fill="none" stroke="#241912" strokeWidth="2.8" strokeLinecap="round" />
                  ) : (
                    <path d="M 142,71 Q 149,68 155,71" fill="none" stroke="#241912" strokeWidth="2.8" strokeLinecap="round" />
                  )}
                  {sedangKedip ? (
                    <path d="M 144,79 Q 149,82 154,79" fill="none" stroke="#1E1712" strokeWidth="2.6" strokeLinecap="round" />
                  ) : (
                    <>
                      <ellipse cx="149" cy="79" rx="3.8" ry={ekspresi === 'takjub' ? 4.8 : 4} fill="#1E1712" />
                      <circle cx="148" cy="77.5" r="1.4" fill="#FFFDF7" />
                    </>
                  )}
                  {ekspresi === 'takjub' ? (
                    <ellipse cx="155" cy="101" rx="3.2" ry="4" fill="#7D2E28" />
                  ) : ekspresi === 'serius' || ekspresi === 'tegang' ? (
                    <line x1="150" y1="101" x2="158" y2="101" stroke="#4A2A1E" strokeWidth="2.5" strokeLinecap="round" />
                  ) : (
                    <path d="M 149,99 Q 154,104 159,99" fill="none" stroke="#4A2A1E" strokeWidth="2.5" strokeLinecap="round" />
                  )}
                </g>
              )}
              {adalahTetua && !horizon && (
                <path d="M 140,104 C 148,104 160,100 162,108 C 162,122 152,130 140,126 C 134,122 136,110 140,104 Z" fill={adalahSiluet ? warnaKulit : palet.rambut} stroke={warnaOutline} strokeWidth="2.2" />
              )}
              {adalahWanita && (
                <path d="M 103,84 C 102,54 122,44 142,46 C 156,48 161,58 158,68 C 146,62 134,66 130,80 C 128,96 134,118 148,138 L 98,142 C 94,120 96,100 103,84 Z" fill={adalahSiluet ? warnaBaju : palet.rambut} stroke={warnaOutline} strokeWidth={strokeUtama} strokeLinejoin="round" />
              )}
              {(adalahSantri || adalahTetua) && (
                <g>
                  <path d="M 106,82 C 102,64 114,50 136,50 C 122,60 116,74 114,90 Z" fill={adalahSiluet ? warnaBaju : palet.rambut} />
                  <path d="M 106,66 L 111,42 C 120,38 148,38 157,44 L 160,66 C 145,69 120,69 106,66 Z" fill="#14110F" stroke={warnaOutline} strokeWidth={strokeUtama} strokeLinejoin="round" />
                </g>
              )}
              {adalahPetani && (
                <g>
                  <path d="M 82,68 L 134,28 L 186,68 Q 134,76 82,68 Z" fill={adalahSiluet ? warnaBaju : palet.aksen} stroke={warnaOutline} strokeWidth={strokeUtama} strokeLinejoin="round" />
                  {!adalahSiluet && <path d="M 96,66 Q 134,58 172,66" fill="none" stroke="#9A7234" strokeWidth="2.6" />}
                </g>
              )}
              {adalahPedagang && (
                <g>
                  <path d="M 102,68 C 100,42 122,34 144,36 C 160,38 166,52 162,68 C 146,72 118,72 102,68 Z" fill={adalahSiluet ? warnaBaju : palet.kerah} stroke={warnaOutline} strokeWidth={strokeUtama} strokeLinejoin="round" />
                  {!adalahSiluet && <path d="M 106,56 Q 134,46 161,56" fill="none" stroke={palet.aksen} strokeWidth="4" strokeLinecap="round" />}
                </g>
              )}
              {adalahPetualang && (
                <g>
                  <path d="M 104,64 L 112,44 C 122,40 146,40 154,46 L 158,64 Z" fill={adalahSiluet ? warnaBaju : '#6D4126'} stroke={warnaOutline} strokeWidth={strokeUtama} strokeLinejoin="round" />
                  <path d="M 94,65 Q 134,58 174,66 Q 134,72 94,65 Z" fill={adalahSiluet ? warnaBaju : '#7C4B2D'} stroke={warnaOutline} strokeWidth="2.4" />
                </g>
              )}
              {(tipe === 'pria' || adalahPemuda) && (
                <path d="M 106,82 C 102,58 116,42 140,44 C 155,45 166,55 162,68 C 150,60 134,62 124,72 C 118,78 114,88 106,82 Z" fill={adalahSiluet ? warnaBaju : palet.rambut} stroke={warnaOutline} strokeWidth="2.4" strokeLinejoin="round" />
              )}
            </g>
            <g transform={`translate(132, 150) rotate(${rotLenganDepan})`}>
              <path d="M -10,0 C -11,38 -9,76 -7,112 C -6,120 7,120 8,112 C 10,76 11,38 10,0 Z" fill={warnaBaju} stroke={warnaOutline} strokeWidth={strokeUtama} strokeLinejoin="round" />
              <circle cx="1" cy="116" r="9" fill={warnaKulit} stroke={warnaOutline} strokeWidth="2.4" />
              {properti === 'arsip' && (
                <g transform={`translate(8, 114) rotate(${-rotLenganDepan - condongBadan})`}>
                  <rect x="-4" y="-26" width="68" height="44" rx="4" fill="#F2E7C9" stroke="#5B442A" strokeWidth="2.6" />
                  <rect x="4" y="-17" width="16" height="18" rx="2" fill="#3B3025" opacity="0.78" />
                  <line x1="27" y1="-13" x2="56" y2="-13" stroke="#6E5A42" strokeWidth="3.2" strokeLinecap="round" />
                  <line x1="27" y1="-4" x2="52" y2="-4" stroke="#6E5A42" strokeWidth="2.8" strokeLinecap="round" />
                  <line x1="27" y1="5" x2="46" y2="5" stroke="#8C2A20" strokeWidth="2.8" strokeLinecap="round" />
                </g>
              )}
              {properti === 'kitab' && (
                <g transform={`translate(8, 114) rotate(${-rotLenganDepan - condongBadan})`}>
                  <rect x="-4" y="-22" width="52" height="36" rx="4" fill="#5A281E" stroke="#2D140E" strokeWidth="2.6" />
                  <rect x="3" y="-16" width="38" height="24" rx="2" fill="none" stroke="#E8C57B" strokeWidth="2" />
                  <line x1="-2" y1="14" x2="46" y2="14" stroke="#F4E9CF" strokeWidth="4" />
                </g>
              )}
              {properti === 'biji_kopi' && (
                <g transform={`translate(10, 114) rotate(${-rotLenganDepan - condongBadan})`}>
                  <path d="M -8,4 Q 16,24 40,4 Z" fill="#8C5A34" stroke="#2D1A0E" strokeWidth="2.4" />
                  <circle cx="8" cy="2" r="7" fill="#B92B27" stroke="#3B110E" strokeWidth="2" />
                  <circle cx="20" cy="0" r="7" fill="#D43B34" stroke="#3B110E" strokeWidth="2" />
                  <circle cx="30" cy="3" r="6.5" fill="#9E221E" stroke="#3B110E" strokeWidth="2" />
                  <ellipse cx="14" cy="-6" rx="6" ry="3.5" fill="#3D7A4A" transform="rotate(-20 14 -6)" />
                </g>
              )}
              {properti === 'lentera' && (
                <g transform={`translate(6, 122) rotate(${-rotLenganDepan - condongBadan})`}>
                  <circle cx="0" cy="24" r={62 * kedipApi} fill="#F5BD4E" opacity={0.22 * kedipApi} />
                  <circle cx="0" cy="24" r={32 * kedipApi} fill="#FFE699" opacity={0.38 * kedipApi} />
                  <path d="M -8,0 C -8,-10 8,-10 8,0" fill="none" stroke={warnaRim} strokeWidth="2.6" />
                  <rect x="-12" y="2" width="24" height="7" rx="3" fill="#2A1E16" stroke={warnaRim} strokeWidth="2" />
                  <rect x="-10" y="9" width="20" height="28" rx="4" fill="#FCE29C" stroke={warnaRim} strokeWidth="2.2" />
                  <ellipse cx="0" cy="23" rx="5" ry={8 * kedipApi} fill="#FFFDF0" />
                  <rect x="-13" y="37" width="26" height="6" rx="3" fill="#2A1E16" stroke={warnaRim} strokeWidth="2" />
                </g>
              )}
              {properti === 'cangkir' && (
                <g transform={`translate(8, 114) rotate(${-rotLenganDepan - condongBadan})`}>
                  <path d={`M 6,${-18 - uapY * 0.45} Q 1,${-27 - uapY * 0.45} 7,${-35 - uapY * 0.45}`} fill="none" stroke="#FFF4D2" strokeWidth="2.6" strokeLinecap="round" opacity={0.75 - uapY / 26} />
                  <path d={`M 15,${-16 - uapY * 0.4} Q 20,${-25 - uapY * 0.4} 14,${-33 - uapY * 0.4}`} fill="none" stroke="#FFF4D2" strokeWidth="2.6" strokeLinecap="round" opacity={0.75 - uapY / 26} />
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
    <svg width="330" height="224" viewBox="0 0 310 210" style={{ overflow: 'visible' }}>
      <rect x="64" y="84" width="186" height="18" rx="6" fill={kayuAtas} stroke={garis} strokeWidth="2.5" />
      <rect x="86" y="102" width="16" height="94" rx="4" fill={kayuKaki} stroke={garis} strokeWidth="2" />
      <rect x="212" y="102" width="16" height="94" rx="4" fill={kayuKaki} stroke={garis} strokeWidth="2" />
      <path d={`M 134,${44 - uap * 0.5} Q 128,${32 - uap * 0.5} 135,${22 - uap * 0.5}`} fill="none" stroke="#FFF4D2" strokeWidth="2.6" strokeLinecap="round" opacity={0.8 - uap / 26} />
      <path d={`M 186,${56 - uap * 0.4} Q 192,${45 - uap * 0.4} 185,${35 - uap * 0.4}`} fill="none" stroke="#FFF4D2" strokeWidth="2.4" strokeLinecap="round" opacity={0.75 - uap / 26} />
      <path d="M 118,84 L 124,48 L 148,48 L 154,84 Z" fill="#B57B45" stroke="#2D1A0E" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M 148,56 C 162,56 162,74 150,74" fill="none" stroke="#2D1A0E" strokeWidth="3" />
      <rect x="174" y="60" width="26" height="24" rx="6" fill="#F2E4C6" stroke="#2D1A0E" strokeWidth="2.4" />
      <path d="M 200,66 C 209,66 209,78 200,78" fill="none" stroke="#2D1A0E" strokeWidth="2.6" />
      <rect x="0" y="128" width="66" height="14" rx="4" fill={kayuAtas} stroke={garis} strokeWidth="2" />
      <rect x="10" y="142" width="12" height="54" rx="3" fill={kayuKaki} />
      <rect x="44" y="142" width="12" height="54" rx="3" fill={kayuKaki} />
    </svg>
  );
};

/** Lapisan kabut tipis melintas agar karakter 2D terasa menyatu ke panggung sinematik (bukan stiker tempelan). */
const KabutPanggung: React.FC<{ tema: 'malam' | 'perkamen'; frame: number }> = ({ tema, frame }) => {
  const geser1 = ((frame * 0.7) % 1200) - 240;
  const geser2 = 960 - ((frame * 0.55) % 1200);
  const warna = tema === 'perkamen' ? 'rgba(246,232,198,0.22)' : 'rgba(180,210,224,0.12)';
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: geser1,
          bottom: 40,
          width: 760,
          height: 220,
          borderRadius: '50%',
          background: `radial-gradient(ellipse at 50% 50%, ${warna} 0%, transparent 72%)`,
          filter: 'blur(26px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: geser2,
          bottom: 130,
          width: 680,
          height: 180,
          borderRadius: '50%',
          background: `radial-gradient(ellipse at 50% 50%, ${warna} 0%, transparent 72%)`,
          filter: 'blur(28px)',
        }}
      />
    </div>
  );
};

/**
 * Hitung beat aktif (shot, posisi, hadap, ekspresi) di dalam 1 adegan agar karakter
 * selalu hidup & berpindah-pindah posisi (tidak statis di 1 tempat selama 10–15 detik!).
 */
function resolveBeatAktif(
  konfig: KonfigPanggungKarakter,
  progres: number,
  durasiBingkai: number,
): {
  beatIdx: number;
  frameSejakBeat: number;
  shot: ShotKarakterCerita;
  posisi: PosisiKarakterCerita;
  hadap: 'kanan' | 'kiri';
  ekspresi: EkspresiKarakterCerita;
} {
  const aksi = konfig.aksi;
  const gaya = konfig.gaya ?? 'ilustrasi';
  const ekspresiAwal: EkspresiKarakterCerita = konfig.ekspresi ?? 'hangat';

  // Mode siluet atau aksi full-body jalan/duduk/ramai secara alami dimulai dengan shot sesuai aksinya
  const aksiWideBawaan = aksi === 'jalan_kanan' || aksi === 'jalan_kiri' || aksi === 'duduk_seduh' || aksi === 'tatap_horizon' || aksi === 'ramai_tiga';
  const shotAwal: ShotKarakterCerita =
    gaya === 'siluet'
      ? 'wide'
      : konfig.shot ?? (aksiWideBawaan ? 'wide' : aksi === 'periksa_arsip' ? 'closeup' : 'medium');
  const posisiAwal: PosisiKarakterCerita =
    konfig.posisi ?? (aksi === 'jalan_kiri' ? 'kanan' : aksi === 'tunjuk_arsip' ? 'kiri' : 'tengah');
  const hadapAwal: 'kanan' | 'kiri' =
    konfig.hadap ?? (posisiAwal === 'kanan' ? 'kiri' : 'kanan');

  // Adegan pendek (< 5 detik) atau mode siluet: cukup 1 beat rapi
  if (gaya === 'siluet' || durasiBingkai < 145) {
    return {
      beatIdx: 0,
      frameSejakBeat: Math.round(progres * durasiBingkai),
      shot: shotAwal,
      posisi: posisiAwal,
      hadap: hadapAwal,
      ekspresi: ekspresiAwal,
    };
  }

  // Beat ke-2 (mulai di ±48% durasi, atau sesuai konfig.beatKedua)
  const batasBeat2 = konfig.beatKedua?.mulaiRasio ?? (durasiBingkai >= 310 ? 0.36 : 0.48);
  const batasBeat3 = 0.72;

  const posisi2: PosisiKarakterCerita =
    konfig.beatKedua?.posisi ??
    (posisiAwal === 'kiri' ? 'kanan' : posisiAwal === 'kanan' ? 'kiri' : 'kanan');
  const shot2: ShotKarakterCerita =
    konfig.beatKedua?.shot ??
    (shotAwal === 'closeup' ? 'medium' : 'closeup');
  const hadap2: 'kanan' | 'kiri' =
    konfig.beatKedua?.hadap ?? (posisi2 === 'kanan' ? 'kiri' : 'kanan');
  const ekspresi2: EkspresiKarakterCerita =
    konfig.beatKedua?.ekspresi ??
    (ekspresiAwal === 'tenang' ? 'hangat' : ekspresiAwal === 'hangat' ? 'takjub' : ekspresiAwal);

  // Beat ke-3 otomatis untuk adegan panjang (≥ 10,3 detik) supaya setiap ~3,5 detik ada pergantian visual!
  if (durasiBingkai >= 310 && progres >= batasBeat3) {
    const posisi3: PosisiKarakterCerita = posisi2 === 'kanan' ? 'kiri' : posisi2 === 'kiri' ? 'tengah' : 'kanan';
    const shot3: ShotKarakterCerita = shot2 === 'closeup' ? 'medium' : 'closeup';
    const hadap3: 'kanan' | 'kiri' = posisi3 === 'kanan' ? 'kiri' : 'kanan';
    return {
      beatIdx: 2,
      frameSejakBeat: Math.max(0, Math.round((progres - batasBeat3) * durasiBingkai)),
      shot: shot3,
      posisi: posisi3,
      hadap: hadap3,
      ekspresi: ekspresiAwal === 'serius' ? 'tegang' : ekspresi2,
    };
  }

  if (progres >= batasBeat2) {
    return {
      beatIdx: 1,
      frameSejakBeat: Math.max(0, Math.round((progres - batasBeat2) * durasiBingkai)),
      shot: shot2,
      posisi: posisi2,
      hadap: hadap2,
      ekspresi: ekspresi2,
    };
  }

  return {
    beatIdx: 0,
    frameSejakBeat: Math.round(progres * durasiBingkai),
    shot: shotAwal,
    posisi: posisiAwal,
    hadap: hadapAwal,
    ekspresi: ekspresiAwal,
  };
}

/**
 * Panggung karakter 2D sinematik untuk `CeritaMotion`:
 * - Shot `closeup` & `medium`: tokoh 3/4-depan besar, ekspresif, lip-sync, posisi berpindah kiri/tengah/kanan + multi-beat cut.
 * - Shot `wide` / `siluet`: karakter full-body berjalan, duduk menyeduh, tatap horizon, dialog 2 tokoh, atau ramai 3 tokoh.
 */
export const PanggungKarakterCerita: React.FC<{
  konfig: KonfigPanggungKarakter;
  durasiBingkai: number;
  tema: 'malam' | 'perkamen';
  bottomLantai?: number;
  kata?: KataRingkas[];
}> = ({ konfig, durasiBingkai, tema, bottomLantai = 505, kata }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!konfig || konfig.aksi === 'tanpa') return null;

  const progres = interpolate(frame, [0, Math.max(1, durasiBingkai)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const detik = frame / fps;
  const { bicara, buka } = hitungStatusBicara(detik, kata, frame);

  const tokohUtama: TipeKarakterCerita = konfig.tokohUtama ?? 'petualang';
  const tokohKedua: TipeKarakterCerita = konfig.tokohKedua ?? (tokohUtama === 'wanita' ? 'pria' : 'petani');
  const tokohKetiga: TipeKarakterCerita =
    konfig.tokohKetiga ?? (tokohUtama === 'pedagang' ? 'tetua' : 'pedagang');
  const properti: PropertiKarakterCerita = konfig.properti ?? 'tanpa';
  const gaya: GayaKarakterCerita = konfig.gaya ?? 'ilustrasi';

  const beat = resolveBeatAktif(konfig, progres, durasiBingkai);
  const masukBeat = spring({
    frame: beat.frameSejakBeat,
    fps,
    config: { damping: 14, stiffness: 155, mass: 0.72 },
  });

  // Getar kamera sangat halus pada awal beat dramatis / ekspresi tegang
  const goyangDramatis =
    (beat.ekspresi === 'tegang' || beat.ekspresi === 'takjub') && beat.frameSejakBeat < 14
      ? Math.sin(beat.frameSejakBeat * 2.4) * (1 - beat.frameSejakBeat / 14) * 5
      : 0;

  // ── MODE HERO PORTRAIT (CLOSE-UP & MEDIUM 3/4 DEPAN BESAR, JELAS, PINDAH-PINDAH POSISI) ──
  if (gaya === 'ilustrasi' && (beat.shot === 'closeup' || beat.shot === 'medium')) {
    const adalahDialogDua = konfig.aksi === 'dialog_dua' && beat.shot === 'medium';
    const lebarTokoh = beat.shot === 'closeup' ? 760 : adalahDialogDua ? 510 : 600;
    const zoomHalus = interpolate(beat.frameSejakBeat, [0, Math.max(30, durasiBingkai * 0.5)], [0.98, 1.05], {
      extrapolateRight: 'clamp',
    });

    // Koordinat horizontal dinamis sesuai posisi (kiri / tengah / kanan) + gerak drift perlahan
    const driftX = (beat.hadap === 'kanan' ? 1 : -1) * interpolate(beat.frameSejakBeat, [0, 120], [-10, 14], { extrapolateRight: 'clamp' });
    const leftUtama =
      beat.posisi === 'kiri'
        ? (beat.shot === 'closeup' ? 20 : 48)
        : beat.posisi === 'kanan'
        ? 1080 - lebarTokoh - (beat.shot === 'closeup' ? 20 : 48)
        : Math.round((1080 - lebarTokoh) / 2);

    const gesturUtama: 'cerita' | 'tunjuk' | 'doa' | 'periksa' | 'dengar' =
      konfig.aksi === 'tunjuk_arsip'
        ? 'tunjuk'
        : konfig.aksi === 'periksa_arsip'
        ? 'periksa'
        : beat.ekspresi === 'tegang' || tokohUtama === 'santri'
        ? 'doa'
        : 'cerita';

    // Letakkan panggung potret di atas subtitle bawah dengan gradasi masker bawah lembut agar tepi baju menyatu mulus
    const bottomPotret = Math.max(350, bottomLantai - 125);

    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: bottomPotret,
          height: 920,
          pointerEvents: 'none',
          overflow: 'hidden',
          transform: `translateX(${goyangDramatis}px)`,
          WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 76%, rgba(0,0,0,0.45) 90%, transparent 100%)',
          maskImage: 'linear-gradient(180deg, black 0%, black 76%, rgba(0,0,0,0.45) 90%, transparent 100%)',
        }}
      >
        {/* Pendar atmosfer belakang tokoh agar kontras dengan latar */}
        <div
          style={{
            position: 'absolute',
            left: beat.posisi === 'kiri' ? 0 : beat.posisi === 'kanan' ? 320 : 140,
            bottom: 80,
            width: 760,
            height: 760,
            borderRadius: '50%',
            background:
              tema === 'perkamen'
                ? 'radial-gradient(circle, rgba(255,244,208,0.34) 0%, rgba(235,198,124,0.12) 48%, transparent 72%)'
                : 'radial-gradient(circle, rgba(245,192,92,0.26) 0%, rgba(180,126,48,0.08) 48%, transparent 72%)',
          }}
        />

        {adalahDialogDua ? (
          <>
            {/* Tokoh 1 di kiri menghadap kanan */}
            <div
              style={{
                position: 'absolute',
                left: 16,
                bottom: -36,
                opacity: masukBeat,
                transform: `translateX(${interpolate(masukBeat, [0, 1], [-80, 0])}px) scale(${zoomHalus})`,
                transformOrigin: 'bottom center',
              }}
            >
              <PotretKarakter34
                tipe={tokohUtama}
                ekspresi={beat.ekspresi}
                properti={properti === 'tanpa' ? 'lentera' : properti}
                hadap="kanan"
                tema={tema}
                bicara={bicara}
                bukaMulut={buka}
                gestur="tunjuk"
                lebarPx={lebarTokoh}
              />
            </div>
            {/* Tokoh 2 di kanan menghadap kiri */}
            <div
              style={{
                position: 'absolute',
                right: 16,
                bottom: -36,
                opacity: masukBeat,
                transform: `translateX(${interpolate(masukBeat, [0, 1], [80, 0])}px) scale(${zoomHalus * 0.96})`,
                transformOrigin: 'bottom center',
              }}
            >
              <PotretKarakter34
                tipe={tokohKedua}
                ekspresi="hangat"
                properti="tanpa"
                hadap="kiri"
                tema={tema}
                bicara={false}
                bukaMulut={0}
                gestur="dengar"
                faseOffset={22}
                lebarPx={lebarTokoh}
              />
            </div>
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              left: leftUtama + driftX,
              bottom: beat.shot === 'closeup' ? -135 : -55,
              opacity: masukBeat,
              transform: `translateX(${interpolate(
                masukBeat,
                [0, 1],
                [beat.posisi === 'kanan' ? 75 : beat.posisi === 'kiri' ? -75 : 0, 0],
              )}px) translateY(${interpolate(masukBeat, [0, 1], [36, 0])}px) scale(${zoomHalus})`,
              transformOrigin: 'bottom center',
            }}
          >
            <PotretKarakter34
              tipe={tokohUtama}
              ekspresi={beat.ekspresi}
              properti={properti}
              hadap={beat.hadap}
              tema={tema}
              bicara={bicara}
              bukaMulut={buka}
              gestur={gesturUtama}
              faseOffset={beat.beatIdx * 19}
              lebarPx={lebarTokoh}
            />
          </div>
        )}

        <KabutPanggung tema={tema} frame={frame} />
      </div>
    );
  }

  // ── MODE WIDE / FULL-BODY / SILUET (lebih besar & jelas 1.22x dengan kabut lembut) ──
  const masuk = spring({ frame, fps, config: { damping: 16, stiffness: 110 } });
  const xJalanKanan = interpolate(progres, [0, 1], [110, 660]);
  const xJalanKiri = interpolate(progres, [0, 1], [660, 110]);
  const skalaWide = 1.22;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.max(430, bottomLantai - 35),
        height: 560,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 18,
          width: 860,
          height: 560,
          transform: 'translateX(-50%)',
          background:
            tema === 'perkamen'
              ? 'radial-gradient(ellipse at 50% 58%, rgba(255,241,200,0.34) 0%, rgba(240,204,132,0.12) 45%, rgba(0,0,0,0) 74%)'
              : 'radial-gradient(ellipse at 50% 58%, rgba(246,204,116,0.28) 0%, rgba(212,155,62,0.1) 44%, rgba(0,0,0,0) 74%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 76,
          right: 76,
          bottom: 24,
          height: 2,
          background:
            tema === 'perkamen'
              ? 'linear-gradient(90deg, transparent 0%, rgba(92,58,28,0.55) 18%, rgba(92,58,28,0.55) 82%, transparent 100%)'
              : 'linear-gradient(90deg, transparent 0%, rgba(235,198,118,0.42) 18%, rgba(235,198,118,0.42) 82%, transparent 100%)',
        }}
      />

      {konfig.aksi === 'jalan_kanan' && (
        <div style={{ position: 'absolute', left: xJalanKanan, bottom: 8, opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <SosokCerita2D tipe={tokohUtama} pose="jalan" properti={properti} hadap="kanan" tema={tema} gaya={gaya} ekspresi={beat.ekspresi} skala={skalaWide} />
        </div>
      )}

      {konfig.aksi === 'jalan_kiri' && (
        <div style={{ position: 'absolute', left: xJalanKiri, bottom: 8, opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <SosokCerita2D tipe={tokohUtama} pose="jalan" properti={properti} hadap="kiri" tema={tema} gaya={gaya} ekspresi={beat.ekspresi} skala={skalaWide} />
        </div>
      )}

      {konfig.aksi === 'periksa_arsip' && (
        <div style={{ position: 'absolute', left: 325, bottom: 8, opacity: masuk, transform: `translateX(${interpolate(masuk, [0, 1], [-44, 0])}px)` }}>
          <SosokCerita2D tipe={tokohUtama} pose="periksa" properti={properti === 'tanpa' ? 'lentera' : properti} hadap="kanan" tema={tema} gaya={gaya} ekspresi="serius" skala={skalaWide} />
        </div>
      )}

      {konfig.aksi === 'tunjuk_arsip' && (
        <div style={{ position: 'absolute', left: 370, bottom: 8, opacity: masuk, transform: `translateY(${interpolate(masuk, [0, 1], [16, 0])}px)` }}>
          <SosokCerita2D tipe={tokohUtama} pose="tunjuk" properti={properti === 'tanpa' ? 'arsip' : properti} hadap="kanan" tema={tema} gaya={gaya} ekspresi={beat.ekspresi} skala={skalaWide} />
        </div>
      )}

      {konfig.aksi === 'dialog_dua' && (
        <>
          <div style={{ position: 'absolute', left: 155, bottom: 8, opacity: masuk, transform: `translateX(${interpolate(masuk, [0, 1], [-48, 0])}px)` }}>
            <SosokCerita2D tipe={tokohUtama} pose="tunjuk" properti={properti === 'tanpa' ? 'arsip' : properti} hadap="kanan" tema={tema} gaya={gaya} ekspresi={beat.ekspresi} skala={1.16} />
          </div>
          <div style={{ position: 'absolute', right: 155, bottom: 8, opacity: masuk, transform: `translateX(${interpolate(masuk, [0, 1], [48, 0])}px)` }}>
            <SosokCerita2D tipe={tokohKedua} pose="dengar" properti="tanpa" hadap="kiri" tema={tema} gaya={gaya} ekspresi="hangat" faseOffset={18} skala={1.14} />
          </div>
        </>
      )}

      {konfig.aksi === 'duduk_seduh' && (
        <div style={{ position: 'absolute', left: 265, bottom: 12, opacity: masuk, transform: `translateY(${interpolate(masuk, [0, 1], [22, 0])}px)` }}>
          <div style={{ position: 'relative', width: 520, height: 480 }}>
            <div style={{ position: 'absolute', left: 0, bottom: 0 }}>
              <SosokCerita2D tipe={tokohUtama} pose="duduk" properti={properti === 'tanpa' ? 'cangkir' : properti} hadap="kanan" tema={tema} gaya={gaya} ekspresi="hangat" skala={1.16} />
            </div>
            <div style={{ position: 'absolute', left: 126, bottom: 6 }}>
              <MejaSeduhKayu tema={tema} frame={frame} />
            </div>
          </div>
        </div>
      )}

      {konfig.aksi === 'tatap_horizon' && (
        <div style={{ position: 'absolute', left: 135, bottom: 8, opacity: masuk, transform: `translateX(${interpolate(masuk, [0, 1], [-30, 0])}px) scale(${interpolate(progres, [0, 1], [0.98, 1.05])})` }}>
          <SosokCerita2D tipe={tokohUtama} pose="horizon" properti={properti === 'lentera' ? 'lentera' : 'tanpa'} hadap="kanan" tema={tema} gaya={gaya} ekspresi="takjub" skala={skalaWide} />
        </div>
      )}

      {konfig.aksi === 'ramai_tiga' && (
        <>
          <div style={{ position: 'absolute', left: 378, bottom: 26, opacity: masuk * 0.92, filter: 'brightness(0.9)' }}>
            <SosokCerita2D tipe={tokohKetiga} pose="berdiri" properti="tanpa" hadap="kiri" tema={tema} gaya={gaya} ekspresi="tenang" faseOffset={32} skala={1.04} />
          </div>
          <div style={{ position: 'absolute', left: 100, bottom: 8, opacity: masuk, transform: `translateX(${interpolate(masuk, [0, 1], [-46, 0])}px)` }}>
            <SosokCerita2D tipe={tokohUtama} pose="tunjuk" properti={properti === 'tanpa' ? 'biji_kopi' : properti} hadap="kanan" tema={tema} gaya={gaya} ekspresi={beat.ekspresi} skala={1.16} />
          </div>
          <div style={{ position: 'absolute', right: 100, bottom: 8, opacity: masuk, transform: `translateX(${interpolate(masuk, [0, 1], [46, 0])}px)` }}>
            <SosokCerita2D tipe={tokohKedua} pose="dengar" properti="cangkir" hadap="kiri" tema={tema} gaya={gaya} ekspresi="hangat" faseOffset={16} skala={1.14} />
          </div>
        </>
      )}

      {konfig.aksi === 'berdiri_tenang' && (
        <div style={{ position: 'absolute', left: 385, bottom: 8, opacity: masuk, transform: `translateY(${interpolate(masuk, [0, 1], [18, 0])}px)` }}>
          <SosokCerita2D tipe={tokohUtama} pose="berdiri" properti={properti} hadap="kanan" tema={tema} gaya={gaya} ekspresi={beat.ekspresi} skala={skalaWide} />
        </div>
      )}

      <KabutPanggung tema={tema} frame={frame} />
    </div>
  );
};
