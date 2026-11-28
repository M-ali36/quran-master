// src/app/page.js
import HomePageClient from "@/components/HomePageClient"; // انقل كود HomePage الحالي هنا

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hisaja.com";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "HiSaja | منصة القرآن الكريم - تلاوة، تحفيظ، ومصحف إلكتروني بدون إنترنت",
    template: "%s | HiSaja",
  },
  description:
    "استمع للقرآن الكريم بأصوات نخبة القراء، مع وضع المعلم لتكرار الآيات والتحفيظ، والمصحف المقروء بالرسم العثماني الذي يعمل بدون إنترنت، بالإضافة إلى التسميع والمراجعة الذكية.",
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
    "Learn Quran",
  ],
  authors: [{ name: "HiSaja Team", url: siteUrl }],
  creator: "HiSaja",
  publisher: "HiSaja",
  applicationName: "HiSaja Quran",
  category: "Religion & Education",
  alternates: {
    canonical: "/",
    languages: {
      "ar": "/",
      "en": "/en",
      "x-default": "/",
    },
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

export default function Page() {
  // بيانات JSON-LD المنظمة (Schema.org) لمحركات البحث
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}/#webapp`,
        "name": "HiSaja",
        "url": siteUrl,
        "applicationCategory": "EducationalApplication",
        "operatingSystem": "All",
        "browserRequirements": "Requires JavaScript. Requires HTML5.",
        "description":
          "منصة قرآنية تفاعلية تقدم الاستماع لتلاوات القرآن، وضع المعلم للتحفيظ، قراءة المصحف بدون إنترنت، ومراجعة التلاوة بالذكاء الاصطناعي.",
        "inLanguage": ["ar", "en"],
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
        },
        "featureList": [
          "تلاوة القرآن الكريم بأصوات متعددة",
          "المصحف المقروء بدون إنترنت",
          "وضع المعلم لتكرار الآيات وتسهيل الحفظ",
          "التقييم الذكي للتلاوة",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        "url": siteUrl,
        "name": "HiSaja",
        "description": "منصة القرآن الكريم الشاملة للاستماع والقراءة والتحفيظ",
        "inLanguage": "ar",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePageClient />
    </>
  );
}