// src/components/InstallPrompt.js
"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";

const CACHE_NAME = "quran-pages-cache";
const TOTAL_PAGES = 604;
const BATCH_SIZE = 6; // تحميل 6 صور بالتوازي لضمان السرعة مع استقرار الأداء

export default function InstallPrompt() {
  const { lang } = useLanguage();
  const isRtl = lang === "ar";

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // حالات تحميل الصفحات أوفلاين
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloadComplete, setIsDownloadComplete] = useState(false);

  const abortControllerRef = useRef(null);

  // دالة فحص وتنزيل الصفحات الناقصة في الكاش
  const downloadQuranPages = async () => {
    if (typeof window === "undefined" || !("caches" in window)) return;

    setIsDownloading(true);
    abortControllerRef.current = new AbortController();

    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      const existingUrls = new Set(keys.map((k) => new URL(k.url).pathname));

      const missingPages = [];
      for (let p = 1; p <= TOTAL_PAGES; p++) {
        const path = `/images/quran_image/${p}.png`;
        if (!existingUrls.has(path)) {
          missingPages.push(p);
        }
      }

      let cachedCount = TOTAL_PAGES - missingPages.length;
      setDownloadProgress(Math.round((cachedCount / TOTAL_PAGES) * 100));

      if (missingPages.length === 0) {
        setIsDownloadComplete(true);
        setIsDownloading(false);
        return;
      }

      // تحميل الصفحات الناقصة بنظام الدفعات (Concurrent Batches)
      for (let i = 0; i < missingPages.length; i += BATCH_SIZE) {
        if (abortControllerRef.current?.signal.aborted) break;

        const batch = missingPages.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (pageNum) => {
            const url = `/images/quran_image/${pageNum}.png`;
            try {
              const res = await fetch(url, {
                signal: abortControllerRef.current?.signal,
                cache: "reload",
              });
              if (res.ok) {
                await cache.put(url, res);
                cachedCount += 1;
                setDownloadProgress(Math.round((cachedCount / TOTAL_PAGES) * 100));
              }
            } catch (err) {
              console.warn(`Failed caching page ${pageNum}:`, err);
            }
          })
        );
      }

      setIsDownloadComplete(true);
    } catch (err) {
      console.error("Quran offline download error:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    // 1. التحقق من وضع Standalone الحالي
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    setIsStandalone(standaloneMode);

    // 2. إذا كان التطبيق مثبتاً ويعمل في وضع Standalone، افحص هل المصحف محملاً بالكامل أم يحتاج استكمال
    if (standaloneMode) {
      if ("caches" in window) {
        caches.open(CACHE_NAME).then(async (cache) => {
          const keys = await cache.keys();
          const count = keys.filter((k) => k.url.includes("/images/quran_image/")).length;
          if (count < TOTAL_PAGES) {
            setIsVisible(true);
            downloadQuranPages();
          }
        });
      }
      return;
    }

    // 3. التحقق من إخفاء التنبيه لهذه الجلسة
    const isDismissed = sessionStorage.getItem("pwa_install_dismissed");
    if (isDismissed) return;

    // 4. التقاط حدث التثبيت قبل الظهور الافتراضي للمتصفح
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    // 5. الاستماع لاكتمال التثبيت الفعلي من قِبل المستخدم
    const handleAppInstalled = () => {
      setIsVisible(true);
      setDeferredPrompt(null);
      downloadQuranPages();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW registration error:", err));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // في حال كان التطبيق مثبتاً بالفعل ولكن المستخدم يطلب بدء تحميل الصفحات الناقصة
      downloadQuranPages();
      return;
    }

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      // بدء تحميل وتخزين جميع الصفحات فور موافقة المستخدم على التثبيت
      downloadQuranPages();
    }
  };

  const handleDismiss = () => {
    if (isDownloading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsVisible(false);
    sessionStorage.setItem("pwa_install_dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col gap-3">
        {/* الصف العلوي: الأيقونة والتفاصيل وزر الإغلاق */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 font-bold text-xs shadow-sm font-['Amiri_Quran',_serif]">
              قرآن
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {isDownloading
                  ? isRtl ? "جاري تجهيز المصحف أوفلاين..." : "Caching Quran Offline..."
                  : isDownloadComplete
                  ? isRtl ? "اكتمل تجهيز المصحف أوفلاين" : "Quran Ready Offline"
                  : isRtl ? "تثبيت التطبيق ومحتوى الأوفلاين" : "Install App & Offline Reading"}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isDownloading
                  ? isRtl ? `تم حفظ ${downloadProgress}% من صفحات المصحف` : `${downloadProgress}% of pages cached`
                  : isDownloadComplete
                  ? isRtl ? "جميع الصفحات الـ 604 محفوظة للعمل بدون إنترنت" : "All 604 pages are ready for offline use"
                  : isRtl ? "قراءة واستماع كامل بدون إنترنت وسرعة أكبر" : "Full offline reading and listening"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* زر الإغلاق / الإخفاء */}
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

            {/* زر التثبيت أو حالة الاكتمال */}
            {!isDownloading && !isDownloadComplete && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                {deferredPrompt
                  ? isRtl ? "تثبيت" : "Install"
                  : isRtl ? "تحميل الصفحات" : "Download Pages"}
              </button>
            )}

            {isDownloadComplete && (
              <span className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 text-xs font-bold">
                ✓
              </span>
            )}
          </div>
        </div>

        {/* شريط التقدم أثناء التنزيل الفعلي */}
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