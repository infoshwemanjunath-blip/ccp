import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Super Profit Business | Build Your UGC Business",
  description:
    "Learn how to build and grow a UGC business step by step with practical lessons, AI tools and digital business strategies.",
  keywords: ["UGC", "Content Creation", "Super Profit", "Creator Economy", "Digital Business"],
  openGraph: {
    title: "Super Profit Business | Build Your UGC Business",
    description:
      "Learn how to build and grow a UGC business step by step with practical lessons, AI tools and digital business strategies.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-cream-100 text-brandText-primary antialiased flex flex-col">
        {children}
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
