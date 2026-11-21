/**
 * Latar belakang Aurora & berkas cahaya meteor tipis (shooting beams) bernuansa gelap-emas-teal.
 * Murni CSS GPU compositor (0% beban WebGL/JS) agar sangat ringan di PC maupun HP.
 */
export function AuroraBg() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Gradasi radial murni tanpa filter blur-3xl agar ringan di GPU HP & desktop */}
      <div className="absolute -top-56 left-1/4 h-[560px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(24,180,168,0.12)_0%,rgba(24,180,168,0.04)_38%,transparent_70%)]" />
      <div className="absolute -top-48 right-[-80px] h-[600px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(201,162,75,0.14)_0%,rgba(201,162,75,0.04)_38%,transparent_68%)]" />

      {/* Berkas cahaya meteor tipis melintas lembut secara diagonal (murni CSS) */}
      <span className="animasi-meteor absolute top-16 left-[12%] h-px w-40 bg-gradient-to-r from-transparent via-emas-muda/75 to-transparent opacity-0" />
      <span className="animasi-meteor-2 absolute top-40 left-[55%] h-px w-48 bg-gradient-to-r from-transparent via-teal-400/65 to-transparent opacity-0" />
    </div>
  );
}
