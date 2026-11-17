import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { situs } from "@/content/situs";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

const judul = `${situs.nama} — ${situs.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(situs.urlSitus),
  title: { default: judul, template: `%s · ${situs.nama}` },
  description: situs.deskripsi,
  alternates: { canonical: "/" },
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: { title: judul, description: situs.deskripsi, url: "/", siteName: situs.nama, type: "website", locale: "id_ID", images: ["/logo.png"] },
  twitter: { card: "summary", title: judul, description: situs.deskripsi, images: ["/logo.png"] },
};

export const viewport: Viewport = { themeColor: "#0c0e12" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { gaId, umamiId } = situs.analitik;
  return (
    <html lang="id" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh overflow-x-hidden">
        {children}
        {/* Analitik dipasang sekali di sini — situs lama memuat Umami dua kali sehingga kunjungan bisa tercatat ganda. */}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
        <Script id="ga" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
        </Script>
        <Script src="https://cloud.umami.is/script.js" data-website-id={umamiId} strategy="afterInteractive" />
      </body>
    </html>
  );
}
