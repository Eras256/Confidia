import React from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "Confidia | Institutional LCP-Aware ZK Agentic Payments",
  description: "Secure, compliant, and zero-knowledge protected agentic commerce gateway on Stellar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className="antialiased min-h-screen text-slate-100 bg-[#050811] font-sans">
        {children}
      </body>
    </html>
  );
}

