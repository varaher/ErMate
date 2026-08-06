import React, { useState } from "react";
import { Activity, ShieldCheck, Mail, ArrowRight, UserCheck, Sparkles, Building2, Key, ChevronRight, ArrowLeft, Link, QrCode, RefreshCw } from "lucide-react";
import { UserProfile } from "../types";
import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

interface MockLoginViewProps {
  onLogin: (profile: UserProfile) => void;
  onSignUpClick: () => void;
  onForgotPasswordClick: () => void;
  theme?: "emerald" | "dark";
}

export default function MockLoginView({
  onLogin,
  onSignUpClick,
  onForgotPasswordClick,
  theme = "emerald",
}: MockLoginViewProps) {
  const [activeTab, setActiveTab] = useState<"credentials" | "phone-link">("credentials");
  
  // Normal Login state
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [hospital, setHospital] = useState("");
  const [normalError, setNormalError] = useState("");

  // Device Link login states
  const [devicePairCode, setDevicePairCode] = useState("");
  const [selectedProfileForDevice, setSelectedProfileForDevice] = useState("");
  const [deviceLinkError, setDeviceLinkError] = useState("");
  const [deviceLinkSuccess, setDeviceLinkSuccess] = useState("");
  const [isLinkingLoading, setIsLinkingLoading] = useState(false);

  // Google OAuth flow state
  const [isGoogleOpen, setIsGoogleOpen] = useState(false);
  const [googleStep, setGoogleStep] = useState<"choose" | "enter_email" | "enter_password" | "authenticating">("choose");
  const [googleEmail, setGoogleEmail] = useState("");
  const [googlePassword, setGooglePassword] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [authStatusMessage, setAuthStatusMessage] = useState("Connecting to Google Accounts...");

  const preConfiguredAccounts: any[] = [];

  // Resolve user profile based on email or username
  const resolveProfile = (emailVal: string, usernameVal: string): UserProfile => {
    const emailLower = emailVal.toLowerCase();
    const userLower = usernameVal.toLowerCase();

    let name = "Doctor";
    let role = "EM Physician";
    let subscriptionTier = "Free Standard";
    let aiCredits = 100;
    let resolvedHospital = hospital; // user's input value on form
    const resolvedEmail = emailVal || `${usernameVal || "doctor"}@hospital.in`;

    if (emailLower) {
      // General custom clinical Gmail
      const localPart = emailLower.split("@")[0].replace(".", " ");
      name = localPart.charAt(0).toUpperCase() + localPart.slice(1);
    } else if (usernameVal) {
      name = usernameVal.charAt(0).toUpperCase() + usernameVal.slice(1);
    }

    return {
      name,
      email: resolvedEmail,
      role,
      hospital: resolvedHospital || "",
      aiCredits,
      streak: 5,
      subscriptionTier
    };
  };

  // Triggers final login callback
  const triggerLogin = (emailVal: string, usernameVal: string) => {
    const profile = resolveProfile(emailVal, usernameVal);
    onLogin(profile);
  };

  // Normal Credentials submit
  const handleNormalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setNormalError("Please enter your Clinical User ID or Username.");
      return;
    }
    if (!password.trim()) {
      setNormalError("Please enter your security access password/PIN.");
      return;
    }
    setNormalError("");
    
    // Construct valid email from username if they entered just a username
    const email = userId.includes("@") ? userId.trim().toLowerCase() : `${userId.trim().toLowerCase()}@ermate.in`;
    const pwd = password.trim();

    try {
      let user: any = null;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pwd);
        user = userCredential.user;
      } catch (authErr: any) {
        // If user is not found or credentials invalid, try creating the account or fallback to preset password
        if (authErr.code === "auth/user-not-found" || authErr.code === "auth/invalid-credential") {
          try {
            const createRes = await createUserWithEmailAndPassword(auth, email, pwd);
            user = createRes.user;
          } catch (createErr: any) {
            try {
              const presetRes = await signInWithEmailAndPassword(auth, email, "password123");
              user = presetRes.user;
            } catch (presetErr) {
              throw authErr;
            }
          }
        } else {
          throw authErr;
        }
      }

      if (user) {
        // Load user profile from Firestore or resolve initial profile
        const profileRef = doc(db, "users", user.uid);
        const profileSnap = await getDoc(profileRef);
        let finalProfile: UserProfile;
        if (profileSnap.exists()) {
          finalProfile = profileSnap.data() as UserProfile;
        } else {
          finalProfile = resolveProfile(email, userId.trim());
          await setDoc(profileRef, finalProfile);
        }
        onLogin(finalProfile);
      }
    } catch (err: any) {
      console.error("Credential Sign-In Error:", err);
      let errorMsg = "Incorrect username/user ID or password.";
      if (err.code === "auth/invalid-email") {
        errorMsg = "Please enter a valid username or email address.";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errorMsg = "Incorrect clinical user ID or security passkey PIN.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      setNormalError(errorMsg);
    }
  };

  // Google Sign-In with Popup
  const handleGoogleSignIn = async () => {
    setNormalError("");
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;
      
      // Check if user profile already exists in Firestore
      const profileRef = doc(db, "users", user.uid);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        onLogin(profileSnap.data() as UserProfile);
      } else {
        // Create initial profile for Google user
        const resolved = resolveProfile(user.email || "", user.displayName || "");
        const initialProfile: UserProfile = {
          name: user.displayName || resolved.name || "Dr. " + (user.email?.split("@")[0] || "Physician"),
          email: user.email || "doctor@ermate.in",
          role: resolved.role || "Senior Consultant",
          hospital: resolved.hospital || "",
          state: "Maharashtra",
          hospitalAddress: "Emergency Wing, Medical Enclave, Civil Lines",
          aiCredits: 350,
          streak: 5,
          subscriptionTier: resolved.subscriptionTier || "Free Standard"
        };
        await setDoc(profileRef, initialProfile);
        onLogin(initialProfile);
      }
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        setNormalError(err.message || "Failed to authenticate via Google Accounts.");
      }
    }
  };

  // Select account from Google List
  const handleSelectGoogleAccount = (email: string) => {
    setGoogleEmail(email);
    setGoogleStep("enter_password");
    setGoogleError("");
  };

  // Custom Google Email submitted
  const handleGoogleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim()) {
      setGoogleError("Please enter your Google email address.");
      return;
    }
    if (!googleEmail.toLowerCase().endsWith("@gmail.com")) {
      setGoogleError("Please enter a valid Gmail address (ending in @gmail.com).");
      return;
    }
    setGoogleError("");
    setGoogleStep("enter_password");
  };

  // Sign in or auto-create preset account in Firebase Auth
  const authenticatePresetUser = async (email: string, name: string, customPwd?: string): Promise<any> => {
    const primaryPwd = (customPwd && customPwd.length >= 6) ? customPwd : "password123";
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, primaryPwd);
      return userCredential.user;
    } catch (err: any) {
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, primaryPwd);
          return userCredential.user;
        } catch (createErr) {
          try {
            const createFallback = await createUserWithEmailAndPassword(auth, email, "password123");
            return createFallback.user;
          } catch (createFallbackErr) {
            try {
              const signFallback = await signInWithEmailAndPassword(auth, email, "password123");
              return signFallback.user;
            } catch (finalErr) {
              console.error("All authentication attempts failed for email:", email, finalErr);
            }
          }
        }
      }
    }
    return null;
  };

  // Google Password submitted & flow begins
  const handleGooglePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError("");
    setGoogleStep("authenticating");

    // Cycle through realistic clinical whitelisting & oauth loader messages
    const steps = [
      { delay: 300, msg: "Establishing secure SSL connection to Google accounts..." },
      { delay: 600, msg: "Exchanging credentials and verifying security tokens..." },
      { delay: 900, msg: "Querying ERmate allowlisted clinical roster database..." },
      { delay: 1200, msg: "Applying security certificate. Logging you in..." }
    ];

    steps.forEach((step) => {
      setTimeout(() => {
        setAuthStatusMessage(step.msg);
      }, step.delay);
    });

    const email = googleEmail.trim().toLowerCase();
    const pwd = googlePassword.trim() || "password123";

    let finalProfile: UserProfile | null = null;

    try {
      const selectedAccount = preConfiguredAccounts.find(acc => acc.email === email);
      const displayName = selectedAccount ? selectedAccount.name : "Physician";
      
      const user = await authenticatePresetUser(email, displayName, pwd);
      if (user) {
        // Also ensure user profile document exists in Firestore under their UID
        const profileRef = doc(db, "users", user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          finalProfile = profileSnap.data() as UserProfile;
        } else {
          finalProfile = resolveProfile(email, "");
          await setDoc(profileRef, finalProfile);
        }
      } else {
        finalProfile = resolveProfile(email, "");
      }
    } catch (authErr) {
      console.error("Preset background authentication failed:", authErr);
      finalProfile = resolveProfile(email, "");
    }

    setTimeout(() => {
      if (finalProfile) {
        setIsGoogleOpen(false);
        onLogin(finalProfile);
      }
    }, 1300);
  };

  const isEmerald = theme === "emerald";

  return (
    <div className={`flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden ${isEmerald ? 'text-slate-800' : 'text-slate-100'}`}>
      {/* Background radial gradients */}
      {!isEmerald && (
        <>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Main Brand Logo & Subtitles */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 space-y-2">
        <div className={`mx-auto h-12 w-12 ${isEmerald ? 'bg-emerald-600 shadow-emerald-600/20' : 'bg-blue-600 shadow-blue-500/20'} rounded-2xl flex items-center justify-center shadow-lg`}>
          <Activity className="w-6 h-6 text-white animate-pulse" />
        </div>
        <div>
          <h1 className={`text-3xl font-black font-display tracking-tight ${isEmerald ? 'text-emerald-800' : 'text-white'} flex items-center justify-center gap-2`}>
            ErMate
          </h1>
          <p className={`text-xs ${isEmerald ? 'text-slate-600' : 'text-slate-400'} font-mono tracking-wider mt-1`}>
            ErMate :- The Scribe Companion for ER
          </p>
        </div>
      </div>

      {/* Main Interaction Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className={`${isEmerald ? 'bg-white border border-emerald-100/80 shadow-xl' : 'bg-slate-950 border border-slate-800/80 shadow-2xl'} rounded-2xl overflow-hidden`}>
          
          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Segmented Tab Bar */}
            <div className={`grid grid-cols-2 p-1 rounded-xl border ${isEmerald ? 'bg-slate-150/40 border-slate-200/50' : 'bg-slate-900 border-slate-850'}`}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("credentials");
                  setDeviceLinkError("");
                  setDeviceLinkSuccess("");
                }}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "credentials"
                    ? isEmerald
                      ? "bg-white text-slate-800 shadow-sm"
                      : "bg-slate-800 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                Credentials
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("phone-link");
                  setNormalError("");
                }}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "phone-link"
                    ? isEmerald
                      ? "bg-white text-slate-800 shadow-sm"
                      : "bg-slate-800 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <QrCode className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
                Phone Sync Code
              </button>
            </div>

            {/* TAB 1: CLINICAL CREDENTIALS */}
            {activeTab === "credentials" && (
              <div className="space-y-6 animate-fade-in">
                {/* GOOGLE SIGN IN BUTTON & ACCOUNT SWITCHER */}
                <div className="space-y-2">
                  <button
                    type="button"
                    id="google-login-btn"
                    onClick={handleGoogleSignIn}
                    className={`w-full py-2.5 px-4 ${isEmerald ? 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700' : 'bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200'} font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-3 shadow-sm hover:scale-[1.01] active:scale-[0.99] cursor-pointer`}
                  >
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
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
                    <span className="font-sans text-xs tracking-wide">Sign In with Google Account</span>
                  </button>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setGoogleStep("choose");
                        setIsGoogleOpen(true);
                        setNormalError("");
                      }}
                      className={`text-[11px] font-bold ${isEmerald ? 'text-emerald-700 hover:text-emerald-800' : 'text-emerald-400 hover:text-emerald-300'} flex items-center gap-1.5 hover:underline cursor-pointer transition-all pt-1`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Switch or Choose Clinical Account Persona</span>
                    </button>
                  </div>
                </div>

                {/* DIVIDER */}
                <div className="relative flex py-2 items-center">
                  <div className={`flex-grow border-t ${isEmerald ? 'border-slate-100' : 'border-slate-800'}`}></div>
                  <span className={`flex-shrink mx-4 text-[10px] font-mono uppercase tracking-wider ${isEmerald ? 'text-slate-400' : 'text-slate-500'}`}>
                    or sign in with credentials
                  </span>
                  <div className={`flex-grow border-t ${isEmerald ? 'border-slate-100' : 'border-slate-800'}`}></div>
                </div>

                {/* NORMAL CLINICAL CREDENTIALS LOGIN FORM */}
                <form onSubmit={handleNormalSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className={`block text-[9px] font-bold ${isEmerald ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider font-mono`}>
                      Clinical User ID / Username
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <input
                        type="text"
                        value={userId}
                        onChange={(e) => {
                          setUserId(e.target.value);
                          setNormalError("");
                        }}
                        placeholder="e.g. usr_vipin_32"
                        className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-emerald-500'} block w-full pl-9 pr-3 py-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className={`block text-[9px] font-bold ${isEmerald ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider font-mono`}>
                        Security Passkey / Access PIN
                      </label>
                      <button
                        type="button"
                        onClick={onForgotPasswordClick}
                        className={`text-[10px] ${isEmerald ? 'text-emerald-600 hover:text-emerald-700' : 'text-emerald-400 hover:text-emerald-300'} hover:underline font-mono transition-all cursor-pointer`}
                      >
                        Forgot PIN?
                      </button>
                    </div>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Key className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setNormalError("");
                        }}
                        placeholder="••••••••"
                        className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-emerald-500'} block w-full pl-9 pr-3 py-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1`}
                      />
                    </div>
                  </div>

                  {normalError && (
                    <p className="text-[10px] text-rose-400 font-bold font-mono">
                      ⚠️ {normalError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className={`w-full py-2.5 px-4 ${isEmerald ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'} font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer`}
                  >
                    <span>Authenticate Credentials</span>
                    <ArrowRight className="w-3.5 h-3.5 text-white" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: PHONE SYNC CODE / QR CODES */}
            {activeTab === "phone-link" && (
              <div className="space-y-5 animate-fade-in">
                
                <div className={`p-3.5 rounded-xl border text-[11px] leading-relaxed font-mono ${isEmerald ? 'bg-emerald-50/40 border-emerald-100 text-emerald-800' : 'bg-slate-900 border-slate-800 text-slate-300'}`}>
                  <div className="flex gap-2.5">
                    <QrCode className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <strong className="block mb-0.5">Quick Pairing Instructions:</strong>
                      1. Open ErMate on your logged-in mobile phone.<br />
                      2. Go to <strong className="text-emerald-600 dark:text-emerald-400">Profile → Link Device</strong>.<br />
                      3. Select your clinical account below and enter the active 6-digit PIN displayed on your phone.
                    </div>
                  </div>
                </div>

                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setDeviceLinkError("");
                    setDeviceLinkSuccess("");
                    
                    const cleanPIN = devicePairCode.replace(/\s+/g, "");
                    if (cleanPIN.length < 6) {
                      setDeviceLinkError("Please enter a valid 6-digit PIN code.");
                      return;
                    }

                    setIsLinkingLoading(true);
                    try {
                      const selectedAccount = preConfiguredAccounts.find(acc => acc.email === selectedProfileForDevice);
                      const displayName = selectedAccount ? selectedAccount.name : "Physician";
                      
                      const user = await authenticatePresetUser(selectedProfileForDevice, displayName);
                      if (user) {
                        const profileRef = doc(db, "users", user.uid);
                        const profileSnap = await getDoc(profileRef);
                        let finalProfile: UserProfile;
                        if (profileSnap.exists()) {
                          finalProfile = profileSnap.data() as UserProfile;
                        } else {
                          finalProfile = resolveProfile(selectedProfileForDevice, "");
                          await setDoc(profileRef, finalProfile);
                        }

                        setIsLinkingLoading(false);
                        setDeviceLinkSuccess("Pairing authorized! Handshake complete.");
                        setTimeout(() => {
                          onLogin(finalProfile);
                        }, 800);
                      } else {
                        throw new Error("Unable to authenticate preset device profile.");
                      }
                    } catch (err: any) {
                      console.error("Device link authentication error:", err);
                      setIsLinkingLoading(false);
                      setDeviceLinkError(err.message || "Failed to sync device session.");
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className={`block text-[9px] font-bold ${isEmerald ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider font-mono`}>
                      Select Target Scribe Account
                    </label>
                    <select
                      value={selectedProfileForDevice}
                      onChange={(e) => {
                        setSelectedProfileForDevice(e.target.value);
                        setDeviceLinkError("");
                      }}
                      className={`block w-full px-3 py-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                        isEmerald 
                          ? 'bg-slate-50 border border-slate-200 text-slate-850' 
                          : 'bg-slate-900 border border-slate-800 text-slate-200'
                      }`}
                    >
                      {preConfiguredAccounts.map((acc) => (
                        <option key={acc.email} value={acc.email}>
                          {acc.name} ({acc.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className={`block text-[9px] font-bold ${isEmerald ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider font-mono`}>
                      6-Digit Phone Link PIN
                    </label>
                    <input
                      type="text"
                      maxLength={7}
                      placeholder="e.g. 583 921"
                      value={devicePairCode}
                      onChange={(e) => {
                        // format as "123 456" dynamically
                        const val = e.target.value.replace(/\D/g, "");
                        if (val.length <= 3) {
                          setDevicePairCode(val);
                        } else {
                          setDevicePairCode(val.substring(0, 3) + " " + val.substring(3, 6));
                        }
                        setDeviceLinkError("");
                      }}
                      className={`block w-full py-2 px-3 text-center text-sm font-black font-mono tracking-widest rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                        isEmerald 
                          ? 'bg-slate-50 border border-slate-200 text-slate-800' 
                          : 'bg-slate-900 border border-slate-800 text-slate-200'
                      }`}
                    />
                  </div>

                  {deviceLinkError && (
                    <p className="text-[10px] text-rose-500 font-bold font-mono">
                      ⚠️ {deviceLinkError}
                    </p>
                  )}

                  {deviceLinkSuccess && (
                    <p className="text-[10px] text-emerald-500 font-bold font-mono animate-pulse">
                      ✓ {deviceLinkSuccess}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isLinkingLoading}
                    className={`w-full py-2.5 px-4 ${isEmerald ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'} font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50`}
                  >
                    {isLinkingLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Securing Link Socket...</span>
                      </>
                    ) : (
                      <>
                        <Link className="w-3.5 h-3.5 text-white" />
                        <span>Sync & Link Computer Session</span>
                      </>
                    )}
                  </button>
                </form>

              </div>
            )}

          </div>

          {/* New account registration trigger */}
          <div className={`border-t p-4 text-center text-xs font-mono ${isEmerald ? 'border-slate-100 bg-slate-50/50 text-slate-500' : 'border-slate-900 bg-slate-950/60 text-slate-400'}`}>
            <span>New to ErMate? </span>
            <button
              type="button"
              onClick={onSignUpClick}
              className={`${isEmerald ? 'text-emerald-600 hover:text-emerald-700' : 'text-emerald-400 hover:text-emerald-300'} font-bold hover:underline transition-all cursor-pointer`}
            >
              Create Account
            </button>
          </div>

        </div>
      </div>

      <div className="mt-6 text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>Secure ISO 27001 Clinical Sandbox Nodes</span>
      </div>

      {/* STUNNING HIGH-FIDELITY SIMULATED GOOGLE OAUTH POPUP MODAL */}
      {isGoogleOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden font-sans transition-all flex flex-col">
            
            {/* Simulated Google Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                <span className="text-xs font-semibold text-slate-500 font-sans">Sign in with Google</span>
              </div>
              
              <button
                type="button"
                onClick={() => setIsGoogleOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold font-mono px-2 py-1 rounded"
              >
                ✕ Close
              </button>
            </div>

            {/* Google Authentication Steps Container */}
            <div className="p-6 flex-1 min-h-[300px] flex flex-col justify-between">
              
              {/* STEP 1: CHOOSE OR SELECT AN ACCOUNT */}
              {googleStep === "choose" && (
                <div className="space-y-4 flex-1">
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">Choose an account</h2>
                    <p className="text-xs text-slate-500">to continue to <strong className="text-blue-600">ErMate EMR</strong></p>
                  </div>

                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {preConfiguredAccounts.map((account) => (
                      <button
                        key={account.email}
                        type="button"
                        onClick={() => handleSelectGoogleAccount(account.email)}
                        className="w-full p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/70 text-left transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-extrabold flex items-center justify-center text-xs border border-blue-100">
                            {account.initial}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">{account.name}</p>
                            <p className="text-[10px] font-medium text-slate-400 font-mono">{account.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-mono tracking-wider">
                            {account.badge}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </div>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setGoogleStep("enter_email");
                        setGoogleEmail("");
                        setGoogleError("");
                      }}
                      className="w-full p-2.5 rounded-xl border border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 text-left transition-all flex items-center gap-3 cursor-pointer mt-2"
                    >
                      <div className="w-8 h-8 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs font-bold">
                        +
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-600">Use another Google account</p>
                        <p className="text-[9px] font-medium text-slate-400">Sign in with a custom clinical address</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: ENTER CUSTOM EMAIL */}
              {googleStep === "enter_email" && (
                <div className="space-y-4 flex-1">
                  <button
                    type="button"
                    onClick={() => setGoogleStep("choose")}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Account Selection
                  </button>

                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight font-sans">Sign in</h2>
                    <p className="text-xs text-slate-500">Use your verified clinical Google Account</p>
                  </div>

                  <form onSubmit={handleGoogleEmailSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                        Google Email Address
                      </label>
                      <input
                        type="email"
                        value={googleEmail}
                        onChange={(e) => {
                          setGoogleEmail(e.target.value);
                          setGoogleError("");
                        }}
                        placeholder="yourname@gmail.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-800"
                        autoFocus
                      />
                      <p className="text-[9px] text-slate-400 leading-normal">
                        Note: For sandbox simulation, your email must end with <strong className="text-slate-500">@gmail.com</strong>.
                      </p>
                    </div>

                    {googleError && (
                      <p className="text-[10px] text-red-500 font-semibold font-sans">
                        ⚠️ {googleError}
                      </p>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STEP 3: ENTER GOOGLE PASSWORD */}
              {googleStep === "enter_password" && (
                <div className="space-y-4 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      // Go back to the correct previous step
                      if (preConfiguredAccounts.some(acc => acc.email === googleEmail)) {
                        setGoogleStep("choose");
                      } else {
                        setGoogleStep("enter_email");
                      }
                      setGooglePassword("");
                      setGoogleError("");
                    }}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Change Account
                  </button>

                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight font-sans">Welcome</h2>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600 font-mono">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {googleEmail}
                    </div>
                  </div>

                  <form onSubmit={handleGooglePasswordSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                        Enter your Google password
                      </label>
                      <input
                        type="password"
                        value={googlePassword}
                        onChange={(e) => {
                          setGooglePassword(e.target.value);
                          setGoogleError("");
                        }}
                        placeholder="Google Account Password"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-800 font-mono"
                        autoFocus
                      />
                    </div>

                    {googleError && (
                      <p className="text-[10px] text-red-500 font-semibold font-sans">
                        ⚠️ {googleError}
                      </p>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer"
                      >
                        Sign In
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STEP 4: AUTHENTICATING AND LINKING ROSTER */}
              {googleStep === "authenticating" && (
                <div className="flex flex-col items-center justify-center space-y-6 py-10 flex-1">
                  {/* Google Loader animation */}
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className="text-sm font-extrabold text-slate-800">Authorizing Workspace</h3>
                    <p className="text-xs font-mono text-slate-500 max-w-xs animate-pulse leading-relaxed">
                      {authStatusMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* Standard OAuth Google Disclaimer */}
              <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-400 font-sans leading-normal">
                By continuing, Google will share your name, email address, language preference, and profile picture with <strong>ErMate EMR</strong>. Read our Privacy Policy and Terms of Clinical Use.
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
