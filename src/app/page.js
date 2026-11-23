"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import Content from "@/components/Content";
import PlayerNormal from "@/components/Player/PlayerNormal";
import QuranReviewer from "@/components/QuranReviewer";

export default function HomePage() {
  const { isGuest, appData } = useAuth();
  const { t } = useLanguage();

  const playerType = appData?.playerType || "default";

  return (
    <>
      <div className="space-y-6">
        {/* Guest Mode Notice Banner */}
        {isGuest && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-black/20 text-white backdrop-blur-xs mb-4">
            <p className="text-xs sm:text-sm">{t.home.guestNotice}</p>
            <Link
              href="/login"
              className="shrink-0 px-3.5 py-1.5 bg-black text-white text-xs font-semibold rounded-full text-center transition"
            >
              {t.home.saveBtn}
            </Link>
          </div>
        )}
      </div>

      {/* Conditionally render: QuranReviewer for reviewer, Content for teacher, PlayerNormal for default */}
      {playerType === "reviewer" && <QuranReviewer />}
      {playerType === "teacher" && <Content />}
      {playerType === "default" && <PlayerNormal />}
    </>
  );
}