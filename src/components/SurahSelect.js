"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { surahCache } from "@/lib/surahCache";

export default function SurahSelect() {
  const { appData, updateAppData } = useAuth();
  const { lang } = useLanguage();

  const currentSura = appData?.currentSura ?? 1;
  const formattedCurrentSura = String(currentSura).padStart(3, "0");

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [surahs, setSurahs] = useState([]);

  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // 1. Load Surah list dynamically
  useEffect(() => {
    let isMounted = true;

    async function loadSurahList() {
      try {
        const module = await import("@/data/surah.json");
        const list = module.default || module;
        if (isMounted) {
          setSurahs(list);
        }
      } catch (err) {
        console.error("Failed to load surah list:", err);
      }
    }

    loadSurahList();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Identify the active Surah (check surahCache first)
  const activeSurah = useMemo(() => {
    const cached = surahCache.get(formattedCurrentSura);
    if (cached) return cached;
    return (
      surahs.find((s) => s.index === formattedCurrentSura) ||
      surahs[Number(currentSura) - 1] ||
      null
    );
  }, [surahs, formattedCurrentSura, currentSura]);

  // 3. Filtered Surahs based on search query (index, Arabic title, English title)
  const filteredSurahs = useMemo(() => {
    if (!searchQuery.trim()) return surahs;
    const q = searchQuery.toLowerCase().trim();

    return surahs.filter((s) => {
      const idx = String(parseInt(s.index, 10));
      const padIdx = s.index;
      const titleEn = (s.title || "").toLowerCase();
      const titleAr = (s.titleAr || "").toLowerCase();

      return (
        idx.includes(q) ||
        padIdx.includes(q) ||
        titleEn.includes(q) ||
        titleAr.includes(q)
      );
    });
  }, [surahs, searchQuery]);

  // 4. Handle Outside Click & Escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      inputRef.current?.focus();
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // 5. Select a Surah: updates appData and caches selection
  const handleSelect = (surah) => {
    const newSuraNumber = parseInt(surah.index, 10);
    surahCache.set(surah);

    updateAppData({
      ...appData,
      currentSura: newSuraNumber,
      currentAya: 1, // Reset to first verse of selected surah
    });

    setIsOpen(false);
    setSearchQuery("");
  };

  const getSurahLabel = (s) => {
    const num = parseInt(s.index, 10);
    const name = lang === "ar" ? s.titleAr : s.title;
    return `${num}. ${name}`;
  };

  return (
    <div className="relative w-full max-w-xs" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl shadow-xs text-sm font-semibold text-slate-800 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
      >
        <span className="truncate">
          {activeSurah ? getSurahLabel(activeSurah) : `${currentSura}`}
        </span>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
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

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full mt-1.5 z-50 w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden flex flex-col max-h-72">
          {/* Search Field */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "ar" ? "ابحث بالاسم أو الرقم..." : "Search by name or number..."}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Surah List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
            {filteredSurahs.length > 0 ? (
              filteredSurahs.map((s) => {
                const isSelected = s.index === formattedCurrentSura;
                return (
                  <button
                    key={s.index}
                    type="button"
                    onClick={() => handleSelect(s)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs transition text-start ${
                      isSelected
                        ? "bg-slate-900 text-white font-medium"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{getSurahLabel(s)}</span>
                    <span
                      className={`text-[11px] font-mono ${
                        isSelected ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      {s.count} {lang === "ar" ? "آية" : "ayas"}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                {lang === "ar" ? "لا توجد نتائج" : "No results found"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}