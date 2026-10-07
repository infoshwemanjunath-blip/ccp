"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface VideoSectionProps {
  youtubeUrl?: string;
  brandName?: string;
}

export default function VideoSection({
  youtubeUrl = "https://youtu.be/7YzDPbLp2Rk?si=8hgVhuK87bZr3eKF",
  brandName = "Super Profit Business",
}: VideoSectionProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  const getVideoId = (url: string) => {
    if (!url) return "7YzDPbLp2Rk";
    try {
      if (url.includes("embed/")) {
        return url.split("embed/")[1]?.split("?")[0] || "7YzDPbLp2Rk";
      }
      if (url.includes("youtu.be/")) {
        return url.split("youtu.be/")[1]?.split("?")[0] || "7YzDPbLp2Rk";
      }
      if (url.includes("youtube.com/watch")) {
        const u = new URL(url);
        return u.searchParams.get("v") || "7YzDPbLp2Rk";
      }
      return "7YzDPbLp2Rk";
    } catch {
      return "7YzDPbLp2Rk";
    }
  };

  const videoId = getVideoId(youtubeUrl);
  // controls=1: displays native YouTube progress line (scrubber), seek forward/backward, time, pause/play
  // autoplay=1&mute=1: ensures automatic playback on open across all browsers
  // playsinline=1: inline mobile playback
  // enablejsapi=1: allows unmuting via postMessage on user interaction
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&rel=0&playsinline=1&enablejsapi=1&modestbranding=1`;

  const sendYtCommand = useCallback((func: string, args: unknown[] = []) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func,
          args,
        }),
        "*"
      );
    }
  }, []);

  const handleUnmute = (e: React.MouseEvent) => {
    e.stopPropagation();
    sendYtCommand("unMute");
    setIsMuted(false);
  };

  // Auto-unmute on first user interaction anywhere on the page
  useEffect(() => {
    const handleFirstInteraction = () => {
      sendYtCommand("unMute");
      setIsMuted(false);
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };

    window.addEventListener("click", handleFirstInteraction, { once: true });
    window.addEventListener("touchstart", handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, [sendYtCommand]);

  return (
    <section
      aria-label="Overview Video"
      className="w-full pt-8 pb-4 sm:pt-12 sm:pb-8 px-4 flex justify-center"
    >
      <div className="w-full max-w-[830px] mx-auto">
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-video bg-deepGreen-950 border border-deepGreen-900/40">
          {/* YouTube iframe with native controls, scrubber timeline, forward/backward active */}
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={`${brandName} Masterclass Overview`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />

          {/* Floating Tap for Sound Badge if muted */}
          {isMuted && (
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 pointer-events-auto">
              <button
                id="video-tap-sound-btn"
                type="button"
                onClick={handleUnmute}
                aria-label="Unmute video sound"
                className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-black/80 hover:bg-black/95 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg active:scale-95 animate-pulse"
              >
                <svg className="w-4 h-4 fill-gold-400" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.73 4.73H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
                <span className="text-gold-300">Tap for Sound</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}