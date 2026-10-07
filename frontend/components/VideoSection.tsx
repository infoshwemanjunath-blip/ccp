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
  const [isPaused, setIsPaused] = useState(false);
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
  // controls=0: removes scrubber/progress bar/standard YouTube controls
  // disablekb=1: disables keyboard seeking
  // iv_load_policy=3: hides annotations
  // modestbranding=1: removes large YouTube logo
  // enablejsapi=1: allows controlling play/pause/mute via postMessage
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&enablejsapi=1&iv_load_policy=3&modestbranding=1&disablekb=1&fs=0`;

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

  const togglePlayPause = () => {
    if (isPaused) {
      sendYtCommand("playVideo");
      setIsPaused(false);
    } else {
      sendYtCommand("pauseVideo");
      setIsPaused(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMuted) {
      sendYtCommand("unMute");
      setIsMuted(false);
    } else {
      sendYtCommand("mute");
      setIsMuted(true);
    }
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
        <div
          onClick={togglePlayPause}
          className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-video bg-deepGreen-950 border border-deepGreen-900/40 cursor-pointer group select-none"
        >
          {/* YouTube iframe with controls disabled */}
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={`${brandName} Masterclass Overview`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0 pointer-events-none"
          />

          {/* Clickable transparent overlay to capture clicks */}
          <div className="absolute inset-0 z-10" />

          {/* Paused Center Indicator */}
          {isPaused && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-300">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gold-500/90 text-deepGreen-950 flex items-center justify-center shadow-lg transform transition-transform hover:scale-110">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 ml-1 fill-current"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-white/90 bg-black/60 px-3 py-1 rounded-full border border-white/10">
                  Paused • Click to Resume
                </span>
              </div>
            </div>
          )}

          {/* Minimal Floating Controls Bar */}
          <div
            className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 flex items-center justify-between pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dedicated Pause / Resume Button */}
            <button
              id="video-pause-btn"
              type="button"
              onClick={togglePlayPause}
              aria-label={isPaused ? "Resume video" : "Pause video"}
              className="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white text-xs sm:text-sm font-medium transition-all shadow-md active:scale-95"
            >
              {isPaused ? (
                <>
                  <svg className="w-4 h-4 fill-gold-400" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Play</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                  <span>Pause</span>
                </>
              )}
            </button>

            {/* Sound Toggle (Unmute / Mute) */}
            <button
              id="video-sound-toggle-btn"
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute sound" : "Mute sound"}
              className="flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white text-xs sm:text-sm font-medium transition-all shadow-md active:scale-95"
            >
              {isMuted ? (
                <>
                  <svg className="w-4 h-4 fill-gold-400" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.73 4.73H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                  <span className="text-gold-300">Tap for Sound</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                  <span>Sound On</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}