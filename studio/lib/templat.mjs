// Templat HTML yang dipotret Chrome menjadi poster & lapisan video. Warna, nama, dan situs mengikuti
// profil merek (studio_merek); bawaannya identitas Bakafrawi.

export const UKURAN = {
  feed: { w: 1080, h: 1080 },
  potret: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Identitas tampilan satu merek dari baris studio_merek. */
export function temaMerek(m) {
  const p = m?.profil ?? {};
  const aksen = /^#[0-9a-f]{6}$/i.test(p.aksen ?? '') ? p.aksen : '#c9a24b';
  return { nama: m?.nama ?? 'Bakafrawi', aksen, aksenMuda: p.aksen_muda ?? '#e3c989', situs: p.situs ?? '' };
}

const rgba = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;

const dasar = (t) => `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%}
body{font-family:'Plus Jakarta Sans',sans-serif;color:#e9eaee;-webkit-font-smoothing:antialiased}
.latar{position:absolute;inset:0;background:radial-gradient(circle at 85% 8%,${rgba(t.aksen, 0.28)},transparent 45%),radial-gradient(circle at 10% 95%,${rgba(t.aksen, 0.14)},transparent 40%),linear-gradient(160deg,#13161c,#0c0e12 60%)}
.kisi{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:72px 72px;-webkit-mask-image:radial-gradient(ellipse at top,black,transparent 75%)}
.serif{font-family:'Fraunces',serif;font-weight:500;letter-spacing:-.02em}
.emas{color:${t.aksen}}
.lencana{align-self:flex-start;display:inline-flex;align-items:center;gap:12px;border:2px solid ${rgba(t.aksen, 0.35)};background:${rgba(t.aksen, 0.12)};color:${t.aksenMuda};border-radius:999px;padding:10px 26px;font-weight:700;letter-spacing:.04em}
.merek{display:flex;align-items:center;gap:14px;font-weight:800;font-size:34px}
.merek img{width:52px;height:52px}
.hp{background:#0a0c10;border:3px solid rgba(255,255,255,.18);border-radius:56px;padding:14px;box-shadow:0 40px 90px -30px rgba(0,0,0,.9)}
.hp img{display:block;width:100%;border-radius:42px}
.poin{display:flex;gap:16px;align-items:flex-start;color:#c9ced8}
.poin b{color:${t.aksen}}
.klip{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.ikon{border-radius:48px;box-shadow:0 40px 90px -30px rgba(0,0,0,.9)}
.cta{background:${t.aksen};color:#1a1408;border-radius:999px;font-weight:800;padding:20px 40px;display:inline-block}
</style>`;

/** Lapisan latar: foto AI (digelapkan agar teks terbaca) atau gradasi polos. */
function latar(foto) {
  if (!foto) return '<div class="latar"></div><div class="kisi"></div>';
  return `<div style="position:absolute;inset:0;background:url('${esc(foto)}') center/cover;filter:brightness(.7) saturate(1.05)"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,14,18,.9) 0%,rgba(12,14,18,.68) 42%,rgba(12,14,18,.72) 62%,rgba(12,14,18,.95) 100%)"></div>`;
}

const tunggu = `<script>Promise.all([document.fonts.ready,...[...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))]).then(()=>document.body.setAttribute('data-siap',''))</script>`;

function merek(t, logo) {
  return `<div class="merek">${logo ? `<img src="${esc(logo)}">` : ''}<span>${esc(t.nama)}<span class="emas">.</span></span></div>`;
}

/** Baris kontak: "WA 0878… · bakafrawi.com" (situs kosong → hanya WA). */
const kontakTeks = (t, kontak, pemisah) => [kontak?.whatsappTampil && `WA ${esc(kontak.whatsappTampil)}`, t.situs && esc(t.situs)].filter(Boolean).join(pemisah);

/** Poster promosi untuk satu rasio. */
export function htmlPoster({ rasio, naskah, produk, gambar, gambarIkon = false, logo, kontak, foto, tema = temaMerek(null) }) {
  const t = tema;
  const { w, h } = UKURAN[rasio];
  const tegak = h > w;
  const hpLebar = rasio === 'feed' ? 380 : rasio === 'potret' ? 430 : 560;
  const poin = naskah.poin.slice(0, rasio === 'feed' ? 3 : 4).map((p) => `<div class="poin"><b>✓</b><span>${esc(p)}</span></div>`).join('');
  const teks = `
    <div class="lencana" style="font-size:${tegak ? 26 : 22}px">${esc(produk.nama)}</div>
    <h1 class="serif klip" style="-webkit-line-clamp:3;font-size:${rasio === 'story' ? 96 : rasio === 'potret' ? 78 : 62}px;line-height:1.05;margin:28px 0 20px">${esc(naskah.judul)}</h1>
    <p class="klip" style="-webkit-line-clamp:${rasio === 'feed' ? 2 : 3};font-size:${tegak ? 34 : 26}px;color:#9aa1ad;line-height:1.4;margin-bottom:30px">${esc(naskah.sub)}</p>
    <div style="display:grid;gap:14px;font-size:${tegak ? 32 : 27}px">${poin}</div>`;
  // Tangkapan layar tampil di bingkai HP; bila hanya ada logo, logo tampil sebagai ikon aplikasi.
  const hp = !gambar ? '' : gambarIkon
    ? `<img class="ikon" src="${esc(gambar)}" style="width:${Math.round(hpLebar * 0.8)}px">`
    : `<div class="hp" style="width:${hpLebar}px"><img src="${esc(gambar)}"></div>`;
  // Di poster tegak, HP mengisi sisa ruang di antara teks dan kaki — tak pernah menimpa teks.
  const hpTegak = !gambar ? '' : gambarIkon
    ? `<img class="ikon" src="${esc(gambar)}" style="max-height:100%;max-width:60%">`
    : `<div class="hp" style="height:100%;display:flex"><img src="${esc(gambar)}" style="height:100%;width:auto;object-fit:contain"></div>`;
  const kaki = `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px">
      <span class="cta" style="font-size:${tegak ? 34 : 28}px">${esc(naskah.ajakan)} →</span>
      <span style="font-size:${tegak ? 28 : 24}px;color:#9aa1ad;text-align:right">${kontakTeks(t, kontak, "<br>")}</span></div>`;
  const isi = rasio === 'feed'
    ? `<div style="position:absolute;inset:64px 64px 170px;display:grid;grid-template-columns:1fr ${hpLebar}px;gap:48px;align-items:center">
         <div style="display:flex;flex-direction:column">${merek(t, logo)}<div style="height:28px"></div>${teks}</div><div style="display:flex;justify-content:center">${hp}</div></div>
       <div style="position:absolute;left:64px;right:64px;bottom:56px">${kaki}</div>`
    : `<div style="position:absolute;inset:${rasio === 'story' ? '90px 72px 110px' : '64px 72px 56px'};display:flex;flex-direction:column;gap:28px">
         <div style="display:flex;flex-direction:column">${merek(t, logo)}<div style="height:32px"></div>${teks}</div>
         <div style="flex:1;min-height:0;display:flex;justify-content:center;align-items:center">${hpTegak}</div>
         ${kaki}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8">${dasar(t)}<style>body{width:${w}px;height:${h}px;position:relative;overflow:hidden}</style></head>
  <body>${latar(foto)}${isi}${tunggu}</body></html>`;
}

// Kartu adegan iklan Reels 1080×1920, ditiru dari Reels teknologi yang ramai (19 Nov 2026): layar dibagi
// — separuh atas kartu (judul besar / potongan layar aplikasi / HP / ajakan) di latar polos, pita
// tengah (y ±1065) dikosongkan untuk subtitle 1–2 kata dari ASS, separuh bawah foto orang (pengganti
// "wajah pembicara"). Dipotret 2× supaya tetap tajam saat digerakkan.
export const TENGAH_SUBTITLE = 1065;
const KREM = '#F1ECE2';

/** Potongan layar di sekitar titik fokus untuk kartu berukuran w×h (piksel CSS). Murni. */
export function potongLayar({ lebar, tinggi }, { fx = 0.5, fy = 0.4, zoom = 1.3 }, w, h) {
  const wi = w * Math.max(1, zoom);
  const hi = (wi * tinggi) / lebar;
  const jepit = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
  return { wi, hi, x: -jepit(fx * wi - w / 2, 0, wi - w), y: -jepit(fy * hi - h / 2, 0, hi - h) };
}

export function htmlIklan({ atas, bawah = null, variasi = 0, tone = 'terang', tema = temaMerek(null), huruf = {}, produk, logo = '', ajakan = '', kontak = null }) {
  const t = tema;
  const terang = tone === 'terang';
  const latar = terang ? KREM : '#0E0F12';
  const tinta = terang ? '#151515' : '#F5F5F5';
  const kartuBayang = terang ? '0 40px 90px -30px rgba(40,30,10,.35)' : `0 40px 110px -30px rgba(0,0,0,.9),0 0 90px ${rgba(t.aksen, 0.18)}`;
  let a = '';
  if (atas.jenis === 'judul') {
    // Judul besar dengan satu frasa disorot kotak warna + coretan tangan berpanah (gaya karosel IG).
    const sorot = String(atas.sorot ?? '').trim();
    const j = esc(atas.judul ?? '');
    const k = sorot ? j.toLowerCase().indexOf(esc(sorot).toLowerCase()) : -1;
    const judul = k < 0 ? j : `${j.slice(0, k)}<span style="display:inline-block;background:${t.aksen};color:#141008;padding:0 22px;border-radius:14px;transform:rotate(-2deg)">${j.slice(k, k + esc(sorot).length)}</span>${j.slice(k + esc(sorot).length)}`;
    a = `<div style="position:absolute;left:80px;right:80px;top:250px">
      <div style="display:inline-block;border:3px solid ${tinta};border-radius:999px;padding:10px 28px;font-family:sans-serif;font-weight:700;font-size:30px;letter-spacing:.08em;text-transform:uppercase">${esc(produk?.label || produk?.nama || t.nama)}</div>
      <div style="margin-top:34px;font-family:Tebal;font-size:112px;line-height:1.02;text-transform:uppercase;letter-spacing:-2px">${judul}</div></div>
      ${atas.coretan ? `<div style="position:absolute;right:70px;top:${atas.judul && atas.judul.length > 28 ? 820 : 700}px;font-family:Tangan;font-size:58px;color:${terang ? '#3a3a3a' : '#ddd'};transform:rotate(-7deg);text-align:right;line-height:1.05">${esc(atas.coretan)}
        <svg width="170" height="90" viewBox="0 0 170 90" style="display:block;margin:6px 0 0 auto"><path d="M160 10 C 120 70, 60 80, 15 55" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M35 35 L12 55 L40 72" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>` : ''}`;
  } else if (atas.jenis === 'layar') {
    const w = 900, h = 760;
    const p = potongLayar(atas, atas, w, h);
    a = `<div style="position:absolute;left:90px;top:200px;width:${w}px;height:${h}px;border-radius:44px;overflow:hidden;box-shadow:${kartuBayang};border:3px solid ${terang ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.12)'}">
      <img src="${esc(atas.berkas)}" style="position:absolute;left:${p.x}px;top:${p.y}px;width:${p.wi}px;height:${p.hi}px"></div>`;
  } else if (atas.jenis === 'hp') {
    const hp = (src, gaya) => `<div style="position:absolute;width:330px;padding:12px;border-radius:52px;background:#05070a;box-shadow:${kartuBayang};${gaya}"><img src="${esc(src)}" style="display:block;width:100%;border-radius:42px"></div>`;
    const [l0, l1 = l0, l2 = l1] = atas.layar;
    a = `${hp(l1, 'left:95px;top:250px;transform:rotate(-9deg) scale(.88)')}${hp(l2, 'right:95px;top:250px;transform:rotate(9deg) scale(.88)')}${hp(l0, 'left:375px;top:170px')}`;
  } else if (atas.jenis === 'logo') {
    a = `<div style="position:absolute;left:0;right:0;top:300px;display:flex;flex-direction:column;align-items:center;gap:36px">
      ${logo ? `<img src="${esc(logo)}" style="width:330px;height:330px;object-fit:contain;border-radius:70px;box-shadow:${kartuBayang}">` : ''}
      <div style="font-family:Tebal;font-size:96px">${esc(produk?.nama ?? t.nama)}</div></div>`;
  } else {
    const wa = kontak?.whatsappTampil ? `WA ${esc(kontak.whatsappTampil)}` : '';
    const fitur = (produk?.fitur ?? []).slice(0, 3).map((f) => `<div style="display:flex;align-items:center;gap:14px;background:${terang ? '#fff' : '#1a1c22'};border-radius:999px;padding:16px 30px;box-shadow:${kartuBayang}"><b style="color:${t.aksen};font-size:40px">✓</b>${esc(f.judul)}</div>`).join('');
    a = `<div style="position:absolute;left:60px;right:60px;top:220px;display:flex;flex-direction:column;align-items:center;gap:34px;text-align:center">
      ${logo ? `<img src="${esc(logo)}" style="width:250px;height:250px;object-fit:contain;border-radius:60px;box-shadow:${kartuBayang}">` : ''}
      <div style="font-family:Tebal;font-size:96px;line-height:1">${esc(produk?.nama ?? t.nama)}</div>
      <div style="font-family:sans-serif;font-size:40px;opacity:.75">${esc(produk?.judul ?? '')}</div></div>
      <div style="position:absolute;left:60px;right:60px;top:1190px;display:flex;flex-direction:column;align-items:center;gap:40px">
      <div style="background:${t.aksen};color:#141008;border-radius:999px;padding:34px 80px;font-family:Tebal;font-size:60px;box-shadow:0 30px 70px -20px ${rgba(t.aksen, 0.7)}">${esc(ajakan || 'Coba sekarang')} →</div>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:18px;font-family:sans-serif;font-weight:700;font-size:34px">${fitur}</div>
      <div style="font-family:sans-serif;font-size:36px;opacity:.65">${[wa, esc(t.situs)].filter(Boolean).join(' · ')}</div></div>`;
  }
  // Foto bawah dipotong beda tiap adegan (lebar/dekat, geser kiri/kanan) — kesan beberapa kamera.
  const [skala, asal] = [[1, '50% 30%'], [1.22, '38% 28%'], [1.1, '62% 35%']][variasi % 3];
  const b = bawah ? `<div style="position:absolute;left:0;right:0;bottom:0;height:780px;overflow:hidden;
    -webkit-mask-image:linear-gradient(180deg,transparent 0,black 160px);mask-image:linear-gradient(180deg,transparent 0,black 160px)">
    <div style="position:absolute;inset:0;background:url('${esc(bawah)}') center 30%/cover;transform:scale(${skala});transform-origin:${asal}"></div></div>` : '';
  const pola = terang
    ? `<div style="position:absolute;inset:0;background-image:radial-gradient(rgba(0,0,0,.06) 2px,transparent 2px);background-size:46px 46px"></div>`
    : `<div style="position:absolute;inset:0;background:radial-gradient(circle at 80% 12%,${rgba(t.aksen, 0.22)},transparent 45%)"></div>`;
  const ff = (nama, url) => (url ? `@font-face{font-family:${nama};src:url('${esc(url)}')}` : '');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${ff('Tebal', huruf.tebal)}${ff('Tangan', huruf.tangan)}
*{margin:0;padding:0;box-sizing:border-box} body{width:1080px;height:1920px;overflow:hidden;position:relative;background:${latar};color:${tinta};font-family:Tebal,sans-serif}
</style></head><body>${pola}${b}${a}${tunggu}</body></html>`;
}
