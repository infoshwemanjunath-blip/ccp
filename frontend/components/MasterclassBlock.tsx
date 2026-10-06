import React from "react";
import Image from "next/image";
import CTAButton from "./CTAButton";

interface MasterclassBlockProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
}

export default function MasterclassBlock({
  eyebrow = "EXCLUSIVE TRAINING",
  title = "UGC Masterclass",
  subtitle = "Step-by-step video curriculum covering everything from pitching to high-ticket brand payments.",
  ctaText = "JOIN NOW",
}: MasterclassBlockProps) {
  return (
    <section
      aria-label="UGC Masterclass Preview"
      className="w-full py-16 sm:py-24 px-4 sm:px-6 bg-cream-100 border-t border-cream-300/60"
    >
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Eyebrow */}
        <span className="text-luxuryGold-500 font-serif italic text-sm sm:text-base font-medium tracking-wider uppercase mb-3">
          {eyebrow}
        </span>

        {/* Title */}
        <h2 className="font-serif text-brandText-primary text-3xl sm:text-4xl md:text-5xl font-normal leading-tight max-w-2xl mb-4">
          {title}
        </h2>

        {/* Subtitle */}
        <p className="font-sans text-brandText-muted text-sm sm:text-base max-w-xl mb-10 leading-relaxed">
          {subtitle}
        </p>

        {/* Masterclass Poster Card */}
        <div className="w-full max-w-[780px] relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-video border-2 border-peach-200/80 bg-deepGreen-950 mb-10 group select-none">
          <div className="relative aspect-video w-full">
            <Image
              src="/complete-ugc-masterclass-kannada.png"
              alt="Complete UGC MasterClass in Kannada"
              fill
              priority
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>
        </div>

        {/* Author & Method Statement */}
        <div className="max-w-xl mx-auto mb-8 sm:mb-10">
          <p className="font-serif text-brandText-primary text-xl sm:text-2xl md:text-3xl font-normal leading-snug tracking-tight">
            &ldquo;The proven UGC method to get High paying brand deals&rdquo;
          </p>
          <p className="text-luxuryGold-500 font-sans text-sm sm:text-base font-medium tracking-wide mt-2">
            Designed by Shwetha Manjunath
          </p>
          <p className="font-serif text-brandText-primary text-lg sm:text-xl font-semibold tracking-wide mt-2 text-deepGreen-900">
            ಕನ್ನಡದಲ್ಲಿ ಕಲಿಯಿರಿ
          </p>
        </div>

        {/* Join Now CTA Button */}
        <div className="flex flex-col items-center gap-3">
          <CTAButton href="#join" variant="primary" id="masterclass-join-now-cta">
            {ctaText}
          </CTAButton>
          <span className="text-xs text-brandText-muted">
            Instant lifetime access • 5 Bonuses included
          </span>
        </div>
      </div>
    </section>
  );
}


