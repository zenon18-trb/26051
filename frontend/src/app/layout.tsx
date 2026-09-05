import type { Metadata } from "next";

import { ShelterConfigurationProvider } from "@/context/ShelterConfigurationContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shelter Thermal Designer | DRDO",
  description:
    "Configure and analyze shelter thermal performance for extreme environments.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased"><ShelterConfigurationProvider>{children}</ShelterConfigurationProvider></body>
    </html>
  );
}
