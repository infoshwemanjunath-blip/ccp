"use client";

import React, { useState } from "react";
import { Loader2, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayCheckoutButtonProps {
  amount?: number; // Amount in paise (minimum 100 paise = ₹1)
  currency?: string;
  name?: string;
  description?: string;
  receipt?: string;
  notes?: Record<string, string>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  buttonText?: string;
  className?: string;
  onSuccess?: (data: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onError?: (error: string) => void;
  onDismiss?: () => void;
}

export default function RazorpayCheckoutButton({
  amount = 349900, // 3,499 INR in paise
  currency = "INR",
  name = "Super Profit",
  description = "UGC Masterclass + 5 Bonuses",
  receipt,
  notes,
  prefill,
  buttonText = "Pay with Razorpay",
  className = "",
  onSuccess,
  onError,
  onDismiss,
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | "info" | null>(null);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  // Ensure Razorpay checkout script is loaded
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

  const handlePayment = async () => {
    if (loading) return;

    if (amount < 100) {
      const err = "Amount must be at least 100 paise (₹1).";
      setStatusType("error");
      setStatusMessage(err);
      onError?.(err);
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    setStatusType(null);

    try {
      // 1. Ensure Razorpay script loaded
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error(
          "Failed to load Razorpay SDK. Please check your internet connection."
        );
      }

      // 2. Call backend to create Razorpay order
      const orderRes = await fetch(`${backendUrl}/api/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency,
          receipt: receipt || `rcpt_${Date.now()}`,
          notes,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(
          orderData.message || orderData.error || "Failed to create payment order"
        );
      }

      const orderId = orderData.order_id || orderData.id;
      const keyId =
        orderData.key_id ||
        orderData.keyId ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!keyId) {
        throw new Error("Payment gateway key unavailable.");
      }

      // 3. Configure Razorpay modal options
      const options = {
        key: keyId,
        amount: orderData.amount || amount,
        currency: orderData.currency || currency,
        name,
        description,
        order_id: orderId,
        prefill: {
          name: prefill?.name || "",
          email: prefill?.email || "",
          contact: prefill?.contact || "",
        },
        theme: {
          color: "#073C35",
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setStatusType("info");
            setStatusMessage("Payment cancelled by user.");
            onDismiss?.();
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          // 4. Verify payment signature on backend
          try {
            setStatusType("info");
            setStatusMessage("Verifying payment signature...");

            const verifyRes = await fetch(`${backendUrl}/api/verify-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.verified) {
              throw new Error(
                verifyData.message ||
                  verifyData.error ||
                  "Payment signature verification failed"
              );
            }

            setStatusType("success");
            setStatusMessage("Payment verified successfully!");
            onSuccess?.(response);
          } catch (verifyErr: any) {
            const errMsg =
              verifyErr.message || "Payment signature verification failed.";
            setStatusType("error");
            setStatusMessage(errMsg);
            onError?.(errMsg);
          } finally {
            setLoading(false);
          }
        },
      };

      const razorpay = new window.Razorpay(options);

      // Handle payment failure event
      razorpay.on("payment.failed", (response: any) => {
        setLoading(false);
        const errMsg =
          response.error?.description ||
          "Payment failed. Please try a different payment method.";
        setStatusType("error");
        setStatusMessage(errMsg);
        onError?.(errMsg);
      });

      razorpay.open();
    } catch (err: any) {
      setLoading(false);
      const errMsg = err.message || "An unexpected payment error occurred.";
      setStatusType("error");
      setStatusMessage(errMsg);
      onError?.(errMsg);
    }
  };

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handlePayment}
        disabled={loading}
        className={
          className ||
          "inline-flex items-center justify-center gap-2 bg-deepGreen-950 text-white font-semibold text-base px-8 py-3.5 rounded-full shadow-md hover:bg-deepGreen-900 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        }
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {statusMessage && (
        <div
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md ${
            statusType === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : statusType === "error"
              ? "bg-rose-50 text-rose-800 border border-rose-200"
              : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          {statusType === "success" ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
}
