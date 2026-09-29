import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "@/components/TopBar";
import NavTabs from "@/components/NavTabs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Annotation Task & Payout Tracker",
  description: "Session duration accounting and dual-currency payout ledger",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TopBar />
        <NavTabs />
        <main className="flex-1 w-full max-w-[2200px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 py-4 sm:py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
