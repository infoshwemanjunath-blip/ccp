"use client";

import React from "react";
import Image from "next/image";

export default function BonusesSection() {
  return (
    <section className="py-16 px-6 bg-white border-t border-peach-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-deepGreen-900 mb-4 font-serif">
            5 Free bonuses
          </h2>
          <div className="w-24 h-1 bg-peach-400 mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Bonus 1 */}
          <div className="bg-cream-100 rounded-3xl p-8 border border-peach-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-peach-300 text-deepGreen-950 font-bold px-4 py-1 rounded-full w-fit mb-4 text-sm uppercase tracking-wider">
              Bonus 1
            </div>
            <h3 className="text-xl font-bold text-deepGreen-900 mb-3">
              50 UGC Brand Pitch Templates E-book
            </h3>
            <p className="text-deepGreen-800/80 mb-6 font-medium">
              Worth <span className="line-through decoration-red-500 decoration-2 opacity-70">₹9999</span> <span className="text-green-600 font-bold ml-1">FREE</span>
            </p>
            <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-white border border-peach-200 shadow-inner">
              <Image 
                src="/ugc_e-book_image.jpeg" 
                alt="50 UGC Brand Pitch Templates E-book" 
                fill 
                className="object-cover" 
              />
            </div>
          </div>

          {/* Bonus 2 */}
          <div className="bg-cream-100 rounded-3xl p-8 border border-peach-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-peach-300 text-deepGreen-950 font-bold px-4 py-1 rounded-full w-fit mb-4 text-sm uppercase tracking-wider">
              Bonus 2
            </div>
            <h3 className="text-xl font-bold text-deepGreen-900 mb-3">
              1 doubt solving session with your mentor Shwetha manjunath
            </h3>
            <p className="text-deepGreen-800/80 mb-4 font-medium">
              Worth <span className="line-through decoration-red-500 decoration-2 opacity-70">₹9999</span> <span className="text-green-600 font-bold ml-1">FREE</span>
            </p>
            <p className="text-deepGreen-800/80 leading-relaxed text-sm">
              After completing course you will get group doubt solving session, get direct guidence, learn practical statergies and clear all your questions to confidently start your journey.
            </p>
          </div>

          {/* Bonus 3 */}
          <div className="bg-cream-100 rounded-3xl p-8 border border-peach-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-peach-300 text-deepGreen-950 font-bold px-4 py-1 rounded-full w-fit mb-4 text-sm uppercase tracking-wider">
              Bonus 3
            </div>
            <h3 className="text-xl font-bold text-deepGreen-900 mb-3">
              Free portfolio templates
            </h3>
            <p className="text-deepGreen-800/80 mb-4 font-medium">
              Worth <span className="line-through decoration-red-500 decoration-2 opacity-70">₹2000</span> <span className="text-green-600 font-bold ml-1">FREE</span>
            </p>
            <p className="text-deepGreen-800/80 leading-relaxed text-sm">
              Step by step videos in kannada to get high paid brand deals.
            </p>
          </div>

          {/* Bonus 4 */}
          <div className="bg-cream-100 rounded-3xl p-8 border border-peach-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-peach-300 text-deepGreen-950 font-bold px-4 py-1 rounded-full w-fit mb-4 text-sm uppercase tracking-wider">
              Bonus 4
            </div>
            <h3 className="text-xl font-bold text-deepGreen-900 mb-3">
              50 Travel/ Resort Pitches to get Barter/Paid travel collaboration experience.
            </h3>
            <p className="text-deepGreen-800/80 mb-6 font-medium">
              Worth <span className="line-through decoration-red-500 decoration-2 opacity-70">₹3000</span> <span className="text-green-600 font-bold ml-1">FREE</span>
            </p>
            <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-white border border-peach-200 shadow-inner">
              <Image 
                src="/travel-resort-pitches-ebook.png" 
                alt="50 Travel/ Resort Pitches to get Barter/Paid travel collaboration experience." 
                fill 
                className="object-cover" 
              />
            </div>
          </div>

          {/* Bonus 5 */}
          <div className="bg-cream-100 rounded-3xl p-8 border border-peach-200 shadow-sm hover:shadow-md transition-shadow md:col-span-2 lg:col-span-1">
            <div className="bg-peach-300 text-deepGreen-950 font-bold px-4 py-1 rounded-full w-fit mb-4 text-sm uppercase tracking-wider">
              Bonus 5
            </div>
            <h3 className="text-xl font-bold text-deepGreen-900 mb-3">
              Exclusive WhatsApp group to get Daily Brand Collaboration Opportunities
            </h3>
            <p className="text-deepGreen-800/80 mb-4 font-medium">
              <span className="text-green-600 font-bold">Free lifetime access.</span>
            </p>
            <p className="text-deepGreen-800/80 leading-relaxed text-sm">
              Get life time access to our exclusive whatsapp group where we regularly share brand deals opportunities, paid collaboration and barter collab forms and many more daily opportunites.
            </p>
          </div>

        </div>

        {/* Final CTA Area */}
        <div className="mt-12 pt-8 border-t border-peach-200 text-center max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-deepGreen-900 mb-6 font-serif leading-tight">
            Position yourself as a paid UGC creator <br className="hidden md:block"/>
            <span className="inline-flex items-center text-red-500/90 mt-2">
              not free collaborator <span className="ml-2 font-sans font-bold">❌</span>
            </span>
          </h2>
          
          <div className="flex flex-col items-center justify-center mb-8 gap-4">
            <div className="text-4xl font-extrabold text-deepGreen-950 font-serif">
              ₹3,499
            </div>
          </div>
          
          <button
            type="button"
            data-enroll-btn
            className="bg-peach-400 hover:bg-peach-500 text-deepGreen-950 font-bold text-lg py-3 px-8 rounded-full shadow-[0_8px_0_0_#d88c55] hover:shadow-[0_4px_0_0_#d88c55] hover:translate-y-1 transition-all cursor-pointer"
          >
            Start Now
          </button>
        </div>
      </div>
    </section>
  );
}


