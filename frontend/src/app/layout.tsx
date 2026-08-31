import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Shelter Thermal Designer",
  description:
    "Area-specific thermal analysis for extreme environments — first-order shelter heat-flow estimates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <p className="text-sm font-semibold text-slate-900">Shelter Thermal Designer</p>
            <p className="text-xs text-slate-500">Engineering prototype</p>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
