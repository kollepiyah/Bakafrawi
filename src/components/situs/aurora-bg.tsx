/**
 * Latar belakang Aurora bernuansa gelap-emas-teal khas Bakafrawi.
 * Murni CSS radial gradient (0% beban WebGL/JS) agar sangat ringan di PC maupun HP
 * sekaligus menjaga kontras teks Hero tetap tajam.
 */
export function AuroraBg() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-44 left-1/4 h-[420px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(24,180,168,0.13),transparent_68%)] blur-3xl" />
      <div className="absolute -top-36 right-0 h-[460px] w-[540px] rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.16),transparent_66%)] blur-3xl" />
    </div>
  );
}
