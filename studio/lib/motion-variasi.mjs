// Cermin logika variasi motion dari `src/lib/serial-kartun-murni.ts` — mesin Studio tidak boleh impor dari src/.

export const JENIS_MOTION_SAH = ['pembuka', 'perkamen', 'peta', 'ilustrasi', 'arsip', 'penutup'];

const ISI_MOTION_PER_EPISODE = [
  ['ilustrasi', 'arsip', 'perkamen', 'peta', 'ilustrasi'],
  ['perkamen', 'ilustrasi', 'arsip', 'ilustrasi', 'arsip'],
  ['arsip', 'ilustrasi', 'perkamen', 'ilustrasi', 'perkamen'],
  ['ilustrasi', 'perkamen', 'arsip', 'peta', 'ilustrasi'],
  ['perkamen', 'arsip', 'ilustrasi', 'perkamen', 'ilustrasi'],
  ['ilustrasi', 'arsip', 'ilustrasi', 'perkamen', 'peta'],
];

const KAMERA_MOTION_SAH = ['zoom_masuk', 'zoom_keluar', 'geser_kanan', 'geser_kiri'];
export const POLA_KAMERA_KEDAI = ['zoom_masuk', 'diam', 'geser_kanan', 'goyang_kaget', 'geser_kiri', 'zoom_keluar', 'zoom_masuk', 'diam'];

export function bangunSkemaJenisMotion(nomorEpisode, jumlahAdegan, temaVisual = 'malam') {
  const jumlah = Math.max(1, Math.min(16, Math.round(jumlahAdegan)));
  if (jumlah === 1) return ['pembuka'];
  const isiPool = ISI_MOTION_PER_EPISODE[(Math.max(1, nomorEpisode) - 1) % ISI_MOTION_PER_EPISODE.length];
  const tengah = [];
  for (let i = 0; i < jumlah - 2; i++) {
    let jenis = isiPool[i % isiPool.length];
    if (temaVisual === 'malam' && jenis === 'perkamen' && i % 2 === 1) jenis = 'ilustrasi';
    if (temaVisual === 'perkamen' && jenis === 'ilustrasi' && i % 3 === 2) jenis = 'perkamen';
    tengah.push(jenis);
  }
  let sudahPeta = false;
  const isiRapi = tengah.map((j) => {
    if (j !== 'peta') return j;
    if (sudahPeta) return 'arsip';
    sudahPeta = true;
    return 'peta';
  });
  return ['pembuka', ...isiRapi, 'penutup'];
}

export function pilihKameraMotionOtomatis(idx, jenis, nomorEpisode = 1) {
  if (jenis === 'penutup') return 'zoom_keluar';
  if (jenis === 'peta' || jenis === 'arsip') return idx % 2 === 0 ? 'geser_kiri' : 'geser_kanan';
  return KAMERA_MOTION_SAH[(idx + nomorEpisode) % KAMERA_MOTION_SAH.length];
}

export function pilihKameraKedaiOtomatis(idx, nomorEpisode = 1) {
  return POLA_KAMERA_KEDAI[(idx + nomorEpisode) % POLA_KAMERA_KEDAI.length];
}

export function teksSkemaMotionUntukPrompt(nomorEpisode, jumlahAdegan, temaVisual) {
  const skema = bangunSkemaJenisMotion(nomorEpisode, jumlahAdegan, temaVisual);
  return (
    `VARIASI LAYAR WAJIB EPISODE ${nomorEpisode} (ikuti urutan jenisMotion per adegan agar video tidak monoton):\n` +
    skema.map((j, i) => `  - Adegan ${i + 1}: jenisMotion "${j}"`).join('\n') +
    '\n- Berganti kamera: zoom_masuk, geser_kanan, geser_kiri, zoom_keluar (jangan semua sama).' +
    '\n- Sesekali isi karakter { aksi, tokohUtama }: jalan_kanan, dialog_dua, periksa_arsip, tatap_horizon, ramai_tiga (maks 1x peta).'
  );
}
