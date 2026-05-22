import type { Metadata, Viewport } from "next";
import { Geist, Orbitron } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "900"],
});

export const metadata: Metadata = {
  title: "ProfitRig — Owner Operator Cost Per Mile",
  description:
    "Know your real break-even rate per mile. Built for owner operators.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ProfitRig",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${orbitron.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
