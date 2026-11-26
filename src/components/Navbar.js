"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import Logo from "./Logo";

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading, logout, appData, updateAppData } = useAuth();
  const { lang, t, toggleLanguage } = useLanguage();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const menuRef = useRef(null);
  const modeRef = useRef(null);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
      if (modeRef.current && !modeRef.current.contains(event.target)) {
        setIsModeOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsModeOpen(false);
      }
    }

    if (isMenuOpen || isModeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen, isModeOpen]);

  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  const currentMode = appData?.playerType || "default";

  const modeOptions = [
    {
      id: "default",
      color: "bg-emerald-500",
      ringColor: "ring-emerald-200",
      labelAr: "الوضع الافتراضي",
      labelEn: "Default Mode",
      descAr: "استماع متواصل للسور",
      descEn: "Continuous full surah playback",
    },
    {
      id: "teacher",
      color: "bg-amber-500",
      ringColor: "ring-amber-200",
      labelAr: "وضع المعلم",
      labelEn: "Teacher Mode",
      descAr: "تكرار الآيات للتحفيظ",
      descEn: "Verse loop & memorization",
    },
    {
      id: "reviewer",
      color: "bg-indigo-500",
      ringColor: "ring-indigo-200",
      labelAr: "وضع المراجع الذكي",
      labelEn: "AI Reviewer",
      descAr: "تسميع وتقييم صوتي ذكي",
      descEn: "Recitation voice check",
    },
  ];

  const activeModeObj =
    modeOptions.find((m) => m.id === currentMode) || modeOptions[0];

  const handleSelectMode = (modeId) => {
    updateAppData({ playerType: modeId });
    setIsModeOpen(false);
  };

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="px-4 lg:px-32 mx-auto h-16 flex items-center justify-between bg-black/20 backdrop-blur-sm">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2"
        >
          <Logo className="text-white w-12" />
          <h1 className="text-white text-lg font-bold">HiSaja</h1>
        </Link>

        <div className="flex items-center gap-3">
          {/* Mode Switch Dropdown */}
          <div className="relative" ref={modeRef}>
            <button
              type="button"
              onClick={() => {
                setIsModeOpen((prev) => !prev);
                setIsMenuOpen(false);
              }}
              className="px-3.5 py-2 text-xs lg:text-sm font-semibold rounded-full bg-white/90 hover:bg-white text-slate-900 border border-slate-200 backdrop-blur-md shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-2"
              aria-expanded={isModeOpen}
            >
              <span
                className={`w-2 h-2 rounded-full transition-colors duration-200 ${activeModeObj.color} ring-2 ${activeModeObj.ringColor}`}
              />
              <span>{lang === "ar" ? activeModeObj.labelAr : activeModeObj.labelEn}</span>
              <svg
                className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                  isModeOpen ? "rotate-180" : ""
                }`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {isModeOpen && (
              <div className="absolute top-full mt-2 ltr:left-0 rtl:right-0 sm:ltr:right-auto sm:rtl:left-auto w-56 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-1">
                {modeOptions.map((opt) => {
                  const isSelected = opt.id === currentMode;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectMode(opt.id)}
                      className={`w-full flex items-start gap-2.5 px-3 py-2 text-start rounded-xl transition cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white"
                          : "text-slate-800 hover:bg-slate-100/80"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${opt.color} ${
                          isSelected ? "ring-2 ring-white/50" : ""
                        }`}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold leading-tight">
                          {lang === "ar" ? opt.labelAr : opt.labelEn}
                        </span>
                        <span
                          className={`text-[10px] leading-tight mt-0.5 ${
                            isSelected ? "text-slate-300" : "text-slate-400"
                          }`}
                        >
                          {lang === "ar" ? opt.descAr : opt.descEn}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Language Switch Button */}
          <button
            onClick={toggleLanguage}
            className="px-4 py-2 text-xs lg:text-sm font-semibold rounded-full bg-white text-black transition cursor-pointer"
          >
            <span className="hidden lg:block">{t.navbar.switchLang}</span>
            <span className="lg:hidden">{t.navbar.switchLangM}</span>
          </button>

          {/* User Settings Dropdown / Guest Status */}
          {loading ? (
            <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen((prev) => !prev);
                  setIsModeOpen(false);
                }}
                className="p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 backdrop-blur-md shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center"
                title={lang === "ar" ? "إعدادات الحساب" : "User settings"}
                aria-expanded={isMenuOpen}
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-300 ${
                    isMenuOpen ? "rotate-90 text-slate-950" : "text-slate-700"
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>

              {isMenuOpen && (
                <div className="absolute top-full mt-2 ltr:right-0 rtl:left-0 w-64 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "Avatar"}
                        className="w-10 h-10 rounded-full border border-slate-200 object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      {user.displayName && (
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {user.displayName}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 truncate">
                        {user.email}
                      </span>
                    </div>
                  </div>

                  <div className="px-2 pt-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer text-start"
                    >
                      <svg
                        className="w-4 h-4 rtl:rotate-180"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <span>{t.navbar.signOut}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-medium border border-amber-200">
              {t.navbar.guestBadge}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}