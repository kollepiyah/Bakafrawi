// Preset "story-drop" (referensi Aurelia Cafe / @samhoyaai):
// 1) Bagian atas: UI Instagram dark mode dengan baris Story berisi foto menu asli merek.
// 2) Bagian bawah: Feed foto meja kafe hangat kosong (latarMeja AI atau gradien kayu hangat).
// 3) Satu per satu, menu melompat keluar dari lingkaran Story di atas dengan kurva parabola 3D,
//    membesar sesuai perspektif, lalu mendarat halus di atas meja dengan bayangan realistis
//    hingga meja penuh hidangan estetik (±9 detik total).
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont as cormorant } from '@remotion/google-fonts/CormorantGaramond';
import { SANS, SERIF } from './components/dasar';
import type { PropsSinematik, SegmenSinematik } from './Sinematik';

const FPS = 30;
const SERIF_JUDUL = cormorant('normal', { weights: ['600', '700'], subsets: ['latin'] }).fontFamily;

const JEDA_AWAL = 20; // ~0.67 dtk meja kosong
const INTERVAL_DROP = 40; // ~1.33 dtk antar-menu
const DURASI_TERBANG = 22; // ~0.73 dtk fase melayang parabola
const TAHAN_AKHIR = 48; // ~1.6 dtk showcase meja penuh
const MAKS_ITEM = 5;

// Koordinat pendaratan 5 menu di atas meja (persis komposisi Aurelia Cafe: tengah belakang, kiri, depan kiri, depan kanan, kanan belakang).
const SLOT_MEJA: { x: number; y: number; ukuran: number; z: number; miringAwal: number }[] = [
  { x: 540, y: 1215, ukuran: 360, z: 20, miringAwal: -10 }, // #1 Tengah hero (kopi utama)
  { x: 255, y: 1295, ukuran: 310, z: 25, miringAwal: 12 }, // #2 Kiri tengah
  { x: 350, y: 1515, ukuran: 340, z: 40, miringAwal: -14 }, // #3 Kiri depan
  { x: 755, y: 1495, ukuran: 355, z: 45, miringAwal: 11 }, // #4 Kanan depan
  { x: 820, y: 1265, ukuran: 300, z: 22, miringAwal: -8 }, // #5 Kanan belakang
];

// Geometri UI Instagram di bagian atas (1080x1920)
const TINGGI_HEADER_IG = 445;
const TRAY_TOP = 128;
const TRAY_KIRI = 34;
const UKURAN_STORY = 156;
const JARAK_STORY = 26;
const LANGKAH_STORY = UKURAN_STORY + JARAK_STORY; // 182px

const itemValid = (p: PropsSinematik) =>
  p.segmen.filter((s) => String(s.berkas ?? '').trim().length > 0 || String(s.teksLayar ?? '').trim().length > 0).slice(0, MAKS_ITEM);

export function hitungDurasiStoryDrop(p: PropsSinematik) {
  const item = itemValid(p);
  const jumlah = Math.max(1, item.length);
  const jadwal = item.map((_, i) => ({
    mulai: JEDA_AWAL + i * INTERVAL_DROP,
    durasi: INTERVAL_DROP,
  }));
  const total = JEDA_AWAL + jumlah * INTERVAL_DROP + TAHAN_AKHIR;
  return { jadwal, penutupMulai: total, penutupDurasi: 0, total };
}

/** "Kopi | Es Kopi Susu Lek" → label pendek untuk bawah lingkaran Story (maks ~12 huruf). */
function labelSingkat(teks: string | undefined, indeks: number) {
  const bagian = String(teks ?? '')
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
  const mentah = bagian.length >= 2 ? bagian[1] : bagian[0] || `Menu ${indeks + 1}`;
  const kata = mentah.split(/\s+/);
  if (mentah.length <= 13) return mentah;
  return kata.slice(0, 2).join(' ').slice(0, 13);
}

function handleInstagram(nama: string) {
  const rendah = nama.toLowerCase();
  if (rendah.includes('lek kopi')) return 'lekkopi.id';
  if (rendah.includes('bakafrawi')) return 'bakafrawi.project';
  return rendah.replace(/[^a-z0-9]+/g, '') || 'lekkopi.id';
}

const IkonPlus: React.FC = () => (
  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#F5F5F5" strokeWidth="2.1" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IkonHati: React.FC = () => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#F5F5F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
    </svg>
    <div style={{ position: 'absolute', top: 0, right: -2, width: 12, height: 12, borderRadius: 12, background: '#FF3040', border: '2px solid #0B0B0D' }} />
  </div>
);

const IkonTitikTiga: React.FC = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="#E5E5E5">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);

/** Satu objek menu yang melompat keluar dari lingkaran Story lalu mendarat di atas meja. */
const MenuTerbang: React.FC<{
  item: SegmenSinematik;
  indeks: number;
  mulaiFrame: number;
}> = ({ item, indeks, mulaiFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < mulaiFrame) return null;

  const t = frame - mulaiFrame;
  const slot = SLOT_MEJA[indeks % SLOT_MEJA.length];
  const pakaiTransparan = Boolean(item.berkasTransparan);
  const sumber = item.berkasTransparan || item.berkas;

  // Titik awal selalu di lingkaran Story pertama sebelah kanan "Your story" (karena tray bergeser ke kiri!).
  const asalX = TRAY_KIRI + LANGKAH_STORY + UKURAN_STORY / 2;
  const asalY = TRAY_TOP + UKURAN_STORY / 2;

  const p = interpolate(t, [0, DURASI_TERBANG], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 0.85, 0.3, 1),
  });

  // Kurva parabola: sedikit melambung ke samping & atas sebelum menukik mendarat.
  const busurY = -Math.sin(p * Math.PI) * 145;
  const busurX = Math.sin(p * Math.PI) * (slot.x > asalX ? 65 : -45);
  const posX = asalX + (slot.x - asalX) * p + busurX;
  const posY = asalY + (slot.y - asalY) * p + busurY;

  // Perspektif skala: kecil saat keluar dari Story → membesar → pantulan pegas halus saat menyentuh meja.
  const skalaTerbang = interpolate(p, [0, 0.72, 1], [0.34, 1.07, 1], { extrapolateRight: 'clamp' });
  const tMendarat = Math.max(0, t - DURASI_TERBANG);
  const pantul = t >= DURASI_TERBANG ? spring({ frame: tMendarat, fps, config: { damping: 11, stiffness: 220, mass: 0.7 } }) : 0;
  const squashY = t >= DURASI_TERBANG ? interpolate(pantul, [0, 0.45, 1], [0.92, 1.03, 1]) : 1;
  const squashX = t >= DURASI_TERBANG ? interpolate(pantul, [0, 0.45, 1], [1.06, 0.98, 1]) : 1;

  const rotasi = interpolate(p, [0, 0.55, 1], [slot.miringAwal, slot.miringAwal * -0.35, 0], { extrapolateRight: 'clamp' });
  const opasitas = interpolate(t, [0, 4], [0, 1], { extrapolateRight: 'clamp' });

  // Bayangan kontak di permukaan meja: muncul saat mulai mendekati meja, menajam saat mendarat.
  const opBayangan = interpolate(p, [0.25, 0.85, 1], [0, 0.32, 0.58], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const skalaBayangan = interpolate(p, [0.25, 1], [1.35, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Riak cahaya tipis tepat saat mendarat di meja.
  const opRiak = t >= DURASI_TERBANG ? interpolate(tMendarat, [0, 4, 16], [0, 0.42, 0], { extrapolateRight: 'clamp' }) : 0;
  const skalaRiak = t >= DURASI_TERBANG ? interpolate(tMendarat, [0, 16], [0.7, 1.38], { extrapolateRight: 'clamp' }) : 0.7;

  return (
    <>
      {/* Bayangan kontak realistis di dasar gelas pada permukaan meja */}
      <div
        style={{
          position: 'absolute',
          left: slot.x - slot.ukuran * 0.34,
          top: slot.y + slot.ukuran * 0.36,
          width: slot.ukuran * 0.68,
          height: slot.ukuran * 0.16,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(16,9,4,0.52) 0%, rgba(16,9,4,0.22) 50%, transparent 74%)',
          filter: 'blur(4px)',
          opacity: opBayangan,
          transform: `scale(${skalaBayangan})`,
          zIndex: slot.z - 2,
          pointerEvents: 'none',
        }}
      />

      {/* Riak pendaratan halus di atas meja */}
      {opRiak > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: slot.x - slot.ukuran * 0.36,
            top: slot.y + slot.ukuran * 0.34,
            width: slot.ukuran * 0.72,
            height: slot.ukuran * 0.18,
            borderRadius: '50%',
            border: '2px solid rgba(246, 224, 178, 0.75)',
            opacity: opRiak,
            transform: `scale(${skalaRiak})`,
            zIndex: slot.z - 1,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {/* Objek minuman (cutout transparan RMBG-1.4, atau kartu foto estetik jika cutout gagal) */}
      <div
        style={{
          position: 'absolute',
          left: posX - slot.ukuran / 2,
          top: posY - slot.ukuran / 2,
          width: slot.ukuran,
          height: slot.ukuran,
          opacity: opasitas,
          transform: `scale(${skalaTerbang * squashX}, ${skalaTerbang * squashY}) rotate(${rotasi}deg)`,
          transformOrigin: '50% 85%',
          zIndex: p < 0.96 ? 120 + indeks : slot.z,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        {sumber ? (
          pakaiTransparan ? (
            <Img
              src={staticFile(sumber)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center bottom',
                filter: 'drop-shadow(0 12px 18px rgba(15, 8, 3, 0.42)) contrast(1.03) saturate(1.06)',
              }}
            />
          ) : (
            <div
              style={{
                width: '82%',
                height: '92%',
                borderRadius: 28,
                padding: 8,
                background: 'linear-gradient(145deg, #FFFDF8 0%, #E8DCC7 100%)',
                boxShadow: '0 18px 28px -10px rgba(16, 9, 4, 0.55), inset 0 2px 4px rgba(255,255,255,0.85)',
                overflow: 'hidden',
              }}
            >
              <Img
                src={staticFile(sumber)}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 22,
                  objectFit: 'cover',
                }}
              />
            </div>
          )
        ) : null}
      </div>
    </>
  );
};

export const StoryDrop: React.FC<{ props: PropsSinematik }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const item = itemValid(props);
  const { total } = hitungDurasiStoryDrop(props);
  const handle = handleInstagram(props.merek.nama);

  // Zoom sangat lembut pada meja kafe di belakang agar terasa hidup.
  const zoomMeja = interpolate(frame, [0, total], [1.0, 1.04], { extrapolateRight: 'clamp' });

  // Berapa menu yang sudah melompat keluar dari Story tray → sisanya bergeser mulus ke kiri!
  const geserTray = item.reduce((acc, _, i) => {
    const mulai = JEDA_AWAL + i * INTERVAL_DROP;
    if (frame < mulai) return acc;
    const p = spring({ frame: frame - mulai, fps, config: { damping: 16, stiffness: 140 } });
    return acc + p * LANGKAH_STORY;
  }, 0);

  // Badge penutup minimalis di bagian bawah saat meja sudah penuh.
  const mulaiBadge = JEDA_AWAL + Math.max(1, item.length) * INTERVAL_DROP + 4;
  const opBadge = interpolate(frame, [mulaiBadge, mulaiBadge + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const yBadge = interpolate(frame, [mulaiBadge, mulaiBadge + 16], [24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#0B0B0D', overflow: 'hidden' }}>
      {/* ==================== BAGIAN BAWAH: FEED FOTO MEJA KAFE ==================== */}
      <div
        style={{
          position: 'absolute',
          top: TINGGI_HEADER_IG,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #2C1E15 0%, #4E3424 44%, #8E6E53 68%, #CBB398 100%)',
        }}
      >
        {props.latarMeja ? (
          <Img
            src={staticFile(props.latarMeja)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${zoomMeja})`,
              filter: 'contrast(1.04) saturate(1.06) brightness(0.95)',
            }}
          />
        ) : (
          /* Fallback meja marmer-kayu hangat bila gambar AI belum tersedia */
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoomMeja})` }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 50% 18%, rgba(255,214,153,0.28) 0%, rgba(44,27,16,0.92) 56%, #1D120B 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: -120,
                right: -120,
                bottom: -140,
                height: 820,
                borderRadius: '50% 50% 0 0 / 16% 16% 0 0',
                background: 'radial-gradient(ellipse at 50% 25%, #EFE5D6 0%, #D9C4AA 55%, #B79C7E 100%)',
                boxShadow: 'inset 0 18px 40px rgba(255,255,255,0.45), 0 -24px 60px rgba(0,0,0,0.55)',
              }}
            />
          </div>
        )}

        {/* Pencahayaan lembut di atas meja */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(11,11,13,0.28) 0%, transparent 18%, transparent 78%, rgba(12,8,5,0.48) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Table tent / kartu merek kecil di pinggir belakang kiri meja */}
        <div
          style={{
            position: 'absolute',
            left: 84,
            top: 560,
            width: 146,
            padding: '15px 12px',
            borderRadius: 12,
            background: 'linear-gradient(160deg, #FBF6EC 0%, #E7D9C2 100%)',
            boxShadow: '0 16px 28px -8px rgba(18,10,4,0.48)',
            transform: 'rotate(-2.5deg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            zIndex: 8,
          }}
        >
          {props.merek.logo ? (
            <Img src={staticFile(props.merek.logo)} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'contain' }} />
          ) : null}
          <div style={{ fontFamily: SERIF_JUDUL, fontWeight: 700, fontSize: 22, letterSpacing: 1, color: '#2B1B10', textAlign: 'center', lineHeight: 1.05 }}>
            {props.merek.nama.toUpperCase()}
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 11, letterSpacing: 2.2, color: '#7A5B3E', textTransform: 'uppercase' }}>
            MENU HARI INI
          </div>
        </div>
      </div>

      {/* ==================== BAGIAN ATAS: UI INSTAGRAM OTENTIK ==================== */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: TINGGI_HEADER_IG,
          background: '#0B0B0D',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          zIndex: 40,
        }}
      >
        {/* Top bar Instagram */}
        <div
          style={{
            position: 'absolute',
            top: 34,
            left: 38,
            right: 38,
            height: 68,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <IkonPlus />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontWeight: 700,
                fontSize: 52,
                letterSpacing: -1,
                color: '#FFFFFF',
                lineHeight: 1,
              }}
            >
              Instagram
            </span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6l6 -6" />
            </svg>
          </div>
          <IkonHati />
        </div>

        {/* Baris Story Tray */}
        <div
          style={{
            position: 'absolute',
            top: TRAY_TOP,
            left: TRAY_KIRI,
            right: 0,
            height: 214,
            overflow: 'hidden',
          }}
        >
          {/* Lingkaran #0 tetap: Your story (logo merek) */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: UKURAN_STORY,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 10,
              background: '#0B0B0D',
              paddingRight: 10,
            }}
          >
            <div
              style={{
                width: UKURAN_STORY,
                height: UKURAN_STORY,
                borderRadius: UKURAN_STORY,
                background: '#F4ECDC',
                border: '3px solid rgba(255,255,255,0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {props.merek.logo ? (
                <Img src={staticFile(props.merek.logo)} style={{ width: 110, height: 110, objectFit: 'contain', borderRadius: 20 }} />
              ) : (
                <span style={{ fontFamily: SERIF_JUDUL, fontWeight: 700, fontSize: 34, color: '#2B1B10' }}>{props.merek.nama.slice(0, 3)}</span>
              )}
              <div
                style={{
                  position: 'absolute',
                  right: 4,
                  bottom: 4,
                  width: 40,
                  height: 40,
                  borderRadius: 40,
                  background: '#FFFFFF',
                  border: '4px solid #0B0B0D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0B0B0D',
                  fontSize: 28,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                +
              </div>
            </div>
            <div style={{ marginTop: 10, fontFamily: SANS, fontSize: 24, color: '#D4D4D8', fontWeight: 500 }}>Your story</div>
          </div>

          {/* Lingkaran Story Menu (bergeser mulus ke kiri saat satu per satu melompat keluar!) */}
          <div
            style={{
              position: 'absolute',
              left: LANGKAH_STORY,
              top: 0,
              right: 0,
              height: 214,
              overflow: 'hidden',
            }}
          >
            {item.map((s, i) => {
              const mulai = JEDA_AWAL + i * INTERVAL_DROP;
              const hilang = frame >= mulai ? interpolate(frame, [mulai, mulai + 7], [1, 0], { extrapolateRight: 'clamp' }) : 1;
              const skalaLingkar = frame >= mulai ? interpolate(frame, [mulai, mulai + 7], [1, 0.5], { extrapolateRight: 'clamp' }) : 1;
              const x = i * LANGKAH_STORY - geserTray;

              if (hilang <= 0.01) return null;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: 0,
                    width: UKURAN_STORY,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    opacity: hilang,
                    transform: `scale(${skalaLingkar})`,
                  }}
                >
                  <div
                    style={{
                      width: UKURAN_STORY,
                      height: UKURAN_STORY,
                      borderRadius: UKURAN_STORY,
                      padding: 5,
                      background: 'linear-gradient(45deg, #FCAF45 0%, #F77737 25%, #E1306C 58%, #833AB4 100%)',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: UKURAN_STORY,
                        padding: 4,
                        background: '#0B0B0D',
                        overflow: 'hidden',
                      }}
                    >
                      {s.berkas ? (
                        <Img
                          src={staticFile(s.berkas)}
                          style={{ width: '100%', height: '100%', borderRadius: UKURAN_STORY, objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', borderRadius: UKURAN_STORY, background: '#3A2616' }} />
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontFamily: SANS,
                      fontSize: 23,
                      color: '#F4F4F5',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: UKURAN_STORY + 10,
                    }}
                  >
                    {labelSingkat(s.teksLayar, i)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Baris Header Postingan Feed (@lekkopi.id) */}
        <div
          style={{
            position: 'absolute',
            left: 34,
            right: 34,
            bottom: 18,
            height: 68,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 58,
                background: '#F4ECDC',
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {props.merek.logo ? (
                <Img src={staticFile(props.merek.logo)} style={{ width: 42, height: 42, objectFit: 'contain' }} />
              ) : null}
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 28, color: '#FFFFFF', letterSpacing: -0.2 }}>
              {handle}
            </div>
          </div>
          <IkonTitikTiga />
        </div>
      </div>

      {/* ==================== LAPISAN MENU MELOMPAT & MENDARAT ==================== */}
      {item.map((s, i) => (
        <MenuTerbang key={i} item={s} indeks={i} mulaiFrame={JEDA_AWAL + i * INTERVAL_DROP} />
      ))}

      {/* ==================== BADGE AJAKAN HALUS DI AKHIR ==================== */}
      {opBadge > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 60,
            right: 60,
            bottom: 72,
            display: 'flex',
            justifyContent: 'center',
            opacity: opBadge,
            transform: `translateY(${yBadge}px)`,
            zIndex: 200,
          }}
        >
          <div
            style={{
              padding: '18px 34px',
              borderRadius: 999,
              background: 'rgba(18, 13, 9, 0.78)',
              border: '1.5px solid rgba(227, 201, 137, 0.45)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 20px 40px -12px rgba(0,0,0,0.75)',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 10, background: '#E3C989' }} />
            <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26, color: '#FFFBF2', letterSpacing: 0.2 }}>
              {props.penutup?.ajakan || `Mampir ngopi di ${props.merek.nama}`}
            </span>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
