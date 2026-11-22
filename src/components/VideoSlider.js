// src/components/VideoSlider.js
"use client";

import { useState, useEffect } from "react";

const DEFAULT_DRIVE_LINKS = [
  "https://drive.google.com/file/d/19zV-mujQLNQbHGdr0JzGORhrTtj57qI1/view?usp=drive_link",
  "https://drive.google.com/file/d/1JH1Yd5KWLbptZRA19FZKz6vlyA-BBSR1/view?usp=sharing",
  "https://drive.google.com/file/d/1E6iVxZKnPwa0DnPdUV0Sb4xDtj9EU0Yr/view?usp=sharing",
];

// Helper to extract file ID from Google Drive URLs
function getDriveFileId(url) {
  if (!url) return null;
  const match = url.match(/\/d\/([^/]+)/);
  return match ? match[1] : null;
}

export default function VideoSlider({ videos }) {
  // Use passed array if non-empty, otherwise fallback to defaults
  const activeVideoList =
    Array.isArray(videos) && videos.length > 0 ? videos : DEFAULT_DRIVE_LINKS;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedVideos, setLoadedVideos] = useState({});

  // Slide transition every 30 seconds
  useEffect(() => {
    if (activeVideoList.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeVideoList.length);
    }, 30000);

    return () => clearInterval(timer);
  }, [activeVideoList.length]);

  // Mark video as ready to display
  const handleVideoLoaded = (index) => {
    setLoadedVideos((prev) => ({ ...prev, [index]: true }));
  };

  // Active video has not finished initial buffering
  const isCurrentVideoLoading = !loadedVideos[currentIndex];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950">
      {/* 1. Loading Indicator Overlay */}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-xs transition-opacity duration-700 pointer-events-none ${
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

          // Direct proxy URL if Google Drive link, otherwise raw URL
          const videoSrc = fileId ? `/api/video/${fileId}` : link;

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
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                isActive && isReady ? "opacity-100" : "opacity-0"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}