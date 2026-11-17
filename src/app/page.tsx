import { produkTampil, situs } from "@/content/situs";
import { Bagian, KepalaBagian } from "@/components/situs/bagian";
import { Hero } from "@/components/situs/hero";
import { KartuProduk } from "@/components/situs/kartu-produk";
import { Footer, Kontak } from "@/components/situs/kontak-footer";
import { Layanan } from "@/components/situs/layanan";
import { Navbar } from "@/components/situs/navbar";
import { Proses, Tentang } from "@/components/situs/tentang-proses";

export default function Beranda() {
  const produkSendiri = [...produkTampil("saas"), ...produkTampil("aplikasi")];
  const karyaPesanan = produkTampil("pesanan");
  return (
    <>
      <Navbar nama={situs.nama} />
      <main>
        <Hero situs={situs} />
        <Layanan layanan={situs.layanan} />

        <Bagian id="produk">
          <KepalaBagian
            label="Produk Kami"
            judul="Aplikasi siap pakai"
            isi="Aplikasi buatan Bakafrawi yang bisa langsung Anda gunakan — tanpa menunggu proses pembuatan."
          />
          {produkSendiri.map((p) => (
            <KartuProduk key={p.slug} produk={p} />
          ))}
        </Bagian>

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

        <Proses proses={situs.proses} />
        <Tentang situs={situs} />
        <Kontak situs={situs} />
      </main>
      <Footer situs={situs} />
    </>
  );
}
