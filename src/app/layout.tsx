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

export const metadata: Metadata = {
  title: "Marswalk — A Martian Survival Guide",
  description:
    "Interactive Jezero Crater map for planning safe, scientifically valuable Marswalks, built on NASA mission data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
