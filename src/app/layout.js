import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import Navbar from "@/components/Navbar";
import VideoSlider from "@/components/VideoSlider";
import InstallPrompt from "@/components/InstallPrompt";
import { Amiri_Quran } from "next/font/google";

const amiriQuran = Amiri_Quran({
  weight: "400",
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-amiri-quran",
});

export const metadata = {
  title: "HiSaja | Quran Memorization & Audio Player",
  description: "Listen, repeat, and memorize the Holy Quran with offline audio support.",
  manifest: "/manifest.webmanifest",
  applicationName: "HiSaja",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HiSaja",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={amiriQuran.variable}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased relative flex flex-col">
        <LanguageProvider>
          <AuthProvider>
            <span className="pointer-events-none absolute h-full w-full left-0 top-0 bg-[#becfd9] flex justify-center items-center overflow-hidden">
              <VideoSlider />
              <span className="absolute h-full w-full top-0 left-0 bg-gradient-to-t from-slate-400/60 to-slate-400/0 bggr"></span>
            </span>

            <Navbar />

            <main className="flex flex-col flex-1 w-full px-4 lg:px-32 mx-auto py-8 relative z-10">
              {children}
            </main>

            {/* PWA installation banner listener */}
            <InstallPrompt />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}