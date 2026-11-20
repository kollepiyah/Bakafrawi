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

/** Poster promosi untuk satu rasio. Mendukung 4 gaya: modern-clean, before-after, bold-typo, photo-floating. */
export function htmlPoster({ rasio, naskah, produk, gambar, gambarIkon = false, logo, kontak, foto, tema = temaMerek(null), gaya = 'modern-clean' }) {
  const t = tema;
  const { w, h } = UKURAN[rasio];
  const tegak = h > w;
  const hpLebar = rasio === 'feed' ? 380 : rasio === 'potret' ? 430 : 560;
  const poin = naskah.poin.slice(0, rasio === 'feed' ? 3 : 4).map((p) => `<div class="poin"><b>✓</b><span>${esc(p)}</span></div>`).join('');
  const hp = !gambar ? '' : gambarIkon
    ? `<img class="ikon" src="${esc(gambar)}" style="width:${Math.round(hpLebar * 0.8)}px">`
    : `<div class="hp" style="width:${hpLebar}px"><img src="${esc(gambar)}"></div>`;
  const hpTegak = !gambar ? '' : gambarIkon
    ? `<img class="ikon" src="${esc(gambar)}" style="max-height:100%;max-width:60%">`
    : `<div class="hp" style="height:100%;display:flex"><img src="${esc(gambar)}" style="height:100%;width:auto;object-fit:contain"></div>`;
  const kaki = (terang = false) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px">
      <span class="cta" style="font-size:${tegak ? 34 : 28}px">${esc(naskah.ajakan)} →</span>
      <span style="font-size:${tegak ? 28 : 24}px;color:${terang ? '#475569' : '#9aa1ad'};text-align:right;font-weight:600">${kontakTeks(t, kontak, '<br>')}</span></div>`;

  // ── GAYA 2: BOLD TYPOGRAPHY / KAROSEL IG TERANG ──
  if (gaya === 'bold-typo') {
    const kartuPoin = naskah.poin.slice(0, 3).map((p, i) => `
      <div style="display:flex;align-items:center;gap:18px;background:#fff;border:2px solid #E5E7EB;border-radius:24px;padding:${tegak ? '22px 28px' : '16px 22px'};box-shadow:0 12px 28px rgba(15,23,42,.06)">
        <span style="width:44px;height:44px;border-radius:14px;background:${t.aksen};color:#111;font-weight:800;font-size:24px;display:grid;place-items:center;flex-shrink:0">0${i + 1}</span>
        <span style="font-weight:700;font-size:${tegak ? 30 : 25}px;color:#0F172A">${esc(p)}</span>
      </div>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8">${dasar(t)}
    <style>body{width:${w}px;height:${h}px;position:relative;overflow:hidden;background:#F8F5EE;color:#0F172A}
    .kisi-terang{position:absolute;inset:0;background-image:linear-gradient(rgba(15,23,42,.05) 1.5px,transparent 1.5px),linear-gradient(90deg,rgba(15,23,42,.05) 1.5px,transparent 1.5px);background-size:64px 64px}</style></head>
    <body><div class="kisi-terang"></div>
    <div style="position:absolute;inset:${rasio === 'story' ? '92px 72px 110px' : '64px 68px 56px'};display:flex;flex-direction:column;justify-content:space-between;gap:28px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="merek" style="color:#0F172A">${logo ? `<img src="${esc(logo)}">` : ''}<span>${esc(t.nama)}<span class="emas">.</span></span></div>
        <span style="background:#0F172A;color:#fff;border-radius:999px;padding:12px 26px;font-weight:800;font-size:${tegak ? 24 : 20}px">${esc(produk.nama)}</span>
      </div>
      <div>
        <h1 style="font-weight:800;font-size:${rasio === 'story' ? 104 : rasio === 'potret' ? 84 : 68}px;line-height:1.03;letter-spacing:-.03em;color:#0F172A;margin-bottom:24px">
          <span style="background:${t.aksen};padding:0 16px;border-radius:16px;box-decoration-break:clone;-webkit-box-decoration-break:clone">${esc(naskah.judul)}</span>
        </h1>
        <p style="font-size:${tegak ? 34 : 26}px;color:#475569;line-height:1.4;font-weight:600">${esc(naskah.sub)}</p>
      </div>
      <div style="display:grid;gap:16px">${kartuPoin}</div>
      ${kaki(true)}
    </div>${tunggu}</body></html>`;
  }

  // ── GAYA 3: BEFORE VS AFTER (MASALAH VS SOLUSI) ──
  if (gaya === 'before-after') {
    const sebelum = ['Rekap manual rawan selisih', 'Antre lama & catatan tercecer', 'Susah pantau laporan dari HP'];
    const sesudah = naskah.poin.slice(0, 3);
    const daftarX = sebelum.map((x) => `<div style="display:flex;gap:12px;align-items:flex-start;font-size:${tegak ? 27 : 22}px;color:#FCA5A5"><b>✕</b><span>${esc(x)}</span></div>`).join('');
    const daftarV = sesudah.map((x) => `<div style="display:flex;gap:12px;align-items:flex-start;font-size:${tegak ? 27 : 22}px;color:#E2E8F0"><b style="color:#34D399">✓</b><span>${esc(x)}</span></div>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8">${dasar(t)}<style>body{width:${w}px;height:${h}px;position:relative;overflow:hidden}</style></head>
    <body>${latar(foto)}
    <div style="position:absolute;inset:${rasio === 'story' ? '92px 68px 110px' : '58px 64px 52px'};display:flex;flex-direction:column;justify-content:space-between;gap:26px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        ${merek(t, logo)}
        <div class="lencana" style="font-size:${tegak ? 24 : 20}px">${esc(produk.nama)}</div>
      </div>
      <div>
        <h1 class="serif klip" style="-webkit-line-clamp:3;font-size:${rasio === 'story' ? 88 : rasio === 'potret' ? 72 : 58}px;line-height:1.06;margin-bottom:14px">${esc(naskah.judul)}</h1>
        <p style="font-size:${tegak ? 30 : 24}px;color:#9aa1ad;line-height:1.35">${esc(naskah.sub)}</p>
      </div>
      <div style="display:grid;grid-template-columns:${rasio === 'story' ? '1fr' : '1fr 1fr'};gap:22px;flex:1;align-content:center">
        <div style="background:rgba(239,68,68,.10);border:2px solid rgba(239,68,68,.35);border-radius:30px;padding:30px;display:grid;gap:16px">
          <div style="font-size:22px;font-weight:800;letter-spacing:.08em;color:#F87171;text-transform:uppercase">✕ Cara Lama</div>
          ${daftarX}
        </div>
        <div style="background:${rgba(t.aksen, 0.14)};border:2px solid ${rgba(t.aksen, 0.55)};border-radius:30px;padding:30px;display:grid;gap:16px;box-shadow:0 24px 60px -24px ${rgba(t.aksen, 0.35)}">
          <div style="font-size:22px;font-weight:800;letter-spacing:.08em;color:${t.aksenMuda};text-transform:uppercase">✓ Pakai ${esc(produk.nama)}</div>
          ${daftarV}
        </div>
      </div>
      ${kaki(false)}
    </div>${tunggu}</body></html>`;
  }

  // ── GAYA 4: PHOTO FLOATING (FOTO SUASANA AI + KARTU GLASS MELAYANG) ──
  if (gaya === 'photo-floating') {
    const latarCerah = foto
      ? `<div style="position:absolute;inset:0;background:url('${esc(foto)}') center/cover;filter:brightness(.88) saturate(1.12)"></div>
         <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,12,16,.55) 0%,rgba(10,12,16,.18) 38%,rgba(10,12,16,.88) 100%)"></div>`
      : latar(null);
    return `<!doctype html><html><head><meta charset="utf-8">${dasar(t)}<style>body{width:${w}px;height:${h}px;position:relative;overflow:hidden}</style></head>
    <body>${latarCerah}
    <div style="position:absolute;inset:${rasio === 'story' ? '88px 64px 104px' : '56px 60px 52px'};display:flex;flex-direction:column;justify-content:space-between;gap:24px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        ${merek(t, logo)}
        <div class="lencana" style="font-size:${tegak ? 24 : 20}px;backdrop-filter:blur(10px)">${esc(produk.nama)}</div>
      </div>
      <div style="flex:1;min-height:0;display:flex;justify-content:center;align-items:center">
        ${gambar ? `<div style="transform:rotate(-2.5deg);height:${tegak ? '88%' : '340px'};display:flex;justify-content:center">${tegak ? hpTegak : hp}</div>` : ''}
      </div>
      <div style="background:rgba(14,17,24,.78);backdrop-filter:blur(18px);border:2px solid rgba(255,255,255,.16);border-radius:36px;padding:34px 38px;display:grid;gap:18px;box-shadow:0 32px 72px rgba(0,0,0,.55)">
        <h1 class="serif klip" style="-webkit-line-clamp:2;font-size:${rasio === 'story' ? 76 : rasio === 'potret' ? 66 : 52}px;line-height:1.06">${esc(naskah.judul)}</h1>
        <p style="font-size:${tegak ? 28 : 23}px;color:#cbd5e1;line-height:1.35">${esc(naskah.sub)}</p>
        <div style="display:grid;gap:10px;font-size:${tegak ? 27 : 22}px">${poin}</div>
        <div style="padding-top:8px">${kaki(false)}</div>
      </div>
    </div>${tunggu}</body></html>`;
  }

  // ── GAYA 1 (BAWAAN): MODERN CLEAN EDITORIAL ──
  const teks = `
    <div class="lencana" style="font-size:${tegak ? 26 : 22}px">${esc(produk.nama)}</div>
    <h1 class="serif klip" style="-webkit-line-clamp:3;font-size:${rasio === 'story' ? 96 : rasio === 'potret' ? 78 : 62}px;line-height:1.05;margin:28px 0 20px">${esc(naskah.judul)}</h1>
    <p class="klip" style="-webkit-line-clamp:${rasio === 'feed' ? 2 : 3};font-size:${tegak ? 34 : 26}px;color:#9aa1ad;line-height:1.4;margin-bottom:30px">${esc(naskah.sub)}</p>
    <div style="display:grid;gap:14px;font-size:${tegak ? 32 : 27}px">${poin}</div>`;
  const isi = rasio === 'feed'
    ? `<div style="position:absolute;inset:64px 64px 170px;display:grid;grid-template-columns:1fr ${hpLebar}px;gap:48px;align-items:center">
         <div style="display:flex;flex-direction:column">${merek(t, logo)}<div style="height:28px"></div>${teks}</div><div style="display:flex;justify-content:center">${hp}</div></div>
       <div style="position:absolute;left:64px;right:64px;bottom:56px">${kaki(false)}</div>`
    : `<div style="position:absolute;inset:${rasio === 'story' ? '90px 72px 110px' : '64px 72px 56px'};display:flex;flex-direction:column;gap:28px">
         <div style="display:flex;flex-direction:column">${merek(t, logo)}<div style="height:32px"></div>${teks}</div>
         <div style="flex:1;min-height:0;display:flex;justify-content:center;align-items:center">${hpTegak}</div>
         ${kaki(false)}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8">${dasar(t)}<style>body{width:${w}px;height:${h}px;position:relative;overflow:hidden}</style></head>
  <body>${latar(foto)}${isi}${tunggu}</body></html>`;
}
