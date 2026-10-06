"use client";

import React, { useState } from "react";
import Image from "next/image";

interface VideoSectionProps {
  youtubeUrl?: string;
  brandName?: string;
}

export default function VideoSection({
  youtubeUrl = "https://youtu.be/7YzDPbLp2Rk?si=8hgVhuK87bZr3eKF",
  brandName = "Super Profit Business",
}: VideoSectionProps) {
  const [isPlaying, setIsPlaying] = useState(false);

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
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

  return (
    <section
      aria-label="Overview Video"
      className="w-full pt-8 pb-4 sm:pt-12 sm:pb-8 px-4 flex justify-center"
    >
      <div className="w-full max-w-[830px] mx-auto">
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-video bg-deepGreen-950 border border-deepGreen-900/40">
          {isPlaying ? (
            <iframe
              src={embedUrl}
              title={`${brandName} Masterclass Overview`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 w-full h-full select-none group cursor-pointer focus:outline-none"
              aria-label="Play video"
            >
              {/* Uploaded UGC Business Poster */}
              <Image
                src="/how-to-build-high-revenue-ugc-business.png"
                alt="How to Build a High Revenue UGC Business"
                fill
                priority
                className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}