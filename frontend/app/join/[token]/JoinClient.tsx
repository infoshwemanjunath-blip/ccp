"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  ArrowRight,
  User,
  Mail,
  Phone,
} from "lucide-react";
import PendingJoinCard from "@/components/PendingJoinCard";
import { isValidIndianMobile } from "@/lib/phone";

type TokenState = "loading" | "valid" | "expired" | "invalid" | "locked" | "joined";

interface JoinClientProps {
  token: string;
}

export default function JoinClient({ token }: JoinClientProps) {
  const [tokenState, setTokenState] = useState<TokenState>("loading");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [gcrLink, setGcrLink] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  // Check token status on mount and attempt session resumption if already verified
  useEffect(() => {
    let isMounted = true;
    async function check() {
      try {
        const res = await fetch(
          `${backendUrl}/api/join/check?token=${encodeURIComponent(token)}`
        );
        const data = await res.json().catch(() => ({}));
        if (!isMounted) return;

        if (res.ok && data.state) {
          setTokenState(data.state);

          // If token is valid, check if current browser already has a pending session
          if (data.state === "valid") {
            const existingSession = localStorage.getItem("joinSession");
            if (existingSession) {
              try {
                const statusRes = await fetch(`${backendUrl}/api/join/status`, {
                  headers: { Authorization: `Bearer ${existingSession}` },
                });
                if (statusRes.ok) {
                  const statusData = await statusRes.json().catch(() => ({}));
                  if (statusData.state === "pending" && statusData.gcrLink) {
                    setSessionToken(existingSession);
                    setGcrLink(statusData.gcrLink);
                    if (statusData.name) {
                      setFormData((prev) => ({ ...prev, name: statusData.name }));
                    }
                  } else if (statusData.state === "joined") {
                    setTokenState("joined");
                    localStorage.removeItem("joinSession");
                  }
                }
              } catch {}
            }
          }
        } else {
          setTokenState("invalid");
        }
      } catch {
        if (isMounted) setTokenState("invalid");
      }
    }
    check();
    return () => {
      isMounted = false;
    };
  }, [backendUrl, token]);

  const validate = () => {
    const errors: { name?: string; email?: string; phone?: string } = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = "Please enter your full name (at least 2 characters).";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    if (!isValidIndianMobile(formData.phone)) {
      errors.phone = "Enter a valid 10-digit Indian mobile number (e.g. 9876543210).";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch(`${backendUrl}/api/join/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.gcrLink) {
        if (data.sessionToken) {
          try {
            localStorage.setItem("joinSession", data.sessionToken);
          } catch {}
          setSessionToken(data.sessionToken);
        }
        setGcrLink(data.gcrLink);
        setShowForm(false);
      } else {
        if (data.alreadyJoined) {
          setTokenState("joined");
          setShowForm(false);
          return;
        }
        if (data.locked) {
          setTokenState("locked");
          setShowForm(false);
        }
        setErrorMessage(
          data.error || "Details don't match. Please check your information and try again."
        );
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-peach-200">
      <div className="w-full max-w-lg bg-cream-50 border border-peach-200 rounded-3xl shadow-2xl p-6 sm:p-10 relative overflow-hidden">
        {/* Top Decorative Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-peach-100 text-deepGreen-900 text-xs font-semibold uppercase tracking-wider mb-3 border border-peach-300">
            <ShieldCheck className="w-4 h-4 text-deepGreen-800" />
            Super Profit Course Access
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-deepGreen-950">
            Student Classroom Portal
          </h1>
          <p className="text-brandText-muted text-xs sm:text-sm mt-1.5">
            Unlock your Google Classroom curriculum and community
          </p>
        </div>

        {/* State: LOADING */}
        {tokenState === "loading" && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-peach-100 border-2 border-peach-300 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-deepGreen-950" />
            </div>
            <p className="text-sm font-medium text-deepGreen-950">
              Validating your secure invitation link...
            </p>
          </div>
        )}

        {/* State: EXPIRED */}
        {tokenState === "expired" && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-amber-700">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold font-serif text-deepGreen-950">
              Invitation Expired
            </h2>
            <p className="text-sm text-brandText-secondary leading-relaxed max-w-sm mx-auto">
              This personal join link has expired. Don't worry — if you purchased the course, please contact our support team to receive a fresh access link.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-block text-xs font-semibold text-deepGreen-900 hover:underline"
              >
                ← Return to Home
              </Link>
            </div>
          </div>
        )}

        {/* State: INVALID */}
        {tokenState === "invalid" && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 border-2 border-red-300 flex items-center justify-center text-red-700">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold font-serif text-deepGreen-950">
              Invalid Invitation Link
            </h2>
            <p className="text-sm text-brandText-secondary leading-relaxed max-w-sm mx-auto">
              This access link is not recognized or has already been replaced. Please use the original link sent via WhatsApp or contact our support team.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-block text-xs font-semibold text-deepGreen-900 hover:underline"
              >
                ← Return to Home
              </Link>
            </div>
          </div>
        )}

        {/* State: LOCKED */}
        {tokenState === "locked" && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-amber-700">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold font-serif text-deepGreen-950">
              Access Temporarily Locked
            </h2>
            <p className="text-sm text-brandText-secondary leading-relaxed max-w-sm mx-auto">
              Too many unsuccessful verification attempts, or maximum reveal limit reached for this order. For your security, access has been temporarily locked. Please try again later or reach out to support.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-block text-xs font-semibold text-deepGreen-900 hover:underline"
              >
                ← Return to Home
              </Link>
            </div>
          </div>
        )}

        {/* State: ALREADY JOINED */}
        {tokenState === "joined" && (
          <div className="py-8 text-center space-y-5 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center text-emerald-800 shadow-sm">
              <CheckCircle className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-serif text-deepGreen-950">
                You've already joined
              </h2>
              <p className="text-sm text-brandText-secondary leading-relaxed max-w-sm mx-auto">
                Your Google Classroom enrollment has already been confirmed. You can access the classroom directly anytime.
              </p>
            </div>
            <div className="pt-2 space-y-3">
              <a
                href="https://classroom.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-6 rounded-full bg-deepGreen-950 hover:bg-deepGreen-900 text-white font-semibold text-sm shadow-md transition-all inline-block"
              >
                Open Google Classroom
              </a>
              <div>
                <Link
                  href="/"
                  className="inline-block text-xs font-semibold text-deepGreen-900 hover:underline"
                >
                  ← Return to Home
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* State: PENDING REMINDER SCREEN (Render PendingJoinCard) */}
        {gcrLink && sessionToken && tokenState !== "joined" && (
          <PendingJoinCard
            gcrLink={gcrLink}
            sessionToken={sessionToken}
            studentName={formData.name}
            onConfirmed={() => setTokenState("joined")}
          />
        )}

        {/* State: VALID (Initial Screen or Form before verification) */}
        {tokenState === "valid" && (!gcrLink || !sessionToken) && (
          <div>
            {!showForm ? (
              <div className="py-6 text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-peach-100 border border-peach-300 flex items-center justify-center text-deepGreen-950">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-deepGreen-950">
                    Verify Your Registration
                  </h2>
                  <p className="text-xs sm:text-sm text-brandText-secondary leading-relaxed max-w-sm mx-auto">
                    To protect course exclusivity, please confirm the details you used when purchasing your enrollment.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="w-full py-4 px-6 rounded-full bg-deepGreen-950 hover:bg-deepGreen-900 text-white font-semibold text-base shadow-luxury hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <span>Join Now</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <p className="text-[11px] text-brandText-muted">
                  Requires the same mobile number used during payment checkout.
                </p>
              </div>
            ) : (
              <form onSubmit={handleVerify} noValidate className="space-y-4">
                <div className="text-center pb-2">
                  <h3 className="text-lg font-bold font-serif text-deepGreen-950">
                    Confirm Your Details
                  </h3>
                  <p className="text-xs text-brandText-muted mt-0.5">
                    Enter the phone number used during payment to reveal the link
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Full Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-brandText-primary">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="name"
                      placeholder="e.g. Priya Sharma"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, name: e.target.value }))
                      }
                      className={`w-full py-2.5 px-3.5 pl-10 rounded-xl bg-white border text-sm text-deepGreen-950 focus:outline-none focus:ring-2 focus:ring-deepGreen-800/20 transition-all ${
                        formErrors.name ? "border-red-400" : "border-peach-300"
                      }`}
                    />
                    <User className="w-4 h-4 text-brandText-muted absolute left-3.5 top-3" />
                  </div>
                  {formErrors.name && (
                    <p className="text-[11px] text-red-600 pl-1">{formErrors.name}</p>
                  )}
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-brandText-primary">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      name="email"
                      placeholder="e.g. priya@gmail.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, email: e.target.value }))
                      }
                      className={`w-full py-2.5 px-3.5 pl-10 rounded-xl bg-white border text-sm text-deepGreen-950 focus:outline-none focus:ring-2 focus:ring-deepGreen-800/20 transition-all ${
                        formErrors.email ? "border-red-400" : "border-peach-300"
                      }`}
                    />
                    <Mail className="w-4 h-4 text-brandText-muted absolute left-3.5 top-3" />
                  </div>
                  {formErrors.email && (
                    <p className="text-[11px] text-red-600 pl-1">{formErrors.email}</p>
                  )}
                </div>

                {/* Contact Number */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-brandText-primary">
                    Contact Number (Used during payment)
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      name="phone"
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, phone: e.target.value }))
                      }
                      className={`w-full py-2.5 px-3.5 pl-10 rounded-xl bg-white border text-sm text-deepGreen-950 focus:outline-none focus:ring-2 focus:ring-deepGreen-800/20 transition-all ${
                        formErrors.phone ? "border-red-400" : "border-peach-300"
                      }`}
                    />
                    <Phone className="w-4 h-4 text-brandText-muted absolute left-3.5 top-3" />
                  </div>
                  {formErrors.phone && (
                    <p className="text-[11px] text-red-600 pl-1">{formErrors.phone}</p>
                  )}
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-6 rounded-full bg-deepGreen-950 hover:bg-deepGreen-900 disabled:opacity-60 text-white font-semibold text-sm shadow-luxury transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Get Classroom Link</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
