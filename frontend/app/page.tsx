import React from "react";
import Header from "@/components/Header";
import OfferBanner from "@/components/OfferBanner";
import VideoSection from "@/components/VideoSection";
import HeroSection from "@/components/HeroSection";
import FeaturesPlaycards from "@/components/FeaturesPlaycards";
import MasterclassBlock from "@/components/MasterclassBlock";
import BonusesSection from "@/components/BonusesSection";
import MentorSection from "@/components/MentorSection";
import ModulesSection from "@/components/ModulesSection";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";
import EnrollmentModal from "@/components/EnrollmentModal";
import { siteContent } from "@/components/siteContent";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col bg-cream-100 selection:bg-peach-300 selection:text-deepGreen-950">
      <EnrollmentModal />
      {/* 1. Clean Premium Header */}
      <Header
        logoSrc={siteContent.logo}
        brandName={siteContent.brandName}
      />

      {/* 2. Limited-time Offer Banner */}
      <OfferBanner
        badgeText={siteContent.offer.badgeText}
        description={siteContent.offer.description}
        originalPrice={siteContent.offer.originalPrice}
        currentPrice={siteContent.offer.currentPrice}
      />

      <main className="flex-1">
        {/* 3. Centered 16:9 YouTube Masterclass Video */}
        <VideoSection
          youtubeUrl={siteContent.youtubeUrl}
          brandName={siteContent.brandName}
        />

        {/* 4. Luxury Hero Content & CTA */}
        <HeroSection
          eyebrow={siteContent.heroEyebrow}
          title={siteContent.heroTitle}
          subtitle={siteContent.heroSubtitle}
          ctaText={siteContent.heroCtaText}
          supportText={siteContent.heroSupportText}
        />

        {/* 5. Features Playcard Section */}
        <FeaturesPlaycards
          eyebrow={siteContent.featureSection.eyebrow}
          heading={siteContent.featureSection.heading}
          cards={siteContent.featureSection.cards}
        />

        {/* 6. UGC Masterclass Preview Block */}
        <MasterclassBlock />
        <BonusesSection />
        <MentorSection />
        <ModulesSection />
        <FAQSection />
      </main>

      {/* 7. Editorial Footer */}
      <Footer brandName={siteContent.brandName} />
    </div>
  );
}




