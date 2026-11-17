// Templat HTML yang dipotret Chrome menjadi poster & lapisan video. Warna & huruf mengikuti situs.

export const UKURAN = {
  feed: { w: 1080, h: 1080 },
  potret: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const DASAR = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%}
body{font-family:'Plus Jakarta Sans',sans-serif;color:#e9eaee;-webkit-font-smoothing:antialiased}
.latar{position:absolute;inset:0;background:radial-gradient(circle at 85% 8%,rgba(201,162,75,.28),transparent 45%),radial-gradient(circle at 10% 95%,rgba(201,162,75,.14),transparent 40%),linear-gradient(160deg,#13161c,#0c0e12 60%)}
.kisi{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:72px 72px;-webkit-mask-image:radial-gradient(ellipse at top,black,transparent 75%)}
.serif{font-family:'Fraunces',serif;font-weight:500;letter-spacing:-.02em}
.emas{color:#c9a24b}
.lencana{align-self:flex-start;display:inline-flex;align-items:center;gap:12px;border:2px solid rgba(201,162,75,.35);background:rgba(201,162,75,.12);color:#e3c989;border-radius:999px;padding:10px 26px;font-weight:700;letter-spacing:.04em}
.merek{display:flex;align-items:center;gap:14px;font-weight:800;font-size:34px}
.merek img{width:52px;height:52px}
.hp{background:#0a0c10;border:3px solid rgba(255,255,255,.18);border-radius:56px;padding:14px;box-shadow:0 40px 90px -30px rgba(0,0,0,.9)}
.hp img{display:block;width:100%;border-radius:42px}
.poin{display:flex;gap:16px;align-items:flex-start;color:#c9ced8}
.poin b{color:#c9a24b}
.klip{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.ikon{border-radius:48px;box-shadow:0 40px 90px -30px rgba(0,0,0,.9)}
.cta{background:#c9a24b;color:#1a1408;border-radius:999px;font-weight:800;padding:20px 40px;display:inline-block}
</style>`;

/** Lapisan latar: foto AI (digelapkan agar teks terbaca) atau gradasi polos. */
function latar(foto) {
  if (!foto) return '<div class="latar"></div><div class="kisi"></div>';
  return `<div style="position:absolute;inset:0;background:url('${esc(foto)}') center/cover;filter:brightness(.7) saturate(1.05)"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,14,18,.9) 0%,rgba(12,14,18,.68) 42%,rgba(12,14,18,.72) 62%,rgba(12,14,18,.95) 100%)"></div>`;
}

const tunggu = `<script>Promise.all([document.fonts.ready,...[...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))]).then(()=>document.body.setAttribute('data-siap',''))</script>`;

function merek(logo) {
  return `<div class="merek"><img src="${esc(logo)}"><span>Bakafrawi<span class="emas">.</span></span></div>`;
}

/** Poster promosi untuk satu rasio. */
export function htmlPoster({ rasio, naskah, produk, gambar, gambarIkon = false, logo, kontak, foto }) {
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
      <span style="font-size:${tegak ? 28 : 24}px;color:#9aa1ad;text-align:right">WA ${esc(kontak.whatsappTampil)}<br>bakafrawi.com</span></div>`;
  const isi = rasio === 'feed'
    ? `<div style="position:absolute;inset:64px 64px 170px;display:grid;grid-template-columns:1fr ${hpLebar}px;gap:48px;align-items:center">
         <div style="display:flex;flex-direction:column">${merek(logo)}<div style="height:28px"></div>${teks}</div><div style="display:flex;justify-content:center">${hp}</div></div>
       <div style="position:absolute;left:64px;right:64px;bottom:56px">${kaki}</div>`
    : `<div style="position:absolute;inset:${rasio === 'story' ? '90px 72px 110px' : '64px 72px 56px'};display:flex;flex-direction:column;gap:28px">
         <div style="display:flex;flex-direction:column">${merek(logo)}<div style="height:32px"></div>${teks}</div>
         <div style="flex:1;min-height:0;display:flex;justify-content:center;align-items:center">${hpTegak}</div>
         ${kaki}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8">${DASAR}<style>body{width:${w}px;height:${h}px;position:relative;overflow:hidden}</style></head>
  <body>${latar(foto)}${isi}${tunggu}</body></html>`;
}

// Tata letak video 1080×1920: layar HP (rekaman) di tengah, judul di atas, ajakan di bawah.
export const LAYAR = { x: 230, y: 360, w: 620, h: 1342, radius: 44 };

/** Lapisan depan video: latar penuh dengan lubang membulat tempat rekaman tampil (PNG transparan). */
export function htmlBingkai({ naskah, produk, logo }) {
  const { x, y, w, h, radius } = LAYAR;
  const lubang = `<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920'><rect width='1080' height='1920' fill='white'/><rect x='${x}' y='${y}' width='${w}' height='${h}' rx='${radius}' fill='black'/></svg>`;
  const masker = `url("data:image/svg+xml;utf8,${encodeURIComponent(lubang)}")`;
  return `<!doctype html><html><head><meta charset="utf-8">${DASAR}<style>
    body{width:1080px;height:1920px;position:relative;overflow:hidden;background:transparent}
    .lapis{position:absolute;inset:0;-webkit-mask-image:${masker};mask-image:${masker};-webkit-mask-mode:luminance;mask-mode:luminance}
  </style></head><body>
  <div class="lapis"><div class="latar"></div><div class="kisi"></div>
    <div style="position:absolute;left:${x - 16}px;top:${y - 16}px;width:${w + 32}px;height:${h + 32}px;border-radius:${radius + 16}px;background:#0a0c10;border:3px solid rgba(255,255,255,.2)"></div>
    <div style="position:absolute;top:70px;left:60px;right:60px;text-align:center">
      <div style="display:flex;justify-content:center">${merek(logo)}</div>
      <h1 class="serif" style="font-size:62px;line-height:1.1;margin-top:26px">${esc(naskah.judul)}</h1>
    </div>
    <div style="position:absolute;left:60px;right:60px;bottom:64px;display:flex;justify-content:space-between;align-items:center;font-size:30px">
      <span class="lencana" style="font-size:26px">${esc(produk.nama)}</span><span style="color:#9aa1ad">bakafrawi.com</span>
    </div>
  </div>${tunggu}</body></html>`;
}

/** Kartu pembuka & penutup video (layar penuh 1080×1920). */
export function htmlKartu({ jenis, naskah, produk, logo, kontak, foto }) {
  const isi = jenis === 'pembuka'
    ? `<div class="lencana" style="font-size:30px">${esc(produk.label || produk.nama)}</div>
       <h1 class="serif" style="font-size:112px;line-height:1.04;margin:40px 0 30px">${esc(naskah.judul)}</h1>
       <p style="font-size:40px;color:#9aa1ad;line-height:1.4">${esc(naskah.sub)}</p>`
    : `<h1 class="serif" style="font-size:100px;line-height:1.05;margin-bottom:44px">${esc(naskah.ajakan)}</h1>
       <div style="display:grid;gap:22px;font-size:44px;color:#c9ced8">
         <div>WhatsApp <b class="emas">${esc(kontak.whatsappTampil)}</b></div><div>bakafrawi.com</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8">${DASAR}<style>body{width:1080px;height:1920px;position:relative;overflow:hidden}</style></head>
  <body>${latar(foto)}
  <div style="position:absolute;inset:0;padding:110px 90px;display:flex;flex-direction:column;justify-content:center">
    <div style="margin-bottom:70px">${merek(logo)}</div>${isi}</div>${tunggu}</body></html>`;
}
