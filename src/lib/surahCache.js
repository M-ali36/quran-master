const CACHE_KEY = "cached_current_surah";

export const surahCache = {
  // Get cached surah object if index matches
  get: (targetIndex) => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      // Validate that the cached object matches the requested surah index
      if (parsed && parsed.index === targetIndex) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  },

  // Set the current surah in localStorage and set a lightweight cookie identifier
  set: (surahData) => {
    if (typeof window === "undefined" || !surahData) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(surahData));
      // Save just the index in cookie for fast access/middleware if needed
      document.cookie = `current_surah_idx=${surahData.index}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {
      console.error("Failed to cache surah data:", e);
    }
  },

  // Clear cache if needed
  clear: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(CACHE_KEY);
    document.cookie = "current_surah_idx=; path=/; max-age=0;";
  },
};