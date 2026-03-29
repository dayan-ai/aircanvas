import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Air Canvas - AI Powered Drawing",
  description: "An interactive, browser-based Air Canvas app powered by Next.js, Tailwind CSS, and Mediapipe.",
  keywords: ["Air Canvas", "Next.js", "Computer Vision", "Tailwind CSS", "Mediapipe", "Hand Tracking"],
  authors: [{ name: "Dayan" }],
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "Air Canvas",
    description: "Draw and paint using real-time AI hand gestures",
    url: "https://aircanvas.vercel.app",
    siteName: "Air Canvas",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Air Canvas",
    description: "Draw and paint using real-time AI hand gestures",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
