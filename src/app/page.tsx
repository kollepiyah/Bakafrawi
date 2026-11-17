import { produkTampil } from "@/content/situs";
import { ambilKonten } from "@/lib/konten";
import { Bagian, KepalaBagian } from "@/components/situs/bagian";
import { HargaMaktaba } from "@/components/situs/harga-maktaba";
import { Hero } from "@/components/situs/hero";
import { KartuProduk } from "@/components/situs/kartu-produk";
import { Footer, Kontak } from "@/components/situs/kontak-footer";
import { Layanan } from "@/components/situs/layanan";
import { Navbar } from "@/components/situs/navbar";
import { Proses, Tentang } from "@/components/situs/tentang-proses";

export default async function Beranda() {
  const situs = await ambilKonten();
  const produkSendiri = [...produkTampil(situs, "saas"), ...produkTampil(situs, "aplikasi")];
  const karyaPesanan = produkTampil(situs, "pesanan");
  return (
    <>
      <Navbar nama={situs.nama} />
      <main>
        <Hero situs={situs} />
        <Layanan layanan={situs.layanan} />

        {produkSendiri.length > 0 && (
          <Bagian id="produk">
            <KepalaBagian
              label="Produk Kami"
              judul="Aplikasi siap pakai"
              isi="Aplikasi buatan Bakafrawi yang bisa langsung Anda gunakan — tanpa menunggu proses pembuatan."
            />
            {produkSendiri.map((p) => (
              <div key={p.slug}>
                <KartuProduk produk={p} />
                {/* Saat ini hanya Maktaba yang harganya bisa dibaca dari database aplikasinya. */}
                {p.slug === "maktaba-pos" && p.tampilHarga && <HargaMaktaba urlDaftar="https://maktabapos.web.app/register" />}
              </div>
            ))}
          </Bagian>
        )}

        {karyaPesanan.length > 0 && (
          <Bagian id="karya">
            <KepalaBagian
              label="Karya Pesanan"
              judul="Dibangun khusus untuk klien"
              isi="Aplikasi milik lembaga dan usaha yang kami rancang, bangun, dan rawat sesuai pesanan. Butuh yang serupa? Kami siap membuatkan."
            />
            {karyaPesanan.map((p) => (
              <KartuProduk key={p.slug} produk={p} />
            ))}
          </Bagian>
        )}

        <Proses proses={situs.proses} />
        <Tentang situs={situs} />
        <Kontak situs={situs} />
      </main>
      <Footer situs={situs} />
    </>
  );
}
