// src/components/InstallPrompt.js
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";

const CACHE_NAME = "quran-pages-cache";
const TOTAL_PAGES = 604;
const CONCURRENT_DOWNLOADS = 5;

export default function InstallPrompt() {
  const { lang } = useLanguage();
  const isRtl = lang === "ar";

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  // حالات الكاش والتحميل (منفصلة تماماً عن صلاحية التثبيت)
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isAllCached, setIsAllCached] = useState(false);

  const abortControllerRef = useRef(null);

  // 1. مزامنة وتحميل صفحات المصحف في الـ CacheStorage
  const syncOfflineQuranPages = useCallback(async () => {
    if (typeof window === "undefined" || !("caches" in window)) return;

    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      const cachedPaths = new Set(keys.map((k) => new URL(k.url).pathname));

      const missingPages = [];
      for (let p = 1; p <= TOTAL_PAGES; p++) {
        const path = `/images/quran_image/${p}.png`;
        if (!cachedPaths.has(path)) {
          missingPages.push(p);
        }
      }

      let completedCount = TOTAL_PAGES - missingPages.length;
      setDownloadProgress(Math.round((completedCount / TOTAL_PAGES) * 100));

      if (missingPages.length === 0) {
        setIsAllCached(true);
        setIsDownloading(false);
        return;
      }

      setIsDownloading(true);
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      for (let i = 0; i < missingPages.length; i += CONCURRENT_DOWNLOADS) {
        if (signal.aborted) break;

        const batch = missingPages.slice(i, i + CONCURRENT_DOWNLOADS);
        await Promise.all(
          batch.map(async (pageNum) => {
            const url = `/images/quran_image/${pageNum}.png`;
            try {
              const res = await fetch(url, { signal, cache: "reload" });
              if (res.ok) {
                await cache.put(url, res);
                completedCount += 1;
              }
            } catch (err) {
              if (err.name !== "AbortError") {
                console.warn(`Failed to cache Quran page ${pageNum}:`, err);
              }
            }
          })
        );

        setDownloadProgress(Math.round((completedCount / TOTAL_PAGES) * 100));
      }

      if (completedCount >= TOTAL_PAGES) {
        setIsAllCached(true);
      }
    } catch (err) {
      console.error("Cache sync error:", err);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  // 2. تتبع بيئة التشغيل وأحداث المتصفح
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW Registration failed:", err));
    }

    // فحص وضع الـ Standalone (هل التطبيق يعمل كنافذة تطبيق مستقلة حالياً؟)
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    setIsStandalone(standaloneMode);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
    setIsIos(isIosDevice);

    // فحص الكاش فقط لمعرفة هل نحتاج استكمال تنزيل الصفحات
    if ("caches" in window) {
      caches.open(CACHE_NAME).then(async (cache) => {
        const keys = await cache.keys();
        const count = keys.filter((k) => k.url.includes("/images/quran_image/")).length;
        const allCached = count >= TOTAL_PAGES;
        setIsAllCached(allCached);

        // إذا كان التطبيق مفتوحاً في وضع standalone والصفحات لم تكتمل بعد، نتابع تحميلها
        if (standaloneMode && !allCached) {
          setIsVisible(true);
          syncOfflineQuranPages();
        }
      });
    }

    // إذا كان التطبيق مفتوحاً كـ Standalone وكل شيء مكتمل في الكاش، لا داعي لظهور البار
    if (standaloneMode) return;

    // فحص الإغلاق المؤقت للجلسة
    const isDismissed = sessionStorage.getItem("pwa_install_dismissed");
    if (isDismissed) return;

    // استقبال حدث جاهزية التثبيت
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    // عند تثبيت التطبيق بنجاح
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      syncOfflineQuranPages();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [syncOfflineQuranPages]);

  // 3. نقرة زر التثبيت
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // إذا لم يتوفر حدث التثبيت بعد (Chrome cooldown أو متصفح لا يدعمه)، نبدأ مزامنة الكاش كإجراء بديل
      syncOfflineQuranPages();
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsVisible(false);
      syncOfflineQuranPages();
    }
  };

  const handleDismiss = () => {
    if (isDownloading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsVisible(false);
    sessionStorage.setItem("pwa_install_dismissed", "true");
  };

  // إخفاء المكون فقط إذا كان التطبيق مثبتاً ويعمل كـ Standalone، وكل الصفحات مكتملة وغير جارية التنزيل
  if (isStandalone && isAllCached && !isDownloading) return null;
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 font-bold text-xs shadow-sm font-['Amiri_Quran',_serif]">
              قرآن
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {isDownloading
                  ? isRtl ? "جاري تحميل صفحات المصحف..." : "Downloading Quran Pages..."
                  : !isStandalone
                  ? isRtl ? "تثبيت تطبيق HiSaja" : "Install HiSaja App"
                  : isRtl ? "المصحف المقروء أوفلاين" : "Offline Quran Reader"}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isDownloading
                  ? isRtl ? `تم حفظ ${downloadProgress}% من الصفحات` : `${downloadProgress}% cached`
                  : isIos && !isStandalone
                  ? isRtl ? "اضغط على «مشاركة» ثم «إضافة للشاشة الرئيسية»" : "Tap Share then 'Add to Home Screen'"
                  : isAllCached
                  ? isRtl ? "الصفحات جاهزة للقراءة بدون إنترنت" : "All pages ready for offline reading"
                  : isRtl ? "قراءة واستماع بدون إنترنت مع تجربة تطبيق سريعة" : "Full offline access and faster loading"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* زر الإغلاق */}
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* زر التثبيت: يظهر دائماً طالما أن المستخدم في المتصفح العادي (وليس في وضع standalone) */}
            {!isStandalone && !isDownloading && !isIos && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                {isRtl ? "تثبيت" : "Install"}
              </button>
            )}

            {/* شارة إتمام تحميل الصفحات إن كان التطبيق مثبتاً والصفحات مكتملة */}
            {isStandalone && isAllCached && (
              <span className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 text-xs font-bold">
                ✓
              </span>
            )}
          </div>
        </div>

        {/* شريط التقدم أثناء التنزيل */}
        {isDownloading && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}