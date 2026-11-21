/**
 * Latar belakang Aurora & berkas cahaya meteor tipis (shooting beams) bernuansa gelap-emas-teal.
 * Murni CSS GPU compositor (0% beban WebGL/JS) agar sangat ringan di PC maupun HP.
 */
export function AuroraBg() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-44 left-1/4 h-[420px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(24,180,168,0.13),transparent_68%)] blur-3xl" />
      <div className="absolute -top-36 right-0 h-[460px] w-[540px] rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.16),transparent_66%)] blur-3xl" />

      {/* Berkas cahaya meteor tipis melintas lembut secara diagonal (murni CSS) */}
      <span className="animasi-meteor absolute top-16 left-[12%] h-px w-40 bg-gradient-to-r from-transparent via-emas-muda/75 to-transparent opacity-0" />
      <span className="animasi-meteor-2 absolute top-40 left-[55%] h-px w-48 bg-gradient-to-r from-transparent via-teal-400/65 to-transparent opacity-0" />
    </div>
  );
}
