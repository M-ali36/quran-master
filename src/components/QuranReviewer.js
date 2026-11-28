// src/components/Reading.js
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";

const CACHE_NAME = "quran-pages-cache";

// ذاكرة تخزين مؤقت فورية (In-Memory URL Cache) لتفادي أي وميض أثناء القراءة المتكررة
const blobUrlCache = new Map();

async function getPageSource(pageNumber) {
  if (pageNumber < 1 || pageNumber > 604) return null;

  // 1. إذا كانت الصورة محوّلة إلى Blob URL مسبقاً في الذاكرة
  if (blobUrlCache.has(pageNumber)) {
    return blobUrlCache.get(pageNumber);
  }

  const defaultUrl = `/images/quran_image/${pageNumber}.png`;

  // 2. إذا كان الجهاز متصلاً، الرابط المباشر يكفي
  if (typeof window !== "undefined" && navigator.onLine) {
    return defaultUrl;
  }

  // 3. في وضع الأوفلاين، استخرجها من CacheStorage فوراً
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const res = await cache.match(defaultUrl);
      if (res) {
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        blobUrlCache.set(pageNumber, objUrl);
        return objUrl;
      }
    } catch (e) {
      console.warn(`Failed reading cache for page ${pageNumber}:`, e);
    }
  }

  return defaultUrl;
}

// مكوّن عرض صفحة المصحف بدون وميض
function QuranPageImage({ pageNumber, isPriority = false, alt = "" }) {
  // إذا كانت موجودة بالـ Map تُعرض فوراً في الريندر الأول بدون انتظار useEffect
  const [src, setSrc] = useState(() => blobUrlCache.get(pageNumber) || `/images/quran_image/${pageNumber}.png`);

  useEffect(() => {
    let isMounted = true;

    // إذا كانت متوفرة بالفعل في الذاكرة نحدثها فوراً
    if (blobUrlCache.has(pageNumber)) {
      setSrc(blobUrlCache.get(pageNumber));
      return;
    }

    getPageSource(pageNumber).then((resolvedSrc) => {
      if (isMounted && resolvedSrc) {
        setSrc(resolvedSrc);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [pageNumber]);

  return (
    <img
      src={src}
      alt={alt}
      loading={isPriority ? "eager" : "lazy"}
      decoding="async"
      className="w-full h-full object-contain pointer-events-none select-none bg-[#fdfbf7]"
      onError={async (e) => {
        if ("caches" in window) {
          try {
            const cache = await caches.open(CACHE_NAME);
            const res = await cache.match(`/images/quran_image/${pageNumber}.png`);
            if (res) {
              const blob = await res.blob();
              const fallbackUrl = URL.createObjectURL(blob);
              blobUrlCache.set(pageNumber, fallbackUrl);
              e.currentTarget.src = fallbackUrl;
            }
          } catch {}
        }
      }}
    />
  );
}

export default function Reading() {
  const { lang } = useLanguage();
  const isRtl = lang === "ar";

  const [surahs, setSurahs] = useState([]);
  const [quranPages, setQuranPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showNav, setShowNav] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // حالة السحب والتحريك
  const [dragOffset, setDragOffset] = useState(0);
  const [animatingMode, setAnimatingMode] = useState("idle");

  // Modals state
  const [isSurahModalOpen, setIsSurahModalOpen] = useState(false);
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");

  // Jump inputs
  const [pageInput, setPageInput] = useState("");
  const [jumpSurah, setJumpSurah] = useState(1);
  const [jumpVerse, setJumpVerse] = useState(1);
  const [selectedJuz, setSelectedJuz] = useState(1);

  const containerRef = useRef(null);
  const autoHideTimerRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchDeltaXRef = useRef(0);
  const wakeLockRef = useRef(null);

  // تجهيز مسبق للـ Blob URLs للصفحة الحالية والصفحات المجاورة (Pre-fetching)
  useEffect(() => {
    getPageSource(currentPage);
    if (currentPage > 1) getPageSource(currentPage - 1);
    if (currentPage < 604) getPageSource(currentPage + 1);
  }, [currentPage]);

  // 1. تحميل ملفات JSON محلياً
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

  // 2. إبقاء شاشة الموبايل مضاءة
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
      if (document.visibilityState === "visible") activateWakeLock();
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

  // 3. مراقبة حالة ملء الشاشة
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async (e) => {
    if (e) e.stopPropagation();
    try {
      if (!document.fullscreenElement) {
        const el = containerRef.current || document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn("Fullscreen toggle error:", err);
    }
  }, []);

  // 4. مؤقت إخفاء أشرطة التنقل
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

  // استخراج تفاصيل الصفحة
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
        if (surahNum === sStart) return verseNum >= vStart;
        if (surahNum === sEnd) return verseNum <= vEnd;
        return surahNum > sStart && surahNum < sEnd;
      });
      return match ? match.page : 1;
    },
    [quranPages]
  );

  // التنقل البرمجي السلس
  const handleNextPage = useCallback(() => {
    if (currentPage >= 604 || animatingMode !== "idle") return;
    const width = containerRef.current?.offsetWidth || window.innerWidth;
    setAnimatingMode("completing");
    setDragOffset(width);

    setTimeout(() => {
      setAnimatingMode("idle");
      setDragOffset(0);
      setCurrentPage((prev) => Math.min(604, prev + 1));
      triggerNavVisibility();
    }, 250);
  }, [currentPage, animatingMode, triggerNavVisibility]);

  const handlePrevPage = useCallback(() => {
    if (currentPage <= 1 || animatingMode !== "idle") return;
    const width = containerRef.current?.offsetWidth || window.innerWidth;
    setAnimatingMode("completing");
    setDragOffset(-width);

    setTimeout(() => {
      setAnimatingMode("idle");
      setDragOffset(0);
      setCurrentPage((prev) => Math.max(1, prev - 1));
      triggerNavVisibility();
    }, 250);
  }, [currentPage, animatingMode, triggerNavVisibility]);

  const handleJumpToJuz = (juzNumber) => {
    setSelectedJuz(juzNumber);
    const paddedJuz = String(juzNumber).padStart(2, "0");

    for (const s of surahs) {
      if (s.juz && Array.isArray(s.juz)) {
        const targetJuzObj = s.juz.find((j) => j.index === paddedJuz);
        if (targetJuzObj && targetJuzObj.verse?.start) {
          const surahNum = parseInt(s.index, 10);
          const verseNum = parseInt(targetJuzObj.verse.start.replace("verse_", ""), 10) || 1;
          setCurrentPage(findPageByVerse(surahNum, verseNum));
          setIsJumpModalOpen(false);
          return;
        }
      }
    }
  };

  const handleJumpToPage = () => {
    setCurrentPage(Math.max(1, Math.min(604, parseInt(pageInput, 10) || 1)));
    setIsJumpModalOpen(false);
  };

  const handleJumpToVerse = () => {
    setCurrentPage(findPageByVerse(jumpSurah, parseInt(jumpVerse, 10) || 1));
    setIsJumpModalOpen(false);
  };

  // Touch Drag Events
  const onTouchStart = (e) => {
    if (animatingMode !== "idle") return;
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
    setAnimatingMode("dragging");
  };

  const onTouchMove = (e) => {
    if (animatingMode !== "dragging") return;
    const currentX = e.touches[0].clientX;
    let delta = currentX - touchStartXRef.current;

    if (currentPage >= 604 && delta > 0) {
      delta = delta * 0.15;
    } else if (currentPage <= 1 && delta < 0) {
      delta = delta * 0.15;
    }

    touchDeltaXRef.current = delta;
    setDragOffset(delta);
  };

  const onTouchEnd = () => {
    if (animatingMode !== "dragging") return;

    const delta = touchDeltaXRef.current;
    const threshold = 55;
    const containerWidth = containerRef.current?.offsetWidth || window.innerWidth;

    if (delta > threshold && currentPage < 604) {
      setAnimatingMode("completing");
      setDragOffset(containerWidth);

      setTimeout(() => {
        setAnimatingMode("idle");
        setDragOffset(0);
        setCurrentPage((prev) => Math.min(604, prev + 1));
        triggerNavVisibility();
      }, 250);

    } else if (delta < -threshold && currentPage > 1) {
      setAnimatingMode("completing");
      setDragOffset(-containerWidth);

      setTimeout(() => {
        setAnimatingMode("idle");
        setDragOffset(0);
        setCurrentPage((prev) => Math.max(1, prev - 1));
        triggerNavVisibility();
      }, 250);

    } else {
      setAnimatingMode("completing");
      setDragOffset(0);
      setTimeout(() => {
        setAnimatingMode("idle");
      }, 200);
    }

    touchDeltaXRef.current = 0;
  };

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
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none flex flex-col justify-between transition-all duration-300 ${
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen rounded-none border-none"
          : "rounded-3xl border border-amber-900/10 shadow-2xl"
      }`}
      onClick={triggerNavVisibility}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <span className="absolute h-full w-full top-0 left-0 bg-gradient-to-t from-slate-400/60 to-slate-400/0 pointer-events-none z-10"></span>

      {/* 1. الشريط العلوي الذكي */}
      <header
        className={`absolute top-0 inset-x-0 z-30 transition-all duration-300 ease-in-out px-3 sm:px-4 py-2.5 bg-stone-900/85 backdrop-blur-md text-white flex items-center justify-between shadow-md ${
          showNav ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsSurahModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <span className="truncate max-w-[90px] sm:max-w-none">
              {currentSurah ? (isRtl ? currentSurah.titleAr : currentSurah.title) : "فهرس السور"}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border border-stone-600 rounded-xl text-xs transition active:scale-95 cursor-pointer flex items-center justify-center"
            title={isFullscreen ? (isRtl ? "إلغاء ملء الشاشة" : "Exit Fullscreen") : (isRtl ? "شاشة كاملة" : "Fullscreen")}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v5m0-5h5m6 6l5-5m0 0h-5m5 0v5m-6 6l5 5m0 0v-5m0 5h-5m-6-6l-5 5m0 0h5m-5 0v-5" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <span className="text-sm font-bold text-amber-400 font-['Amiri_Quran',_serif]">
            {pageDetails?.start?.name?.ar || ""}
          </span>
          <span className="text-[10px] text-stone-300 font-medium">
            {isRtl ? `صفحة ${currentPage} من 604` : `Page ${currentPage} / 604`}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsJumpModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>{isRtl ? "انتقال" : "Jump"}</span>
        </button>
      </header>

      {/* أزرار الأسهم للشاشات الكبيرة */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handlePrevPage();
        }}
        disabled={currentPage <= 1 || animatingMode !== "idle"}
        aria-label="Previous Page"
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-stone-900/40 hover:bg-stone-900/75 text-white backdrop-blur-xs transition disabled:opacity-0 cursor-pointer"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleNextPage();
        }}
        disabled={currentPage >= 604 || animatingMode !== "idle"}
        aria-label="Next Page"
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-stone-900/40 hover:bg-stone-900/75 text-white backdrop-blur-xs transition disabled:opacity-0 cursor-pointer"
      >
        <svg className="w-6 h-6 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* 2. حاوية العرض مع استدعاء صفحات المصحف الداعمة للأوفلاين بدون وميض */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden touch-pan-y">
        <div
          className={`relative w-full h-full flex items-center justify-center ${
            animatingMode === "completing"
              ? "transition-transform duration-250 ease-out"
              : "transition-none"
          }`}
          style={{
            transform: `translate3d(${dragOffset}px, 0, 0)`,
            willChange: "transform",
          }}
        >
          {/* الصفحة القادمة (Next Page): تقع يسار الشاشة (-100%) */}
          {currentPage < 604 && (
            <div
              key={`next-${currentPage + 1}`}
              className="absolute inset-0 flex items-center justify-center p-2 sm:p-5 pointer-events-none"
              style={{ transform: "translate3d(-100%, 0, 0)" }}
            >
              <div className="relative w-full h-full max-w-[550px] aspect-[62/100] shadow-2xl rounded-sm overflow-hidden bg-[#fdfbf7] border border-stone-200">
                <QuranPageImage
                  pageNumber={currentPage + 1}
                  alt={`Quran Page ${currentPage + 1}`}
                />
              </div>
            </div>
          )}

          {/* الصفحة الحالية (Current Page): تقع في المركز (0%) */}
          <div
            key={`current-${currentPage}`}
            className="relative w-full h-full flex items-center justify-center p-2 sm:p-5"
          >
            <div className="relative w-full h-full max-w-[550px] aspect-[62/100] shadow-2xl rounded-sm overflow-hidden bg-[#fdfbf7] border border-stone-200">
              <QuranPageImage
                pageNumber={currentPage}
                isPriority={true}
                alt={`Quran Page ${currentPage}`}
              />
            </div>
          </div>

          {/* الصفحة السابقة (Previous Page): تقع يمين الشاشة (+100%) */}
          {currentPage > 1 && (
            <div
              key={`prev-${currentPage - 1}`}
              className="absolute inset-0 flex items-center justify-center p-2 sm:p-5 pointer-events-none"
              style={{ transform: "translate3d(100%, 0, 0)" }}
            >
              <div className="relative w-full h-full max-w-[550px] aspect-[62/100] shadow-2xl rounded-sm overflow-hidden bg-[#fdfbf7] border border-stone-200">
                <QuranPageImage
                  pageNumber={currentPage - 1}
                  alt={`Quran Page ${currentPage - 1}`}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. الشريط السفلي الذكي */}
      <footer
        className={`absolute bottom-0 inset-x-0 z-30 transition-all duration-300 ease-in-out px-4 py-2.5 bg-stone-900/85 backdrop-blur-md text-white flex items-center justify-between shadow-lg ${
          showNav ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevPage();
          }}
          disabled={currentPage <= 1 || animatingMode !== "idle"}
          className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-30 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
        >
          <span>{isRtl ? "السابقة" : "Prev"}</span>
        </button>

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
          disabled={currentPage >= 604 || animatingMode !== "idle"}
          className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-30 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
        >
          <span>{isRtl ? "التالية" : "Next"}</span>
        </button>
      </footer>

      {/* مودال فهرس السور */}
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

      {/* مودال أدوات الانتقال السريع */}
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