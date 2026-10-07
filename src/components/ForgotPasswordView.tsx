import React, { useState } from "react";

import {
  Activity,
  ShieldCheck,
  Mail,
  ArrowLeft,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { ErMateLogo } from "./shared/ErMateLogo";

import {
  sendPasswordResetEmail
} from "firebase/auth";

import {
  auth
} from "../firebase";


interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
  theme?: "emerald" | "dark";
}


export default function ForgotPasswordView({
  onBackToLogin,
  theme = "emerald"
}: ForgotPasswordViewProps) {
  const [email, setEmail] =
    useState("");

  const [submittedEmail, setSubmittedEmail] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  const [error, setError] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const isEmerald =
    theme === "emerald";


  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError("");

    const cleanEmail =
      email.trim().toLowerCase();

    if (
      !cleanEmail ||
      !cleanEmail.includes("@")
    ) {
      setError(
        "Please enter a valid email address."
      );

      return;
    }

    setIsLoading(true);

    try {
      await sendPasswordResetEmail(
        auth,
        cleanEmail
      );

      /*
       * Do not reveal whether this address exists
       * in Firebase Authentication.
       */
      setSubmittedEmail(
        cleanEmail
      );

      setSuccess(true);
    } catch (err: any) {
      const code =
        err?.code || "";

      /*
       * Account enumeration protection:
       *
       * Treat an unknown account exactly like a
       * successful request.
       */
      if (
        code ===
        "auth/user-not-found"
      ) {
        setSubmittedEmail(
          cleanEmail
        );

        setSuccess(true);

        return;
      }

      if (
        code ===
        "auth/invalid-email"
      ) {
        setError(
          "Please enter a valid email address."
        );
      } else if (
        code ===
        "auth/too-many-requests"
      ) {
        setError(
          "Too many reset requests. Please wait a few minutes and try again."
        );
      } else if (
        code ===
        "auth/network-request-failed"
      ) {
        setError(
          "No network connection. Please check your internet and try again."
        );
      } else {
        console.error(
          "Password reset error:",
          err
        );

        setError(
          "Unable to request a password reset right now. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div
      className={`flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden ${
        isEmerald
          ? "text-slate-800"
          : "text-slate-100"
      }`}
    >
      {!isEmerald && (
        <>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}


      {/* Brand */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 space-y-3">
        <div className="flex justify-center mb-1">
          <ErMateLogo variant="icon" size="lg" className="rounded-2xl shadow-xl ring-4 ring-white/20 dark:ring-slate-800/60" />
        </div>

        <div>
          <h1
            className={`text-3xl font-black tracking-tight ${
              isEmerald
                ? "text-emerald-800"
                : "text-white"
            }`}
          >
            ErMate
          </h1>

          <p
            className={`text-xs ${
              isEmerald
                ? "text-slate-600"
                : "text-slate-400"
            } font-mono tracking-wider mt-1`}
          >
            The Scribe Companion for ER
          </p>
        </div>
      </div>


      {/* Reset Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div
          className={`${
            isEmerald
              ? "bg-white border border-emerald-100/80 shadow-xl"
              : "bg-slate-950 border border-slate-800/80 shadow-2xl"
          } rounded-2xl overflow-hidden`}
        >
          <div
            className={`border-b px-6 py-4 flex items-center justify-between ${
              isEmerald
                ? "border-slate-100 bg-slate-50/50"
                : "border-slate-900 bg-slate-950"
            }`}
          >
            <h2
              className={`text-sm font-extrabold uppercase tracking-wider font-mono ${
                isEmerald
                  ? "text-slate-700"
                  : "text-slate-300"
              }`}
            >
              Reset Password
            </h2>

            <button
              type="button"
              onClick={
                onBackToLogin
              }
              className={`text-xs font-bold font-mono flex items-center gap-1 transition-all ${
                isEmerald
                  ? "text-emerald-600 hover:text-emerald-700"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />

              Back
            </button>
          </div>


          <div className="p-6 sm:p-8 space-y-5">

            {isLoading ? (
              <div className="flex flex-col items-center justify-center space-y-5 py-10">
                <RefreshCw
                  className={`w-9 h-9 animate-spin ${
                    isEmerald
                      ? "text-emerald-600"
                      : "text-blue-500"
                  }`}
                />

                <p
                  className={`text-xs font-mono ${
                    isEmerald
                      ? "text-slate-500"
                      : "text-slate-400"
                  }`}
                >
                  Sending password reset link...
                </p>
              </div>
            ) : success ? (
              <div className="space-y-5 text-center py-4">
                <div
                  className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center ${
                    isEmerald
                      ? "bg-emerald-50"
                      : "bg-emerald-500/10"
                  }`}
                >
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>

                <div className="space-y-2">
                  <h3
                    className={`text-sm font-extrabold ${
                      isEmerald
                        ? "text-slate-800"
                        : "text-slate-200"
                    }`}
                  >
                    Check your email
                  </h3>

                  <p
                    className={`text-xs leading-relaxed ${
                      isEmerald
                        ? "text-slate-500"
                        : "text-slate-400"
                    }`}
                  >
                    If an ErMate account exists for{" "}
                    <strong>
                      {submittedEmail}
                    </strong>
                    , a password reset link has been sent.
                  </p>

                  <p
                    className={`text-[11px] leading-relaxed ${
                      isEmerald
                        ? "text-slate-400"
                        : "text-slate-500"
                    }`}
                  >
                    Open the email and follow the Firebase
                    reset link to choose a new password.
                  </p>

                  <p
                    className={`text-[11px] leading-relaxed ${
                      isEmerald
                        ? "text-slate-400"
                        : "text-slate-500"
                    }`}
                  >
                    If you normally use Google to access
                    ErMate, you do not need to reset an
                    ErMate password. Return to login and
                    choose Continue with Google.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    onBackToLogin
                  }
                  className={`w-full py-2.5 ${
                    isEmerald
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white font-bold rounded-xl text-xs transition-all`}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl font-mono leading-relaxed">
                    ⚠️ {error}
                  </div>
                )}

                <form
                  onSubmit={
                    handleSubmit
                  }
                  className="space-y-4"
                >
                  <div
                    className={`text-xs leading-relaxed ${
                      isEmerald
                        ? "text-slate-600"
                        : "text-slate-300"
                    }`}
                  >
                    Enter the email address used for your
                    ErMate account. Firebase will send a
                    secure password reset link if a matching
                    email/password account exists.
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="recovery-email"
                      className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${
                        isEmerald
                          ? "text-slate-500"
                          : "text-slate-400"
                      }`}
                    >
                      Email Address
                    </label>

                    <div className="relative rounded-lg">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />

                      <input
                        id="recovery-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(
                            e.target.value
                          );

                          setError("");
                        }}
                        placeholder="doctor@example.com"
                        className={`${
                          isEmerald
                            ? "bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500"
                            : "bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500"
                        } block w-full pl-9 pr-3 py-2 text-xs rounded-lg font-mono font-semibold focus:outline-none focus:ring-1`}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className={`w-full py-2.5 ${
                      isEmerald
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    } text-white font-bold rounded-xl text-xs transition-all shadow-md`}
                  >
                    Send Reset Link
                  </button>
                </form>

                <div
                  className={`border-t pt-3 text-[10.5px] font-mono flex items-center gap-1 justify-center ${
                    isEmerald
                      ? "border-slate-100 text-slate-500"
                      : "border-slate-900 text-slate-400"
                  }`}
                >
                  <span>
                    Remembered your password?
                  </span>

                  <button
                    type="button"
                    onClick={
                      onBackToLogin
                    }
                    className={`font-bold hover:underline ${
                      isEmerald
                        ? "text-emerald-600"
                        : "text-blue-400"
                    }`}
                  >
                    Sign In
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>


      {/* Truthful footer */}
      <div className="mt-6 text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />

        <span>
          Password recovery powered by Firebase
        </span>
      </div>
    </div>
  );
}