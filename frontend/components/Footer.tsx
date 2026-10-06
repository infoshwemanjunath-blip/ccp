import React from "react";

interface FooterProps {
  brandName?: string;
}

export default function Footer({ brandName = "Super Profit" }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-[#052924] border-t border-deepGreen-900 py-8 sm:py-10 px-4 text-center text-xs text-cream-300/60 font-sans">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-3">
        <p className="font-serif text-cream-200 text-sm tracking-wide">
          {brandName}
        </p>
        <p>© {currentYear} {brandName}. All rights reserved.</p>
      </div>
    </footer>
  );
}
