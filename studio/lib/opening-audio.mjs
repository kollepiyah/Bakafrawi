// Generator musik kafe adaptif & efek suara (SFX) untuk Story Jam Buka AI.
// Menghasilkan musik yang selalu variatif (nada dasar, progresi akor, & ritme mengikuti tema visual
// dan hari) serta efek suara transisi (whoosh, pop kartu, chime penutup) — tanpa API berbayar.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ffmpeg } from './bank/alat.mjs';

const SR = 44100;

/** Tulis array Float32Array stereo [-1..1] menjadi berkas WAV 16-bit PCM. */
async function tulisWavStereo(kiri, kanan, keluar) {
  const n = kiri.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, kiri[i]));
    const r = Math.max(-1, Math.min(1, kanan[i]));
    buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
  }
  await writeFile(keluar, buf);
}

const midiKeHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Variasi progresi akor kafe (jazz/lo-fi/bossa) — berganti berdasarkan hari & tema visual.
const PROGRESI = {
  'hangat-kafe': [
    // Warm Lo-Fi Jazz (ii9 - V13 - Imaj9 - VI7)
    [[62, 65, 69, 72, 76], [55, 62, 65, 69, 71], [60, 64, 67, 71, 74], [57, 64, 67, 72, 74]],
    [[65, 69, 72, 76, 79], [64, 67, 71, 74, 76], [62, 65, 69, 72, 76], [60, 64, 67, 71, 74]],
  ],
  'terang-modern': [
    // Morning Acoustic Bossa (Imaj7 - vi7 - ii7 - V7)
    [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]],
    [[65, 69, 72, 76], [62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71]],
  ],
  'minimalis-gelap': [
    // Deep Chill Coffee Lounge (im9 - bVImaj7 - iv9 - Vsus4)
    [[57, 60, 64, 67, 71], [53, 57, 60, 64, 67], [50, 53, 57, 60, 64], [52, 57, 59, 64, 67]],
    [[62, 65, 69, 72, 76], [58, 62, 65, 69, 72], [55, 58, 62, 65, 69], [57, 60, 64, 67, 71]],
  ],
};

// Geser nada dasar harian (-3 s.d. +4 semitone) supaya setiap hari nuansa musiknya terasa baru.
const GESER_HARIAN = [0, 2, -2, 3, -1, 4, -3];

/**
 * Buat musik latar kafe adaptif (durasi detik) sesuai tema visual & hari → berkas MP3 hangat.
 */
export async function buatMusikKafe({ gaya = 'hangat-kafe', hariEpoch = 0, durasiDetik = 16, keluarMp3 }) {
  const n = Math.ceil(durasiDetik * SR);
  const kiri = new Float32Array(n);
  const kanan = new Float32Array(n);

  const daftarProg = PROGRESI[gaya] ?? PROGRESI['hangat-kafe'];
  const prog = daftarProg[Math.abs(hariEpoch) % daftarProg.length];
  const geser = GESER_HARIAN[Math.abs(hariEpoch * 3 + 1) % GESER_HARIAN.length];
  const bpm = gaya === 'terang-modern' ? 96 : gaya === 'minimalis-gelap' ? 78 : 84;
  const ketuk = 60 / bpm;
  const panjangBar = ketuk * 4;

  // 1) Rhodes / Electric Piano akor hangat + petikan halus
  const jumlahBar = Math.ceil(durasiDetik / panjangBar) + 1;
  for (let b = 0; b < jumlahBar; b++) {
    const akor = prog[b % prog.length];
    const tMulaiBar = b * panjangBar;

    // Akar bas hangat di ketukan 1 & 3
    for (const offsetBas of [0, ketuk * 2.5]) {
      const t0 = tMulaiBar + offsetBas;
      const dur = ketuk * 1.6;
      const hz = midiKeHz(akor[0] - 12 + geser);
      const i0 = Math.floor(t0 * SR);
      const i1 = Math.min(n, Math.floor((t0 + dur) * SR));
      for (let i = i0; i < i1; i++) {
        const dt = (i - i0) / SR;
        const env = Math.min(1, dt / 0.025) * Math.exp(-dt * 2.6);
        const s = (Math.sin(2 * Math.PI * hz * dt) * 0.8 + Math.sin(2 * Math.PI * hz * 2 * dt) * 0.12) * env * 0.16;
        kiri[i] += s;
        kanan[i] += s;
      }
    }

    // Akor Rhodes lembut dengan sedikit strum (jeda 18ms antar nada) agar terasa natural
    akor.forEach((midi, idx) => {
      const t0 = tMulaiBar + idx * 0.018;
      const dur = panjangBar * 0.95;
      const hz = midiKeHz(midi + geser);
      const pan = idx % 2 === 0 ? 0.44 : 0.56;
      const i0 = Math.floor(t0 * SR);
      const i1 = Math.min(n, Math.floor((t0 + dur) * SR));
      for (let i = i0; i < i1; i++) {
        const dt = (i - i0) / SR;
        const env = Math.min(1, dt / 0.03) * Math.exp(-dt * 1.15);
        // Rhodes timbre: fundamental + sedikit harmonik 2 & 3 yang cepat meluruh
        const suara =
          Math.sin(2 * Math.PI * hz * dt) * 0.78 +
          Math.sin(2 * Math.PI * hz * 2 * dt) * 0.16 * Math.exp(-dt * 4.5) +
          Math.sin(2 * Math.PI * hz * 3 * dt) * 0.05 * Math.exp(-dt * 8);
        const v = suara * env * 0.075;
        kiri[i] += v * (1 - pan);
        kanan[i] += v * pan;
      }
    });

    // Petikan melodi ringan di atas akor (variasi tiap bar supaya tidak monoton)
    const polaKetuk = gaya === 'terang-modern' ? [0.5, 1.5, 2.0, 3.0, 3.5] : [1.0, 2.25, 3.5];
    polaKetuk.forEach((kPos, j) => {
      const t0 = tMulaiBar + kPos * ketuk;
      const nada = akor[(b + j * 2) % akor.length] + 12 + geser;
      const hz = midiKeHz(nada);
      const dur = ketuk * 0.9;
      const i0 = Math.floor(t0 * SR);
      const i1 = Math.min(n, Math.floor((t0 + dur) * SR));
      for (let i = i0; i < i1; i++) {
        const dt = (i - i0) / SR;
        const env = Math.min(1, dt / 0.01) * Math.exp(-dt * 4.8);
        const v = (Math.sin(2 * Math.PI * hz * dt) + 0.2 * Math.sin(2 * Math.PI * hz * 2 * dt)) * env * 0.042;
        kiri[i] += v * 0.6;
        kanan[i] += v * 0.4;
      }
    });
  }

  // 2) Perkusi lo-fi sangat halus (kick lembut + shaker/brush)
  let seed = (hariEpoch * 2654435761) >>> 0 || 12345;
  const acak = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };
  const jumlahKetuk = Math.ceil(durasiDetik / ketuk);
  for (let k = 0; k < jumlahKetuk; k++) {
    const t0 = k * ketuk;
    // Kick lembut pada ketukan 1 dan 3
    if (k % 4 === 0 || (k % 4 === 2 && gaya !== 'minimalis-gelap')) {
      const i0 = Math.floor(t0 * SR);
      const i1 = Math.min(n, i0 + Math.floor(0.14 * SR));
      for (let i = i0; i < i1; i++) {
        const dt = (i - i0) / SR;
        const f = 110 * Math.exp(-dt * 26) + 46;
        const env = Math.exp(-dt * 22);
        const s = Math.sin(2 * Math.PI * f * dt) * env * 0.14;
        kiri[i] += s;
        kanan[i] += s;
      }
    }
    // Shaker / brush halus tiap setengah ketukan
    for (const sub of [0, 0.5]) {
      const i0 = Math.floor((t0 + sub * ketuk) * SR);
      const i1 = Math.min(n, i0 + Math.floor(0.035 * SR));
      const amp = sub === 0 ? 0.012 : 0.008;
      for (let i = i0; i < i1; i++) {
        const dt = (i - i0) / SR;
        const env = Math.exp(-dt * 85);
        const s = acak() * env * amp;
        kiri[i] += s * 0.45;
        kanan[i] += s * 0.55;
      }
    }
  }

  const wavTmp = `${keluarMp3}.wav`;
  await tulisWavStereo(kiri, kanan, wavTmp);
  // Hangatkan suara dengan low-pass 5.5kHz & sedikit EQ hangat ala lo-fi kafe
  await ffmpeg([
    '-y',
    '-i',
    wavTmp,
    '-af',
    'lowpass=f=5500,highpass=f=45,acompressor=threshold=-16dB:ratio=2.5,loudnorm=I=-16:TP=-1.5',
    '-b:a',
    '160k',
    keluarMp3,
  ]);
  return keluarMp3;
}

/**
 * Buat 3 berkas SFX halus untuk transisi & pop-up kartu di Story Jam Buka:
 * - sfx-whoosh.mp3 : desis lembut perpindahan adegan
 * - sfx-pop.mp3    : bunyi pop hangat saat kartu menu muncul
 * - sfx-chime.mp3  : denting lembut saat penutup "Buka Hari Ini" tampil
 */
export async function buatSfxOpening(folderPublik) {
  let seed = 987654321;
  const acak = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  // 1) Whoosh transisi (0.38 dtk)
  {
    const dur = 0.38;
    const n = Math.floor(dur * SR);
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const env = Math.sin((t / dur) * Math.PI);
      const alpha = 0.04 + 0.18 * env;
      lp += alpha * (acak() - lp);
      const v = lp * env * env * 0.42;
      l[i] = v;
      r[i] = v;
    }
    const wav = path.join(folderPublik, '_whoosh.wav');
    await tulisWavStereo(l, r, wav);
    await ffmpeg(['-y', '-i', wav, '-af', 'bandpass=f=900:width_type=h:w=1200', '-b:a', '128k', path.join(folderPublik, 'sfx-whoosh.mp3')]);
  }

  // 2) Pop lembut kartu menu (0.22 dtk)
  {
    const dur = 0.22;
    const n = Math.floor(dur * SR);
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = 320 + 260 * Math.exp(-t * 28);
      const env = Math.min(1, t / 0.008) * Math.exp(-t * 20);
      const v = Math.sin(2 * Math.PI * f * t) * env * 0.35;
      l[i] = v;
      r[i] = v;
    }
    const wav = path.join(folderPublik, '_pop.wav');
    await tulisWavStereo(l, r, wav);
    await ffmpeg(['-y', '-i', wav, '-b:a', '128k', path.join(folderPublik, 'sfx-pop.mp3')]);
  }

  // 3) Chime kafe hangat di penutup (0.9 dtk — dua nada harmonis lembut)
  {
    const dur = 0.9;
    const n = Math.floor(dur * SR);
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    const nada = [
      { t0: 0, hz: 523.25 }, // C5
      { t0: 0.11, hz: 659.25 }, // E5
      { t0: 0.22, hz: 783.99 }, // G5
    ];
    for (const nd of nada) {
      const i0 = Math.floor(nd.t0 * SR);
      for (let i = i0; i < n; i++) {
        const dt = (i - i0) / SR;
        const env = Math.min(1, dt / 0.012) * Math.exp(-dt * 4.5);
        const v = (Math.sin(2 * Math.PI * nd.hz * dt) * 0.8 + Math.sin(2 * Math.PI * nd.hz * 2 * dt) * 0.18) * env * 0.16;
        l[i] += v;
        r[i] += v;
      }
    }
    const wav = path.join(folderPublik, '_chime.wav');
    await tulisWavStereo(l, r, wav);
    await ffmpeg(['-y', '-i', wav, '-b:a', '128k', path.join(folderPublik, 'sfx-chime.mp3')]);
  }

  return {
    whoosh: 'sfx-whoosh.mp3',
    pop: 'sfx-pop.mp3',
    chime: 'sfx-chime.mp3',
  };
}
