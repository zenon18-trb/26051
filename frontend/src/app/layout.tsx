import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Instrument_Serif, Inter } from "next/font/google";

import { ShelterConfigurationProvider } from "@/context/ShelterConfigurationContext";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shelter Thermal Designer | DRDO",
  description:
    "Configure and analyze shelter thermal performance for extreme environments.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${instrumentSerif.variable} ${inter.variable} min-h-screen antialiased`}>
        <ShelterConfigurationProvider>{children}</ShelterConfigurationProvider>
      </body>
    </html>
  );
}
