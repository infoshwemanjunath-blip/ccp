import type { Metadata } from "next";
import JoinContinueClient from "./JoinContinueClient";

export const metadata: Metadata = {
  title: "Complete Enrollment | Super Profit Masterclass",
  description: "Resume your personal course enrollment and Google Classroom verification.",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export default function JoinContinuePage() {
  return <JoinContinueClient />;
}
