"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import Content from "@/components/Content";

export default function HomePage() {
  const { user, isGuest, appData, updateAppData, userProfile } = useAuth();
  const { t } = useLanguage();

  const handleContentChange = (e) => {
    updateAppData({
      ...appData,
      content: e.target.value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Guest Mode Notice Banner */}
      {isGuest && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-black/20 text-white backdrop-blur-xs">
          <p className="text-xs sm:text-sm">{t.home.guestNotice}</p>
          <Link
            href="/login"
            className="shrink-0 px-3.5 py-1.5 bg-black text-white text-xs font-semibold rounded-full text-center transition"
          >
            {t.home.saveBtn}
          </Link>
        </div>
      )}

      {/* Main Workspace Card */}
      <Content />
    </div>
  );
}