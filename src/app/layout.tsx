import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SupportChatMount } from "@/components/SupportChatMount";
import { TimeZoneCookie } from "@/components/TimeZoneCookie";
import "./globals.css";

// The three approved ProfitRig typefaces, self-hosted from src/fonts/ (see
// the README there). All three are variable, so one file covers every weight
// the design system asks for.
//
//   Satoshi        headings, navigation, buttons, card titles, UI emphasis
//   Inter          body, descriptions, helper text, forms, tables
//   JetBrains Mono important financial values only — never ordinary digits

const satoshi = localFont({
  src: "../fonts/Satoshi-Variable.ttf",
  weight: "300 900",
  display: "swap",
  variable: "--font-satoshi",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const inter = localFont({
  src: "../fonts/Inter.ttf",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const jetBrainsMono = localFont({
  src: "../fonts/JetBrainsMono.ttf",
  weight: "100 800",
  display: "swap",
  variable: "--font-jetbrains-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
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
  // No maximumScale: a driver reading a rate confirmation in a dark cab has
  // to be able to pinch-zoom. Locking the scale was a WCAG 1.4.4 failure.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${satoshi.variable} ${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
        <TimeZoneCookie />
        <SupportChatMount />
      </body>
    </html>
  );
}
