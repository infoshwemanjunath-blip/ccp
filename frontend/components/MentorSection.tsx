import React from "react";
import Image from "next/image";

export default function MentorSection() {
  return (
    <section className="py-20 px-6 bg-cream-100 border-t border-peach-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-deepGreen-900 mb-4 font-serif">
            Know Your Mentor
          </h2>
          <div className="w-24 h-1 bg-peach-400 mx-auto rounded-full"></div>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-start">
          
          {/* Left Column: Image (Sticky on Desktop) */}
          <div className="w-full lg:w-5/12 lg:sticky top-12">
            <div className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl border-4 border-white transform -rotate-2 hover:rotate-0 transition-transform duration-500">
              {/* Fallback styling in case image is missing */}
              <div className="absolute inset-0 bg-peach-200 flex items-center justify-center">
                <span className="text-deepGreen-800/50 font-bold">Image: know_your_author_image.jpeg</span>
              </div>
              <Image 
                src="/know_your_author_image.jpeg" 
                alt="Shweta Manjunath" 
                fill 
                className="object-cover relative z-10"
                // Adding a fallback in case the image path is slightly different
                
              />
            </div>
            
            <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-peach-100 text-center relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-peach-400 text-deepGreen-950 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                Mission
              </div>
              <p className="text-deepGreen-800 font-medium italic">
                "Helping you turn content creation skills into real income and high-paying UGC brand opportunities."
              </p>
            </div>
          </div>

          {/* Right Column: Story Content */}
          <div className="w-full lg:w-7/12 space-y-8 text-lg text-deepGreen-800/90 leading-relaxed">
            
            {/* Block 1: Intro */}
            <div>
              <h3 className="text-3xl font-bold text-deepGreen-900 mb-2 font-serif">
                Hi, I&apos;m Shweta Manjunath 👋
              </h3>
              <p className="text-xl font-medium text-peach-600">
                UGC Expert, Fashion & Lifestyle Influencer (4+ years), and Entrepreneur.
              </p>
            </div>

            {/* Block 2: The Struggle */}
            <div className="bg-white p-6 rounded-2xl border-l-4 border-peach-300 shadow-sm">
              <p className="mb-4">
                Nobody in my family taught me how to build wealth. I wasn&apos;t born into a business family. I didn&apos;t have investors, connections, or my parents&apos; support to build the lifestyle I have today.
              </p>
              <p>
                After experiencing the stress of a 9-to-5 corporate life—coming home exhausted in the evening and waking up to repeat the same routine the next morning—I realized that <strong>this wasn&apos;t the life I wanted.</strong>
              </p>
            </div>

            {/* Block 3: The Turning Point */}
            <div>
              <div className="inline-block bg-deepGreen-900 text-white px-4 py-1 rounded-lg font-bold mb-4 transform -skew-x-6">
                <span className="transform skew-x-6 block">So, I started learning.</span>
              </div>
              <p>
                I learned through experiences — by creating, experimenting, making mistakes, working with multiple big brands, understanding what actually works, and constantly improving myself.
              </p>
            </div>

            {/* Block 4: Achievements (Bulleted/Checkmarks style) */}
            <div className="space-y-4 pt-2">
              <p className="font-bold text-deepGreen-900">Over the past years, I turned my UGC skills into a successful income stream that helped me:</p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-green-500 mr-3 mt-1 font-bold">✓</span>
                  <span>Build my own multi-cuisine restaurant, Sea Plate</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-3 mt-1 font-bold">✓</span>
                  <span>Purchase land for my parents & invest in multiple properties in Bangalore</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-3 mt-1 font-bold">✓</span>
                  <span>Own three premium seafood trucks in Bangalore</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-3 mt-1 font-bold">✓</span>
                  <span>Travel internationally and buy gold & diamonds for myself</span>
                </li>
              </ul>
            </div>

            {/* Block 5: The Climax Quote */}
            <div className="relative py-8 my-8 text-center">
              <div className="absolute inset-0 bg-peach-100 transform -skew-y-2 rounded-xl"></div>
              <p className="relative text-2xl md:text-3xl font-extrabold text-deepGreen-900 font-serif px-6">
                I built the lifestyle I once dreamed of — all at the age of 25.
              </p>
            </div>

            {/* Block 6: The Pitch */}
            <div className="space-y-4">
              <p>
                Today, I get to build businesses from the skills I once learned from zero, without any prior experience, and turn my experience into something that can help other creators build their own dream income.
              </p>
              <p className="text-xl font-bold text-deepGreen-900 bg-peach-100 inline-block px-2">
                Now, I&apos;m here to help you.
              </p>
              <p className="text-xl font-medium">
                Because you shouldn&apos;t have to spend years figuring it all out alone.
              </p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}



