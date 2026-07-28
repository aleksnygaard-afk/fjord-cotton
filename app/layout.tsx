import type { Metadata } from "next";
import { Instrument_Serif, Archivo } from "next/font/google";
import "./globals.css";

// Display face — headlines only. UI face — everything else. (01-design-spec.md)
const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const archivo = Archivo({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fjord & Cotton",
  description:
    "Originale trykk på tung kammet bomull. Nye design publisert hver dag.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="no" className={`${instrumentSerif.variable} ${archivo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
