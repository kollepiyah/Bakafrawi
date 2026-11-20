// Preset "dial-menu" (referensi Happy Cake "Dial a slice"):
// 1) Layar krem berisi keypad telepon — angka berganti foto menu satu per satu, lalu tombol hijau "ditekan".
// 2) Potongan foto/video menu layar penuh, tiap potongan bernomor sesuai tombol keypad + keterangan serif.
// 3) Kartu penutup krem singkat berisi ajakan & info kedai.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as cormorant } from '@remotion/google-fonts/CormorantGaramond';
import { SANS, SERIF } from './components/dasar';
import type { PropsSinematik, SegmenSinematik } from './Sinematik';

const FPS = 30;
const SERIF_TEGAK = cormorant('normal', { weights: ['500', '600', '700'], subsets: ['latin'] }).fontFamily;

export const INTRO_DIAL = 3 * FPS;
const PENUTUP_DIAL = Math.round(1.6 * FPS);
const MAKS_ITEM = 8;

const TOMBOL = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const HURUF: Record<string, string> = { '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ' };
// Tombol diisi foto menu secara berurutan 1, 2, 3, 4, 5, 6, ... agar nomor tidak loncat.
const URUTAN_FOTO = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Hanya ambil segmen yang punya teks menu valid (cegah "Menu Pilihan 7" atau logo tersesat). */
const itemValid = (p: PropsSinematik) =>
  p.segmen.filter((s) => String(s.teksLayar ?? '').trim().length > 0).slice(0, MAKS_ITEM);

export function hitungDurasiDial(p: PropsSinematik) {
  const item = itemValid(p);
  let mulai = INTRO_DIAL;
  const jadwal = item.map((s) => {
    const durasi = Math.min(66, Math.max(48, Math.round((Number(s.durasi) || 1.8) * FPS)));
    const j = { mulai, durasi };
    mulai += durasi;
    return j;
  });
  const penutupDurasi = p.penutup ? PENUTUP_DIAL : 0;
  return { jadwal, penutupMulai: mulai, penutupDurasi, total: Math.max(INTRO_DIAL + FPS, mulai + penutupDurasi) };
}

/** "Kopi | Es Kopi Susu Lek" → { label: 'Kopi “Es Kopi Susu Lek”' }; cegah dobel "Milkshake “Milkshake Banana”". */
function formatJudulMenu(teks: string | undefined, indeks: number) {
  const bagian = String(teks ?? '').split('|').map((x) => x.trim()).filter(Boolean);
  if (bagian.length >= 2) {
    const [jenis, nama] = bagian;
    if (nama.toLowerCase().includes(jenis.toLowerCase())) return `“${nama}”`;
    return `${jenis} “${nama}”`;
  }
  if (bagian.length === 1) return `“${bagian[0]}”`;
  return `Menu #${indeks + 1}`;
}

const Media: React.FC<{ s: SegmenSinematik; gayaBox?: React.CSSProperties }> = ({ s, gayaBox }) => {
  if (!s.berkas) return <div style={{ background: '#2A1D14', ...gayaBox }} />;
  if (s.jenis === 'video') {
    return (
      <OffthreadVideo
        src={staticFile(s.berkas)}
        startFrom={Math.max(0, Math.round((Number(s.mulaiKlip) || 0) * FPS))}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', ...gayaBox }}
      />
    );
  }
  return <Img src={staticFile(s.berkas)} style={{ width: '100%', height: '100%', objectFit: 'cover', ...gayaBox }} />;
};

const UKURAN = 176;
const JARAK = 40;
const KISI_ATAS = 585;

const Keypad: React.FC<{ item: SegmenSinematik[]; merek: PropsSinematik['merek'] }> = ({ item, merek }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Peta tombol → indeks item yang tampil di tombol itu.
  const peta = new Map<string, number>();
  item.forEach((_, i) => { if (URUTAN_FOTO[i]) peta.set(URUTAN_FOTO[i], i); });

  const masukHeader = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const tekan = interpolate(frame, [64, 70, 78], [1, 0.9, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const keluar = interpolate(frame, [INTRO_DIAL - 9, INTRO_DIAL], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const zoomKeluar = interpolate(frame, [INTRO_DIAL - 9, INTRO_DIAL], [1, 1.07], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 50% 28%, #FBF7EC 0%, #F3EBD8 62%, #EBE0C8 100%)',
        opacity: keluar,
        transform: `scale(${zoomKeluar})`,
      }}
    >
      {/* Kepala merek */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, top: 205, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          opacity: masukHeader, transform: `translateY(${(1 - masukHeader) * -30}px)`,
        }}
      >
        {merek.logo ? <Img src={staticFile(merek.logo)} style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 26 }} /> : null}
        <div style={{ fontFamily: SERIF_TEGAK, fontWeight: 700, fontSize: 104, lineHeight: 1, letterSpacing: -2, color: '#3A2616' }}>{merek.nama}</div>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 60, color: '#6B4B30', marginTop: 4 }}>Dial a cup</div>
      </div>

      {/* Papan tombol */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, top: KISI_ATAS, display: 'grid',
          gridTemplateColumns: `repeat(3, ${UKURAN}px)`, gap: JARAK, justifyContent: 'center',
        }}
      >
        {TOMBOL.map((t, k) => {
          const idx = peta.get(t);
          const mulai = 12 + (idx ?? 0) * 7;
          const p = idx === undefined ? 1 : spring({ frame: frame - mulai, fps, config: { damping: 13, stiffness: 150 } });
          const sudahFoto = idx !== undefined && frame >= mulai;
          return (
            <div
              key={k}
              style={{
                width: UKURAN, height: UKURAN, borderRadius: UKURAN, position: 'relative', overflow: 'hidden',
                background: '#FFFEFA', boxShadow: '0 14px 30px -12px rgba(58,38,22,0.28)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                transform: sudahFoto ? `scale(${0.6 + 0.4 * Math.min(1.12, p)})` : 'scale(1)',
              }}
            >
              {sudahFoto && idx !== undefined ? (
                <div style={{ position: 'absolute', inset: 0, opacity: Math.min(1, p) }}>
                  <Media s={item[idx]} />
                </div>
              ) : (
                <>
                  <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 68, color: '#2B1D12', lineHeight: 1 }}>{t}</div>
                  {HURUF[t] ? <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 18, letterSpacing: 3, color: '#8A7B6A', marginTop: 4 }}>{HURUF[t]}</div> : null}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Tombol telepon hijau */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, top: KISI_ATAS + 4 * UKURAN + 3 * JARAK + 58, display: 'flex', justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: UKURAN, height: UKURAN, borderRadius: UKURAN, background: '#34C759', display: 'grid', placeItems: 'center',
            boxShadow: '0 18px 36px -12px rgba(52,199,89,0.55)', transform: `scale(${tekan})`,
          }}
        >
          <svg width="76" height="76" viewBox="0 0 24 24" fill="#fff"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1L6.6 10.8z" /></svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PotonganMenu: React.FC<{ s: SegmenSinematik; nomor: string; indeks: number; durasi: number }> = ({ s, nomor, indeks, durasi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const label = formatJudulMenu(s.teksLayar, indeks);
  const zoom = interpolate(frame, [0, durasi], [1.04, 1.13], { extrapolateRight: 'clamp' });
  const masuk = spring({ frame, fps, config: { damping: 16, stiffness: 140 } });
  const tutup = interpolate(frame, [0, 5], [0.0, 1], { extrapolateRight: 'clamp' });
  const geser = interpolate(frame, [0, 10], [38, 0], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#1A110A', opacity: tutup }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, filter: 'contrast(1.05) saturate(1.1)' }}>
        <Media s={s} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(20,12,6,0.62) 0%, rgba(20,12,6,0.12) 26%, rgba(20,12,6,0) 55%, rgba(20,12,6,0.30) 100%)' }} />
      <div
        style={{
          position: 'absolute', left: 0, right: 0, top: 205, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
          opacity: masuk, transform: `translateY(${geser}px)`,
        }}
      >
        <div
          style={{
            width: 86, height: 86, borderRadius: 86, border: '2.5px solid rgba(255,255,255,0.92)', display: 'grid', placeItems: 'center',
            fontFamily: SANS, fontWeight: 500, fontSize: 38, color: '#fff', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(4px)',
          }}
        >
          {nomor}
        </div>
        <div style={{ fontFamily: SERIF_TEGAK, fontWeight: 600, fontSize: 62, lineHeight: 1.1, color: '#fff', textAlign: 'center', padding: '0 70px', textShadow: '0 4px 22px rgba(0,0,0,0.55)' }}>
          {label}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const KartuPenutup: React.FC<{ props: PropsSinematik; durasi: number }> = ({ props, durasi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16, stiffness: 130 } });
  const nadi = 1 + 0.06 * Math.sin((frame / fps) * Math.PI * 3);
  const { merek, penutup } = props;
  const keluarAkhir = interpolate(frame, [durasi - 6, durasi], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ajakan = penutup?.ajakan && !penutup.ajakan.includes('|') ? penutup.ajakan : 'Mampir ngopi, yuk';
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 50% 36%, #FBF7EC 0%, #F1E8D2 70%, #E8DCC2 100%)', opacity: Math.min(1, p) * keluarAkhir,
        justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 90px', gap: 26,
      }}
    >
      {merek.logo ? <Img src={staticFile(merek.logo)} style={{ width: 150, height: 150, objectFit: 'contain', borderRadius: 30 }} /> : null}
      <div style={{ fontFamily: SERIF_TEGAK, fontWeight: 700, fontSize: 104, lineHeight: 1, color: '#3A2616', letterSpacing: -2 }}>{merek.nama}</div>
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 62, color: '#6B4B30' }}>{ajakan}</div>
      <div style={{ width: 120, height: 120, borderRadius: 120, background: '#34C759', display: 'grid', placeItems: 'center', transform: `scale(${nadi})`, boxShadow: '0 16px 34px -10px rgba(52,199,89,0.55)', marginTop: 18 }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="#fff"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1L6.6 10.8z" /></svg>
      </div>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 32, color: '#5A4430', marginTop: 8 }}>{penutup?.info || merek.info || merek.sub}</div>
    </AbsoluteFill>
  );
};

export const DialMenu: React.FC<{ props: PropsSinematik }> = ({ props }) => {
  const item = itemValid(props);
  const { jadwal, penutupMulai, penutupDurasi } = hitungDurasiDial(props);
  const nomorItem = item.map((_, i) => URUTAN_FOTO[i] ?? String(i + 1));

  return (
    <AbsoluteFill style={{ background: '#F3EBD8' }}>
      <Sequence from={0} durationInFrames={INTRO_DIAL + 2} name="Keypad">
        <Keypad item={item} merek={props.merek} />
      </Sequence>
      {item.map((s, i) => (
        <Sequence key={i} from={jadwal[i].mulai} durationInFrames={jadwal[i].durasi} name={`Menu ${nomorItem[i]}`}>
          <PotonganMenu s={s} nomor={nomorItem[i]} indeks={i} durasi={jadwal[i].durasi} />
        </Sequence>
      ))}
      {penutupDurasi > 0 ? (
        <Sequence from={penutupMulai} durationInFrames={penutupDurasi} name="Penutup">
          <KartuPenutup props={props} durasi={penutupDurasi} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
