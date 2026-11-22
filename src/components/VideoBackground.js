// src/components/VideoBackground.js
"use client";

export default function VideoBackground({ children }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
      >
        <source src="/api/video" type="video/mp4" />
      </video>
    </div>
  );
}