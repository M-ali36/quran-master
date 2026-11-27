"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import Content from "@/components/Content";
import PlayerNormal from "@/components/Player/PlayerNormal";
import QuranReviewer from "@/components/QuranReviewer";
import Reading from "@/components/Reading";

export default function HomePage() {
  const { isGuest, appData, updateAppData } = useAuth();
  const { lang, t } = useLanguage();
  const isRtl = lang === "ar";

  const [isOnline, setIsOnline] = useState(true);

  // مراقبة حالة الاتصال بالإنترنت لحظياً
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const playerType = appData?.playerType || "default";
  const requiresInternet = playerType === "reviewer" || playerType === "teacher";

  return (
    <>
      <div className="space-y-4 mb-4">
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

        {/* Offline Warning for Modes that require network */}
        {!isOnline && requiresInternet && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 backdrop-blur-md animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
              <p className="text-xs sm:text-sm text-white">
                {isRtl
                  ? "لا يوجد اتصال بالإنترنت حالياً؛ هذا الوضع يتطلب اتصالاً لتحميل الصوت أو تحليل التلاوة."
                  : "You are currently offline; this mode requires an active internet connection."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateAppData({ playerType: "reading" })}
              className="shrink-0 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-full transition active:scale-95 cursor-pointer"
            >
              {isRtl ? "الانتقال للمصحف المقروء (Offline)" : "Switch to Reading Mode"}
            </button>
          </div>
        )}
      </div>

      {/* Conditionally render modes */}
      {playerType === "reading" && <Reading />}
      {playerType === "reviewer" && <QuranReviewer />}
      {playerType === "teacher" && <Content />}
      {playerType === "default" && <PlayerNormal />}
    </>
  );
}