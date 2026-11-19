// Komposisi utama video iklan 9:16. Lapisan (bawah → atas): latar berkisi, adegan, maskot, caption,
// bilah progres, lencana langkah & nama merek. Narasi per adegan + musik yang mengecil saat narasi.
import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Latar, Lencana, Merek, Progres } from './components/Bingkai';
import { Caption } from './components/Caption';
import { tataLetak, useKeluar } from './components/dasar';
import { MascotOverlay } from './components/Maskot';
import { FPS, hitungWaktu, JEDA_AWAL, type Adegan, type Kata, type Layar as LayarT, type Naskah } from './data/script';
import { Alur } from './scenes/Alur';
import { Daftar } from './scenes/Daftar';
import { Hook } from './scenes/Hook';
import { Kasir } from './scenes/Kasir';
import { Layar } from './scenes/Layar';
import { Penutup } from './scenes/Penutup';

/** Tanpa berkas suara (pratinjau naskah): waktu kata dibagi menurut panjang kata. Murni. */
export function kataRata(narasi: string, detik: number): Kata[] {
  const kata = narasi.split(/\s+/).filter(Boolean);
  const total = kata.reduce((n, k) => n + k.length + 2, 0) || 1;
  let t = 0;
  return kata.map((teks) => {
    const d = ((teks.length + 2) / total) * detik;
    const k = { teks, mulai: t, selesai: t + d };
    t += d;
    return k;
  });
}

type PIsi = { a: Adegan; merek: Naskah['merek']; durasi: number; atas: number; jumlah: number; layar: LayarT[] };

const Isi: React.FC<PIsi> = ({ a, merek, durasi, atas, jumlah, layar }) => {
  switch (a.jenis) {
    case 'hook': return <Hook a={a} merek={merek} jumlah={jumlah} />;
    case 'layar': return <Layar a={a} merek={merek} durasi={durasi} layar={layar} />;
    case 'kasir': return <Kasir a={a} merek={merek} durasi={durasi} />;
    case 'alur': return <Alur a={a} merek={merek} durasi={durasi} />;
    case 'daftar': return <Daftar a={a} merek={merek} durasi={durasi} />;
    default: return <Penutup a={a} merek={merek} atas={atas} />;
  }
};

/** Area visual: isi adegan diletakkan di tengah area dan diskalakan agar muat, lalu memudar di akhir. */
const Panggung: React.FC<PIsi & { bawah: number }> = (p) => {
  const keluar = useKeluar(p.durasi);
  if (p.a.jenis === 'penutup') return <Isi {...p} />;
  // Tak pernah membesar di atas 1: konten dirancang ≤ 960 px lebar supaya tak menyentuh bilah progres.
  const tinggi = p.a.jenis === 'layar' ? 900 : 820;
  const skala = Math.min(1, (p.bawah - p.atas) / tinggi);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: p.atas, height: p.bawah - p.atas, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: keluar, transform: `scale(${(0.96 + 0.04 * keluar) * skala})` }}>
      <Isi {...p} />
    </div>
  );
};

/** Musik mengecil (ducking) selama ada kata yang sedang diucapkan. */
function volumeMusik(frame: number, kata: { mulai: number; selesai: number }[]) {
  const t = frame / FPS;
  const bicara = kata.some((k) => t >= k.mulai - 0.15 && t <= k.selesai + 0.25);
  const masuk = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  return masuk * (bicara ? 0.12 : 0.32);
}

export const Iklan: React.FC<Naskah> = (naskah) => {
  const frame = useCurrentFrame();
  const { merek, adegan, suara, maskot, musik } = naskah;
  const { adegan: waktu, total } = hitungWaktu(naskah);
  const letak = tataLetak(Boolean(maskot));
  const kini = waktu.findLastIndex((w) => frame >= w.mulai);
  const penutup = adegan[kini]?.jenis === 'penutup';
  let langkah = 0;
  const nomor = adegan.map((a) => ('badge' in a ? ++langkah : 0));
  const kataGlobal = adegan.flatMap((a, i) => (suara?.[i]?.kata ?? []).map((k) => ({ mulai: waktu[i].mulai / FPS + JEDA_AWAL + k.mulai, selesai: waktu[i].mulai / FPS + JEDA_AWAL + k.selesai })));

  return (
    <AbsoluteFill style={{ background: merek.latar }}>
      <Latar merek={merek} />
      {adegan.map((a, i) => (
        <Sequence key={i} from={waktu[i].mulai} durationInFrames={waktu[i].durasi} name={`${i + 1}. ${a.jenis}`}>
          <Panggung a={a} merek={merek} durasi={waktu[i].durasi} atas={letak.visualAtas} bawah={letak.visualBawah} jumlah={adegan.length} layar={naskah.layar ?? []} />
          {suara?.[i] ? (
            <Sequence from={Math.round(JEDA_AWAL * FPS)} layout="none">
              <Audio src={staticFile(suara[i].berkas)} />
            </Sequence>
          ) : null}
        </Sequence>
      ))}
      {adegan.map((a, i) => {
        const berkas = a.maskot ?? maskot;
        const sebelum = i > 0 ? (adegan[i - 1].maskot ?? maskot) : null;
        return (
          <Sequence key={`m${i}`} from={waktu[i].mulai} durationInFrames={waktu[i].durasi} layout="none">
            <MascotOverlay berkas={berkas} atas={letak.maskotAtas} ganti={berkas !== sebelum} awal={waktu[i].mulai} kata={suara?.[i]?.kata ?? []} mulaiDetik={JEDA_AWAL} />
          </Sequence>
        );
      })}
      {adegan.map((a, i) => (
        <Sequence key={`c${i}`} from={waktu[i].mulai} durationInFrames={waktu[i].durasi} layout="none">
          <Caption
            kata={suara?.[i]?.kata ?? kataRata(a.narasi, waktu[i].durasi / FPS - JEDA_AWAL - 0.4)}
            mulaiDetik={JEDA_AWAL}
            kunci={a.kunci}
            y={a.jenis === 'penutup' && !maskot ? 1520 : letak.caption}
            utama={merek.utama}
            kedua={merek.kedua}
            tinta={merek.tinta}
            terang={a.jenis === 'penutup'}
          />
        </Sequence>
      ))}
      {!penutup ? <Progres waktu={waktu} total={total} warna={merek.utama} /> : null}
      {adegan.map((a, i) => ('badge' in a ? (
        <Sequence key={`b${i}`} from={waktu[i].mulai} durationInFrames={waktu[i].durasi} layout="none">
          <Lencana nomor={nomor[i]} teks={a.badge} warna={merek.utama} mulai={0} />
        </Sequence>
      ) : null))}
      {adegan[kini]?.jenis !== 'hook' ? <Merek merek={merek} terang={penutup} /> : null}
      {musik ? <Audio src={staticFile(musik)} volume={(f) => volumeMusik(f, kataGlobal)} loop /> : null}
    </AbsoluteFill>
  );
};
