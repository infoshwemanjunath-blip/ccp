"use client";

import React, { useState, useEffect } from "react";
import { Lock } from "lucide-react";

interface OfferBannerProps {
  badgeText: string;
  description: string;
  originalPrice: string;
  currentPrice: string;
}

const CYCLE_DURATION = 10 * 60; // 10 minutes in seconds
const STORAGE_KEY = "superprofit_offer_expiry_timer";

export default function OfferBanner({
  badgeText,
  description,
  originalPrice,
  currentPrice,
}: OfferBannerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("10:00");

  useEffect(() => {
    const getOrSetExpiry = () => {
      const now = Date.now();
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const expiry = parseInt(stored, 10);
        if (!isNaN(expiry) && expiry > now) {
          return expiry;
        }
      }
      const newExpiry = now + CYCLE_DURATION * 1000;
      localStorage.setItem(STORAGE_KEY, newExpiry.toString());
      return newExpiry;
    };

    let targetExpiry = getOrSetExpiry();

    const updateTimer = () => {
      const now = Date.now();
      let diffSeconds = Math.floor((targetExpiry - now) / 1000);

      if (diffSeconds <= 0) {
        targetExpiry = now + CYCLE_DURATION * 1000;
        localStorage.setItem(STORAGE_KEY, targetExpiry.toString());
        diffSeconds = CYCLE_DURATION;
      }

      const mins = Math.floor(diffSeconds / 60);
      const secs = diffSeconds % 60;
      setTimeLeft(
        `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      role="region"
      aria-label="Promotional Announcement"
      className="w-full bg-deepGreen-950 text-cream-100 py-3 sm:py-3.5 px-4 text-xs sm:text-sm border-b border-deepGreen-900 shadow-inner"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-center text-center flex-wrap gap-x-2.5 gap-y-2 leading-relaxed">
        <span className="inline-flex items-center gap-1.5 font-medium text-cream-200">
          <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-luxuryGold-400 shrink-0" aria-hidden="true" />
          <span>{badgeText} :</span>
        </span>
        <span className="text-cream-100/90">{description}</span>
        <span className="line-through text-cream-300/70 mx-0.5 tracking-tight font-medium">
          {originalPrice}
        </span>
        <span className="font-semibold text-peach-200 tracking-wide">
          yours today for just{" "}
          <span className="text-luxuryGold-400 font-bold underline decoration-peach-400/50 underline-offset-4">
            {currentPrice}
          </span>
        </span>

        {/* 10-Minute Recurring Urgency Countdown Timer */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDE9FE] text-[#4338CA] font-bold text-xs sm:text-sm tracking-tight shadow-sm border border-[#DDD6FE] ml-1">
          <span role="img" aria-label="hourglass" className="text-sm leading-none">⏳</span>
          <span>Offer price expires in</span>
          <span className="font-mono font-extrabold text-[#3730A3] tabular-nums tracking-normal">
            {timeLeft}
          </span>
        </span>
      </div>
    </div>
  );
}

