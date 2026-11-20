import React from 'react';
import { Composition } from 'remotion';
import { Iklan } from './Iklan';
import { FPS, hitungWaktu, naskahContoh, type Naskah } from './data/script';
import suaraContoh from './data/suara.json';
import { contohSinematik, FPS_SINEMATIK, hitungDurasiSinematik, Sinematik } from './Sinematik';

// Props bawaan = naskah contoh + narasi hasil `npm run siapkan` (bila sudah dibuat). Mesin Studio
// menimpa seluruhnya lewat --props; durasi selalu dihitung ulang dari naskah + suara.
const bawaan: Naskah = { ...naskahContoh, ...(suaraContoh as Partial<Naskah>) };

export const Root: React.FC = () => (
  <>
    <Composition
      id="Iklan"
      component={Iklan}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={hitungWaktu(bawaan).total}
      defaultProps={bawaan}
      calculateMetadata={({ props }) => ({ durationInFrames: hitungWaktu(props).total })}
    />
    <Composition
      id="Sinematik"
      component={Sinematik}
      width={1080}
      height={1920}
      fps={FPS_SINEMATIK}
      durationInFrames={hitungDurasiSinematik(contohSinematik).total}
      defaultProps={contohSinematik}
      calculateMetadata={({ props }) => ({ durationInFrames: hitungDurasiSinematik(props).total })}
    />
  </>
);
