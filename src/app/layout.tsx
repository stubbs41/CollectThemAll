import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/styles/mobile-optimizations.css";
import Header from "@/components/Header";
import MobileNavigation from "@/components/MobileNavigation";
import ApiKeyVerifier from "@/components/ApiKeyVerifier";
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
            {/* API Key Verifier runs at startup to check API keys */}
            <ApiKeyVerifier />
            <Header />
            <main className="flex-grow container mx-auto px-4 py-6 page-container">
              {children}
            </main>
            <MobileNavigation />
          </CollectionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
