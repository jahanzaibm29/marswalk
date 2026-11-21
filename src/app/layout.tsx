import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Replace this with your actual deployed website URL.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: "Marswalk — A Martian Survival Guide",

  description:
    "Explore Jezero Crater on Mars with Marswalk, an interactive Martian survival guide for planning safe and scientifically valuable Marswalks using NASA mission data.",

  applicationName: "Marswalk",

  keywords: [
    "Marswalk",
    "NASA",
    "Mars",
    "Jezero Crater",
    "Mars Exploration",
    "Martian Survival Guide",
    "Mars Rover",
    "Mars Mission",
  ],

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "Marswalk — A Martian Survival Guide",
    description:
      "Explore Jezero Crater on Mars with an interactive map. Plan safe routes, discover scientific locations, and explore Mars using NASA mission data.",
    url: "/",
    siteName: "Marswalk",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 627,
        alt: "Marswalk — An Interactive Martian Survival Guide",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Marswalk — A Martian Survival Guide",
    description:
      "Explore Jezero Crater on Mars with an interactive map and plan scientifically valuable Marswalks using NASA mission data.",
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
