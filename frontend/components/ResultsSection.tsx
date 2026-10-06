import React from "react";

interface ResultsSectionProps {
  eyebrow?: string;
  statistic?: string;
  statDescription?: string;
}

export default function ResultsSection({
  eyebrow = "PROVEN RESULTS",
  statistic = "3,467+",
  statDescription = "Active creators & business builders scaling high-income UGC deals.",
}: ResultsSectionProps) {
  return (
    <section
      aria-label="Proven Results"
      className="w-full bg-deepGreen-950 text-cream-100 py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden"
    >
      {/* Background luxury gradient accents */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0D4B42] via-deepGreen-950 to-deepGreen-950 opacity-50 pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Eyebrow */}
        <p className="text-luxuryGold-400 text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase mb-4 sm:mb-6">
          {eyebrow}
        </p>

        {/* Large Stat */}
        <div className="font-serif text-cream-100 text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-normal tracking-tight mb-4 sm:mb-6 select-none">
          {statistic}
        </div>

        {/* Stat Description / Subtitle */}
        <p className="font-sans text-cream-200/80 text-sm sm:text-base md:text-lg max-w-md mx-auto leading-relaxed">
          {statDescription}
        </p>
      </div>
    </section>
  );
}
