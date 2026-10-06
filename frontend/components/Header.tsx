import React from "react";
import Image from "next/image";
import CTAButton from "./CTAButton";

interface HeaderProps {
  logoSrc: string;
  brandName: string;
}

export default function Header({ logoSrc, brandName }: HeaderProps) {
  return (
    <header className="w-full bg-cream-50/90 backdrop-blur-md border-b border-cream-300/60 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between">
        {/* Left: Client Logo */}
        <a
          href="#"
          className="flex items-center gap-3 transition-opacity hover:opacity-90 focus:outline-none"
          aria-label={brandName}
        >
          <div className="relative h-10 w-28 sm:h-12 sm:w-36 flex items-center">
            <Image
              src={logoSrc}
              alt={brandName}
              fill
              priority
              className="object-contain object-left"
            />
          </div>
        </a>

        {/* Right: Instagram + CTA Button */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          <a
            href="https://www.instagram.com/shwe.manjunath?stkn=bDZtZjd6eWc0ZHJl"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram @shwe.manjunath"
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full border border-pink-200/90 bg-gradient-to-r from-pink-50/90 via-rose-50/70 to-peach-50/90 hover:border-pink-300 hover:shadow-xs text-deepGreen-900 transition-all hover:scale-105 group"
          >
            <svg
              className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-pink-600 transition-transform group-hover:scale-110 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
            <span className="hidden min-[400px]:inline text-xs sm:text-sm font-semibold tracking-tight text-deepGreen-900 group-hover:text-pink-700 whitespace-nowrap">
              @shwe.manjunath
            </span>
          </a>

          <CTAButton href="#join" variant="header" id="header-cta">
            <span className="hidden sm:inline">GET INSTANT ACCESS</span>
            <span className="sm:hidden font-semibold">ACCESS</span>
          </CTAButton>
        </div>
      </div>
    </header>
  );
}
