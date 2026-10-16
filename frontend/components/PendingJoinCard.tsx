"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface PendingJoinCardProps {
  gcrLink: string;
  sessionToken: string;
  studentName?: string;
  onConfirmed?: () => void;
}

const CONFIRM_WAIT_SECONDS = 15;

export default function PendingJoinCard({
  gcrLink,
  sessionToken,
  studentName,
  onConfirmed,
}: PendingJoinCardProps) {
  const [hasOpened, setHasOpened] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [highlightConfirm, setHighlightConfirm] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  // 1. Non-dismissible beforeunload protection while unconfirmed
  useEffect(() => {
    if (confirmed) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Prevent browser back button from quitting the pending join screen
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [confirmed]);

  // 2. Countdown timer once Classroom link is opened
  useEffect(() => {
    if (!hasOpened || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [hasOpened, secondsLeft]);

  // 3. Highlight button when returning to tab after opening Classroom
  useEffect(() => {
    if (!hasOpened || confirmed) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setHighlightConfirm(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasOpened, confirmed]);

  // Handle clicking "Open Classroom"
  const handleOpenClassroom = useCallback(async () => {
    if (!hasOpened) {
      setHasOpened(true);
      setSecondsLeft(CONFIRM_WAIT_SECONDS);
    }
    setConfirmError("");

    // Notify backend that classroom link was opened
    try {
      await fetch(`${backendUrl}/api/join/opened`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
      });
    } catch (err) {
      console.warn("Failed to record classroom opened event", err);
    }
  }, [backendUrl, sessionToken]);

  // Handle confirmation
  const handleConfirm = useCallback(async () => {
    if (!hasOpened || secondsLeft > 0 || isConfirming) return;

    setIsConfirming(true);
    setConfirmError("");

    try {
      const res = await fetch(`${backendUrl}/api/join/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        // Clear session from localStorage
        try {
          localStorage.removeItem("joinSession");
        } catch {}

        setConfirmed(true);
        setHighlightConfirm(false);
        onConfirmed?.();
      } else {
        setConfirmError(
          data.error || "Unable to confirm enrollment. Please try again."
        );
      }
    } catch {
      setConfirmError(
        "Network connection error. Please check your internet and try again."
      );
    } finally {
      setIsConfirming(false);
    }
  }, [backendUrl, sessionToken, hasOpened, secondsLeft, isConfirming, onConfirmed]);

  // Success view
  if (confirmed) {
    return (
      <div className="py-8 text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center text-emerald-800 shadow-sm">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-deepGreen-950">
            You're all set!
          </h2>
          <p className="text-base font-medium text-emerald-900">
            Welcome to the course!
          </p>
          <p className="text-xs sm:text-sm text-brandText-secondary leading-relaxed max-w-sm mx-auto">
            Your Google Classroom access has been verified. You can now access all modules, templates, and student community resources anytime.
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <a
            href={gcrLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 px-6 rounded-full bg-deepGreen-950 hover:bg-deepGreen-900 text-white font-semibold text-base shadow-luxury hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <BookOpen className="w-5 h-5 text-peach-300" />
            <span>Go to Google Classroom</span>
            <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
          </a>
          <a
            href="/"
            className="inline-block text-xs font-semibold text-deepGreen-900 hover:underline pt-1"
          >
            ← Return to Homepage
          </a>
        </div>
      </div>
    );
  }

  const isConfirmDisabled = !hasOpened || secondsLeft > 0 || isConfirming;

  return (
    <div className="py-4 space-y-6 animate-fade-in text-center">
      {/* Non-dismissible Urgent Banner Header */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 text-left space-y-2 shadow-sm">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-amber-950 leading-snug">
              Please join the Classroom to complete your enrollment.
            </h2>
            <p className="text-xs sm:text-sm text-amber-900/90 mt-1 leading-relaxed">
              {studentName ? `Hi ${studentName}! ` : ""}Click below to open your personal Google Classroom invitation in a new tab, then tap the confirmation button when you're in.
            </p>
          </div>
        </div>
      </div>

      {/* Action 1: Open Classroom */}
      <div className="space-y-2">
        <a
          href={gcrLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpenClassroom}
          id="btn-open-classroom"
          className="w-full py-4 px-6 rounded-full bg-deepGreen-950 hover:bg-deepGreen-900 text-white font-semibold text-base shadow-luxury hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer group"
        >
          <BookOpen className="w-5 h-5 text-peach-300 group-hover:scale-105 transition-transform" />
          <span>Open Classroom</span>
          <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
        </a>
        <p className="text-[11px] text-brandText-muted">
          Opens Google Classroom in a new tab so this verification window stays open.
        </p>
      </div>

      {/* Return Highlight Notice */}
      {highlightConfirm && hasOpened && (
        <div className="p-3 bg-peach-100/90 border border-peach-300 rounded-xl text-deepGreen-950 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 animate-pulse">
          <Sparkles className="w-4 h-4 text-deepGreen-900" />
          <span>Did you join? Tap here to confirm.</span>
        </div>
      )}

      {/* Action 2: I've Joined the Classroom Confirmation */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isConfirmDisabled}
          id="btn-confirm-joined"
          className={`w-full py-3.5 px-6 rounded-full font-semibold text-sm sm:text-base transition-all flex items-center justify-center gap-2 ${
            isConfirmDisabled
              ? "bg-stone-200 text-stone-400 cursor-not-allowed border border-stone-300"
              : highlightConfirm
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg ring-4 ring-emerald-200 cursor-pointer animate-none"
              : "bg-emerald-700 hover:bg-emerald-800 text-white shadow-md cursor-pointer"
          }`}
        >
          {isConfirming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Confirming your enrollment...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>I've joined the Classroom</span>
            </>
          )}
        </button>

        {/* Short Disabled / Status Hint */}
        {isConfirmDisabled && (
          <p className="text-xs text-brandText-muted flex items-center justify-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            {!hasOpened ? (
              <span>Please open the Classroom first using the button above.</span>
            ) : (
              <span>Confirm button activates in {secondsLeft}s...</span>
            )}
          </p>
        )}

        {confirmError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs text-left flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{confirmError}</span>
          </div>
        )}
      </div>

      <div className="text-[11px] text-brandText-muted border-t border-peach-200/80 pt-3">
        Important: Keep this tab open while accepting the Google Classroom invite.
      </div>
    </div>
  );
}
