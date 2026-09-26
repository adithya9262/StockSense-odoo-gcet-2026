import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Shell from "./Shell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StockSense",
  description: "Minimal Stock Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
