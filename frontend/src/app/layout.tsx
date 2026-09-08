import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Inter } from "next/font/google";

import { ShelterConfigurationProvider } from "@/context/ShelterConfigurationContext";
import "./globals.css";

const interDisplay = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
      <body className={`${interDisplay.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <ShelterConfigurationProvider>{children}</ShelterConfigurationProvider>
      </body>
    </html>
  );
}
