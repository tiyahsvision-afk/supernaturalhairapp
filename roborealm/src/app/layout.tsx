import type { Metadata, Viewport } from "next";
import { Fredoka, Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", weight: ["400", "500", "600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ROBOREALM",
  description: "Build, program, test and debug simulated robots. A robotics career-training simulator disguised as an adventure game.",
};

export const viewport: Viewport = { themeColor: "#0b1437", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
