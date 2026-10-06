"use client";

import React, { useState } from "react";
import Image from "next/image";

interface VideoSectionProps {
  brandName?: string;
}

export default function VideoSection({
  brandName = "Super Profit Business",
}: VideoSectionProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const youtubeUrl =
    "https://www.youtube.com/embed/7YzDPbLp2Rk";

  return (
    <section
      aria-label="Overview Video"
      className="w-full pt-8 pb-4 sm:pt-12 sm:pb-8 px-4 flex justify-center"
    >
      <div className="w-full max-w-[830px] mx-auto">
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-video bg-deepGreen-950 border border-deepGreen-900/40">
          {isPlaying ? (
            <iframe
              src={`${youtubeUrl}?autoplay=1&rel=0`}
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
              className="absolute inset-0 w-full h-full select-none group cursor-pointer"
              aria-label="Play video"
            >
              {/* YouTube Thumbnail */}
              <Image
                src="https://img.youtube.com/vi/7YzDPbLp2Rk/maxresdefault.jpg"
                alt="How my life changed | My main source of Income | Kannada UGC MasterClass"
                fill
                priority
                className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                unoptimized
              />

              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors duration-300" />

              {/* Play Button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 shadow-xl transition-transform duration-300 group-hover:scale-110">
                  <svg
                    className="w-7 h-7 sm:w-9 sm:h-9 ml-1 text-deepGreen-950"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
