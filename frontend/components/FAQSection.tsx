"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  Clock,
  UserX,
  CornerDownLeft,
  AlertCircle,
  Plus,
  Minus,
  Sparkles,
} from "lucide-react";

interface FAQItem {
  id: string;
  num: string;
  icon: "help" | "clock" | "user" | "refund" | "alert";
  question: string;
  category: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    id: "who-is-this-for",
    num: "01",
    category: "Eligibility & Target",
    icon: "help",
    question: "Who is this for ?",
    answer:
      "You&apos;re done doing unpaid or underpaid collaborations, and ready to charge confidently and deliver premium content. This playbook is for creators who want to build a real business, not just a hobby.",
  },
  {
    id: "course-duration",
    num: "02",
    category: "Learning Pace",
    icon: "clock",
    question: "What is the duration of the course ?",
    answer:
      "It&apos;s approximately 2 hours long. Designed to be concise and actionable so you can start implementing immediately.",
  },
  {
    id: "without-showing-face",
    num: "03",
    category: "Faceless UGC",
    icon: "user",
    question: "Can I work without showing my face ?",
    answer:
      "Yes, absolutely! UGC faceless creators are also growing tremendously these days. Many successful UGC creators work entirely behind the camera, focusing on product shots, hands-only content, and voiceovers.",
  },
  {
    id: "refund-policy",
    num: "04",
    category: "Policy",
    icon: "refund",
    question: "Is this course refundable ?",
    answer:
      "This course is non-refundable as it&apos;s a digital product. Once you purchase, you get immediate lifetime access to all the content.",
  },
  {
    id: "get-rich-quick",
    num: "05",
    category: "Expectations & Mindset",
    icon: "alert",
    question:
      "Is UGC a Get-Rich-Quick Scheme? Can I Start Earning on the Same Day I Join?",
    answer: `
      <div class="space-y-3">
        <p><strong class="text-deepGreen-950 font-bold">No.</strong> UGC is not a get-rich-quick scheme, and you shouldn&apos;t expect to start earning huge amounts overnight.</p>
        <p>This course will teach you everything from the basics, but building your skills and getting consistent brand opportunities takes time, practice, creativity, communication, consistency, and effort.</p>
        <p class="p-3.5 rounded-xl bg-peach-100/60 border-l-4 border-peach-400 text-deepGreen-900 font-medium">
          First, focus on learning and becoming skilled. Then, focus on turning those skills into income.
        </p>
        <p>Your results will depend on how seriously you apply what you learn, how consistently you practice, how you approach brands, and how much you improve along the way.</p>
        <p class="font-bold text-deepGreen-950">Learn first. Get skilled. Take action. Then focus on the money.</p>
        <p class="text-sm opacity-90">There is no overnight success — but with the right skills, consistency, and action, UGC can become a valuable income opportunity.</p>
      </div>
    `,
  },
];

export default function FAQSection() {
  const [openIds, setOpenIds] = useState<string[]>([]);

  const toggleFaq = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const renderIcon = (type: FAQItem["icon"]) => {
    switch (type) {
      case "clock":
        return <Clock className="w-5 h-5 text-deepGreen-900" />;
      case "user":
        return <UserX className="w-5 h-5 text-deepGreen-900" />;
      case "refund":
        return <CornerDownLeft className="w-5 h-5 text-deepGreen-900" />;
      case "alert":
        return <AlertCircle className="w-5 h-5 text-deepGreen-900" />;
      case "help":
      default:
        return <HelpCircle className="w-5 h-5 text-deepGreen-900" />;
    }
  };

  return (
    <section className="py-24 px-4 sm:px-6 bg-gradient-to-b from-cream-100 via-cream-50 to-cream-100 border-t border-peach-200/60 relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-peach-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-luxuryGold-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-peach-200/70 text-deepGreen-950 text-xs sm:text-sm font-semibold tracking-wider uppercase mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-luxuryGold-600" />
            <span>Got Questions? We&apos;ve Got Answers</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-deepGreen-900 font-serif mb-4 tracking-tight">
            Frequently Asked Questions
          </h2>
          <div className="w-24 h-1 bg-peach-400 mx-auto rounded-full mb-4"></div>
          <p className="text-brandText-muted text-sm sm:text-base max-w-lg mx-auto">
            Everything you need to know before enrolling in the UGC Masterclass.
          </p>
        </div>

        {/* FAQs Accordion Cards */}
        <div className="space-y-4 sm:space-y-5">
          {faqs.map((faq) => {
            const isOpen = openIds.includes(faq.id);
            return (
              <div
                key={faq.id}
                className={`rounded-2xl sm:rounded-3xl transition-all duration-300 overflow-hidden border ${
                  isOpen
                    ? "bg-white border-peach-300 shadow-xl shadow-peach-900/5 ring-2 ring-peach-300/30"
                    : "bg-white/80 hover:bg-white border-peach-200/80 shadow-sm hover:shadow-md hover:border-peach-300"
                }`}
              >
                {/* Accordion Question Trigger */}
                <button
                  type="button"
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isOpen}
                  className="w-full text-left p-5 sm:p-6 flex items-start sm:items-center justify-between gap-4 cursor-pointer select-none transition-colors group"
                >
                  <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 flex-1">
                    {/* Icon Badge */}
                    <div
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105 ${
                        isOpen
                          ? "bg-peach-300 text-deepGreen-950 shadow-sm"
                          : "bg-peach-100 text-deepGreen-900"
                      }`}
                    >
                      {renderIcon(faq.icon)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold tracking-widest uppercase text-luxuryGold-600">
                          {faq.category}
                        </span>
                        <span className="text-deepGreen-900/30 text-xs">•</span>
                        <span className="text-[11px] font-medium text-deepGreen-900/50">
                          {faq.num}
                        </span>
                      </div>
                      <h3 className="font-serif text-lg sm:text-xl font-bold text-deepGreen-900 leading-snug group-hover:text-deepGreen-950 transition-colors">
                        {faq.question}
                      </h3>
                    </div>
                  </div>

                  {/* Toggle Button Icon */}
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                      isOpen
                        ? "bg-deepGreen-900 text-cream-100 rotate-180"
                        : "bg-peach-100 text-deepGreen-900 group-hover:bg-peach-200"
                    }`}
                  >
                    {isOpen ? (
                      <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>
                </button>

                {/* Animated Accordion Content */}
                {isOpen && (
                  <div className="px-5 pb-6 sm:px-6 sm:pb-7 pt-1 border-t border-peach-100">
                    <div className="pl-0 sm:pl-16 text-deepGreen-900/85 leading-relaxed text-base sm:text-lg font-sans">
                      <div dangerouslySetInnerHTML={{ __html: faq.answer }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Support Callout */}
        <div className="mt-14 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white via-cream-50 to-peach-100/50 border border-peach-200/90 shadow-md flex flex-col lg:flex-row items-center justify-between gap-6 text-center lg:text-left">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#25D366]/25">
              <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
</svg>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/90 border border-emerald-300/70 text-emerald-900 text-xs sm:text-sm font-semibold mb-2 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>250+ students enrolled &amp; started learning in ಕನ್ನಡ in last 3 hour!</span>
              </div>
              <h4 className="font-serif text-xl sm:text-2xl font-bold text-deepGreen-900">
                Start your journey now to learn &amp; Earn
              </h4>
              <p className="text-base sm:text-lg font-bold text-deepGreen-950 mt-1 flex items-center justify-center sm:justify-start gap-1">
                Have Doubts 👇🏻
              </p>
            </div>
          </div>

          <a
            href="https://wa.me/917676200810"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-base transition-all hover:scale-105 shrink-0 shadow-lg shadow-[#25D366]/30 active:scale-95"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
</svg>
            <span>Chat on Whatsapp.</span>
          </a>
        </div>
      </div>
    </section>
  );
}
