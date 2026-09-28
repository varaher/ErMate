import React, { useState } from "react";

import {
  Activity,
  ArrowRight,
  Key,
  Mail
} from "lucide-react";

import { UserProfile } from "../types";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  reload,
  signOut,
  type User
} from "firebase/auth";

import {
  doc,
  getDoc
} from "firebase/firestore";

import {
  auth,
  db,
  googleProvider
} from "../firebase";


interface MockLoginViewProps {
  onLogin: (profile: UserProfile) => void;
  onSignUpClick: () => void;
  onForgotPasswordClick: () => void;
  theme?: "emerald" | "dark";
}


/**
 * Safe fallback profile.
 *
 * IMPORTANT:
 * This is only a temporary in-memory fallback when
 * users/{uid} is not yet available.
 *
 * It grants:
 * - no hospital membership
 * - no privileged role
 * - no paid subscription
 * - no elevated authority
 *
 * This login component does NOT write the fallback
 * profile to Firestore. App.tsx will remain the
 * central bootstrap location for a genuinely missing
 * users/{uid} document.
 */
function safeDefaultProfile(
  email: string,
  displayName?: string | null
): UserProfile {
  const rawName =
    String(
      displayName ||
      email.split("@")[0] ||
      "Doctor"
    ).trim();

  const formattedName =
    rawName.startsWith("Dr.")
      ? rawName
      : `Dr. ${rawName}`;

  return {
    name: formattedName,

    email,

    role: "EM Resident",

    hospital: "",

    aiCredits: 100,

    streak: 1,

    subscriptionTier:
      "Free Standard"
  };
}


/**
 * Load the trusted users/{uid} profile.
 *
 * If it is temporarily unavailable or does not yet
 * exist, return only a safe independent fallback.
 *
 * Never derive hospital membership, HOD status,
 * subscription entitlement, or authority from input
 * entered on the login screen.
 */
async function loadProfile(
  uid: string,
  email: string,
  displayName?: string | null
): Promise<UserProfile> {
  try {
    const profileRef =
      doc(
        db,
        "users",
        uid
      );

    const profileSnap =
      await getDoc(
        profileRef
      );

    if (profileSnap.exists()) {
      return (
        profileSnap.data() as UserProfile
      );
    }
  } catch (error) {
    console.warn(
      "Profile read failed; App bootstrap will handle profile setup:",
      error
    );
  }

  return safeDefaultProfile(
    email,
    displayName
  );
}


export default function MockLoginView({
  onLogin,
  onSignUpClick,
  onForgotPasswordClick,
  theme = "emerald"
}: MockLoginViewProps) {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const isEmerald =
    theme === "emerald";


  /**
   * Shared post-authentication path.
   *
   * Used by BOTH:
   * - email/password sign-in
   * - Google OAuth
   *
   * Existing clinicians are allowed to sign in even
   * when their email has not yet been verified.
   *
   * Verification will later be enforced only for
   * security-sensitive identity-bound actions such
   * as accepting an email-restricted hospital invite.
   */
  const finishAuthenticatedLogin =
    async (
      signedInUser: User
    ) => {
      /*
       * Refresh Firebase state because email
       * verification may have happened in another
       * browser tab or device.
       */
      await reload(
        signedInUser
      );

      const user =
        auth.currentUser;

      if (
        !user ||
        user.uid !== signedInUser.uid
      ) {
        throw new Error(
          "Authentication session could not be confirmed."
        );
      }

      /*
       * Backward-compatible email verification.
       *
       * Older ErMate accounts may pre-date email
       * verification, so they are NOT locked out.
       *
       * Send one verification email during this
       * browser session and allow normal independent
       * account access.
       */
      if (
        user.email &&
        user.emailVerified !== true
      ) {
        const sentKey =
          `ermate_verif_sent_${user.uid}`;

        try {
          if (
            typeof sessionStorage !==
              "undefined" &&
            !sessionStorage.getItem(
              sentKey
            )
          ) {
            await sendEmailVerification(
              user
            ).catch(
              () => undefined
            );

            sessionStorage.setItem(
              sentKey,
              "1"
            );
          }
        } catch (verificationError) {
          /*
           * Verification-email delivery must never
           * prevent access to the independent account.
           */
          console.warn(
            "Could not send verification email:",
            verificationError
          );
        }
      }

      /*
       * IMPORTANT:
       *
       * Do NOT automatically consume or accept
       * ermate_pending_invite_token here.
       *
       * Joining a hospital must remain an explicit
       * clinician action through the existing
       * Accept Joining Offer workflow.
       */

      const normalizedEmail =
        String(
          user.email || ""
        )
          .trim()
          .toLowerCase();

      if (!normalizedEmail) {
        throw new Error(
          "Your authenticated account does not have an email address."
        );
      }

      /*
       * Read AFTER authentication.
       *
       * We do not create or elevate profiles here.
       */
      const profile =
        await loadProfile(
          user.uid,
          normalizedEmail,
          user.displayName
        );

      onLogin(
        profile
      );
    };


  /**
   * Email + password login.
   */
  const handleEmailSignIn =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      setError("");

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      if (
        !cleanEmail ||
        !cleanEmail.includes("@")
      ) {
        setError(
          "Please enter the email address you registered with."
        );

        return;
      }

      /*
       * Passwords must be used exactly as typed.
       * Never trim or silently modify them.
       */
      if (!password) {
        setError(
          "Please enter your password."
        );

        return;
      }

      setBusy(true);

      try {
        /*
         * SIGN IN ONLY.
         *
         * No createUserWithEmailAndPassword.
         * No fallback password.
         * No preset password.
         */
        const credential =
          await signInWithEmailAndPassword(
            auth,
            cleanEmail,
            password
          );

        await finishAuthenticatedLogin(
          credential.user
        );
      } catch (err: any) {
        const code =
          err?.code || "";

        /*
         * If authentication succeeded but a later
         * login-completion step failed, avoid leaving
         * an uncertain half-open session.
         */
        if (
          auth.currentUser &&
          ![
            "auth/invalid-credential",
            "auth/wrong-password",
            "auth/user-not-found",
            "auth/invalid-email"
          ].includes(code)
        ) {
          await signOut(
            auth
          ).catch(
            () => undefined
          );
        }

        if (
          code ===
          "auth/too-many-requests"
        ) {
          setError(
            "Too many attempts. Please wait a few minutes or reset your password."
          );
        } else if (
          code ===
          "auth/network-request-failed"
        ) {
          setError(
            "No network connection. Please check your internet and try again."
          );
        } else if (
          code ===
            "auth/invalid-credential" ||
          code ===
            "auth/wrong-password" ||
          code ===
            "auth/user-not-found"
        ) {
          /*
           * Same response prevents easy account
           * enumeration.
           */
          setError(
            "Incorrect email or password."
          );
        } else if (
          code ===
          "auth/invalid-email"
        ) {
          setError(
            "Please enter a valid email address."
          );
        } else if (
          err?.message
        ) {
          setError(
            err.message
          );
        } else {
          setError(
            "Unable to sign in. Please try again."
          );
        }
      } finally {
        setBusy(false);
      }
    };


  /**
   * Real Firebase Google OAuth.
   *
   * ErMate NEVER asks for the user's Google password.
   */
  const handleGoogleSignIn =
    async () => {
      setError("");
      setBusy(true);

      try {
        googleProvider
          .setCustomParameters({
            prompt:
              "select_account"
          });

        const credential =
          await signInWithPopup(
            auth,
            googleProvider
          );

        await finishAuthenticatedLogin(
          credential.user
        );
      } catch (err: any) {
        const code =
          err?.code || "";

        if (
          code ===
            "auth/popup-closed-by-user" ||
          code ===
            "auth/cancelled-popup-request"
        ) {
          return;
        }

        /*
         * Remove an incomplete OAuth session if a
         * later completion step failed.
         */
        if (auth.currentUser) {
          await signOut(
            auth
          ).catch(
            () => undefined
          );
        }

        if (
          code ===
          "auth/network-request-failed"
        ) {
          setError(
            "No network connection. Please check your internet and try again."
          );
        } else if (
          code ===
          "auth/popup-blocked"
        ) {
          setError(
            "The Google sign-in window was blocked. Please allow pop-ups and try again."
          );
        } else if (
          err?.message
        ) {
          setError(
            err.message
          );
        } else {
          setError(
            "Google sign-in failed. Please try again."
          );
        }
      } finally {
        setBusy(false);
      }
    };


  const inputCls =
    isEmerald
      ? "bg-slate-50 border border-slate-200 text-slate-800 focus:ring-emerald-500"
      : "bg-slate-900 border border-slate-800 text-slate-200 focus:ring-emerald-500";


  return (
    <div
      className={`flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans ${
        isEmerald
          ? "text-slate-800"
          : "text-slate-100"
      }`}
    >
      {/* Brand */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div
          className={`mx-auto h-12 w-12 ${
            isEmerald
              ? "bg-emerald-600"
              : "bg-blue-600"
          } rounded-2xl flex items-center justify-center shadow-lg`}
        >
          <Activity className="w-6 h-6 text-white" />
        </div>

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
          } font-mono`}
        >
          The Scribe Companion for ER
        </p>
      </div>


      {/* Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div
          className={`${
            isEmerald
              ? "bg-white border border-emerald-100 shadow-xl"
              : "bg-slate-950 border border-slate-800 shadow-2xl"
          } rounded-2xl overflow-hidden`}
        >
          <div className="p-6 sm:p-8 space-y-6">

            {/* Google Login */}
            <button
              type="button"
              onClick={
                handleGoogleSignIn
              }
              disabled={busy}
              className={`w-full py-2.5 px-4 ${
                isEmerald
                  ? "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
                  : "bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200"
              } font-bold rounded-xl text-xs flex items-center justify-center gap-3 disabled:opacity-50`}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />

                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />

                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />

                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>

              <span>
                Continue with Google
              </span>
            </button>


            {/* Divider */}
            <div className="relative flex items-center">
              <div
                className={`flex-grow border-t ${
                  isEmerald
                    ? "border-slate-100"
                    : "border-slate-800"
                }`}
              />

              <span className="mx-4 text-[10px] font-mono uppercase text-slate-400">
                or sign in with email
              </span>

              <div
                className={`flex-grow border-t ${
                  isEmerald
                    ? "border-slate-100"
                    : "border-slate-800"
                }`}
              />
            </div>


            {/* Email Login */}
            <form
              onSubmit={
                handleEmailSignIn
              }
              className="space-y-4"
            >
              <div className="space-y-1">
                <label
                  htmlFor="login-email"
                  className="block text-[9px] font-bold uppercase tracking-wider font-mono text-slate-500"
                >
                  Email
                </label>

                <div className="relative">
                  <Mail className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />

                  <input
                    id="login-email"
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
                    className={`${inputCls} block w-full pl-9 pr-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1`}
                    required
                  />
                </div>
              </div>


              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="login-password"
                    className="block text-[9px] font-bold uppercase tracking-wider font-mono text-slate-500"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={
                      onForgotPasswordClick
                    }
                    className="text-[10px] text-emerald-600 hover:underline font-mono"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <Key className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />

                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(
                        e.target.value
                      );

                      setError("");
                    }}
                    placeholder="••••••••"
                    className={`${inputCls} block w-full pl-9 pr-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1`}
                    required
                  />
                </div>
              </div>


              {/* Error */}
              {error && (
                <p
                  role="alert"
                  className="text-[11px] text-rose-500 font-semibold leading-relaxed"
                >
                  ⚠️ {error}
                </p>
              )}


              {/* Submit */}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Activity className="w-3.5 h-3.5 animate-spin" />

                    <span>
                      Signing in…
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      Sign in
                    </span>

                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>


          {/* Create Account */}
          <div
            className={`border-t p-4 text-center text-xs font-mono ${
              isEmerald
                ? "border-slate-100 bg-slate-50/50 text-slate-500"
                : "border-slate-900 text-slate-400"
            }`}
          >
            New to ErMate?{" "}

            <button
              type="button"
              onClick={
                onSignUpClick
              }
              className="text-emerald-600 font-bold hover:underline"
            >
              Create account
            </button>
          </div>
        </div>
      </div>


      {/* Truthful Security Footer */}
      <div className="mt-6 text-center text-[10px] text-slate-500 font-mono">
        Secure authentication powered by Firebase
      </div>
    </div>
  );
}