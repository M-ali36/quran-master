"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { surahCache } from "@/lib/surahCache";

import Play from "./play";
import Next from "./next";
import Prev from "./prev";
import Pause from "./pause";
import Volume from "./volume";

const OFFLINE_CACHE_NAME = "quran_audio_offline_v1";

// Helper: Format seconds into MM:SS
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Star Icon component for favorite toggle
function StarIcon({ filled, className = "w-4 h-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? "0" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// Circular Download Button & Progress
function CircularDownloadButton({ isDownloaded, isDownloading, progress, onClick, lang }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDownloading}
      className={`relative w-10 h-10 flex items-center justify-center rounded-xl border transition cursor-pointer shrink-0 ${
        isDownloaded
          ? "bg-emerald-50 border-emerald-200 text-emerald-600"
          : isDownloading
          ? "bg-slate-50 border-slate-300 text-slate-800"
          : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white"
      }`}
      title={
        isDownloaded
          ? lang === "ar" ? "محفوظة للتشغيل بدون إنترنت" : "Downloaded for offline use"
          : isDownloading
          ? `${progress}%`
          : lang === "ar" ? "تحميل للاستماع بدون إنترنت" : "Download for offline use"
      }
    >
      {isDownloading ? (
        <div className="relative w-7 h-7 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r={radius}
              stroke="currentColor"
              strokeWidth="3"
              className="text-slate-200"
              fill="none"
            />
            <circle
              cx="18"
              cy="18"
              r={radius}
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="text-slate-900 transition-all duration-150"
              fill="none"
            />
          </svg>
          <span className="absolute text-[8px] font-mono font-bold text-slate-800">
            {progress}
          </span>
        </div>
      ) : isDownloaded ? (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 stroke-current fill-none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
    </button>
  );
}

export default function PlayerNormal() {
  const { appData, updateAppData } = useAuth();
  const { lang } = useLanguage();
  const isRtl = lang === "ar";

  const currentSura = appData?.currentSura ?? 1;
  const formattedSura = String(currentSura).padStart(3, "0");

  const [surahs, setSurahs] = useState([]);
  const [reciters, setReciters] = useState([]);
  const [selectedServer, setSelectedServer] = useState(
    appData?.selectedReciterServer || "https://server11.mp3quran.net/hawashi"
  );

  // Download state: { [url]: progressNumber }
  const [downloadProgress, setDownloadProgress] = useState({});
  // List of cached audio item descriptors: [ { url, suraIndex, server, reciterName, rewayaName, suraTitle } ]
  const [offlineAudios, setOfflineAudios] = useState([]);
  const [isOfflineListOpen, setIsOfflineListOpen] = useState(false);

  // Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [blobAudioUrl, setBlobAudioUrl] = useState(null);

  // Dropdown States
  const [isReciterOpen, setIsReciterOpen] = useState(false);
  const [reciterSearch, setReciterSearch] = useState("");
  const [isSurahOpen, setIsSurahOpen] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");

  const audioRef = useRef(null);
  const reciterRef = useRef(null);
  const surahRef = useRef(null);
  const offlineRef = useRef(null);

  const favoriteReciters = useMemo(
    () => appData?.favoriteReciters || [],
    [appData?.favoriteReciters]
  );

  // 1. Load surahs and reciters dynamically
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [surahMod, reciterMod] = await Promise.all([
          import("@/data/surah.json"),
          import("@/data/reciter.json"),
        ]);

        if (isMounted) {
          const surahList = surahMod.default || surahMod;
          const reciterList = reciterMod.default || reciterMod;
          setSurahs(surahList);
          setReciters(reciterList);

          if (!appData?.selectedReciterServer && reciterList.length > 0) {
            setSelectedServer(reciterList[0].server);
          }
        }
      } catch (err) {
        console.error("Failed to load surah or reciter data:", err);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [appData?.selectedReciterServer]);

  // 2. Scan Cache API on client mount for offline tracks
  const refreshOfflineCache = useCallback(async () => {
    if (typeof window === "undefined" || !("caches" in window)) return;
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const requests = await cache.keys();
      const urls = requests.map((req) => req.url);
      setOfflineAudios(urls);
    } catch (e) {
      console.warn("Cache API inspection failed:", e);
    }
  }, []);

  useEffect(() => {
    refreshOfflineCache();
  }, [refreshOfflineCache]);

  const activeReciter = useMemo(() => {
    return reciters.find((r) => r.server === selectedServer) || reciters[0];
  }, [reciters, selectedServer]);

  const activeSurah = useMemo(() => {
    const cached = surahCache.get(formattedSura);
    if (cached) return cached;
    return (
      surahs.find((s) => s.index === formattedSura) ||
      surahs[Number(currentSura) - 1] ||
      null
    );
  }, [surahs, formattedSura, currentSura]);

  const rawAudioUrl = useMemo(() => {
    if (!selectedServer) return "";
    const base = selectedServer.endsWith("/")
      ? selectedServer.slice(0, -1)
      : selectedServer;
    return `${base}/${formattedSura}.mp3`;
  }, [selectedServer, formattedSura]);

  const isCurrentDownloaded = offlineAudios.includes(rawAudioUrl);
  const isCurrentDownloading = typeof downloadProgress[rawAudioUrl] === "number";

  // Toggle favorite status
  const toggleFavoriteReciter = (e, serverUrl) => {
    e.stopPropagation();
    const isFav = favoriteReciters.includes(serverUrl);
    const updatedFavorites = isFav
      ? favoriteReciters.filter((s) => s !== serverUrl)
      : [...favoriteReciters, serverUrl];

    updateAppData({ favoriteReciters: updatedFavorites });
  };

  // 3. Audio Source Resolution: Check Cache first, then fallback to stream
  useEffect(() => {
    let isMounted = true;
    let createdUrl = null;

    async function resolveSource() {
      if (!rawAudioUrl) return;

      setIsLoadingAudio(true);
      setCurrentTime(0);
      setBufferedEnd(0);

      try {
        if ("caches" in window) {
          const cache = await caches.open(OFFLINE_CACHE_NAME);
          const cachedResponse = await cache.match(rawAudioUrl);
          if (cachedResponse) {
            const blob = await cachedResponse.blob();
            createdUrl = URL.createObjectURL(blob);
            if (isMounted) setBlobAudioUrl(createdUrl);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed cache retrieval:", err);
      }

      if (isMounted) {
        setBlobAudioUrl(rawAudioUrl);
      }
    }

    resolveSource();

    return () => {
      isMounted = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [rawAudioUrl]);

  // Audio lifecycle handler
  useEffect(() => {
    if (!audioRef.current || !blobAudioUrl) return;

    audioRef.current.load();
    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => setIsPlaying(false));
      }
    }
  }, [blobAudioUrl]);

  // 4. Download Surah via ReadableStream with live progress calculation
  const handleDownloadCurrentSura = async () => {
    if (!rawAudioUrl || isCurrentDownloaded || isCurrentDownloading) return;

    try {
      setDownloadProgress((prev) => ({ ...prev, [rawAudioUrl]: 0 }));

      const response = await fetch(rawAudioUrl);
      if (!response.ok) throw new Error("Audio download failed");

      const contentLength = response.headers.get("content-length");
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      let receivedBytes = 0;
      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        if (totalBytes > 0) {
          const percent = Math.min(
            100,
            Math.round((receivedBytes / totalBytes) * 100)
          );
          setDownloadProgress((prev) => ({ ...prev, [rawAudioUrl]: percent }));
        }
      }

      const blob = new Blob(chunks, { type: "audio/mp3" });
      const cacheResponse = new Response(blob, {
        headers: { "Content-Type": "audio/mp3" },
      });

      if ("caches" in window) {
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        await cache.put(rawAudioUrl, cacheResponse);
      }

      await refreshOfflineCache();
    } catch (err) {
      console.error("Download audio error:", err);
    } finally {
      setDownloadProgress((prev) => {
        const next = { ...prev };
        delete next[rawAudioUrl];
        return next;
      });
    }
  };

  // 5. Audio playback events
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);

    if (audioRef.current.buffered.length > 0) {
      const buffered = audioRef.current.buffered.end(
        audioRef.current.buffered.length - 1
      );
      setBufferedEnd(buffered);
    }
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
    setIsLoadingAudio(false);
  };

  const handleNext = useCallback(() => {
    if (currentSura < 114) {
      const nextSura = currentSura + 1;
      const targetSurahObj = surahs.find(
        (s) => s.index === String(nextSura).padStart(3, "0")
      );
      if (targetSurahObj) surahCache.set(targetSurahObj);

      updateAppData({ currentSura: nextSura, currentAya: 1 });
    }
  }, [currentSura, surahs, updateAppData]);

  const handlePrev = useCallback(() => {
    if (currentSura > 1) {
      const prevSura = currentSura - 1;
      const targetSurahObj = surahs.find(
        (s) => s.index === String(prevSura).padStart(3, "0")
      );
      if (targetSurahObj) surahCache.set(targetSurahObj);

      updateAppData({ currentSura: prevSura, currentAya: 1 });
    }
  }, [currentSura, surahs, updateAppData]);

  const handleAudioEnded = () => {
    if (currentSura < 114) {
      handleNext();
    } else {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !blobAudioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  };

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  // 6. Parsed Offline Items list for the offline picker
  const parsedOfflineItems = useMemo(() => {
    if (!surahs.length || !reciters.length || !offlineAudios.length) return [];

    return offlineAudios
      .map((url) => {
        const match = url.match(/^(.*)\/(\d{3})\.mp3$/);
        if (!match) return null;
        const serverBase = match[1];
        const suraIndex = match[2];

        const matchedReciter = reciters.find((r) => {
          const clean = r.server.endsWith("/") ? r.server.slice(0, -1) : r.server;
          return clean === serverBase;
        });

        const matchedSurah = surahs.find((s) => s.index === suraIndex);

        if (!matchedReciter || !matchedSurah) return null;

        return {
          url,
          suraIndex,
          suraNum: parseInt(suraIndex, 10),
          suraTitle: lang === "ar" ? matchedSurah.titleAr : matchedSurah.title,
          reciterName: matchedReciter.reciter[lang] || matchedReciter.reciter.ar,
          server: matchedReciter.server,
        };
      })
      .filter(Boolean);
  }, [offlineAudios, surahs, reciters, lang]);

  // 7. Filtered Reciters & Surahs
  const filteredReciters = useMemo(() => {
    let list = [...reciters];
    if (reciterSearch.trim()) {
      const q = reciterSearch.toLowerCase();
      list = list.filter(
        (r) =>
          (r.reciter?.ar || "").toLowerCase().includes(q) ||
          (r.reciter?.en || "").toLowerCase().includes(q) ||
          (r.rewaya?.ar || "").toLowerCase().includes(q) ||
          (r.rewaya?.en || "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      const aFav = favoriteReciters.includes(a.server);
      const bFav = favoriteReciters.includes(b.server);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [reciters, reciterSearch, favoriteReciters]);

  const filteredSurahs = useMemo(() => {
    if (!surahSearch.trim()) return surahs;
    const q = surahSearch.toLowerCase();
    return surahs.filter(
      (s) =>
        s.index.includes(q) ||
        String(parseInt(s.index, 10)).includes(q) ||
        (s.title || "").toLowerCase().includes(q) ||
        (s.titleAr || "").toLowerCase().includes(q)
    );
  }, [surahs, surahSearch]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (reciterRef.current && !reciterRef.current.contains(e.target)) {
        setIsReciterOpen(false);
      }
      if (surahRef.current && !surahRef.current.contains(e.target)) {
        setIsSurahOpen(false);
      }
      if (offlineRef.current && !offlineRef.current.contains(e.target)) {
        setIsOfflineListOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
  const fillOriginClass = isRtl ? "right-0" : "left-0";
  const isActiveReciterFav = activeReciter && favoriteReciters.includes(activeReciter.server);

  return (
    <div className="w-full max-w-2xl mt-auto mx-auto frosted-card rounded-2xl p-5 flex flex-col gap-5 border border-slate-200 shadow-sm bg-white/85 backdrop-blur-md">
      <audio
        ref={audioRef}
        src={blobAudioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        onWaiting={() => setIsLoadingAudio(true)}
        onPlaying={() => setIsLoadingAudio(false)}
        preload="metadata"
      />

      {/* Selectors Bar: Reciter & Surah + Download Progress + Offline Dropdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Reciter Searchable Dropdown */}
        <div className="relative flex items-center gap-1.5" ref={reciterRef}>
          <button
            type="button"
            onClick={() => setIsReciterOpen((prev) => !prev)}
            className="flex-1 min-w-0 flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 hover:bg-white transition cursor-pointer"
          >
            <span className="truncate">
              {activeReciter
                ? `${activeReciter.reciter[lang] || activeReciter.reciter.ar} - ${
                    activeReciter.rewaya[lang] || activeReciter.rewaya.ar
                  }`
                : lang === "ar" ? "اختر القارئ" : "Select Reciter"}
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                isReciterOpen ? "rotate-180" : ""
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

          {/* Quick toggle favorite for current active reciter */}
          {activeReciter && (
            <button
              type="button"
              onClick={(e) => toggleFavoriteReciter(e, activeReciter.server)}
              className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                isActiveReciterFav
                  ? "bg-amber-50 border-amber-200 text-amber-500 hover:bg-amber-100"
                  : "bg-slate-50 border-slate-200 text-slate-400 hover:text-amber-500 hover:bg-white"
              }`}
              title={
                isActiveReciterFav
                  ? lang === "ar" ? "إزالة من المفضلة" : "Remove from favorites"
                  : lang === "ar" ? "إضافة إلى المفضلة" : "Add to favorites"
              }
            >
              <StarIcon filled={isActiveReciterFav} className="w-4 h-4" />
            </button>
          )}

          {isReciterOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-60">
              <div className="p-2 border-b border-slate-100 bg-slate-50">
                <input
                  type="text"
                  value={reciterSearch}
                  onChange={(e) => setReciterSearch(e.target.value)}
                  placeholder={lang === "ar" ? "ابحث عن قارئ..." : "Search reciter..."}
                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
                {filteredReciters.map((r) => {
                  const isSelected = r.server === selectedServer;
                  const isFav = favoriteReciters.includes(r.server);

                  return (
                    <div
                      key={r.id || r.server}
                      onClick={() => {
                        setSelectedServer(r.server);
                        updateAppData({ selectedReciterServer: r.server });
                        setIsReciterOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white font-medium"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="truncate">{r.reciter[lang] || r.reciter.ar}</span>
                        <span
                          className={`text-[10px] truncate ${
                            isSelected ? "text-slate-300" : "text-slate-400"
                          }`}
                        >
                          {r.rewaya[lang] || r.rewaya.ar}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteReciter(e, r.server)}
                        className={`p-1.5 rounded-lg transition shrink-0 cursor-pointer ${
                          isFav
                            ? "text-amber-400 hover:text-amber-500"
                            : isSelected
                            ? "text-slate-500 hover:text-amber-300"
                            : "text-slate-300 hover:text-amber-500"
                        }`}
                      >
                        <StarIcon filled={isFav} className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Surah Searchable Dropdown + Circular Download Button */}
        <div className="relative flex items-center gap-1.5" ref={surahRef}>
          <button
            type="button"
            onClick={() => setIsSurahOpen((prev) => !prev)}
            className="flex-1 min-w-0 flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 hover:bg-white transition cursor-pointer"
          >
            <span className="truncate">
              {activeSurah
                ? `${parseInt(activeSurah.index, 10)}. ${
                    lang === "ar" ? activeSurah.titleAr : activeSurah.title
                  }`
                : `${currentSura}`}
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                isSurahOpen ? "rotate-180" : ""
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

          {/* Circular Download Button */}
          <CircularDownloadButton
            isDownloaded={isCurrentDownloaded}
            isDownloading={isCurrentDownloading}
            progress={downloadProgress[rawAudioUrl] || 0}
            onClick={handleDownloadCurrentSura}
            lang={lang}
          />

          {isSurahOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-60">
              <div className="p-2 border-b border-slate-100 bg-slate-50">
                <input
                  type="text"
                  value={surahSearch}
                  onChange={(e) => setSurahSearch(e.target.value)}
                  placeholder={lang === "ar" ? "ابحث عن سورة..." : "Search surah..."}
                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
                {filteredSurahs.map((s) => {
                  const isSelected = s.index === formattedSura;
                  return (
                    <button
                      key={s.index}
                      type="button"
                      onClick={() => {
                        const newSura = parseInt(s.index, 10);
                        surahCache.set(s);
                        updateAppData({ currentSura: newSura, currentAya: 1 });
                        setIsSurahOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white font-medium"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>
                        {parseInt(s.index, 10)}. {lang === "ar" ? s.titleAr : s.title}
                      </span>
                      <span
                        className={`text-[10px] font-mono ${
                          isSelected ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        {s.count} {lang === "ar" ? "آية" : "ayas"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Offline Surahs Quick Selector */}
      {parsedOfflineItems.length > 0 && (
        <div className="relative" ref={offlineRef}>
          <button
            type="button"
            onClick={() => setIsOfflineListOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs font-medium text-emerald-800 hover:bg-emerald-100/60 transition cursor-pointer"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate">
                {lang === "ar"
                  ? `السور المحفوظة للتشغيل بدون إنترنت (${parsedOfflineItems.length})`
                  : `Downloaded Offline Surahs (${parsedOfflineItems.length})`}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-emerald-600 transition-transform shrink-0 ${
                isOfflineListOpen ? "rotate-180" : ""
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

          {isOfflineListOpen && (
            <div className="absolute top-full mt-1.5 z-40 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-56 divide-y divide-slate-50">
              {parsedOfflineItems.map((item, idx) => (
                <button
                  key={`${item.url}-${idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedServer(item.server);
                    updateAppData({
                      selectedReciterServer: item.server,
                      currentSura: item.suraNum,
                      currentAya: 1,
                    });
                    setIsOfflineListOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-start hover:bg-slate-50 transition cursor-pointer"
                >
                  <span className="font-semibold text-slate-800">
                    {item.suraNum}. {item.suraTitle}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {item.reciterName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Progress & Seeking Bar (Mirrored in RTL) */}
      <div className="flex flex-col gap-1.5 w-full">
        <div
          dir={isRtl ? "rtl" : "ltr"}
          className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden flex items-center"
        >
          <div
            className={`absolute top-0 bottom-0 ${fillOriginClass} bg-slate-300 transition-all duration-300`}
            style={{ width: `${bufferedPercent}%` }}
          />
          <div
            className={`absolute top-0 bottom-0 ${fillOriginClass} bg-slate-900 transition-all duration-100`}
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            dir={isRtl ? "rtl" : "ltr"}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
        </div>

        {/* Duration Timestamps */}
        <div
          className="flex justify-between items-center text-[11px] font-mono text-slate-500 px-0.5"
          dir="ltr"
        >
          <span>{formatTime(currentTime)}</span>
          {isLoadingAudio && (
            <span className="text-slate-400 animate-pulse text-[10px]">
              {lang === "ar" ? "جاري التحميل..." : "Buffering..."}
            </span>
          )}
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls: Prev / Play / Next & Volume */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrev}
            disabled={currentSura <= 1}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
            title={lang === "ar" ? "السورة السابقة" : "Previous Surah"}
          >
            <Prev className="w-5 h-5 rtl:rotate-180" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!blobAudioUrl}
            className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-sm transition cursor-pointer active:scale-95"
            title={
              isPlaying
                ? lang === "ar" ? "إيقاف مؤقت" : "Pause"
                : lang === "ar" ? "تشغيل" : "Play"
            }
          >
            {isPlaying ? (
              <Pause className="w-10 h-10 fill-current" />
            ) : (
              <Play className="w-10 h-10 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={handleNext}
            disabled={currentSura >= 114}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
            title={lang === "ar" ? "السورة التالية" : "Next Surah"}
          >
            <Next className="w-5 h-5 rtl:rotate-180" />
          </button>
        </div>

        {/* Volume Slider (RTL enabled) */}
        <div className="flex items-center gap-2 text-slate-600">
          <Volume className="w-5 h-5 shrink-0 text-slate-500" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            dir={isRtl ? "rtl" : "ltr"}
            className="w-20 sm:w-28 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
            title={lang === "ar" ? "مستوى الصوت" : "Volume"}
          />
        </div>
      </div>
    </div>
  );
}