// Adegan Kasir — mockup tablet: produk masuk keranjang satu per satu, lencana "Scan Barcode ✓",
// tombol QRIS ditekan, struk digital naik keluar. Waktu tiap peristiwa = pecahan durasi adegan.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { bayangan, bayanganGelap, Ikon, Kartu, SANS, usePegas } from '../components/dasar';
import type { Adegan, Naskah } from '../data/script';

type P = { a: Extract<Adegan, { jenis: 'kasir' }>; merek: Naskah['merek']; durasi: number; gelap?: boolean };
const WARNA = ['#FDE68A', '#FBCFE8', '#BFDBFE', '#BBF7D0'];

export const Kasir: React.FC<P> = ({ a, merek, durasi, gelap }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (f: number) => Math.round(durasi * f); // peristiwa pada pecahan durasi
  const pg = (mulai: number, opsi = {}) => spring({ frame: frame - mulai, fps, config: { damping: 15, stiffness: 160, ...opsi } });
  const tablet = usePegas(0, { damping: 18 });
  const produk = a.produk.slice(0, 3);
  const masuk = produk.map((_, i) => pg(t(0.12 + i * 0.1)));
  const scan = pg(t(0.1), { damping: 10, stiffness: 200 });
  const tekan = frame >= t(0.55) && frame < t(0.55) + 8 ? 0.92 : 1;
  const struk = pg(t(0.62), { damping: 17 });
  const garisScan = interpolate(frame % 24, [0, 24], [0, 1]);
  const warnaHarga = gelap ? merek.kedua : merek.utama;
  return (
    <div style={{ position: 'relative', width: 900, height: 660 }}>
      {/* Tablet */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 46, background: gelap ? '#090D16' : '#18181B', border: gelap ? '2px solid rgba(255,255,255,0.16)' : undefined, padding: 18, boxShadow: gelap ? bayanganGelap : bayangan, transform: `translateY(${(1 - tablet) * 120}px) rotateX(${(1 - tablet) * 18}deg)`, opacity: tablet }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 30, background: gelap ? '#0F172A' : '#F4F4F5', display: 'flex', overflow: 'hidden', fontFamily: SANS }}>
          {/* Katalog */}
          <div style={{ flex: 1.15, padding: 26, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignContent: 'start' }}>
            {a.produk.slice(0, 4).map((p, i) => (
              <div key={i} style={{ background: gelap ? '#1E293B' : '#fff', borderRadius: 20, padding: 14, border: i < produk.length && masuk[i] > 0.5 ? `3px solid ${warnaHarga}` : '3px solid transparent', position: 'relative', overflow: 'hidden' }}>
                <div style={{ height: 120, borderRadius: 14, background: WARNA[i % 4], display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 50, color: 'rgba(0,0,0,.55)' }}>{p.nama.slice(0, 1)}</div>
                <div style={{ fontWeight: 700, fontSize: 22, marginTop: 10, color: gelap ? '#F8FAFC' : '#27272A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nama}</div>
                <div style={{ fontWeight: 800, fontSize: 22, color: warnaHarga }}>{p.harga}</div>
                {i === 0 && frame < t(0.2) ? <div style={{ position: 'absolute', left: 0, right: 0, top: 14 + garisScan * 120, height: 4, background: '#EF4444', boxShadow: '0 0 12px #EF4444' }} /> : null}
              </div>
            ))}
          </div>
          {/* Keranjang */}
          <div style={{ width: 330, background: gelap ? '#111827' : '#fff', padding: 24, display: 'flex', flexDirection: 'column', gap: 12, borderLeft: `2px solid ${gelap ? 'rgba(255,255,255,0.12)' : '#E4E4E7'}` }}>
            <div style={{ fontWeight: 800, fontSize: 28, color: gelap ? '#F8FAFC' : '#18181B' }}>Keranjang</div>
            {produk.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 21, fontWeight: 700, color: gelap ? '#CBD5E1' : '#3F3F46', opacity: masuk[i], transform: `translateX(${(1 - masuk[i]) * -80}px)` }}>
                <span style={{ maxWidth: 190, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>1× {p.nama}</span><span>{p.harga.replace('Rp ', '')}</span>
              </div>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 28, color: gelap ? '#F8FAFC' : '#18181B', opacity: masuk.at(-1) }}><span>Total</span><span>{a.total}</span></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '16px 0', borderRadius: 16, background: warnaHarga, color: gelap ? '#0A0C10' : '#fff', fontWeight: 800, fontSize: 24, transform: `scale(${tekan})` }}>QRIS</div>
              <div style={{ flex: 1, textAlign: 'center', padding: '16px 0', borderRadius: 16, border: `3px solid ${warnaHarga}`, color: warnaHarga, fontWeight: 800, fontSize: 24 }}>Tunai</div>
            </div>
          </div>
        </div>
      </div>
      {/* Lencana scan */}
      <div style={{ position: 'absolute', left: -20, top: -40, transform: `scale(${scan})`, display: 'flex', alignItems: 'center', gap: 10, background: gelap ? '#0F172A' : '#fff', border: gelap ? '2px solid rgba(52,211,153,0.45)' : undefined, borderRadius: 999, padding: '14px 26px', boxShadow: gelap ? bayanganGelap : bayangan, fontFamily: SANS, fontWeight: 800, fontSize: 30, color: gelap ? '#34D399' : '#047857' }}>
        <Ikon nama="scan" ukuran={36} warna={gelap ? '#34D399' : '#047857'} /> {a.lencana}
      </div>
      {/* Struk digital */}
      <Kartu gelap={gelap} style={{ position: 'absolute', right: 10, bottom: -80, width: 300, padding: 24, fontFamily: SANS, opacity: struk, transform: `translateY(${(1 - struk) * 160}px) rotate(${(1 - struk) * 8 + 3}deg)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 26, color: gelap ? '#F8FAFC' : '#18181B' }}><Ikon nama="struk" ukuran={34} warna={warnaHarga} /> Struk digital</div>
        <div style={{ borderTop: `2px dashed ${gelap ? 'rgba(255,255,255,0.22)' : '#D4D4D8'}`, margin: '14px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 22 }}><span>Total</span><span>{a.total}</span></div>
        <div style={{ marginTop: 12, background: gelap ? 'rgba(16,185,129,0.2)' : '#DCFCE7', color: gelap ? '#6EE7B7' : '#166534', borderRadius: 12, padding: '8px 12px', fontWeight: 800, fontSize: 20 }}>✓ {a.struk}</div>
      </Kartu>
    </div>
  );
};
