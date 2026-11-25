import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type TokohKartunId =
  | 'mas_barista'
  | 'mas_pelanggan'
  | 'mbak_pelanggan'
  | 'pak_tetangga'
  | 'kucing_kedai';

export type EkspresiKartun =
  | 'senyum'
  | 'ketawa'
  | 'kaget'
  | 'mikir'
  | 'cemberut'
  | 'ngantuk'
  | 'bangga'
  | 'malu';

export type PropertiKartun =
  | 'tanpa'
  | 'es_kopi'
  | 'kopi_panas'
  | 'matcha_latte'
  | 'hp'
  | 'uang'
  | 'jempol'
  | 'tunjuk';

export type EfekKartun =
  | 'tanpa'
  | 'tanda_tanya'
  | 'tanda_seru'
  | 'keringat'
  | 'hati'
  | 'lampu_ide'
  | 'tawa';

export type KataTimestamp = {
  teks: string;
  mulai: number;
  selesai: number;
};

type PropsKarakter = {
  tokoh: TokohKartunId;
  ekspresi?: EkspresiKartun;
  properti?: PropertiKartun;
  efek?: EfekKartun;
  sedangBicara?: boolean;
  kata?: KataTimestamp[];
  hadap?: 'kanan' | 'kiri';
  ukuran?: number;
};

const OUTLINE = '#2B1D14';

const OFFSET_KEDIP: Record<TokohKartunId, number> = {
  mas_barista: 11,
  mas_pelanggan: 37,
  mbak_pelanggan: 53,
  pak_tetangga: 23,
  kucing_kedai: 43,
};

/** Hitung keterbukaan mulut (0 = tutup, 1 = setengah, 2 = terbuka lebar) dari timestamps ElevenLabs atau ritme bicara. */
function hitungBentukMulut(
  sedangBicara: boolean,
  frame: number,
  fps: number,
  kata?: KataTimestamp[],
): 0 | 1 | 2 {
  if (!sedangBicara) return 0;
  const detik = frame / fps;
  if (kata && kata.length > 0) {
    const aktif = kata.find((k) => detik >= k.mulai - 0.03 && detik <= k.selesai + 0.04);
    if (!aktif) return 0;
    const progres = (detik - aktif.mulai) / Math.max(0.08, aktif.selesai - aktif.mulai);
    const huruf = aktif.teks.toLowerCase();
    const punyaVokalLebar = /[ao]/.test(huruf);
    if (progres < 0.25 || progres > 0.85) return 1;
    return punyaVokalLebar ? 2 : (Math.floor(frame / 3) % 2 === 0 ? 2 : 1);
  }
  const pola = Math.sin(frame * 0.65) + Math.cos(frame * 0.35);
  if (pola > 0.65) return 2;
  if (pola > -0.35) return 1;
  return 0;
}

const EfekReaksiKomik: React.FC<{ efek: EfekKartun; frame: number; fps: number; balikX?: number }> = ({
  efek,
  frame,
  fps,
  balikX = 1,
}) => {
  if (efek === 'tanpa') return null;
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 180, mass: 0.7 } });
  const ayun = Math.sin(frame * 0.2) * 5;
  const balikTeks = balikX < 0 ? 'scale(-1, 1)' : undefined;

  return (
    <g transform={`translate(245, 58) scale(${0.4 + 0.6 * pop}) translate(0, ${ayun})`}>
      {efek === 'tanda_tanya' && (
        <g>
          <circle cx="0" cy="0" r="24" fill="#FFFDF5" stroke={OUTLINE} strokeWidth="4" />
          <g transform={balikTeks}>
            <text x="0" y="9" textAnchor="middle" fontSize="30" fontWeight="900" fill="#E07A2E">
              ?
            </text>
          </g>
        </g>
      )}
      {efek === 'tanda_seru' && (
        <g>
          <polygon points="0,-28 24,-10 18,22 -18,22 -24,-10" fill="#FFE066" stroke={OUTLINE} strokeWidth="4" />
          <g transform={balikTeks}>
            <text x="0" y="8" textAnchor="middle" fontSize="30" fontWeight="900" fill="#C92A2A">
              !
            </text>
          </g>
        </g>
      )}
      {efek === 'keringat' && (
        <path
          d="M 0,-22 C 12,-4 16,10 0,22 C -16,10 -12,-4 0,-22 Z"
          fill="#74C0FC"
          stroke={OUTLINE}
          strokeWidth="3.5"
        />
      )}
      {efek === 'hati' && (
        <path
          d="M 0,18 C -24,2 -26,-20 -10,-22 C -2,-23 0,-14 0,-14 C 0,-14 2,-23 10,-22 C 26,-20 24,2 0,18 Z"
          fill="#FF6B8B"
          stroke={OUTLINE}
          strokeWidth="3.5"
        />
      )}
      {efek === 'lampu_ide' && (
        <g>
          <circle cx="0" cy="-4" r="18" fill="#FFE066" stroke={OUTLINE} strokeWidth="3.5" />
          <rect x="-7" y="13" width="14" height="9" rx="3" fill="#CBD5E1" stroke={OUTLINE} strokeWidth="3" />
          <line x1="0" y1="-32" x2="0" y2="-26" stroke="#F59F00" strokeWidth="4" strokeLinecap="round" />
          <line x1="-26" y1="-16" x2="-20" y2="-12" stroke="#F59F00" strokeWidth="4" strokeLinecap="round" />
          <line x1="26" y1="-16" x2="20" y2="-12" stroke="#F59F00" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
      {efek === 'tawa' && (
        <g transform={balikTeks}>
          <rect x="-42" y="-19" width="84" height="36" rx="16" fill="#FFF3BF" stroke={OUTLINE} strokeWidth="3.5" />
          <text x="0" y="6" textAnchor="middle" fontSize="19" fontWeight="900" fill={OUTLINE}>
            HAHA!
          </text>
        </g>
      )}
    </g>
  );
};

const PropertiTangan: React.FC<{ properti: PropertiKartun; frame: number; balikX?: number }> = ({
  properti,
  frame,
  balikX = 1,
}) => {
  if (properti === 'tanpa') return null;
  const uapY = (frame * 0.6) % 18;
  const balikTeks = balikX < 0 ? 'scale(-1, 1)' : undefined;

  return (
    <g transform="translate(232, 266)">
      {properti === 'es_kopi' && (
        <g>
          <polygon points="-18,-22 18,-22 14,30 -14,30" fill="#D9A773" stroke={OUTLINE} strokeWidth="4" strokeLinejoin="round" />
          <polygon points="-16,-4 16,-4 14,30 -14,30" fill="#8D5524" opacity="0.72" />
          <rect x="-10" y="-15" width="9" height="9" rx="2" fill="#E7F5FF" opacity="0.85" />
          <rect x="2" y="-12" width="8" height="8" rx="2" fill="#E7F5FF" opacity="0.85" />
          <path d="M -21,-22 L 21,-22 L 18,-30 L -18,-30 Z" fill="#F8FAFC" stroke={OUTLINE} strokeWidth="3.5" />
          <line x1="4" y1="-30" x2="11" y2="-50" stroke="#18B4A8" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      {properti === 'matcha_latte' && (
        <g>
          <polygon points="-18,-22 18,-22 14,30 -14,30" fill="#E9F7EF" stroke={OUTLINE} strokeWidth="4" strokeLinejoin="round" />
          <polygon points="-16,-8 16,-8 14,10 -14,10" fill="#52B788" opacity="0.9" />
          <polygon points="-14,10 14,10 13,30 -13,30" fill="#2D6A4F" opacity="0.88" />
          <path d="M -21,-22 L 21,-22 L 18,-30 L -18,-30 Z" fill="#F8FAFC" stroke={OUTLINE} strokeWidth="3.5" />
          <line x1="4" y1="-30" x2="11" y2="-50" stroke="#2D6A4F" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      {properti === 'kopi_panas' && (
        <g>
          <path d="M 16,-10 C 28,-10 28,12 15,12" fill="none" stroke={OUTLINE} strokeWidth="4" />
          <rect x="-18" y="-18" width="34" height="38" rx="10" fill="#FFFDF7" stroke={OUTLINE} strokeWidth="4" />
          <ellipse cx="-1" cy="-18" rx="17" ry="5" fill="#6F4E37" stroke={OUTLINE} strokeWidth="3" />
          <path
            d={`M -6,${-28 - uapY * 0.5} Q -12,${-38 - uapY * 0.5} -5,${-48 - uapY * 0.5}`}
            fill="none"
            stroke="#FFFDF9"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity={0.85 - uapY / 22}
          />
          <path
            d={`M 6,${-26 - uapY * 0.4} Q 12,${-36 - uapY * 0.4} 5,${-46 - uapY * 0.4}`}
            fill="none"
            stroke="#FFFDF9"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity={0.85 - uapY / 22}
          />
        </g>
      )}
      {properti === 'hp' && (
        <g transform="rotate(-10)">
          <rect x="-15" y="-26" width="30" height="52" rx="6" fill="#1E293B" stroke={OUTLINE} strokeWidth="4" />
          <rect x="-11" y="-20" width="22" height="38" rx="3" fill="#38BDF8" />
          <circle cx="0" cy="22" r="2.2" fill="#94A3B8" />
        </g>
      )}
      {properti === 'uang' && (
        <g transform="rotate(-12)">
          <rect x="-24" y="-12" width="48" height="24" rx="4" fill="#69DB7C" stroke={OUTLINE} strokeWidth="3.5" />
          <circle cx="0" cy="0" r="6" fill="#2B8A3E" opacity="0.55" />
          <g transform={balikTeks}>
            <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="900" fill="#FFF">
              Rp
            </text>
          </g>
        </g>
      )}
      {properti === 'jempol' && (
        <g>
          <path
            d="M -12,10 L -12,-4 L -2,-18 C 3,-23 9,-19 6,-10 L 4,-4 L 18,-4 C 22,-4 22,16 14,16 L -12,16 Z"
            fill="#F4C7A1"
            stroke={OUTLINE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </g>
      )}
      {properti === 'tunjuk' && (
        <g>
          <path
            d="M -14,8 L -14,-6 L 26,-6 C 32,-6 32,3 26,3 L 6,3 L 6,14 L -14,14 Z"
            fill="#F4C7A1"
            stroke={OUTLINE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </g>
      )}
    </g>
  );
};

export const KarakterKartun: React.FC<PropsKarakter> = ({
  tokoh,
  ekspresi = 'senyum',
  properti = 'tanpa',
  efek = 'tanpa',
  sedangBicara = false,
  kata,
  hadap = 'kanan',
  ukuran = 420,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const siklusKedip = (frame + OFFSET_KEDIP[tokoh]) % 105;
  const sedangKedip = siklusKedip >= 98;
  const napasY = Math.sin(frame * 0.11 + OFFSET_KEDIP[tokoh]) * (sedangBicara ? 4.5 : 2.5);
  const goyangRot = sedangBicara ? Math.sin(frame * 0.24) * 2.2 : Math.sin(frame * 0.08) * 0.8;
  const skalaBicara = sedangBicara ? 1.04 : 0.96;
  const bentukMulut = hitungBentukMulut(sedangBicara, frame, fps, kata);
  const goyangEkor = Math.sin(frame * 0.22) * 14;

  // Warna kulit & pakaian khas tiap tokoh Lek Kopi
  const palet =
    tokoh === 'mas_barista'
      ? { kulit: '#F1C29B', kulitBayang: '#DEA57A', baju: '#F5EFE6', kerah: '#D6C7B2', rambut: '#2B1E1A' }
      : tokoh === 'mas_pelanggan'
      ? { kulit: '#ECC099', kulitBayang: '#D4A176', baju: '#18B4A8', kerah: '#118A81', rambut: '#1F1B18' }
      : tokoh === 'mbak_pelanggan'
      ? { kulit: '#F5CBA7', kulitBayang: '#DFA980', baju: '#F4A261', kerah: '#D97736', rambut: '#C86D51' }
      : tokoh === 'pak_tetangga'
      ? { kulit: '#E0AC82', kulitBayang: '#C68E64', baju: '#EAE4D3', kerah: '#C2B69C', rambut: '#3A3532' }
      : { kulit: '#FF9F43', kulitBayang: '#E67E22', baju: '#FFE4C4', kerah: '#E67E22', rambut: '#FF9F43' };

  const balikX = hadap === 'kiri' ? -1 : 1;

  if (tokoh === 'kucing_kedai') {
    return (
      <svg
        width={ukuran}
        height={ukuran * 1.1}
        viewBox="0 0 320 360"
        style={{ overflow: 'visible', transform: `scale(${skalaBicara})` }}
      >
        <g transform={`translate(160, 0) scale(${balikX}, 1) translate(-160, 0)`}>
          <ellipse cx="160" cy="336" rx="76" ry="14" fill="rgba(26,16,8,0.28)" />
          <g transform={`translate(0, ${napasY})`}>
            {/* Ekor bergoyang */}
            <path
              d={`M 218,288 Q ${265 + goyangEkor},250 ${252 + goyangEkor},205`}
              fill="none"
              stroke={OUTLINE}
              strokeWidth="22"
              strokeLinecap="round"
            />
            <path
              d={`M 218,288 Q ${265 + goyangEkor},250 ${252 + goyangEkor},205`}
              fill="none"
              stroke="#FF9F43"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Badan kucing oren gemoy */}
            <ellipse cx="160" cy="272" rx="68" ry="64" fill="#FF9F43" stroke={OUTLINE} strokeWidth="5" />
            <ellipse cx="160" cy="282" rx="42" ry="44" fill="#FFF3E0" />
            {/* Kaki depan */}
            <ellipse cx="132" cy="322" rx="16" ry="12" fill="#FFF3E0" stroke={OUTLINE} strokeWidth="4" />
            <ellipse cx="188" cy="322" rx="16" ry="12" fill="#FFF3E0" stroke={OUTLINE} strokeWidth="4" />
            {/* Kalung lonceng teal Lek Kopi */}
            <path d="M 114,225 Q 160,240 206,225" fill="none" stroke="#18B4A8" strokeWidth="10" strokeLinecap="round" />
            <circle cx="160" cy="236" r="10" fill="#FFD43B" stroke={OUTLINE} strokeWidth="3.5" />
            {/* Kepala */}
            <polygon points="104,155 112,96 146,132" fill="#FF9F43" stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />
            <polygon points="216,155 208,96 174,132" fill="#FF9F43" stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />
            <polygon points="113,144 117,110 137,131" fill="#FFB8B8" />
            <polygon points="207,144 203,110 183,131" fill="#FFB8B8" />
            <ellipse cx="160" cy="176" rx="66" ry="54" fill="#FF9F43" stroke={OUTLINE} strokeWidth="5" />
            {/* Garis loreng dahi */}
            <path d="M 160,124 L 160,142 M 146,127 L 149,141 M 174,127 L 171,141" stroke="#D97706" strokeWidth="5" strokeLinecap="round" />
            {/* Pipi putih */}
            <ellipse cx="145" cy="192" rx="18" ry="13" fill="#FFF3E0" />
            <ellipse cx="175" cy="192" rx="18" ry="13" fill="#FFF3E0" />
            {/* Mata */}
            {sedangKedip || ekspresi === 'ketawa' ? (
              <>
                <path d="M 122,168 Q 134,158 144,168" fill="none" stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" />
                <path d="M 176,168 Q 186,158 198,168" fill="none" stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle cx="134" cy="168" r={ekspresi === 'kaget' ? 12 : 10} fill="#1E1B18" />
                <circle cx="186" cy="168" r={ekspresi === 'kaget' ? 12 : 10} fill="#1E1B18" />
                <circle cx="130" cy="164" r="3.5" fill="#FFF" />
                <circle cx="182" cy="164" r="3.5" fill="#FFF" />
              </>
            )}
            {/* Hidung & mulut */}
            <polygon points="154,183 166,183 160,190" fill="#FF758F" />
            {bentukMulut > 0 || ekspresi === 'kaget' ? (
              <ellipse cx="160" cy="199" rx="8" ry={bentukMulut === 2 ? 9 : 6} fill="#B91C1C" stroke={OUTLINE} strokeWidth="3" />
            ) : (
              <path d="M 148,195 Q 154,202 160,194 Q 166,202 172,195" fill="none" stroke={OUTLINE} strokeWidth="3.5" strokeLinecap="round" />
            )}
            {/* Kumis */}
            <line x1="94" y1="180" x2="122" y2="184" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" />
            <line x1="92" y1="194" x2="122" y2="193" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" />
            <line x1="226" y1="180" x2="198" y2="184" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" />
            <line x1="228" y1="194" x2="198" y2="193" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" />
          </g>
          <EfekReaksiKomik efek={efek} frame={frame} fps={fps} balikX={balikX} />
        </g>
      </svg>
    );
  }

  // Tokoh Manusia 2D Cel-Shaded
  return (
    <svg
      width={ukuran}
      height={ukuran * 1.18}
      viewBox="0 0 320 380"
      style={{ overflow: 'visible', transform: `scale(${skalaBicara})` }}
    >
      <g transform={`translate(160, 0) scale(${balikX}, 1) translate(-160, 0)`}>
        <ellipse cx="160" cy="362" rx="84" ry="14" fill="rgba(26,16,8,0.28)" />

        <g transform={`translate(0, ${napasY}) rotate(${goyangRot}, 160, 290)`}>
          {/* Kerudung belakang untuk Mbak Rara */}
          {tokoh === 'mbak_pelanggan' && (
            <path
              d="M 88,165 C 82,225 84,280 96,310 L 224,310 C 236,280 238,225 232,165 Z"
              fill={palet.rambut}
              stroke={OUTLINE}
              strokeWidth="5"
            />
          )}

          {/* Badan / Bahu */}
          <path
            d="M 84,352 C 84,264 102,226 160,226 C 218,226 236,264 236,352 Z"
            fill={palet.baju}
            stroke={OUTLINE}
            strokeWidth="5"
            strokeLinejoin="round"
          />

          {/* Detail Baju Khusus Per Tokoh */}
          {tokoh === 'mas_barista' && (
            <g>
              {/* Apron Barista Hitam & Logo LK */}
              <path
                d="M 108,242 L 212,242 L 218,352 L 102,352 Z"
                fill="#1D1A17"
                stroke={OUTLINE}
                strokeWidth="4.5"
                strokeLinejoin="round"
              />
              <line x1="120" y1="228" x2="120" y2="245" stroke="#1D1A17" strokeWidth="8" />
              <line x1="200" y1="228" x2="200" y2="245" stroke="#1D1A17" strokeWidth="8" />
              <rect x="136" y="274" width="48" height="32" rx="6" fill="#2E2620" stroke="#D9A441" strokeWidth="2.5" />
              <g transform={balikX < 0 ? 'translate(160, 0) scale(-1, 1) translate(-160, 0)' : undefined}>
                <text x="160" y="297" textAnchor="middle" fontSize="18" fontWeight="900" fill="#FFFDF5">
                  LK
                </text>
              </g>
            </g>
          )}
          {tokoh === 'mas_pelanggan' && (
            <g>
              {/* Tali hoodie */}
              <path d="M 126,230 Q 160,256 194,230" fill="none" stroke={palet.kerah} strokeWidth="8" strokeLinecap="round" />
              <line x1="145" y1="246" x2="145" y2="288" stroke="#FFFDF5" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="175" y1="246" x2="175" y2="288" stroke="#FFFDF5" strokeWidth="4.5" strokeLinecap="round" />
            </g>
          )}
          {tokoh === 'pak_tetangga' && (
            <g>
              {/* Kerah baju koko & kancing */}
              <path d="M 135,226 L 160,255 L 185,226" fill="none" stroke={palet.kerah} strokeWidth="6" strokeLinejoin="round" />
              <line x1="160" y1="255" x2="160" y2="335" stroke={palet.kerah} strokeWidth="4" />
              <circle cx="160" cy="272" r="3.5" fill={OUTLINE} />
              <circle cx="160" cy="296" r="3.5" fill={OUTLINE} />
              <circle cx="160" cy="320" r="3.5" fill={OUTLINE} />
            </g>
          )}
          {tokoh === 'mbak_pelanggan' && (
            <path
              d="M 102,226 Q 160,278 218,226 L 206,200 L 114,200 Z"
              fill={palet.rambut}
              stroke={OUTLINE}
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
          )}

          {/* Leher */}
          <rect x="142" y="198" width="36" height="36" rx="12" fill={palet.kulitBayang} stroke={OUTLINE} strokeWidth="4.5" />

          {/* Kepala */}
          <g transform={`rotate(${goyangRot * 0.5}, 160, 145)`}>
            {/* Telinga (untuk non-hijab) */}
            {tokoh !== 'mbak_pelanggan' && (
              <>
                <circle cx="96" cy="148" r="14" fill={palet.kulitBayang} stroke={OUTLINE} strokeWidth="4.5" />
                <circle cx="224" cy="148" r="14" fill={palet.kulitBayang} stroke={OUTLINE} strokeWidth="4.5" />
              </>
            )}

            {/* Lingkaran Wajah */}
            <rect x="98" y="76" width="124" height="132" rx="58" fill={palet.kulit} stroke={OUTLINE} strokeWidth="5" />
            {/* Rona pipi hangat */}
            <ellipse cx="122" cy="160" rx="12" ry="7" fill="#FF758F" opacity={ekspresi === 'malu' ? 0.55 : 0.25} />
            <ellipse cx="198" cy="160" rx="12" ry="7" fill="#FF758F" opacity={ekspresi === 'malu' ? 0.55 : 0.25} />

            {/* Rambut / Hijab / Kopiah */}
            {tokoh === 'mas_barista' && (
              <path
                d="M 94,132 C 92,70 128,48 166,52 C 204,54 228,82 224,130 C 212,102 186,92 152,96 C 122,99 108,112 94,132 Z"
                fill={palet.rambut}
                stroke={OUTLINE}
                strokeWidth="5"
                strokeLinejoin="round"
              />
            )}
            {tokoh === 'mas_pelanggan' && (
              <path
                d="M 95,126 C 95,64 134,48 164,54 C 200,52 228,74 225,126 C 210,104 185,104 168,112 C 148,100 116,105 95,126 Z"
                fill={palet.rambut}
                stroke={OUTLINE}
                strokeWidth="5"
                strokeLinejoin="round"
              />
            )}
            {tokoh === 'mbak_pelanggan' && (
              <path
                d="M 90,145 C 88,68 125,52 160,52 C 195,52 232,68 230,145 C 228,176 218,200 202,208 C 215,170 212,115 160,104 C 108,115 105,170 118,208 C 102,200 92,176 90,145 Z"
                fill={palet.rambut}
                stroke={OUTLINE}
                strokeWidth="5"
                strokeLinejoin="round"
              />
            )}
            {tokoh === 'pak_tetangga' && (
              <g>
                <path
                  d="M 98,125 C 104,90 125,84 160,84 C 195,84 216,90 222,125"
                  fill="none"
                  stroke={palet.rambut}
                  strokeWidth="12"
                />
                {/* Kopiah Hitam Rapi */}
                <path
                  d="M 104,98 L 112,50 C 120,44 200,44 208,50 L 216,98 C 190,104 130,104 104,98 Z"
                  fill="#1C1917"
                  stroke={OUTLINE}
                  strokeWidth="5"
                  strokeLinejoin="round"
                />
              </g>
            )}

            {/* Alis sesuai ekspresi */}
            {ekspresi === 'cemberut' ? (
              <>
                <line x1="120" y1="118" x2="144" y2="126" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
                <line x1="200" y1="118" x2="176" y2="126" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
              </>
            ) : ekspresi === 'kaget' ? (
              <>
                <path d="M 118,115 Q 132,104 146,115" fill="none" stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" />
                <path d="M 174,115 Q 188,104 202,115" fill="none" stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" />
              </>
            ) : ekspresi === 'mikir' ? (
              <>
                <path d="M 118,122 Q 132,118 145,122" fill="none" stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" />
                <path d="M 174,116 Q 188,107 202,116" fill="none" stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" />
              </>
            ) : (
              <>
                <path d="M 118,122 Q 132,115 145,121" fill="none" stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" />
                <path d="M 175,121 Q 188,115 202,122" fill="none" stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" />
              </>
            )}

            {/* Mata */}
            {sedangKedip || ekspresi === 'ngantuk' ? (
              <>
                <path d="M 121,142 Q 134,149 147,142" fill="none" stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" />
                <path d="M 173,142 Q 186,149 199,142" fill="none" stroke={OUTLINE} strokeWidth="4.5" strokeLinecap="round" />
              </>
            ) : ekspresi === 'ketawa' || ekspresi === 'bangga' ? (
              <>
                <path d="M 121,144 Q 134,131 147,144" fill="none" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
                <path d="M 173,144 Q 186,131 199,144" fill="none" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
              </>
            ) : (
              <>
                <ellipse cx="134" cy="142" rx="10" ry={ekspresi === 'kaget' ? 14 : 11} fill="#FFF" stroke={OUTLINE} strokeWidth="3.5" />
                <ellipse cx="186" cy="142" rx="10" ry={ekspresi === 'kaget' ? 14 : 11} fill="#FFF" stroke={OUTLINE} strokeWidth="3.5" />
                <circle cx={ekspresi === 'mikir' ? 137 : 135} cy={ekspresi === 'mikir' ? 139 : 142} r={ekspresi === 'kaget' ? 5 : 6.5} fill="#1E1B18" />
                <circle cx={ekspresi === 'mikir' ? 189 : 187} cy={ekspresi === 'mikir' ? 139 : 142} r={ekspresi === 'kaget' ? 5 : 6.5} fill="#1E1B18" />
                <circle cx="132" cy="139" r="2.2" fill="#FFF" />
                <circle cx="184" cy="139" r="2.2" fill="#FFF" />
              </>
            )}

            {/* Hidung Kartun */}
            <path d="M 159,146 Q 165,156 156,160" fill="none" stroke={OUTLINE} strokeWidth="3.5" strokeLinecap="round" />

            {/* Kumis Pak Budi */}
            {tokoh === 'pak_tetangga' && (
              <path
                d="M 142,167 Q 160,159 178,167 Q 168,173 160,169 Q 152,173 142,167 Z"
                fill="#2F2B28"
                stroke={OUTLINE}
                strokeWidth="2.5"
              />
            )}

            {/* Mulut Lip-Sync & Ekspresi */}
            {bentukMulut === 2 ? (
              <ellipse cx="160" cy="180" rx="15" ry="11" fill="#991B1B" stroke={OUTLINE} strokeWidth="3.5" />
            ) : bentukMulut === 1 ? (
              <path
                d="M 145,177 Q 160,188 175,177 Z"
                fill="#B91C1C"
                stroke={OUTLINE}
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
            ) : ekspresi === 'ketawa' ? (
              <path d="M 142,174 Q 160,196 178,174 Z" fill="#FFF" stroke={OUTLINE} strokeWidth="3.5" strokeLinejoin="round" />
            ) : ekspresi === 'kaget' ? (
              <circle cx="160" cy="181" r="9" fill="#991B1B" stroke={OUTLINE} strokeWidth="3.5" />
            ) : ekspresi === 'cemberut' ? (
              <path d="M 146,184 Q 160,175 174,184" fill="none" stroke={OUTLINE} strokeWidth="4" strokeLinecap="round" />
            ) : ekspresi === 'mikir' ? (
              <line x1="149" y1="180" x2="169" y2="178" stroke={OUTLINE} strokeWidth="4" strokeLinecap="round" />
            ) : (
              <path d="M 144,175 Q 160,189 176,175" fill="none" stroke={OUTLINE} strokeWidth="4.2" strokeLinecap="round" />
            )}
          </g>

          {/* Properti di tangan */}
          <PropertiTangan properti={properti} frame={frame} balikX={balikX} />
        </g>

        <EfekReaksiKomik efek={efek} frame={frame} fps={fps} balikX={balikX} />
      </g>
    </svg>
  );
};
