import React from "react";
import { Users, CreditCard, Zap, Globe, TrendingUp, Check, Sparkles } from "lucide-react";
import { PlaycardItem } from "./siteContent";

interface FeaturesPlaycardsProps {
  eyebrow?: string;
  heading: string;
  cards: PlaycardItem[];
}

export default function FeaturesPlaycards({
  eyebrow = "CREATOR ADVANTAGES",
  heading,
  cards,
}: FeaturesPlaycardsProps) {
  const getIcon = (name: PlaycardItem["iconName"]) => {
    const iconClass = "w-5 h-5 text-deepGreen-950";
    switch (name) {
      case "users":
        return <Users className={iconClass} />;
      case "payment":
        return <CreditCard className={iconClass} />;
      case "zap":
        return <Zap className={iconClass} />;
      case "globe":
        return <Globe className={iconClass} />;
      case "trending":
        return <TrendingUp className={iconClass} />;
      default:
        return <Check className={iconClass} />;
    }
  };

  return (
    <section
      aria-label="Creator Advantages"
      className="w-full py-16 sm:py-24 px-4 sm:px-6 bg-cream-200/50 border-t border-cream-300/60"
    >
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        {/* Eyebrow */}
        {eyebrow && (
          <span className="text-luxuryGold-500 font-serif italic text-sm sm:text-base font-medium tracking-wider uppercase mb-3 text-center">
            {eyebrow}
          </span>
        )}

        {/* Main Section Heading */}
        <h2 className="font-serif text-brandText-primary text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-normal leading-[1.25] text-center max-w-3xl mb-10 sm:mb-14">
          {heading}
        </h2>

        {/* Single Premium Playcard Container */}
        <div className="w-full max-w-2xl relative group">
          {/* Ambient card glow */}
          <div className="absolute -inset-1 rounded-[32px] bg-gradient-to-r from-peach-300/40 via-luxuryGold-400/30 to-peach-300/40 blur-xl opacity-60 group-hover:opacity-90 transition duration-500" />

          {/* Playing Card Body */}
          <div className="relative rounded-[28px] bg-cream-50 border-2 border-peach-200/90 shadow-luxury p-6 sm:p-10 transition-transform duration-300 group-hover:-translate-y-1">
            {/* Playing Card Top Corners */}
            <div className="flex items-center justify-between pb-6 border-b border-cream-300/80">
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl sm:text-2xl font-bold text-deepGreen-950">A</span>
                <span className="text-luxuryGold-500 text-sm">♦</span>
                <span className="text-xs font-semibold tracking-widest uppercase text-brandText-muted ml-2">
                  LEARN FROM ZERO
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-peach-100 text-deepGreen-950 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-luxuryGold-500" />
                <span>5-in-1 Benefits</span>
              </div>
            </div>

            {/* 5 Benefits List Inside Single Playcard */}
            <div className="divide-y divide-cream-300/60 my-4 sm:my-6">
              {cards.map((card, idx) => (
                <div
                  key={card.id}
                  className="py-4 sm:py-5 flex items-start gap-4 transition-colors hover:bg-cream-100/60 rounded-xl px-2 sm:px-3 -mx-2 sm:-mx-3"
                >
                  {/* Card Index & Icon */}
                  <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-peach-100/80 border border-peach-200 flex items-center justify-center shrink-0 shadow-sm">
                    {getIcon(card.iconName)}
                    <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-deepGreen-950 text-cream-100 text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                  </div>

                  {/* Title & Tagline */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-serif text-brandText-primary text-base sm:text-lg font-medium leading-snug">
                        {card.title}
                      </h3>
                      <Check className="w-4 h-4 text-deepGreen-950 stroke-[3] shrink-0" />
                    </div>
                    <p className="font-sans text-brandText-muted text-xs sm:text-sm mt-0.5 leading-relaxed">
                      {card.tagline}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Playing Card Bottom Corner (Inverted A ♦) */}
            <div className="pt-5 border-t border-cream-300/80 flex items-center justify-between text-xs text-brandText-muted">
              <span className="font-sans">All 5 included with instant enrollment</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-widest uppercase text-brandText-muted mr-2">
                  ACE ACCESS
                </span>
                <span className="text-luxuryGold-500 text-sm">♦</span>
                <span className="font-serif text-xl sm:text-2xl font-bold text-deepGreen-950">A</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

