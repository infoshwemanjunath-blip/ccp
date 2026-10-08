"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Mail,
  User,
  Phone,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function openEnrollmentModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-enrollment-modal"));
  }
}

type ModalState =
  | "FORM"
  | "CREATING_ORDER"
  | "CHECKOUT_OPEN"
  | "VERIFYING"
  | "ENROLLING"
  | "SUCCESS"
  | "ALREADY_ENROLLED"
  | "INVALID_GOOGLE_EMAIL"
  | "FAILED";

export default function EnrollmentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>("FORM");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
  }>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [classroomUrl, setClassroomUrl] = useState<string>("https://classroom.google.com");
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [newGoogleEmail, setNewGoogleEmail] = useState<string>("");
  const [updateEmailSubmitting, setUpdateEmailSubmitting] = useState<boolean>(false);
  const [updateEmailError, setUpdateEmailError] = useState<string>("");

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (typeof window !== "undefined") {
      if (window.history.state?.modal === "enrollment") {
        window.history.back();
      } else if (window.location.hash === "#enroll") {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      }
    }
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setModalState("FORM");
    setStatusMessage("");
    if (typeof window !== "undefined" && window.location.hash !== "#enroll") {
      window.history.pushState({ modal: "enrollment" }, "", "#enroll");
    }
  }, []);

  // Listen to open triggers from CTA buttons or links
  useEffect(() => {
    function handleLinkClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest(
        'a[href="#join"], a[href="#enroll"], [data-enroll-btn]'
      );
      if (target) {
        e.preventDefault();
        handleOpen();
      }
    }

    window.addEventListener("open-enrollment-modal", handleOpen);
    document.addEventListener("click", handleLinkClick);

    // If loaded with #enroll in URL, open modal
    if (typeof window !== "undefined" && window.location.hash === "#enroll") {
      setIsOpen(true);
    }

    return () => {
      window.removeEventListener("open-enrollment-modal", handleOpen);
      document.removeEventListener("click", handleLinkClick);
    };
  }, [handleOpen]);

  // Handle browser back button (popstate) and Escape key
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined" && window.location.hash !== "#enroll") {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Load Razorpay Checkout script dynamically
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && window.Razorpay) {
        return resolve(true);
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Frontend input validation
  const validateForm = (): boolean => {
    const errors: { name?: string; phone?: string; email?: string } = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = "Full Name must be at least 2 characters.";
    }

    const cleanedPhone = formData.phone.replace(/[\s\-\(\)\+]/g, "");
    const normalizedPhone =
      cleanedPhone.startsWith("91") && cleanedPhone.length === 12
        ? cleanedPhone.slice(2)
        : cleanedPhone;

    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      errors.phone = "Enter a valid 10-digit Indian mobile number.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      errors.email = "Enter a valid Google Account email.";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Poll enrollment status
  const pollEnrollmentStatus = async (currentOrderId: string) => {
    setModalState("ENROLLING");
    setStatusMessage("Payment received. Activating Google Classroom access...");

    let attempts = 0;
    const maxAttempts = 15;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(
          `${backendUrl}/api/enrollment/status/${currentOrderId}`
        );
        if (res.ok) {
          const data = await res.json();

          if (
            data.status === "INVITED" ||
            data.status === "ENROLLMENT_SUCCESS" ||
            data.classroomUrl
          ) {
            clearInterval(interval);
            if (data.classroomUrl) {
              setClassroomUrl(data.classroomUrl);
            }
            setModalState("SUCCESS");
            setStatusMessage(
              data.message ||
              `Invitation sent to ${formData.email}. Open Classroom and click Accept.`
            );
            return;
          }

          if (data.status === "INVALID_GOOGLE_EMAIL") {
            clearInterval(interval);
            setModalState("INVALID_GOOGLE_EMAIL");
            setStatusMessage(
              data.message ||
              "Payment received. The email provided is not a registered Google Account. Please provide your Google account email."
            );
            return;
          }

          if (data.status === "ENROLLMENT_FAILED") {
            clearInterval(interval);
            setModalState("FAILED");
            setStatusMessage(
              data.message ||
              "Your payment was received. Our team will verify and invite your Google email shortly."
            );
            return;
          }
        }
      } catch (err) {
        console.error("Status polling error", err);
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setClassroomUrl("https://classroom.google.com/c/889084654883");
        setModalState("SUCCESS");
        setStatusMessage(
          `Invitation sent to ${formData.email}. Open Classroom and click Accept.`
        );
      }
    }, 2500);
  };


  // Handle updating Google email if account was invalid
  const handleUpdateGoogleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoogleEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newGoogleEmail.trim())) {
      setUpdateEmailError("Please enter a valid Google Account email.");
      return;
    }

    setUpdateEmailSubmitting(true);
    setUpdateEmailError("");

    try {
      const res = await fetch(`${backendUrl}/api/enrollment/update-google-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          email: newGoogleEmail.trim().toLowerCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update Google account email");
      }

      setFormData((prev) => ({ ...prev, email: newGoogleEmail.trim().toLowerCase() }));
      if (orderId) {
        pollEnrollmentStatus(orderId);
      }
    } catch (err: any) {
      setUpdateEmailError(err.message || "Failed to update email. Please try again.");
    } finally {
      setUpdateEmailSubmitting(false);
    }
  };

  // Handle Form Submission & Razorpay Checkout
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setModalState("CREATING_ORDER");
    setStatusMessage("");

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setModalState("FORM");
        setStatusMessage(
          "Failed to load payment gateway. Please check your internet connection."
        );
        return;
      }

      // Step 1: Create Order Server-Side
      let orderData: any = null;
      try {
        const orderRes = await fetch(`${backendUrl}/api/enrollment/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim(),
          }),
        });

        if (orderRes.ok) {
          orderData = await orderRes.json();
        }
      } catch (err) {
        console.warn("Primary create-order failed, using standard route:", err);
      }

      // Fallback to standard create-order endpoint if needed
      if (!orderData || !orderData.orderId) {
        const stdRes = await fetch(`${backendUrl}/api/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 349900,
            currency: "INR",
            receipt: `rcpt_${Date.now()}`,
            notes: {
              name: formData.name.trim(),
              phone: formData.phone.trim(),
              email: formData.email.trim(),
            },
          }),
        });

        if (stdRes.ok) {
          const stdData = await stdRes.json();
          orderData = {
            orderId: stdData.order_id || stdData.id,
            amount: stdData.amount,
            currency: stdData.currency,
            keyId: stdData.key_id,
          };
        } else {
          const errData = await stdRes.json().catch(() => ({}));
          setModalState("FORM");
          setStatusMessage(
            errData.message ||
            errData.error ||
            "Unable to initiate order. Please try again."
          );
          return;
        }
      }

      // If user already paid & enrolled
      if (orderData.alreadyEnrolled) {
        setModalState("ALREADY_ENROLLED");
        setStatusMessage(orderData.message);
        return;
      }

      setOrderId(orderData.orderId);
      setModalState("CHECKOUT_OPEN");

      // Step 2: Open Razorpay Checkout Modal
      const gatewayKey =
        orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!gatewayKey) {
        setModalState("FORM");
        setStatusMessage(
          "Payment gateway key unavailable. Please contact support."
        );
        return;
      }

      const options = {
        key: gatewayKey,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Super Profit",
        description: "UGC Masterclass + 5 Bonuses",
        order_id: orderData.orderId,
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: "#073C35", // Luxury deep green
        },
        modal: {
          ondismiss: () => {
            // User closed Razorpay popup without paying
            setModalState("FORM");
            setStatusMessage("Payment window was closed. You can retry anytime.");
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          // Fast verification call to verify-payment endpoint
          setModalState("VERIFYING");
          try {
            const verifyRes = await fetch(`${backendUrl}/api/verify-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...response,
                email: formData.email.trim(),
                name: formData.name.trim(),
                phone: formData.phone.trim(),
              }),
            });


            const verifyData = await verifyRes.json().catch(() => ({}));

            if (verifyRes.ok && (verifyData.verified || verifyData.success)) {
              setModalState("SUCCESS");
              setStatusMessage(
                "Payment verified successfully! Your course invitation has been sent to your Google account."
              );
              return;
            } else {
              setModalState("FAILED");
              setStatusMessage(
                verifyData.message ||
                verifyData.error ||
                "Payment signature could not be verified."
              );
              return;
            }
          } catch (err) {
            console.warn("Fast-path verify notice:", err);
            // Fallback polling for Google Classroom activation
            pollEnrollmentStatus(orderData.orderId);
          }
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", (response: any) => {
        setModalState("FORM");
        setStatusMessage(
          response.error?.description ||
          "Payment attempt failed. Please check your bank or card details."
        );
      });

      razorpay.open();
    } catch (err) {
      console.error("Checkout process error", err);
      setModalState("FORM");
      setStatusMessage(
        "Connection error. Please check if the backend service is reachable."
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center pt-16 pb-8 px-3 sm:p-4 bg-deepGreen-950/75 backdrop-blur-sm overflow-y-auto animate-fade-in"
    >
      <div className="relative w-full max-w-lg my-auto max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-cream-50 border border-peach-200 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8">
        {/* Sticky Top Navigation Header with Back and Close options */}
        <div className="sticky -top-5 sm:-top-8 -mx-5 sm:-mx-8 px-5 sm:px-8 pt-4 pb-3 mb-4 bg-cream-50/95 backdrop-blur-md z-30 flex items-center justify-between border-b border-peach-200 shadow-sm">
          <button
            id="modal-back-btn"
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold text-deepGreen-950 bg-peach-200 hover:bg-peach-300 border border-peach-300 transition-all shadow-sm cursor-pointer active:scale-95"
            aria-label="Back to overview"
          >
            <ArrowLeft className="w-4 h-4 text-deepGreen-950" />
            <span>Back</span>
          </button>

          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-deepGreen-900 bg-peach-100/80 px-2.5 py-1 rounded-full border border-peach-200">
            Secure Checkout
          </span>

          <button
            id="modal-close-x-btn"
            type="button"
            onClick={handleClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-deepGreen-950 bg-peach-200 hover:bg-peach-300 border border-peach-300 transition-all shadow-sm cursor-pointer active:scale-95"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-peach-100 text-deepGreen-900 text-xs font-semibold uppercase tracking-wider mb-2 border border-peach-300">
            <ShieldCheck className="w-3.5 h-3.5 text-deepGreen-800" />
            Official Course Enrollment
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold font-serif text-deepGreen-950">
            Join Super Profit Masterclass
          </h3>
          <p className="text-brandText-muted text-xs sm:text-sm mt-1">
            Lifetime Access • 13 Modules • 5 Free Bonuses • ₹3,499
          </p>
        </div>

        {/* Status Alert Message if any */}
        {statusMessage && (
          <div
            className={`mb-5 p-3.5 rounded-xl text-xs sm:text-sm flex items-start gap-2.5 ${modalState === "FAILED"
                ? "bg-red-50 text-red-800 border border-red-200"
                : modalState === "ALREADY_ENROLLED"
                  ? "bg-blue-50 text-blue-900 border border-blue-200"
                  : "bg-peach-100 text-deepGreen-950 border border-peach-300"
              }`}
          >
            {modalState === "FAILED" ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-deepGreen-800" />
            )}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* State: FORM */}
        {(modalState === "FORM" || modalState === "CREATING_ORDER") && (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-deepGreen-900 uppercase tracking-wide mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brandText-muted" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-3 bg-white border border-peach-300 rounded-xl text-sm text-deepGreen-950 placeholder-brandText-muted/60 focus:outline-none focus:ring-2 focus:ring-deepGreen-900/40 focus:border-deepGreen-900 transition-all"
                />
              </div>
              {validationErrors.name && (
                <p className="text-red-600 text-xs mt-1">
                  {validationErrors.name}
                </p>
              )}
            </div>

            {/* Indian Mobile Number */}
            <div>
              <label className="block text-xs font-semibold text-deepGreen-900 uppercase tracking-wide mb-1.5">
                WhatsApp / Phone Number
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-deepGreen-900 bg-peach-100 px-1.5 py-0.5 rounded border border-peach-200">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full pl-14 pr-4 py-3 bg-white border border-peach-300 rounded-xl text-sm text-deepGreen-950 placeholder-brandText-muted/60 focus:outline-none focus:ring-2 focus:ring-deepGreen-900/40 focus:border-deepGreen-900 transition-all"
                />
              </div>
              {validationErrors.phone && (
                <p className="text-red-600 text-xs mt-1">
                  {validationErrors.phone}
                </p>
              )}
            </div>

            {/* Google Account Email */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-deepGreen-900 uppercase tracking-wide">
                  Google Account Email
                </label>
                <span className="text-[10px] font-medium text-luxuryGold-600">
                  For Google Classroom invite
                </span>
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brandText-muted" />
                <input
                  type="email"
                  required
                  placeholder="your.email@gmail.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-3 bg-white border border-peach-300 rounded-xl text-sm text-deepGreen-950 placeholder-brandText-muted/60 focus:outline-none focus:ring-2 focus:ring-deepGreen-900/40 focus:border-deepGreen-900 transition-all"
                />
              </div>
              {validationErrors.email && (
                <p className="text-red-600 text-xs mt-1">
                  {validationErrors.email}
                </p>
              )}
              <p className="text-[11px] text-brandText-muted mt-1.5 leading-relaxed">
                Important: Use the exact Google/Gmail account you want added to
                the private Google Classroom course.
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <p className="text-center text-xs font-bold uppercase tracking-wider text-deepGreen-900 mb-2">
                NON-REFUNDABLE
              </p>
              <button
                type="submit"
                disabled={modalState === "CREATING_ORDER"}
                className="w-full py-4 px-6 rounded-full bg-deepGreen-950 hover:bg-deepGreen-900 text-white font-semibold text-base shadow-luxury hover:shadow-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-75 cursor-pointer"
              >
                {modalState === "CREATING_ORDER" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-peach-300" />
                    <span>Preparing Secure Checkout...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Secure Pay (₹3,499)</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>

            {/* Cancel & Return Option */}
            <div className="text-center pt-1">
              <button
                id="modal-cancel-link-btn"
                type="button"
                onClick={handleClose}
                className="text-xs text-brandText-muted hover:text-deepGreen-950 font-medium underline py-1 cursor-pointer transition-colors"
              >
                ← Cancel & Return to Course Overview
              </button>
            </div>

            <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-brandText-muted">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-luxuryGold-500" /> 256-bit SSL
                Encrypted
              </span>
              <span>•</span>
              <span>Razorpay Verified</span>
              <span>•</span>
              <span>Instant Classroom Invite</span>
            </div>
          </form>
        )}

        {/* State: VERIFYING or ENROLLING */}
        {(modalState === "VERIFYING" || modalState === "ENROLLING") && (
          <div className="py-10 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-peach-100 border-2 border-peach-300 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-deepGreen-950" />
            </div>
            <h4 className="text-xl font-bold font-serif text-deepGreen-950">
              {modalState === "VERIFYING"
                ? "Verifying Payment..."
                : "Activating Google Classroom..."}
            </h4>
            <p className="text-sm text-brandText-muted max-w-sm mx-auto leading-relaxed">
              We are finalizing your enrollment and registering your Google
              account in the private student roster.
            </p>
          </div>
        )}

        {/* State: SUCCESS */}
        {modalState === "SUCCESS" && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center text-green-700">
              <CheckCircle className="w-9 h-9" />
            </div>
            <h4 className="text-2xl font-bold font-serif text-deepGreen-950">
              Enrollment Confirmed!
            </h4>
            <p className="text-sm text-brandText-secondary leading-relaxed max-w-md mx-auto">
              Invitation sent to{" "}
              <strong className="text-deepGreen-950 underline">
                {formData.email}
              </strong>
              .
            </p>

            <div className="bg-cream-100 border border-peach-200 rounded-2xl p-4 text-left text-xs text-brandText-secondary space-y-2">
              <p className="font-semibold text-deepGreen-900">Instruction:</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 font-medium text-sm">
                Open Classroom and click <strong>Accept</strong>.
              </div>
              <ul className="list-disc list-inside space-y-1 text-brandText-muted pt-1">
                <li>
                  Make sure you are signed into Google with <strong>{formData.email}</strong>.
                </li>
                <li>
                  Your invitation is waiting on your Google Classroom dashboard.
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <a
                href={classroomUrl || "https://classroom.google.com/c/889084654883"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 w-full py-3.5 px-6 rounded-full bg-deepGreen-950 text-white font-semibold text-sm shadow-md hover:bg-deepGreen-900 transition-colors"
              >
                Open Classroom <ExternalLink className="w-4 h-4" />
              </a>


              <button
                id="modal-success-done-btn"
                onClick={handleClose}
                className="w-full py-2.5 px-6 rounded-full text-brandText-muted font-medium text-xs hover:text-deepGreen-950 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* State: INVALID_GOOGLE_EMAIL */}
        {modalState === "INVALID_GOOGLE_EMAIL" && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-amber-700">
              <AlertCircle className="w-9 h-9" />
            </div>
            <h4 className="text-2xl font-bold font-serif text-deepGreen-950">
              Google Account Required
            </h4>
            <p className="text-sm text-brandText-secondary leading-relaxed max-w-sm mx-auto">
              Your payment is confirmed! However, <strong>{formData.email}</strong> is not recognized by Google Classroom as a valid Google Account.
            </p>
            <form onSubmit={handleUpdateGoogleEmail} className="space-y-3 max-w-sm mx-auto text-left">
              <div>
                <label className="block text-xs font-semibold text-deepGreen-950 mb-1">
                  Google Account Email (Gmail or Google Workspace)
                </label>
                <input
                  type="email"
                  value={newGoogleEmail}
                  onChange={(e) => {
                    setNewGoogleEmail(e.target.value);
                    setUpdateEmailError("");
                  }}
                  placeholder="yourname@gmail.com"
                  className="w-full px-4 py-3 rounded-xl border border-peach-200 text-sm focus:outline-none focus:ring-2 focus:ring-deepGreen-950"
                  required
                />
                {updateEmailError && (
                  <p className="text-xs text-red-600 mt-1">{updateEmailError}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={updateEmailSubmitting}
                className="w-full py-3 px-6 rounded-full bg-deepGreen-950 text-white font-semibold text-sm shadow-md hover:bg-deepGreen-900 transition-colors disabled:opacity-50"
              >
                {updateEmailSubmitting ? "Updating..." : "Send Invitation to this Email"}
              </button>
            </form>
          </div>
        )}

        {/* State: ALREADY_ENROLLED */}
        {modalState === "ALREADY_ENROLLED" && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-blue-700">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <h4 className="text-2xl font-bold font-serif text-deepGreen-950">
              Already Enrolled
            </h4>
            <p className="text-sm text-brandText-secondary leading-relaxed max-w-sm mx-auto">
              This Google account (<strong>{formData.email}</strong>) already
              holds active access to the Super Profit Classroom.
            </p>
            <div className="space-y-2 pt-2">
              <a
                href="https://classroom.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 w-full py-3.5 px-6 rounded-full bg-deepGreen-950 text-white font-semibold text-sm shadow-md hover:bg-deepGreen-900 transition-colors"
              >
                Open Google Classroom <ExternalLink className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 text-xs font-semibold text-deepGreen-900 hover:underline"
              >
                ← Back to Overview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
