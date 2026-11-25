import React from 'react';
import { Composition } from 'remotion';
import { Iklan } from './Iklan';
import { FPS, hitungWaktu, naskahContoh, type Naskah } from './data/script';
import suaraContoh from './data/suara.json';
import { contohSinematik, FPS_SINEMATIK, hitungDurasiSinematik, Sinematik } from './Sinematik';
import { contohOpening, DURASI_OPENING, FPS_OPENING, hitungDurasiOpening, OpeningStory } from './OpeningStory';
import {
  contohSerialKartun,
  FPS_SERIAL,
  hitungDurasiSerialKartun,
  SerialKartun,
} from './SerialKartun';

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
    <Composition
      id="OpeningStory"
      component={OpeningStory}
      width={1080}
      height={1920}
      fps={FPS_OPENING}
      durationInFrames={DURASI_OPENING}
      defaultProps={contohOpening}
      calculateMetadata={({ props }) => ({ durationInFrames: hitungDurasiOpening(props) })}
    />
    <Composition
      id="SerialKartun"
      component={SerialKartun}
      width={1080}
      height={1920}
      fps={FPS_SERIAL}
      durationInFrames={hitungDurasiSerialKartun(contohSerialKartun).total}
      defaultProps={contohSerialKartun}
      calculateMetadata={({ props }) => ({ durationInFrames: hitungDurasiSerialKartun(props).total })}
    />
  </>
);
