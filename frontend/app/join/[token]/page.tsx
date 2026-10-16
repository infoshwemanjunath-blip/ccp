import type { Metadata } from "next";
import JoinClient from "./JoinClient";

export const metadata: Metadata = {
  title: "Join Classroom | Super Profit Masterclass",
  description: "Personal Google Classroom invite portal for registered Super Profit students.",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

interface JoinPageProps {
  params: {
    token: string;
  };
}

export default function JoinPage({ params }: JoinPageProps) {
  return <JoinClient token={params.token} />;
}
