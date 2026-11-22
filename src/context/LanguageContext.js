"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { en } from "@/dictionaries/en";
import { ar } from "@/dictionaries/ar";

const dictionaries = { en, ar };
const LanguageContext = createContext({});

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState("en");

  const applyLanguage = (selectedLang) => {
    if (selectedLang !== "en" && selectedLang !== "ar") return;
    setLang(selectedLang);
    document.cookie = `app_lang=${selectedLang}; path=/; max-age=31536000; SameSite=Lax`;
    localStorage.setItem("app_lang", selectedLang);
    document.documentElement.setAttribute("lang", selectedLang);
    document.documentElement.setAttribute("dir", dictionaries[selectedLang].dir);
  };

  useEffect(() => {
    // Read from localStorage first, then fallback to cookie
    const local = localStorage.getItem("app_lang");
    if (local === "en" || local === "ar") {
      applyLanguage(local);
      return;
    }

    const match = document.cookie.match(/(^|;)\s*app_lang\s*=\s*([^;]+)/);
    const cookieVal = match ? match[2] : null;
    if (cookieVal === "en" || cookieVal === "ar") {
      applyLanguage(cookieVal);
    }
  }, []);

  const toggleLanguage = () => {
    applyLanguage(lang === "en" ? "ar" : "en");
  };

  return (
    <LanguageContext.Provider
      value={{
        lang,
        t: dictionaries[lang],
        toggleLanguage,
        setLanguage: applyLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);