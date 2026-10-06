"use client";

import React from "react";

interface CTAButtonProps {
  children: React.ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "header";
  className?: string;
  id?: string;
  onClick?: () => void;
}

export default function CTAButton({
  children,
  href = "#join",
  variant = "primary",
  className = "",
  id,
  onClick,
}: CTAButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-sans text-center transition-all duration-250 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer";

  const variantStyles = {
    // Large primary hero button
    primary:
      "bg-deepGreen-950 text-white font-semibold text-base sm:text-lg px-8 py-3.5 sm:px-11 sm:py-4 rounded-full shadow-md hover:bg-deepGreen-900 hover:-translate-y-0.5 hover:shadow-luxury focus:ring-deepGreen-950 active:translate-y-0",
    
    // Header outlined pill button
    header:
      "bg-cream-50 hover:bg-cream-200 text-deepGreen-950 border border-deepGreen-950 font-medium text-xs sm:text-sm px-4 py-2 sm:px-6 sm:py-2.5 rounded-full shadow-sm hover:-translate-y-0.5 hover:shadow transition-all duration-200 focus:ring-deepGreen-950",

    // Secondary variant
    secondary:
      "bg-peach-300 text-deepGreen-950 font-semibold text-base px-8 py-3.5 rounded-full hover:bg-peach-400 hover:-translate-y-0.5 shadow-sm transition-all duration-200",
  };

  return (
    <a
      id={id}
      href={href}
      data-enroll-btn={href === "#join" ? "true" : undefined}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </a>
  );
}
