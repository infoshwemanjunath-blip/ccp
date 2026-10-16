"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";

export default function PendingJoinBanner() {
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  useEffect(() => {
    let sessionToken: string | null = null;
    try {
      sessionToken = localStorage.getItem("joinSession");
    } catch {
      setLoading(false);
      return;
    }

    if (!sessionToken) {
      setLoading(false);
      return;
    }

    async function checkStatus() {
      try {
        const res = await fetch(`${backendUrl}/api/join/status`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.state === "pending") {
            setIsPending(true);
          } else {
            // Already joined
            try {
              localStorage.removeItem("joinSession");
            } catch {}
            setIsPending(false);
          }
        } else {
          // Invalid or expired session
          try {
            localStorage.removeItem("joinSession");
          } catch {}
          setIsPending(false);
        }
      } catch {
        // Network issue: do not clear, but do not show banner unless confirmed
        setIsPending(false);
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, [backendUrl]);

  if (loading || !isPending) {
    return null;
  }

  return (
    <div
      id="pending-join-banner"
      className="sticky top-0 z-50 w-full bg-deepGreen-950 text-white px-4 py-2.5 sm:py-3 shadow-md border-b border-peach-400/30 flex items-center justify-between gap-3 text-xs sm:text-sm animate-fade-in"
    >
      <div className="flex items-center gap-2 max-w-2xl">
        <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
        <AlertCircle className="w-4 h-4 text-peach-300 shrink-0 hidden sm:inline" />
        <span className="font-medium text-cream-100">
          Please join the Classroom to complete your enrollment
        </span>
      </div>

      <Link
        href="/join/continue"
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-peach-300 hover:bg-peach-200 text-deepGreen-950 font-semibold text-xs transition-colors shrink-0 shadow-sm"
      >
        <span>Complete Now</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
