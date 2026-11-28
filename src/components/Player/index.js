"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { surahCache } from "@/lib/surahCache";

import Play from "./play";
import Next from "./next";
import Prev from "./prev";
import Pause from "./pause";
import Volume from "./volume";

const REPEAT_CACHE_KEY = "player_repeat_limit";

// Helper to retrieve cached repeat count with fallback (1)
const getCachedRepeat = () => {
  if (typeof window === "undefined") return 1;
  try {
    const val = localStorage.getItem(REPEAT_CACHE_KEY);
    const parsed = parseInt(val, 10);
    return !isNaN(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 1;
  } catch {
    return 1;
  }
};

// Helper to save repeat count to storage & cookie
const saveCachedRepeat = (count) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REPEAT_CACHE_KEY, String(count));
    document.cookie = `player_repeat_limit=${count}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (err) {
    console.error("Failed to cache repeat count:", err);
  }
};

export default function Player() {
  const { appData, updateAppData } = useAuth();
  const { lang } = useLanguage();

  const currentSura = appData?.currentSura ?? 1;
  const currentAya = appData?.currentAya ?? 1;

  const formattedSura = String(currentSura).padStart(3, "0");
  const formattedAya = String(currentAya).padStart(3, "0");

  const audioSrc = `/audio/${formattedSura}/${formattedAya}.mp3`;

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [repeatLimit, setRepeatLimit] = useState(1);
  const [repeatCounter, setRepeatCounter] = useState(0);
  const [totalVerses, setTotalVerses] = useState(null);

  const audioRef = useRef(null);

  // 1. Initialize repeat limit from cache on client mount
  useEffect(() => {
    const initialRepeat = getCachedRepeat();
    setRepeatLimit(initialRepeat);
  }, []);

  // 2. Resolve total verses (count) using cached surah data first
  useEffect(() => {
    let isMounted = true;

    async function resolveSurahCount() {
      const cached = surahCache.get(formattedSura);
      if (cached?.count) {
        if (isMounted) setTotalVerses(Number(cached.count));
        return;
      }

      try {
        const module = await import("@/data/surah.json");
        const list = module.default || module;
        const matched =
          list.find((s) => s.index === formattedSura) ||
          list[Number(currentSura) - 1];

        if (matched && isMounted) {
          setTotalVerses(Number(matched.count));
          surahCache.set(matched);
        }
      } catch (err) {
        console.error("Failed to load surah count:", err);
      }
    }

    resolveSurahCount();
    return () => {
      isMounted = false;
    };
  }, [formattedSura, currentSura]);

  // 3. Reset playback and repetition counters when verse changes
  useEffect(() => {
    setRepeatCounter(0);
    if (audioRef.current) {
      audioRef.current.load();
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => setIsPlaying(false));
        }
      }
    }
  }, [audioSrc]);

  // Sync play/pause state with audio element
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => setIsPlaying(false));
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Volume handler
  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  // Navigate to Next Aya
  const handleNext = useCallback(() => {
    if (totalVerses && currentAya < totalVerses) {
      updateAppData({
        ...appData,
        currentAya: currentAya + 1,
      });
    }
  }, [totalVerses, currentAya, appData, updateAppData]);

  // Navigate to Prev Aya
  const handlePrev = useCallback(() => {
    if (currentAya > 1) {
      updateAppData({
        ...appData,
        currentAya: currentAya - 1,
      });
    }
  }, [currentAya, appData, updateAppData]);

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  // Handle Repeat Logic when an audio track finishes
  const handleAudioEnded = () => {
    const nextPlayedCount = repeatCounter + 1;

    if (nextPlayedCount < repeatLimit) {
      setRepeatCounter(nextPlayedCount);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      setRepeatCounter(0);
      if (totalVerses && currentAya < totalVerses) {
        handleNext();
      } else {
        setIsPlaying(false);
      }
    }
  };

  // Increment repeat limit (clamped to max 100)
  const handleIncrementRepeat = () => {
    if (repeatLimit < 100) {
      const nextVal = repeatLimit + 1;
      setRepeatLimit(nextVal);
      saveCachedRepeat(nextVal);
      setRepeatCounter(0);
    }
  };

  // Decrement repeat limit (clamped to min 1)
  const handleDecrementRepeat = () => {
    if (repeatLimit > 1) {
      const nextVal = repeatLimit - 1;
      setRepeatLimit(nextVal);
      saveCachedRepeat(nextVal);
      setRepeatCounter(0);
    }
  };

  const isPrevDisabled = currentAya <= 1;
  const isNextDisabled = !totalVerses || currentAya >= totalVerses;

  return (
    <div className="w-full max-w-2xl mx-auto frosted-card rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border border-slate-200 shadow-sm bg-white/80 backdrop-blur-md">
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onEnded={handleAudioEnded}
        onError={() => setIsPlaying(false)}
        preload="auto"
      />

      {/* Primary Playback Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Prev Button */}
        <button
          onClick={handlePrev}
          disabled={isPrevDisabled}
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
          title={lang === "ar" ? "الآية السابقة" : "Previous Aya"}
        >
          <Prev className="w-5 h-5 rtl:rotate-180" />
        </button>

        {/* Play / Pause Button */}
        <button
          onClick={handleTogglePlay}
          className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-sm transition cursor-pointer active:scale-95"
          title={
            isPlaying
              ? lang === "ar"
                ? "إيقاف مؤقت"
                : "Pause"
              : lang === "ar"
              ? "تشغيل"
              : "Play"
          }
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={isNextDisabled}
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
          title={lang === "ar" ? "الآية التالية" : "Next Aya"}
        >
          <Next className="w-5 h-5 rtl:rotate-180" />
        </button>
      </div>

      {/* Volume Slider */}
      <div className="flex items-center gap-2 text-slate-600">
        <Volume className="w-5 h-5 shrink-0 text-slate-500" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={handleVolumeChange}
          className="w-20 sm:w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
          title={lang === "ar" ? "مستوى الصوت" : "Volume"}
        />
      </div>

      {/* Repeat Stepper Control (Increment / Decrement, Read-only Input) */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100/80 px-2.5 py-1.5 rounded-xl border border-slate-200">
        <span className="whitespace-nowrap select-none">
          {lang === "ar" ? "التكرار:" : "Repeat:"}
        </span>

        <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-xs">
          {/* Minus Button */}
          <button
            type="button"
            onClick={handleDecrementRepeat}
            disabled={repeatLimit <= 1}
            aria-label={lang === "ar" ? "تقليل التكرار" : "Decrease repeat"}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer font-bold text-sm select-none"
          >
            −
          </button>

          {/* Non-editable Display Field */}
          <input
            type="text"
            readOnly
            tabIndex={-1}
            value={repeatLimit}
            aria-label={lang === "ar" ? "عدد مرات التكرار" : "Repeat limit"}
            className="w-8 text-center bg-transparent border-none py-0 font-mono text-slate-900 font-bold focus:outline-none select-none cursor-default"
          />

          {/* Plus Button */}
          <button
            type="button"
            onClick={handleIncrementRepeat}
            disabled={repeatLimit >= 100}
            aria-label={lang === "ar" ? "زيادة التكرار" : "Increase repeat"}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer font-bold text-sm select-none"
          >
            +
          </button>
        </div>

        {repeatLimit > 1 && (
          <span className="text-[10px] text-slate-400 font-mono select-none">
            ({repeatCounter + 1}/{repeatLimit})
          </span>
        )}
      </div>
    </div>
  );
}