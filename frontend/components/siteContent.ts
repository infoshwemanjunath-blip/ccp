export interface PlaycardItem {
  id: string;
  title: string;
  tagline: string;
  iconName: "users" | "payment" | "zap" | "globe" | "trending";
}

export interface SiteContent {
  brandName: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroSupportText: string;
  featureSection: {
    eyebrow: string;
    heading: string;
    cards: PlaycardItem[];
  };
  offer: {
    badgeText: string;
    description: string;
    originalPrice: string;
    currentPrice: string;
  };
  youtubeUrl: string;
  logo: string;
  results: {
    eyebrow: string;
    statistic: string;
    statDescription: string;
  };
}

export const siteContent: SiteContent = {
  brandName: "Super Profit",
  heroEyebrow: "Super Profit Business",
  heroTitle: "I unlocked my luxury dream life at the age of 25 through my UGC business.",
  heroSubtitle: "Endless and unlimited earning potential starts from here",
  heroCtaText: "JOIN NOW",
  heroSupportText: "Learn from zero, step by step, do it with me lessons",
  featureSection: {
    eyebrow: "WHY JOIN SUPER PROFIT",
    heading: "If you are ready to create content now you can make your dream income out of it",
    cards: [
      {
        id: "01",
        title: "No followers count needed",
        tagline: "Start creating and closing brand deals with 0 followers.",
        iconName: "users",
      },
      {
        id: "02",
        title: "One time payment - No monthly fees",
        tagline: "Lifetime access with zero recurring subscription charges.",
        iconName: "payment",
      },
      {
        id: "03",
        title: "Instant access",
        tagline: "Instant unlock to the complete masterclass and bonuses.",
        iconName: "zap",
      },
      {
        id: "04",
        title: "Work from anywhere",
        tagline: "Total location independence using just your smartphone.",
        iconName: "globe",
      },
      {
        id: "05",
        title: "Unlimited earning potential",
        tagline: "Scale your revenue with high-ticket brand collaborations.",
        iconName: "trending",
      },
    ],
  },
  offer: {
    badgeText: "Limited time offer",
    description: "full course + 5 Bonuses included",
    originalPrice: "₹9,999",
    currentPrice: "₹3,499",
  },
  youtubeUrl: "",
  logo: "/client-logo.png",
  results: {
    eyebrow: "PROVEN RESULTS",
    statistic: "3,467+",
    statDescription: "Active creators & business builders scaling high-income UGC deals.",
  },
};

