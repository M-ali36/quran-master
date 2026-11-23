// src/components/VideoSlider.js
"use client";

import { useState, useEffect } from "react";

const VIDEO_CACHE_NAME = "quran_videos_cache_v1";

const DEFAULT_DRIVE_LINKS = [
  "https://drive.google.com/file/d/1T0IAvHX8xSFsY_mIUDVfw4kcDfRnwiXK/view?usp=drive_link",
  "https://drive.google.com/file/d/1ybxSyzGKCvuFX33N8WJivk5ddMXldMWS/view?usp=drive_link",
  "https://drive.google.com/file/d/1VMaH-EoDji0gjwXF7wlDGJFq85d_z4Vm/view?usp=drive_link",
  "https://drive.google.com/file/d/1yMFAbHffp-3xf0DAXI7_APAEYpqNNfR-/view?usp=drive_link",
  "https://drive.google.com/file/d/1wq9Uj-BhQBEDSndNn67eieq3pq9MW-ct/view?usp=drive_link",
  "https://drive.google.com/file/d/1q_7YNnwz0RL4jsgAmbjMfsXVzOenue3B/view?usp=drive_link",
  "https://drive.google.com/file/d/1KZY53ZXEsr2dZuezf7kQVUMkP9Lm2OpL/view?usp=drive_link",
  "https://drive.google.com/file/d/1INemSE0X31aHdAgiWiH-x7B9ZsOmE4X7/view?usp=drive_link",
  "https://drive.google.com/file/d/19exVCPblmjxhXDXlOR9qBT931F2uHHJP/view?usp=drive_link",
];

function getDriveFileId(url) {
  if (!url) return null;
  const match = url.match(/\/d\/([^/]+)/);
  return match ? match[1] : null;
}

export default function VideoSlider({ videos }) {
  const activeVideoList =
    Array.isArray(videos) && videos.length > 0 ? videos : DEFAULT_DRIVE_LINKS;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedVideos, setLoadedVideos] = useState({});
  // Maps video index -> local blob: URL or fallback URL
  const [resolvedSources, setResolvedSources] = useState({});

  // 1. Resolve & Cache Video streams offline
  useEffect(() => {
    let isMounted = true;
    const createdBlobUrls = [];

    async function cacheAndResolveVideos() {
      if (typeof window === "undefined" || !("caches" in window)) {
        // Fallback if Cache API is unavailable
        const directMap = {};
        activeVideoList.forEach((link, idx) => {
          const fileId = getDriveFileId(link);
          directMap[idx] = fileId ? `/api/video/${fileId}` : link;
        });
        if (isMounted) setResolvedSources(directMap);
        return;
      }

      try {
        const cache = await caches.open(VIDEO_CACHE_NAME);

        for (let idx = 0; idx < activeVideoList.length; idx++) {
          const link = activeVideoList[idx];
          const fileId = getDriveFileId(link);
          const requestUrl = fileId ? `/api/video/${fileId}` : link;

          // Check if already stored offline in browser cache
          let cachedResponse = await cache.match(requestUrl);

          if (!cachedResponse) {
            // If online, fetch and save to Cache API
            if (navigator.onLine) {
              try {
                const response = await fetch(requestUrl);
                if (response.ok) {
                  // Put clone into Cache storage
                  await cache.put(requestUrl, response.clone());
                  cachedResponse = response;
                }
              } catch (fetchErr) {
                console.warn(`Could not preload video ${idx} offline:`, fetchErr);
              }
            }
          }

          if (cachedResponse) {
            const blob = await cachedResponse.blob();
            const blobUrl = URL.createObjectURL(blob);
            createdBlobUrls.push(blobUrl);

            if (isMounted) {
              setResolvedSources((prev) => ({
                ...prev,
                [idx]: blobUrl,
              }));
            }
          } else {
            // Fallback directly to network URL if cache failed
            if (isMounted) {
              setResolvedSources((prev) => ({
                ...prev,
                [idx]: requestUrl,
              }));
            }
          }
        }
      } catch (err) {
        console.error("Cache API video resolution error:", err);
      }
    }

    cacheAndResolveVideos();

    return () => {
      isMounted = false;
      // Cleanup created blob URLs on unmount
      createdBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [activeVideoList]);

  // 2. Slide transition every 30 seconds
  useEffect(() => {
    if (activeVideoList.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeVideoList.length);
    }, 30000);

    return () => clearInterval(timer);
  }, [activeVideoList.length]);

  const handleVideoLoaded = (index) => {
    setLoadedVideos((prev) => ({ ...prev, [index]: true }));
  };

  const isCurrentVideoLoading = !loadedVideos[currentIndex];

  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden bg-slate-900">
      {/* 1. Loading Indicator Overlay */}
      <div
        className={`absolute inset-0 z-[1] flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-xs transition-opacity duration-700 pointer-events-none ${
          isCurrentVideoLoading ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="w-9 h-9 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3" />
        <span className="text-xs font-medium text-slate-300 tracking-wider uppercase">
          Loading Background...
        </span>
      </div>

      {/* 2. Background Video Layer */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        {activeVideoList.map((link, idx) => {
          const fileId = getDriveFileId(link);
          const isActive = idx === currentIndex;
          const isReady = loadedVideos[idx];
          const videoSrc = resolvedSources[idx];

          if (!videoSrc) return null;

          return (
            <video
              key={fileId || link || idx}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              src={videoSrc}
              onCanPlay={() => handleVideoLoaded(idx)}
              className={`min-h-full absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                isActive && isReady ? "opacity-100" : "opacity-0"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}