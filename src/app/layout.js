import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import Navbar from "@/components/Navbar";
import VideoSlider from "@/components/VideoSlider";
import Image from "next/image";

export const metadata = {
  title: "App with Firebase & Localization",
  description: "Next.js open guest app with Google Auth sync to Firestore",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased relative flex flex-col">
        <LanguageProvider>
          <AuthProvider>
            <span className="absolute h-full w-full left-0 top-0 bg-[#becfd9] flex justify-center items-center">
              {/*<Image
                src="/images/bg.png"
                alt="User Avatar"
                width={2048}
                height={2048}
                priority // Add priority if the image is above the fold (e.g., in a navbar or hero)
                className="max-h-full w-auto absolute mix-blend-multiply"
              />*/}
              <VideoSlider />
              <span className="absolute  h-full w-full top-0 left-0 bg-gradient-to-t from-slate-400/60 to-slate-400/0 bggr"></span>
            </span>
            <Navbar />
            <main className="flex-1 w-full px-4 lg:px-32 mx-auto px-4 py-8 relative z-[1]">
              {children}
            </main>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}