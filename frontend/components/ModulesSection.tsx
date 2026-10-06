import React from "react";
import { CheckCircle2, Sparkles, Gift } from "lucide-react";

interface ModuleItem {
  num: string;
  title: string;
  tag?: string;
  isSpecial?: boolean;
}

const modules: ModuleItem[] = [
  { num: "01", title: "Welcome & Introduction to start UGC Business" },
  { num: "02", title: "UGC Business Advantages" },
  { num: "03", title: "UGC Words That Matter" },
  { num: "04", title: "The UGC Process Explained" },
  { num: "05", title: "Skills That Pay You" },
  { num: "06", title: "Shooting Strategies" },
  { num: "07", title: "Build Your Portfolio With Your Mentor" },
  { num: "08", title: "Charge Like a Pro" },
  { num: "09", title: "UGC Contract Decode" },
  { num: "10", title: "Content That Brands Love" },
  { num: "11", title: "How to Pitch So You Don&apos;t Get Ignored" },
  { num: "12", title: "How to Get Paid for UGC Work" },
  {
    num: "13",
    title: "Things No One Tells You",
    tag: "5 Bonuses Included",
    isSpecial: true,
  },
];

export default function ModulesSection() {
  return (
    <section className="py-20 px-4 sm:px-6 bg-cream-50 border-t border-peach-100">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-14">
          <span className="text-luxuryGold-500 font-serif italic text-sm sm:text-base font-semibold tracking-widest uppercase mb-2 block">
            Step-by-Step Curriculum
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-deepGreen-900 font-serif mb-4">
            Inside the ಕನ್ನಡ UGC Masterclass
          </h2>
          <div className="w-24 h-1 bg-peach-400 mx-auto rounded-full mb-4"></div>
          <p className="text-brandText-muted text-sm sm:text-base max-w-xl mx-auto">
            13 clear, practical modules designed to take you from total beginner to closing paid brand deals.
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {modules.map((m) =>
            m.isSpecial ? (
              <div
                key={m.num}
                className="md:col-span-2 relative rounded-2xl p-6 sm:p-7 bg-gradient-to-r from-peach-100 via-cream-50 to-peach-200/90 text-deepGreen-950 border-2 border-peach-400 shadow-lg overflow-hidden group hover:border-peach-500 hover:shadow-xl transition-all duration-300"
              >
                {/* Accent glow */}
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-peach-300/30 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="w-12 h-12 rounded-xl bg-peach-300/60 border border-peach-400 text-deepGreen-950 font-serif font-bold text-xl flex items-center justify-center shrink-0">
                      {m.num}
                    </span>
                    <div>
                      <span className="text-xs uppercase tracking-widest text-deepGreen-800/70 font-bold block mb-1">
                        Module 13 • Final Mastery
                      </span>
                      <h3 className="text-xl sm:text-2xl font-bold font-serif text-deepGreen-950 flex items-center gap-2">
                        {m.title}
                        <Sparkles className="w-5 h-5 text-luxuryGold-600 inline" />
                      </h3>
                    </div>
                  </div>

                  {/* 5 Bonuses Highlight Badge */}
                  <div className="inline-flex items-center gap-2 bg-deepGreen-950 hover:bg-deepGreen-900 text-peach-200 font-extrabold text-sm sm:text-base px-5 py-2.5 rounded-full shadow-md shrink-0 transition-transform group-hover:scale-105">
                    <Gift className="w-4 h-4 text-peach-300" />
                    <span>+ 5 FREEEEEEE Bonuses</span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={m.num}
                className="flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-peach-200/70 shadow-sm hover:shadow-md hover:border-peach-300 transition-all duration-200"
              >
                <span className="w-10 h-10 rounded-xl bg-peach-100 text-deepGreen-900 font-bold text-base flex items-center justify-center shrink-0 font-serif">
                  {m.num}
                </span>
                <div className="flex-1">
                  <span className="text-[11px] font-semibold text-deepGreen-800/60 uppercase tracking-wider block">
                    Module {parseInt(m.num, 10)}
                  </span>
                  <p
                    className="text-base sm:text-lg font-semibold text-deepGreen-900 leading-snug"
                    dangerouslySetInnerHTML={{ __html: m.title }}
                  />
                </div>
                <CheckCircle2 className="w-5 h-5 text-peach-400/80 shrink-0" />
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
