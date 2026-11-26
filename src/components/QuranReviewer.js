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
  const [errorMessage, setErrorMessage] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioStreamRef = useRef(null);

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

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const activeSurah = useMemo(() => {
    const formatted = String(selectedSura).padStart(3, "0");
    return surahs.find((s) => s.index === formatted) || null;
  }, [surahs, selectedSura]);

  const maxAyas = activeSurah?.count || 7;

  // 2. Load selected verses using 3-digit padded filenames
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
      audioStreamRef.current = stream;
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
        audioStreamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setEvaluationResult(null);
      setErrorMessage("");

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      setErrorMessage(
        isRtl
          ? "تعذر الوصول للميكروفون. يرجى التأكد من منح الإذن للمتصفح."
          : "Microphone access denied. Please grant permission in your browser."
      );
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
    setErrorMessage("");
    setEvaluationResult(null);

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

      if (!res.ok || data.error) {
        throw new Error(data.error || "Server failed to evaluate recitation");
      }

      if (typeof data.score === "undefined") {
        throw new Error("No response or invalid evaluation received from AI.");
      }

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
        feedback: data.generalFeedback || data.feedback || "",
      };

      const existingHistory = appData?.recitationHistory || [];
      updateAppData({
        recitationHistory: [newReviewEntry, ...existingHistory].slice(0, 50),
      });
    } catch (err) {
      console.error("Evaluation error:", err);
      setErrorMessage(
        isRtl
          ? "حدث خطأ أثناء فحص التلاوة أو أن السيرفر يواجه ضغطاً مؤقتاً. يرجى إعادة المحاولة."
          : "There was an issue reaching the AI reviewer or the model is temporarily busy. Please try again."
      );
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
            {isRtl ? "مُراجع التلاوة والتدقيق التجويدي" : "AI Quran Recitation & Tajweed Auditor"}
          </h2>
          <p className="text-xs text-slate-500">
            {isRtl
              ? "تحقيق دقيق في الحفظ، علامات الإعراب، وأحكام التجويد مع نصائح توجيهية"
              : "Strict verification of memorization, diacritics, and tajweed rules"}
          </p>
        </div>
        <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
          {isRtl ? "رواية حفص عن عاصم" : "Hafs an Asim"}
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
              setErrorMessage("");
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

      {/* Target Quranic Text Preview */}
      <div className="p-4 bg-amber-50/40 border border-amber-200/60 rounded-xl max-h-56 overflow-y-auto">
        <span className="text-[10px] uppercase font-bold text-amber-700 block mb-2">
          {isRtl ? "النص القرآني المعتمد المطلوب:" : "Target Quranic Text to Recite:"}
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
        <div className="flex flex-wrap items-center justify-center gap-4">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-full shadow-md transition active:scale-95 cursor-pointer"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              <span>{isRtl ? "بدء التسميع والتسجيل" : "Start Reciting"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-full shadow-md transition active:scale-95 cursor-pointer"
            >
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-xs" />
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
                  <span>{isRtl ? "جاري التدقيق الحرفي والتجويدي..." : "Auditing Recitation..."}</span>
                </>
              ) : (
                <span>{isRtl ? "إرسال للتحكيم والتدقيق" : "Submit for Evaluation"}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error Alert Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex items-start justify-between gap-3 text-rose-800">
          <div className="flex items-start gap-2.5">
            <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex flex-col">
              <span className="text-xs font-bold">
                {isRtl ? "تنبيه" : "Evaluation Notice"}
              </span>
              <span className="text-xs text-rose-700 mt-0.5">{errorMessage}</span>
            </div>
          </div>

          {audioBlob && !isEvaluating && (
            <button
              type="button"
              onClick={handleEvaluate}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition active:scale-95 cursor-pointer"
            >
              {isRtl ? "إعادة المحاولة" : "Retry"}
            </button>
          )}
        </div>
      )}

      {/* Evaluation Results */}
      {evaluationResult && (
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col gap-4 animate-in fade-in duration-300">
          {/* Status Header */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <span className="text-xs font-bold text-slate-800">
              {isRtl ? "تقرير التحكيم والتقييم" : "Evaluation Report"}
            </span>
            <span
              className={`text-xs px-3 py-1 rounded-full font-bold ${
                evaluationResult.score >= 90
                  ? "bg-emerald-100 text-emerald-800"
                  : evaluationResult.score >= 75
                  ? "bg-blue-100 text-blue-800"
                  : evaluationResult.score >= 60
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {evaluationResult.score}% - {evaluationResult.status}
            </span>
          </div>

          {/* Transcribed Text Detected by AI */}
          {evaluationResult.transcribedText && (
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex flex-col gap-1">
              <span className="text-[11px] font-bold text-slate-500">
                {isRtl ? "النص المنطوق كما سُمع بالتشكيل:" : "Spoken Text as Heard:"}
              </span>
              <p
                className="text-sm font-['Amiri_Quran',_serif] text-slate-800 leading-relaxed text-right"
                dir="rtl"
              >
                {evaluationResult.transcribedText}
              </p>
            </div>
          )}

          {/* General Feedback */}
          <div className="text-xs text-slate-700 leading-relaxed bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
            {evaluationResult.generalFeedback || evaluationResult.feedback}
          </div>

          {/* Detected Mistakes List */}
          {evaluationResult.mistakes && evaluationResult.mistakes.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                <span>⚠️</span>
                <span>{isRtl ? "الأخطاء المرصودة واللحن:" : "Identified Mistakes:"}</span>
              </span>
              <div className="flex flex-col gap-2">
                {evaluationResult.mistakes.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 text-xs bg-white border border-rose-100 rounded-xl flex flex-col gap-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="line-through text-rose-600 font-bold font-['Amiri_Quran',_serif] text-sm">
                          {m.wordSpoken || m.word}
                        </span>
                        <span className="text-slate-400 font-sans">←</span>
                        <span className="text-emerald-700 font-bold font-['Amiri_Quran',_serif] text-sm">
                          {m.wordCorrect || m.correction}
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 font-semibold bg-rose-50 text-rose-700 rounded-md border border-rose-200/60">
                        {m.type || m.reason || (isRtl ? "لحن" : "Mistake")}
                      </span>
                    </div>

                    {m.explanation && (
                      <p className="text-[11px] text-slate-600">
                        <strong className="text-slate-800">{isRtl ? "السبب: " : "Why: "}</strong>
                        {m.explanation}
                      </p>
                    )}

                    {m.howToFix && (
                      <p className="text-[11px] text-emerald-800 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
                        <strong>{isRtl ? "💡 كيف تصححها: " : "💡 How to Fix: "}</strong>
                        {m.howToFix}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-200/60 flex items-center gap-2">
              <span>✓</span>
              <span>
                {isRtl
                  ? "ما شاء الله، قراءة متقنة خالية من الأخطاء في الكلمات والحركات."
                  : "Excellent! No major mispronunciations or diacritic errors detected."}
              </span>
            </div>
          )}

          {/* Tajweed Observations */}
          {evaluationResult.tajweedObservations && evaluationResult.tajweedObservations.length > 0 && (
            <div className="flex flex-col gap-1.5 p-3 bg-white rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-indigo-700">
                {isRtl ? "ملاحظات التجويد والمخارج:" : "Tajweed & Articulation Notes:"}
              </span>
              <ul className="list-disc list-inside text-xs text-slate-600 flex flex-col gap-1">
                {evaluationResult.tajweedObservations.map((obs, i) => (
                  <li key={i}>{obs}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Time Advice */}
          {evaluationResult.nextTimeAdvice && evaluationResult.nextTimeAdvice.length > 0 && (
            <div className="flex flex-col gap-1.5 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60">
              <span className="text-[11px] font-bold text-amber-800">
                {isRtl ? "نصائح للتسميع القادم:" : "Tips for Next Recitation:"}
              </span>
              <ul className="list-disc list-inside text-xs text-slate-700 flex flex-col gap-1">
                {evaluationResult.nextTimeAdvice.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}