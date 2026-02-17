import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Bronn AI — Intelligent Appointment Orchestration",
    template: "%s | Bronn AI",
  },
  description:
    "AI-driven dental scheduling with multi-resource constraint solving, emergency triage, and One-Stop-Shop combo appointments.",
  keywords: [
    "dental scheduling",
    "AI healthcare",
    "appointment orchestration",
    "dental clinic management",
  ],
  authors: [{ name: "Bronn AI" }],
  creator: "Bronn AI",
  metadataBase: new URL("https://bronn.dev"),
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Bronn AI — Intelligent Appointment Orchestration",
    description:
      "AI-driven dental scheduling with multi-resource constraint solving, emergency triage, and One-Stop-Shop combo appointments.",
    siteName: "Bronn AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bronn AI — Intelligent Appointment Orchestration",
    description:
      "AI-driven dental scheduling with multi-resource constraint solving, emergency triage, and One-Stop-Shop combo appointments.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0e17" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className={`${inter.className} min-h-screen bg-brand-primary text-brand-text-primary antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}