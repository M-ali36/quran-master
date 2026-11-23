// src/components/QuranReviewer.js
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export default function QuranReviewer() {
  const { appData, updateAppData } = useAuth();
  const { lang } = useLanguage();
  const isRtl = lang === "ar";

  const [surahs, setSurahs] = useState([]);
  const [selectedSura, setSelectedSura] = useState(appData?.currentSura || 1);
  const [startAya, setStartAya] = useState(1);
  const [endAya, setEndAya] = useState(5);
  const [targetVerses, setTargetVerses] = useState([]);
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);

  // Recording and review states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // 1. Load surahs list
  useEffect(() => {
    async function loadSurahs() {
      try {
        const mod = await import("@/data/surah.json");
        setSurahs(mod.default || mod);
      } catch (e) {
        console.error("Failed to load surah list", e);
      }
    }
    loadSurahs();
  }, []);

  const activeSurah = useMemo(() => {
    const formatted = String(selectedSura).padStart(3, "0");
    return surahs.find((s) => s.index === formatted) || null;
  }, [surahs, selectedSura]);

  const maxAyas = activeSurah?.count || 7;

  // 2. Load selected verses using 3-digit padded filenames (e.g. 096_001.json)
  useEffect(() => {
    let isMounted = true;

    async function loadSelectedVerses() {
      setIsLoadingVerses(true);
      const versesData = [];
      const suraPadded = String(selectedSura).padStart(3, "0");

      for (let a = startAya; a <= endAya; a++) {
        const ayaPadded = String(a).padStart(3, "0");
        try {
          const mod = await import(`@/data/verses/${suraPadded}_${ayaPadded}.json`);
          const verseJson = mod.default || mod;

          // Always extract Arabic Quranic text from text.ar
          const arabicText =
            typeof verseJson.text === "object"
              ? verseJson.text?.ar || ""
              : verseJson.text || "";

          versesData.push({
            aya: a,
            text: arabicText,
          });
        } catch (err) {
          console.error(`Failed to load verse ${suraPadded}_${ayaPadded}.json:`, err);
        }
      }

      if (isMounted) {
        setTargetVerses(versesData);
        setIsLoadingVerses(false);
      }
    }

    if (startAya <= endAya) {
      loadSelectedVerses();
    }

    return () => {
      isMounted = false;
    };
  }, [selectedSura, startAya, endAya]);

  // 3. Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setEvaluationResult(null);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      alert(isRtl ? "يرجى السماح بالوصول إلى الميكروفون" : "Microphone access is required");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // 4. Send audio and verses to AI review
  const handleEvaluate = async () => {
    if (!audioBlob) return;

    setIsEvaluating(true);
    const combinedVerses = targetVerses.map((v) => `(${v.aya}) ${v.text}`).join(" ");

    const formData = new FormData();
    formData.append("audio", audioBlob, "recitation.webm");
    formData.append("targetVersesText", combinedVerses);
    formData.append(
      "surahName",
      activeSurah ? (isRtl ? activeSurah.titleAr : activeSurah.title) : `${selectedSura}`
    );
    formData.append("startAya", String(startAya));
    formData.append("endAya", String(endAya));
    formData.append("lang", lang);

    try {
      const res = await fetch("/api/review-recitation", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setEvaluationResult(data);

      const newReviewEntry = {
        id: Date.now(),
        date: new Date().toISOString(),
        sura: parseInt(selectedSura, 10),
        surahTitle: activeSurah ? (isRtl ? activeSurah.titleAr : activeSurah.title) : "",
        startAya,
        endAya,
        lang,
        score: data.score || 0,
        status: data.status || "",
        feedback: data.feedback || "",
      };

      const existingHistory = appData?.recitationHistory || [];
      updateAppData({
        recitationHistory: [newReviewEntry, ...existingHistory].slice(0, 50),
      });
    } catch (err) {
      console.error("Evaluation error:", err);
      alert(isRtl ? "حدث خطأ أثناء تقييم التلاوة" : "Failed to evaluate recitation");
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto frosted-card rounded-2xl p-6 flex flex-col gap-6 border border-slate-200 shadow-sm bg-white/90 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {isRtl ? "مُراجع التلاوة الذكي" : "AI Recitation Reviewer"}
          </h2>
          <p className="text-xs text-slate-500">
            {isRtl
              ? "اختر الآيات واقرأها بصوتك وسيقوم النموذج بفحص صحة حفظك وحركاتك"
              : "Select verses, recite into your mic, and receive recitation accuracy feedback"}
          </p>
        </div>
        <span className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
          Gemini Flash
        </span>
      </div>

      {/* Surah & Range Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-700">
            {isRtl ? "السورة" : "Surah"}
          </label>
          <select
            value={selectedSura}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setSelectedSura(val);
              setStartAya(1);
              setEndAya(Math.min(5, surahs.find((s) => parseInt(s.index, 10) === val)?.count || 5));
              setEvaluationResult(null);
              setAudioBlob(null);
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
          >
            {surahs.map((s) => (
              <option key={s.index} value={parseInt(s.index, 10)}>
                {parseInt(s.index, 10)}. {isRtl ? s.titleAr : s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-700">
            {isRtl ? "من آية" : "From Verse"}
          </label>
          <input
            type="number"
            min={1}
            max={endAya}
            value={startAya}
            onChange={(e) => setStartAya(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-700">
            {isRtl ? "إلى آية" : "To Verse"}
          </label>
          <input
            type="number"
            min={startAya}
            max={maxAyas}
            value={endAya}
            onChange={(e) => setEndAya(Math.min(maxAyas, parseInt(e.target.value, 10) || startAya))}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
          />
        </div>
      </div>

      {/* Target Quranic Text Preview (Arabic Script Only) */}
      <div className="p-4 bg-amber-50/40 border border-amber-200/60 rounded-xl max-h-56 overflow-y-auto">
        <span className="text-[10px] uppercase font-bold text-amber-700 block mb-2">
          {isRtl ? "النص القرآني المطلوب تسميعه:" : "Target Quranic Text to Recite:"}
        </span>
        {isLoadingVerses ? (
          <p className="text-xs text-slate-400 animate-pulse">
            {isRtl ? "جاري تحميل الآيات..." : "Loading verses..."}
          </p>
        ) : (
          <div
            className="text-lg leading-loose text-slate-900 font-['Amiri_Quran',_serif] text-right"
            dir="rtl"
          >
            {targetVerses.map((v) => (
              <span key={v.aya} className="inline mx-0.5">
                {v.text} <span className="text-amber-600 font-sans text-sm font-bold">﴿{v.aya}﴾</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Recording Actions */}
      <div className="flex flex-col items-center justify-center gap-4 py-2">
        <div className="flex items-center gap-4">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-full shadow-md transition active:scale-95 cursor-pointer"
            >
              <span className="w-3 h-3 rounded-full bg-white animate-ping" />
              <span>{isRtl ? "بدء التسجيل والتسميع" : "Start Recording"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-full shadow-md transition active:scale-95 cursor-pointer"
            >
              <span className="w-3 h-3 bg-rose-500 rounded-xs" />
              <span>
                {isRtl ? "إيقاف التسجيل" : "Stop Recording"} ({recordingTime}s)
              </span>
            </button>
          )}

          {audioBlob && !isRecording && (
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={isEvaluating}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-bold rounded-full shadow-md transition active:scale-95 cursor-pointer flex items-center gap-2"
            >
              {isEvaluating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isRtl ? "جاري التقييم بواسطة الذكاء الاصطناعي..." : "Evaluating..."}</span>
                </>
              ) : (
                <span>{isRtl ? "إرسال للمراجعة والتقييم" : "Submit for Evaluation"}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Evaluation Results */}
      {evaluationResult && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-bold text-slate-700">
              {isRtl ? "نتيجة التقييم" : "Evaluation Result"}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                evaluationResult.score >= 85
                  ? "bg-emerald-100 text-emerald-800"
                  : evaluationResult.score >= 65
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {evaluationResult.score}% - {evaluationResult.status}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {evaluationResult.feedback}
          </p>

          {evaluationResult.mistakes && evaluationResult.mistakes.length > 0 ? (
            <div className="flex flex-col gap-1.5 pt-2">
              <span className="text-[11px] font-bold text-rose-600">
                {isRtl ? "الملاحظات ومواضع الخطأ:" : "Detected Mistakes:"}
              </span>
              <div className="divide-y divide-slate-200/70 border border-slate-200 rounded-lg bg-white overflow-hidden">
                {evaluationResult.mistakes.map((m, idx) => (
                  <div key={idx} className="p-2 text-xs flex items-center justify-between">
                    <div>
                      <span className="line-through text-rose-500 font-semibold">{m.word}</span>
                      <span className="mx-2 text-slate-400">←</span>
                      <span className="text-emerald-600 font-semibold">{m.correction}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{m.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold">
              {isRtl
                ? "ما شاء الله، قراءة خالية من الأخطاء الجلية في الحفظ."
                : "Flawless recitation! No major memorization mistakes detected."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}