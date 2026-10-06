import React from "react";
import CTAButton from "./CTAButton";

interface HeroSectionProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaText: string;
  supportText: string;
}

export default function HeroSection({
  eyebrow,
  title,
  subtitle,
  ctaText,
  supportText,
}: HeroSectionProps) {
  return (
    <section
      aria-label="Hero Section"
      className="w-full pt-4 pb-14 sm:pt-6 sm:pb-20 px-4 sm:px-6 flex flex-col items-center text-center"
    >
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        {/* Eyebrow */}
        <span className="text-luxuryGold-500 font-serif italic text-base sm:text-lg md:text-xl font-medium tracking-wide mb-3 sm:mb-4">
          {eyebrow}
        </span>

        {/* Main Heading */}
        <h1 className="font-serif text-brandText-primary text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-normal leading-[1.18] sm:leading-[1.16] tracking-tight max-w-3xl mb-4 sm:mb-6">
          {title}
        </h1>

        {/* Subtitle */}
        <p className="font-sans text-brandText-secondary/80 text-base sm:text-lg md:text-xl font-normal max-w-2xl leading-relaxed mb-8 sm:mb-10">
          {subtitle}
        </p>

        {/* CTA Button */}
        <div className="mb-4">
          <CTAButton href="#join" variant="primary" id="hero-join-now-cta">
            {ctaText}
          </CTAButton>
        </div>

        {/* Small Supporting Text */}
        <p className="font-sans text-brandText-muted text-xs sm:text-sm font-normal max-w-md leading-relaxed">
          {supportText}
        </p>
      </div>
    </section>
  );
}
