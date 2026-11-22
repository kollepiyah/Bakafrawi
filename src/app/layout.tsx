import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { PencatatPengunjung } from "@/components/situs/pencatat-pengunjung";
import { ambilKonten } from "@/lib/konten";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const situs = await ambilKonten();
  const judul = `${situs.nama} — ${situs.tagline}`;
  return {
    metadataBase: new URL(situs.urlSitus),
    title: { default: judul, template: `%s · ${situs.nama}` },
    description: situs.deskripsi,
    alternates: { canonical: "/" },
    icons: { icon: "/logo.png", apple: "/logo.png" },
    openGraph: { title: judul, description: situs.deskripsi, url: "/", siteName: situs.nama, type: "website", locale: "id_ID", images: ["/logo.png"] },
    twitter: { card: "summary", title: judul, description: situs.deskripsi, images: ["/logo.png"] },
  };
}

export const viewport: Viewport = { themeColor: "#0c0e12" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { gaId } = (await ambilKonten()).analitik;
  return (
    <html lang="id" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh overflow-x-hidden">
        <PencatatPengunjung />
        {children}
        {/* Analitik dipasang sekali di sini. Umami dilepas 19 Nov 2026: statistiknya tak bisa tampil langsung di situs. */}
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
