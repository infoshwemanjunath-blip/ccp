import React from "react";
import Image from "next/image";

interface VideoSectionProps {
  youtubeUrl?: string;
  brandName?: string;
}

export default function VideoSection({
  youtubeUrl = "",
  brandName = "Super Profit Business",
}: VideoSectionProps) {
  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    try {
      if (url.includes("embed/")) return url;
      const urlObj = new URL(url);
      if (urlObj.hostname.includes("youtube.com")) {
        const id = urlObj.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}?rel=0` : url;
      }
      if (urlObj.hostname.includes("youtu.be")) {
        const id = urlObj.pathname.slice(1);
        return id ? `https://www.youtube.com/embed/${id}?rel=0` : url;
      }
      return url;
    } catch {
      return url;
    }
  };

  const embedUrl = getEmbedUrl(youtubeUrl);

  return (
    <section
      aria-label="Overview Video"
      className="w-full pt-8 pb-4 sm:pt-12 sm:pb-8 px-4 flex justify-center"
    >
      <div className="w-full max-w-[830px] mx-auto">
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-video bg-deepGreen-950 border border-deepGreen-900/40">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`${brandName} Masterclass Overview`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full select-none group cursor-pointer">
              {/* Poster Image */}
              <Image
                src="/how-to-build-high-revenue-ugc-business.png"
                alt="How to Build a High Revenue UGC Business"
                fill
                priority
                className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
