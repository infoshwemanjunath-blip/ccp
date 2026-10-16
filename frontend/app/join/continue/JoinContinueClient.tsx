"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import PendingJoinCard from "@/components/PendingJoinCard";

type ContinueState = "loading" | "no_session" | "pending" | "joined";

export default function JoinContinueClient() {
  const [continueState, setContinueState] = useState<ContinueState>("loading");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [gcrLink, setGcrLink] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("joinSession");
    } catch {
      setContinueState("no_session");
      return;
    }

    if (!token) {
      setContinueState("no_session");
      return;
    }

    setSessionToken(token);

    async function checkSession() {
      try {
        const res = await fetch(`${backendUrl}/api/join/status`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          try {
            localStorage.removeItem("joinSession");
          } catch {}
          setContinueState("no_session");
          return;
        }

        const data = await res.json().catch(() => ({}));

        if (data.state === "joined") {
          try {
            localStorage.removeItem("joinSession");
          } catch {}
          setContinueState("joined");
          return;
        }

        if (data.state === "pending" && data.gcrLink) {
          setGcrLink(data.gcrLink);
          setStudentName(data.name || "");
          setContinueState("pending");
          return;
        }

        setContinueState("no_session");
      } catch {
        setContinueState("no_session");
      }
    }

    checkSession();
  }, [backendUrl]);

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-peach-200">
      <div className="w-full max-w-lg bg-cream-50 border border-peach-200 rounded-3xl shadow-2xl p-6 sm:p-10 relative overflow-hidden">
        {/* Header Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-peach-100 text-deepGreen-900 text-xs font-semibold uppercase tracking-wider mb-3 border border-peach-300">
            <ShieldCheck className="w-4 h-4 text-deepGreen-800" />
            Super Profit Course Access
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-deepGreen-950">
            Enrollment Verification
          </h1>
        </div>

        {/* State: LOADING */}
        {continueState === "loading" && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-peach-100 border-2 border-peach-300 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-deepGreen-950" />
            </div>
            <p className="text-sm font-medium text-deepGreen-950">
              Checking your course enrollment status...
            </p>
          </div>
        )}

        {/* State: NO VALID SESSION */}
        {continueState === "no_session" && (
          <div className="py-8 text-center space-y-5 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-peach-100 border-2 border-peach-300 flex items-center justify-center text-deepGreen-950 shadow-sm">
              <MessageSquare className="w-8 h-8 text-deepGreen-900" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-deepGreen-950">
                No Active Enrollment Session
              </h2>
              <p className="text-sm text-brandText-secondary leading-relaxed max-w-sm mx-auto font-medium">
                Open the join link we sent you on WhatsApp.
              </p>
              <p className="text-xs text-brandText-muted leading-relaxed max-w-sm mx-auto pt-1">
                Your personal access link was sent to your registered WhatsApp mobile number right after payment confirmation.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-block text-xs font-semibold text-deepGreen-900 hover:underline"
              >
                ← Return to Homepage
              </Link>
            </div>
          </div>
        )}

        {/* State: ALREADY JOINED */}
        {continueState === "joined" && (
          <div className="py-8 text-center space-y-5 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center text-emerald-800 shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-serif text-deepGreen-950">
                You've already joined!
              </h2>
              <p className="text-sm text-brandText-secondary leading-relaxed max-w-sm mx-auto">
                Your enrollment is complete and confirmed. You can access all course materials in your Google Classroom dashboard.
              </p>
            </div>
            <div className="pt-2 space-y-3">
              <a
                href="https://classroom.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-6 rounded-full bg-deepGreen-950 hover:bg-deepGreen-900 text-white font-semibold text-sm shadow-md transition-all inline-block"
              >
                Go to Google Classroom Dashboard
              </a>
              <div>
                <Link
                  href="/"
                  className="inline-block text-xs font-semibold text-deepGreen-900 hover:underline"
                >
                  ← Return to Homepage
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* State: PENDING (Render PendingJoinCard) */}
        {continueState === "pending" && sessionToken && gcrLink && (
          <PendingJoinCard
            gcrLink={gcrLink}
            sessionToken={sessionToken}
            studentName={studentName}
            onConfirmed={() => setContinueState("joined")}
          />
        )}
      </div>
    </div>
  );
}
