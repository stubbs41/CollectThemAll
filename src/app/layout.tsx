import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { CollectionProvider } from "@/context/CollectionContext";
import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PokémonCard Locator",
  description: "Track your Pokémon card collection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-100 dark:bg-gray-900 flex flex-col min-h-screen`}
      >
        <AuthProvider>
          <CollectionProvider>
            <Header />
            <main className="flex-grow container mx-auto px-4 py-6">
              {children}
            </main>
          </CollectionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
