import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

/**
 * Latar SVG kartun 2D bawaan khas Lek Kopi (Panjunan, Waru, Sidoarjo).
 * Dipakai otomatis apabila foto asli tempat Lek Kopi belum diunggah di Studio.
 */
export const LatarKartunBawaan: React.FC<{ kode?: string }> = ({ kode = 'outdoor' }) => {
  const frame = useCurrentFrame();
  const k = kode.toLowerCase();
  const kedipBohlam = 0.88 + Math.sin(frame * 0.14) * 0.12;
  const uap = (frame * 0.7) % 28;

  if (k === 'bar') {
    return (
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #3B281E 0%, #5B3E2B 52%, #2B1D14 100%)' }}>
        <svg viewBox="0 0 1080 1920" style={{ width: '100%', height: '100%' }}>
          {/* Dinding kayu hangat */}
          <rect x="0" y="0" width="1080" height="1220" fill="#4A3224" />
          {[180, 360, 540, 720, 900].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="1220" stroke="#362217" strokeWidth="4" opacity="0.5" />
          ))}
          {/* Papan menu kapur Lek Kopi */}
          <rect x="130" y="250" width="820" height="390" rx="22" fill="#1F2421" stroke="#D9A441" strokeWidth="10" />
          <text x="540" y="345" textAnchor="middle" fontSize="54" fontWeight="900" fill="#F3D58D" letterSpacing="4">
            LEK KOPI MENU
          </text>
          <line x1="250" y1="375" x2="830" y2="375" stroke="#D9A441" strokeWidth="4" opacity="0.6" />
          <text x="200" y="450" fontSize="34" fontWeight="700" fill="#F8FAFC">Kopi Lek · · · · · · · · · · Rp10K</text>
          <text x="200" y="515" fontSize="34" fontWeight="700" fill="#FFD8A8">Butterscoth Latte · · · · Rp14K</text>
          <text x="200" y="580" fontSize="34" fontWeight="700" fill="#A7F3D0">Matcha Latte · · · · · · · Rp14K</text>

          {/* Lampu gantung hangat */}
          {[280, 540, 800].map((x, idx) => (
            <g key={x}>
              <line x1={x} y1="0" x2={x} y2="165" stroke="#1E1510" strokeWidth="6" />
              <circle cx={x} cy="215" r="78" fill="#FFD43B" opacity={0.18 * kedipBohlam} />
              <path d={`M ${x - 42},195 L ${x + 42},195 L ${x + 22},160 L ${x - 22},160 Z`} fill="#241913" stroke="#111" strokeWidth="4" />
              <circle cx={x} cy="200" r="14" fill={idx % 2 === 0 ? '#FFE066' : '#FFD43B'} />
            </g>
          ))}

          {/* Rak botol sirup & toples biji kopi */}
          <rect x="140" y="810" width="800" height="22" rx="8" fill="#8C5A3C" stroke="#2B1D14" strokeWidth="5" />
          {[210, 290, 370, 740, 830].map((x, i) => (
            <g key={x}>
              <rect
                x={x}
                y="700"
                width="48"
                height="110"
                rx="10"
                fill={['#F59F00', '#F06595', '#18B4A8', '#7950F2', '#51CF66'][i]}
                stroke="#2B1D14"
                strokeWidth="4"
              />
              <rect x={x + 14} y="675" width="20" height="25" rx="4" fill="#F8FAFC" stroke="#2B1D14" strokeWidth="3.5" />
            </g>
          ))}

          {/* Mesin Espresso */}
          <rect x="440" y="895" width="260" height="235" rx="18" fill="#CBD5E1" stroke="#2B1D14" strokeWidth="6" />
          <rect x="465" y="925" width="210" height="58" rx="10" fill="#334155" stroke="#2B1D14" strokeWidth="4" />
          <circle cx="515" cy="954" r="10" fill="#34E0CD" />
          <circle cx="555" cy="954" r="10" fill="#F59F00" />
          <rect x="495" y="1015" width="42" height="28" rx="6" fill="#1E293B" />
          <rect x="605" y="1015" width="42" height="28" rx="6" fill="#1E293B" />

          {/* Meja Bar Depan */}
          <rect x="0" y="1120" width="1080" height="80" fill="#A66E4E" stroke="#2B1D14" strokeWidth="6" />
          <rect x="0" y="1200" width="1080" height="720" fill="#2A1F18" />
          {/* Panel kayu bar */}
          {[140, 280, 420, 560, 700, 840, 980].map((x) => (
            <line key={x} x1={x} y1="1200" x2={x} y2="1920" stroke="#1B130E" strokeWidth="6" />
          ))}
        </svg>
      </AbsoluteFill>
    );
  }

  if (k === 'meja') {
    return (
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #FFE8CC 0%, #F4C07A 45%, #8C5A3C 100%)' }}>
        <svg viewBox="0 0 1080 1920" style={{ width: '100%', height: '100%' }}>
          {/* Jendela kedai hangat */}
          <rect x="90" y="210" width="900" height="760" rx="34" fill="#FFF3BF" stroke="#4A3224" strokeWidth="14" />
          <circle cx="240" cy="400" r="110" fill="#FFD43B" opacity="0.35" />
          <circle cx="820" cy="450" r="140" fill="#FFA94D" opacity="0.28" />
          {/* Meja kayu close-up */}
          <rect x="0" y="960" width="1080" height="960" fill="#B87A50" stroke="#2B1D14" strokeWidth="8" />
          <line x1="0" y1="1120" x2="1080" y2="1120" stroke="#8C5A3C" strokeWidth="6" />
          <line x1="0" y1="1380" x2="1080" y2="1380" stroke="#8C5A3C" strokeWidth="6" />
          {/* Gelas kopi dekoratif di meja */}
          <g transform="translate(830, 930)">
            <polygon points="-50,-110 50,-110 38,40 -38,40" fill="#E6B88A" stroke="#2B1D14" strokeWidth="6" />
            <polygon points="-44,-35 44,-35 38,40 -38,40" fill="#6F4E37" />
            <line x1="12" y1="-110" x2="26" y2="-175" stroke="#18B4A8" strokeWidth="10" strokeLinecap="round" />
          </g>
          {/* Uap hangat di sisi kiri */}
          <path
            d={`M 230,${860 - uap} Q 200,${800 - uap} 235,${740 - uap}`}
            fill="none"
            stroke="#FFFDF5"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.65"
          />
        </svg>
      </AbsoluteFill>
    );
  }

  if (k === 'depan') {
    return (
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #FF9E6D 0%, #FFD494 42%, #475569 100%)' }}>
        <svg viewBox="0 0 1080 1920" style={{ width: '100%', height: '100%' }}>
          {/* Langit senja ceria Panjunan */}
          <circle cx="840" cy="360" r="140" fill="#FFE066" opacity="0.65" />
          {/* Bangunan Kedai Lek Kopi */}
          <rect x="85" y="420" width="910" height="820" rx="22" fill="#3B2B22" stroke="#2B1D14" strokeWidth="8" />
          {/* Kanopi bergaris */}
          <path d="M 55,440 L 1025,440 L 1055,585 L 25,585 Z" fill="#18B4A8" stroke="#2B1D14" strokeWidth="7" />
          {[140, 320, 500, 680, 860].map((x) => (
            <rect key={x} x={x} y="445" width="75" height="136" fill="#FFFDF5" opacity="0.9" />
          ))}
          {/* Papan kotak hitam logo Lek Kopi */}
          <rect x="330" y="250" width="420" height="165" rx="20" fill="#141210" stroke="#D9A441" strokeWidth="7" />
          <text x="540" y="340" textAnchor="middle" fontSize="64" fontWeight="900" fill="#FFFDF5">
            Lek Kopi
          </text>
          <text x="540" y="388" textAnchor="middle" fontSize="24" fontWeight="700" fill="#D9A441" letterSpacing="4">
            EST. 2025 · PANJUNAN
          </text>
          {/* Jendela kaca hangat */}
          <rect x="160" y="650" width="760" height="420" rx="18" fill="#FFE8A3" stroke="#2B1D14" strokeWidth="8" />
          {/* Jalan paving */}
          <rect x="0" y="1220" width="1080" height="700" fill="#64748B" stroke="#2B1D14" strokeWidth="6" />
          {[1320, 1450, 1600, 1760].map((y) => (
            <line key={y} x1="0" y1={y} x2="1080" y2={y} stroke="#475569" strokeWidth="4" />
          ))}
        </svg>
      </AbsoluteFill>
    );
  }

  // Default: Outdoor Paving Hangat Sore/Malam Lek Kopi
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #273755 0%, #5F5478 36%, #F2A66E 72%, #5A6270 100%)' }}>
      <svg viewBox="0 0 1080 1920" style={{ width: '100%', height: '100%' }}>
        {/* Bulan & bintang lembut */}
        <circle cx="885" cy="255" r="46" fill="#FFF3BF" opacity="0.9" />
        <circle cx="902" cy="246" r="40" fill="#344162" />
        {/* Kanopi & rangka kedai */}
        <rect x="0" y="640" width="1080" height="580" fill="#3B2920" stroke="#2B1D14" strokeWidth="6" />
        <rect x="110" y="720" width="520" height="390" rx="18" fill="#FFD8A8" stroke="#2B1D14" strokeWidth="7" />
        {/* Untaian lampu bohlam gantung outdoor */}
        <path d="M 0,480 Q 540,620 1080,480" fill="none" stroke="#1E1510" strokeWidth="6" />
        {[120, 290, 460, 630, 800, 960].map((x, idx) => {
          const y = 492 + Math.sin(((idx + 1) / 7) * Math.PI) * 62;
          return (
            <g key={x}>
              <circle cx={x} cy={y + 22} r="44" fill="#FFE066" opacity={0.22 * kedipBohlam} />
              <circle cx={x} cy={y + 20} r="14" fill="#FFF3BF" stroke="#2B1D14" strokeWidth="3.5" />
            </g>
          );
        })}
        {/* Tanaman pot sudut kedai */}
        <ellipse cx="955" cy="1095" rx="68" ry="86" fill="#2B8A3E" stroke="#2B1D14" strokeWidth="5" />
        <polygon points="905,1140 1005,1140 990,1245 920,1245" fill="#B87A50" stroke="#2B1D14" strokeWidth="5" />
        {/* Lantai paving outdoor */}
        <rect x="0" y="1220" width="1080" height="700" fill="#6E7889" stroke="#2B1D14" strokeWidth="6" />
        {[1340, 1480, 1640, 1810].map((y) => (
          <line key={y} x1="0" y1={y} x2="1080" y2={y} stroke="#555F70" strokeWidth="4" />
        ))}
        {/* Meja & kursi kayu outdoor */}
        <rect x="330" y="1360" width="420" height="32" rx="10" fill="#C68958" stroke="#2B1D14" strokeWidth="6" />
        <rect x="370" y="1392" width="24" height="170" fill="#4A3224" stroke="#2B1D14" strokeWidth="4" />
        <rect x="686" y="1392" width="24" height="170" fill="#4A3224" stroke="#2B1D14" strokeWidth="4" />
      </svg>
    </AbsoluteFill>
  );
};
