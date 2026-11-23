"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { surahCache } from "@/lib/surahCache";
import Player from './Player'
import NavigationControls from './NavigationControls'

export default function Content() {
  const { appData } = useAuth();
  const { lang } = useLanguage(); // "ar" or "en"

  // 1. Surah and Aya numbers with defaults
  const currentSura = appData?.currentSura ?? 1;
  const currentAya = appData?.currentAya ?? 1;

  // 2. Pad to 3-digit strings (e.g. "001")
  const formattedSura = String(currentSura).padStart(3, "0");
  const formattedAya = String(currentAya).padStart(3, "0");
  const fileName = `${formattedSura}_${formattedAya}.json`;

  const [surahInfo, setSurahInfo] = useState(null);
  const [ayaData, setAyaData] = useState(null);
  const [loadingAya, setLoadingAya] = useState(true);
  const [error, setError] = useState(null);

  // 3. Retrieve Surah data from Storage/Cookie cache, or load JSON once on demand
  useEffect(() => {
    let isMounted = true;

    async function resolveSurahData() {
      // Step A: Check local cache first
      const cached = surahCache.get(formattedSura);
      if (cached) {
        if (isMounted) setSurahInfo(cached);
        return;
      }

      // Step B: Cache miss -> dynamically import surah.json, extract target, and cache it
      try {
        const module = await import("@/data/surah.json");
        const list = module.default || module;
        const matched =
          list.find((s) => s.index === formattedSura) ||
          list[Number(currentSura) - 1];

        if (matched && isMounted) {
          setSurahInfo(matched);
          surahCache.set(matched); // Store for future sessions
        }
      } catch (err) {
        console.error("Failed to load surah list:", err);
      }
    }

    resolveSurahData();

    return () => {
      isMounted = false;
    };
  }, [formattedSura, currentSura]);

  // 4. Dynamically import verse data
  useEffect(() => {
    let isMounted = true;

    async function loadAyaFile() {
      setLoadingAya(true);
      setError(null);

      try {
        const fileModule = await import(
          `@/data/verses/${formattedSura}_${formattedAya}.json`
        );

        if (isMounted) {
          setAyaData(fileModule.default || fileModule);
        }
      } catch (err) {
        if (isMounted) {
          setError(`File not found: src/data/verses/${fileName}`);
          setAyaData(null);
        }
      } finally {
        if (isMounted) {
          setLoadingAya(false);
        }
      }
    }

    loadAyaFile();

    return () => {
      isMounted = false;
    };
  }, [formattedSura, formattedAya, fileName]);

  // Localized Surah Title & Type
  const surahTitle = lang === "ar" ? surahInfo?.titleAr : surahInfo?.title;
  const surahType =
    lang === "ar"
      ? surahInfo?.type === "Makkiyah" ? "مكية" : "مدنية"
      : surahInfo?.type;

  return (
    <section className="mt-auto w-full min-h-64 frosted-card rounded-[20px] p-6 lg:p-12 flex flex-col items-center justify-center gap-6">
      {/* Meta Bar */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 text-xs sm:text-sm text-slate-600 bg-white/70 backdrop-blur-xs px-5 py-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="font-semibold text-slate-800">
            {lang === "ar" ? "السورة: " : "Surah: "}
          </span>
          <span>{surahTitle ? `${surahTitle} (${currentSura})` : currentSura}</span>
        </div>

        {surahType && (
          <>
            <div className="w-px h-4 bg-slate-300" />
            <div>
              <span className="font-semibold text-slate-800">
                {lang === "ar" ? "النوع: " : "Type: "}
              </span>
              <span>{surahType}</span>
            </div>
          </>
        )}

        <div className="w-px h-4 bg-slate-400" />

        <div>
          <span className="font-semibold text-slate-800">
            {lang === "ar" ? "الآية: " : "Aya: "}
          </span>
          <span>{ayaData?.number ?? currentAya}</span>
          {surahInfo?.count && (
            <span className="text-slate-400 text-xs"> / {surahInfo.count}</span>
          )}
        </div>

        {ayaData && (
          <>
            <div className="w-px h-4 bg-slate-300" />
            <div>
              <span className="font-semibold text-slate-800">
                {lang === "ar" ? "الجزء: " : "Juz: "}
              </span>
              <span>{ayaData.juz}</span>
            </div>

            <div className="w-px h-4 bg-slate-300" />
            <div>
              <span className="font-semibold text-slate-800">
                {lang === "ar" ? "الصفحة: " : "Page: "}
              </span>
              <span>{ayaData.page}</span>
            </div>

            {ayaData.sajda && (
              <>
                <div className="w-px h-4 bg-slate-300" />
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  {lang === "ar" ? "سجدة" : "Sajda"}
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-2xl text-center">
        {loadingAya && (
          <div className="text-sm text-slate-400 animate-pulse py-8">
            {lang === "ar" ? "جاري تحميل الآية..." : "Loading verse..."}
          </div>
        )}

        {error && (
          <div className="text-xs text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100">
            {error}
          </div>
        )}

        {!loadingAya && !error && ayaData && (
          <div className="space-y-6">
            {/* Arabic Text */}
            <p
              dir="rtl"
              className="text-2xl font-amiri-quran sm:text-3xl leading-[2.2] text-black px-2"
            >
              {ayaData.text?.ar}
            </p>

            {/* English Translation */}
            {ayaData.text?.en && (
              <p
                dir="ltr"
                className="text-sm sm:text-base text-black leading-relaxed max-w-xl mx-auto font-sans"
              >
                "{ayaData.text.en}"
              </p>
            )}
          </div>
        )}
      </div>
      <Player />
      <NavigationControls />
    </section>
  );
}