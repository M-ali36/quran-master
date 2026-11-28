// src/app/layout.js
import "./globals.css";
import Image from "next/image";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hisaja.site";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "HiSaja | منصة القرآن الكريم - تلاوة، تحفيظ، ومصحف إلكتروني بدون إنترنت",
    template: "%s | HiSaja",
  },
  description:
    "استمع للقرآن الكريم بأصوات نخبة القراء، مع وضع المعلم لتكرار الآيات والتحفيظ، والمصحف المقروء بالرسم العثماني الذي يعمل بدون إنترنت، بالإضافة إلى التسميع والمراجعة الذكية.",
  manifest: "/manifest.webmanifest",
  applicationName: "HiSaja",
  category: "Religion & Education",
  keywords: [
    "القرآن الكريم",
    "تلاوة القرآن",
    "المصحف الإلكتروني",
    "تحفيظ القرآن",
    "مصحف بدون نت",
    "تسميع القرآن",
    "HiSaja",
    "Quran Reader",
    "Quran Audio",
    "Quran Memorization",
  ],
  authors: [{ name: "HiSaja Team", url: siteUrl }],
  creator: "HiSaja",
  publisher: "HiSaja",
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
      { url: "/favicon.png", sizes: "any" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "ar_AR",
    alternateLocale: ["en_US"],
    url: siteUrl,
    siteName: "HiSaja",
    title: "HiSaja | منصة القرآن الكريم - استماع، قراءة وتحفيظ",
    description:
      "تطبيق القرآن الكريم المتكامل: استماع متواصل، وضع تكرار الآيات للتحفيظ، وقراءة صفحات المصحف كاملة بدون اتصال بالإنترنت.",
    images: [
      {
        url: "/images/og-cover.webp",
        width: 1200,
        height: 630,
        alt: "HiSaja Quran Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HiSaja | منصة القرآن الكريم",
    description:
      "استمع واقرأ واحفظ القرآن الكريم مع أوضاع متعددة تشمل المصحف المقروء أوفلاين والمراجع الذكي.",
    images: ["/images/og-cover.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // السماح بالتكبير المريح لصفحات المصحف
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={amiriQuran.variable}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased relative flex flex-col">
        <LanguageProvider>
          <AuthProvider>
            <span className="pointer-events-none fixed h-full w-full left-0 top-0 bg-[#becfd9] flex justify-center items-center overflow-hidden z-0">
              {/* Static background image for mobile/tablet */}
              <div className="relative w-full h-full">
                <Image
                  src="/images/bg.png"
                  alt="Background"
                  fill
                  priority
                  className="object-cover"
                />
              </div>

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