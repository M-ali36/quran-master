// src/components/Reading.js
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { useLanguage } from "@/context/LanguageContext";

export default function Reading() {
  const { lang } = useLanguage();
  const isRtl = lang === "ar";

  const [surahs, setSurahs] = useState([]);
  const [quranPages, setQuranPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showNav, setShowNav] = useState(true);

  // Modals state
  const [isSurahModalOpen, setIsSurahModalOpen] = useState(false);
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");

  // Jump inputs
  const [pageInput, setPageInput] = useState("");
  const [jumpSurah, setJumpSurah] = useState(1);
  const [jumpVerse, setJumpVerse] = useState(1);
  const [selectedJuz, setSelectedJuz] = useState(1);

  const autoHideTimerRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);
  const wakeLockRef = useRef(null);

  // 1. تحميل ملفات JSON محلياً لضمان العمل بدون إنترنت
  useEffect(() => {
    async function loadOfflineData() {
      try {
        const [surahData, pagesData] = await Promise.all([
          import("@/data/surah.json"),
          import("@/data/pagesQuran.json"),
        ]);
        setSurahs(surahData.default || surahData);
        setQuranPages(pagesData.default || pagesData);
      } catch (err) {
        console.error("Failed to load local offline Quran data:", err);
      }
    }
    loadOfflineData();
  }, []);

  // 2. إبقاء شاشة الموبايل مضاءة (Screen Wake Lock API)
  useEffect(() => {
    async function activateWakeLock() {
      try {
        if ("wakeLock" in navigator && !wakeLockRef.current) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch (err) {
        console.warn("Screen Wake Lock could not be acquired:", err);
      }
    }

    activateWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        activateWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  // 3. مؤقت الإخفاء التلقائي لأشرطة الملاحة
  const triggerNavVisibility = useCallback(() => {
    setShowNav(true);
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    autoHideTimerRef.current = setTimeout(() => {
      setShowNav(false);
    }, 4000);
  }, []);

  useEffect(() => {
    triggerNavVisibility();
    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [currentPage, triggerNavVisibility]);

  // استخراج تفاصيل الصفحة الحالية والسورة
  const pageDetails = useMemo(() => {
    if (!quranPages.length) return null;
    return quranPages.find((p) => p.page === currentPage) || quranPages[0];
  }, [quranPages, currentPage]);

  const currentSurah = useMemo(() => {
    if (!pageDetails || !surahs.length) return null;
    const surahNum = pageDetails.start?.surah_number || 1;
    const formatted = String(surahNum).padStart(3, "0");
    return surahs.find((s) => s.index === formatted) || null;
  }, [pageDetails, surahs]);

  // دالة مطابقة الآية والسورة مع أرقام الصفحات من pagesQuran.json
  const findPageByVerse = useCallback(
    (surahNum, verseNum) => {
      if (!quranPages.length) return 1;
      const match = quranPages.find((p) => {
        const sStart = p.start.surah_number;
        const sEnd = p.end.surah_number;
        const vStart = p.start.verse;
        const vEnd = p.end.verse;

        if (sStart === sEnd && sStart === surahNum) {
          return verseNum >= vStart && verseNum <= vEnd;
        }
        if (surahNum === sStart) {
          return verseNum >= vStart;
        }
        if (surahNum === sEnd) {
          return verseNum <= vEnd;
        }
        return surahNum > sStart && surahNum < sEnd;
      });
      return match ? match.page : 1;
    },
    [quranPages]
  );

  // التنقل بين الصفحات
  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(604, prev + 1));
    triggerNavVisibility();
  }, [triggerNavVisibility]);

  const handlePrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
    triggerNavVisibility();
  }, [triggerNavVisibility]);

  // الانتقال إلى الجزء بالاعتماد على surah.json و pagesQuran.json
  const handleJumpToJuz = (juzNumber) => {
    setSelectedJuz(juzNumber);
    const paddedJuz = String(juzNumber).padStart(2, "0");

    for (const s of surahs) {
      if (s.juz && Array.isArray(s.juz)) {
        const targetJuzObj = s.juz.find((j) => j.index === paddedJuz);
        if (targetJuzObj && targetJuzObj.verse?.start) {
          const surahNum = parseInt(s.index, 10);
          const verseNum = parseInt(targetJuzObj.verse.start.replace("verse_", ""), 10) || 1;
          const foundPage = findPageByVerse(surahNum, verseNum);
          setCurrentPage(foundPage);
          setIsJumpModalOpen(false);
          return;
        }
      }
    }
  };

  const handleJumpToPage = () => {
    const p = Math.max(1, Math.min(604, parseInt(pageInput, 10) || 1));
    setCurrentPage(p);
    setIsJumpModalOpen(false);
  };

  const handleJumpToVerse = () => {
    const p = findPageByVerse(jumpSurah, parseInt(jumpVerse, 10) || 1);
    setCurrentPage(p);
    setIsJumpModalOpen(false);
  };

  // إيماءات السحب التاتش للموبايل (مصحف عربي RTL)
  const onTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    touchEndXRef.current = e.changedTouches[0].clientX;
    const distance = touchStartXRef.current - touchEndXRef.current;
    if (Math.abs(distance) > 50) {
      if (distance > 0) {
        // سحب لليسار -> الصفحة التالية
        handleNextPage();
      } else {
        // سحب لليمين -> الصفحة السابقة
        handlePrevPage();
      }
    }
  };

  // قائمة السور المفلترة للبحث
  const filteredSurahs = useMemo(() => {
    if (!surahSearch.trim()) return surahs;
    const term = surahSearch.toLowerCase().trim();
    return surahs.filter(
      (s) =>
        s.titleAr.includes(term) ||
        s.title.toLowerCase().includes(term) ||
        String(parseInt(s.index, 10)) === term
    );
  }, [surahs, surahSearch]);

  return (
    <div
      className="relative w-full h-[90vh] sm:h-[86vh] bg-[#fdfbf7] rounded-3xl overflow-hidden border border-amber-900/10 shadow-2xl flex flex-col justify-between select-none"
      onClick={triggerNavVisibility}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* 1. الشريط العلوي الذكي (Auto-hide Header) */}
      <header
        className={`absolute top-0 inset-x-0 z-30 transition-all duration-300 ease-in-out px-4 py-3 bg-stone-900/80 backdrop-blur-md text-white flex items-center justify-between shadow-md ${
          showNav ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsSurahModalOpen(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
        >
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span>{currentSurah ? (isRtl ? currentSurah.titleAr : currentSurah.title) : "فهرس السور"}</span>
        </button>

        {/* بيانات الصفحة الحالية والسورة */}
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-amber-400 font-['Amiri_Quran',_serif]">
            {pageDetails?.start?.name?.ar || ""}
          </span>
          <span className="text-[10px] text-stone-300 font-medium">
            {isRtl ? `صفحة ${currentPage} من 604` : `Page ${currentPage} / 604`}
          </span>
        </div>

        {/* زر الانتقال السريع */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsJumpModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>{isRtl ? "انتقال" : "Jump"}</span>
        </button>
      </header>

      {/* أزرار الأسهم للكمبيوتر */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handlePrevPage();
        }}
        disabled={currentPage <= 1}
        aria-label="Previous Page"
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-stone-900/40 hover:bg-stone-900/75 text-white backdrop-blur-xs transition disabled:opacity-0 cursor-pointer"
      >
        <svg className="w-6 h-6 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleNextPage();
        }}
        disabled={currentPage >= 604}
        aria-label="Next Page"
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-stone-900/40 hover:bg-stone-900/75 text-white backdrop-blur-xs transition disabled:opacity-0 cursor-pointer"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* 2. حاوية صورة المصحف المتوافقة مع أوفلاين */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-5 my-auto overflow-hidden">
        <div className="relative w-full max-w-[550px] aspect-[1/1.55] shadow-2xl rounded-sm overflow-hidden bg-white border border-stone-200">
          <Image
            src={`/images/quran_image/${currentPage}.png`}
            alt={`Quran Page ${currentPage}`}
            fill
            priority
            unoptimized
            className="object-contain pointer-events-none"
          />
        </div>
      </div>

      {/* 3. الشريط السفلي الذكي (Auto-hide Footer) */}
      <footer
        className={`absolute bottom-0 inset-x-0 z-30 transition-all duration-300 ease-in-out px-4 py-3 bg-stone-900/80 backdrop-blur-md text-white flex items-center justify-between shadow-lg ${
          showNav ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevPage();
          }}
          disabled={currentPage <= 1}
          className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-30 rounded-xl text-xs font-semibold cursor-pointer"
        >
          <span>{isRtl ? "السابقة" : "Prev"}</span>
        </button>

        {/* شريط تمرير سريع لأرقام الصفحات */}
        <div
          className="flex items-center gap-2 max-w-[220px] w-full mx-2"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="range"
            min={1}
            max={604}
            value={currentPage}
            onChange={(e) => setCurrentPage(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 h-1.5 bg-stone-700 rounded-lg cursor-pointer"
          />
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleNextPage();
          }}
          disabled={currentPage >= 604}
          className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-30 rounded-xl text-xs font-semibold cursor-pointer"
        >
          <span>{isRtl ? "التالية" : "Next"}</span>
        </button>
      </footer>

      {/* مودال فهرس السور مع البحث الفوري */}
      {isSurahModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsSurahModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">{isRtl ? "فهرس سور القرآن الكريم" : "Surah Index"}</h3>
              <button
                type="button"
                onClick={() => setIsSurahModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 border-b border-slate-100">
              <input
                type="text"
                value={surahSearch}
                onChange={(e) => setSurahSearch(e.target.value)}
                placeholder={isRtl ? "ابحث باسم السورة أو رقمها..." : "Search Surah..."}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              {filteredSurahs.map((s) => {
                const sNum = parseInt(s.index, 10);
                return (
                  <div
                    key={s.index}
                    onClick={() => {
                      const p = parseInt(s.pages, 10) || findPageByVerse(sNum, 1);
                      setCurrentPage(p);
                      setIsSurahModalOpen(false);
                    }}
                    className="p-3 flex items-center justify-between hover:bg-amber-50/70 rounded-2xl cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
                        {sNum}
                      </span>
                      <div>
                        <span className="text-sm font-bold text-slate-800 font-['Amiri_Quran',_serif] block">
                          {isRtl ? s.titleAr : s.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {s.type === "Madaniyah" ? (isRtl ? "مدنية" : "Madani") : (isRtl ? "مكية" : "Makki")} • {s.count} {isRtl ? "آية" : "verses"}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                      {isRtl ? `ص ${s.pages}` : `p. ${s.pages}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* مودال أدوات الانتقال السريع (صفحة / جزء / آية) */}
      {isJumpModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsJumpModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm flex flex-col p-5 gap-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">{isRtl ? "انتقال سريع في المصحف" : "Quick Jump"}</h3>
              <button
                type="button"
                onClick={() => setIsJumpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* الانتقال لرقم الصفحة */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">{isRtl ? "إلى الصفحة (1 - 604):" : "To Page (1-604):"}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={604}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  placeholder="مثال: 120"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleJumpToPage}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  {isRtl ? "اذهب" : "Go"}
                </button>
              </div>
            </div>

            {/* الانتقال للجزء (1 - 30) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">{isRtl ? "إلى الجزء (1 - 30):" : "To Juz (1-30):"}</label>
              <div className="flex gap-2">
                <select
                  value={selectedJuz}
                  onChange={(e) => setSelectedJuz(parseInt(e.target.value, 10))}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
                >
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                    <option key={j} value={j}>
                      {isRtl ? `الجزء ${j}` : `Juz ${j}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleJumpToJuz(selectedJuz)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  {isRtl ? "اذهب" : "Go"}
                </button>
              </div>
            </div>

            {/* الانتقال لآية معينة */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">{isRtl ? "إلى سورة وآية محددة:" : "To Surah & Verse:"}</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={jumpSurah}
                  onChange={(e) => setJumpSurah(parseInt(e.target.value, 10))}
                  className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
                >
                  {surahs.map((s) => (
                    <option key={s.index} value={parseInt(s.index, 10)}>
                      {parseInt(s.index, 10)}. {isRtl ? s.titleAr : s.title}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={jumpVerse}
                  onChange={(e) => setJumpVerse(e.target.value)}
                  placeholder={isRtl ? "رقم الآية" : "Verse #"}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={handleJumpToVerse}
                className="w-full mt-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                {isRtl ? "انتقال إلى الآية" : "Go to Verse"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}