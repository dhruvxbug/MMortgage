import type { Metadata } from "next";
import type { ReactNode } from "react";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "MezoMortgage",
  description:
    "Borrow against BTC on Mezo, route MUSD yield into escrow, and let your Bitcoin help pay for your house.",
  openGraph: {
    title: "MezoMortgage",
    description:
      "Your Bitcoin pays for your house. Borrow against BTC, earn yield in MUSD, and auto-pay real-world property installments.",
    siteName: "MezoMortgage",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MezoMortgage",
    description:
      "Bank-free. Sell-free. Debt that pays itself with Bitcoin-backed yield.",
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-zinc-950 text-white">
        <Providers>
          <div className="min-h-screen">
            <Navbar />
            <main>{children}</main>
            <div className="px-4 pb-4 sm:px-6 lg:px-10">
              <Footer />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
