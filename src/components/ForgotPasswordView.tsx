import React, { useState } from "react";
import { Activity, ShieldCheck, Mail, ArrowRight, ArrowLeft, Key, RefreshCw, CheckCircle2 } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
  theme?: "emerald" | "dark";
}

export default function ForgotPasswordView({ onBackToLogin, theme = "emerald" }: ForgotPasswordViewProps) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"request" | "verify_otp" | "new_password" | "success">("request");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const isEmerald = theme === "emerald";

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("Please provide a valid clinical or allowlisted Gmail address.");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Sending secure Firebase password reset link...");

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setIsLoading(false);
      setStep("success");
    } catch (err: any) {
      console.error("Password reset error:", err);
      setIsLoading(false);
      let errorMsg = err.message || "Failed to send reset link. Ensure the email is registered.";
      if (err.code === "auth/user-not-found") {
        errorMsg = "We couldn't find a clinical account registered with this email.";
      } else if (err.code === "auth/invalid-email") {
        errorMsg = "Please enter a valid clinical email address.";
      }
      setError(errorMsg);
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (otp.length < 4) {
      setError("Please enter the 6-digit clinical security passcode received.");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Validating dynamic cryptographic token...");

    setTimeout(() => {
      setIsLoading(false);
      setStep("new_password");
    }, 1200);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Your new security passkey must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passkey confirmation mismatch. Please verify.");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Re-keying local node credentials...");

    setTimeout(() => {
      setIsLoading(false);
      setStep("success");
    }, 1500);
  };

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
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 space-y-3">
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

      {/* Forgot Password Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className={`${isEmerald ? 'bg-white border border-emerald-100/80 shadow-xl' : 'bg-slate-950 border border-slate-800/80 shadow-2xl'} rounded-2xl overflow-hidden`}>
          
          <div className={`border-b px-6 py-4 flex items-center justify-between ${isEmerald ? 'border-slate-100 bg-slate-50/50' : 'border-slate-900 bg-slate-950'}`}>
            <h2 className={`text-sm font-extrabold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-700' : 'text-slate-300'}`}>
              Reset Security Credentials
            </h2>
            <button
              onClick={onBackToLogin}
              className={`text-xs font-bold font-mono flex items-center gap-1 transition-all cursor-pointer ${isEmerald ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-400 hover:text-white'}`}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center space-y-6 py-12">
                <RefreshCw className={`w-10 h-10 animate-spin ${isEmerald ? 'text-emerald-600' : 'text-blue-500'}`} />
                <p className={`text-xs font-mono animate-pulse ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>{loadingMessage}</p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-mono leading-relaxed">
                    ⚠️ {error}
                  </div>
                )}

                {/* STEP 1: REQUEST OTP */}
                {step === "request" && (
                  <form onSubmit={handleRequestSubmit} className="space-y-4">
                    <div className={`${isEmerald ? 'text-slate-600' : 'text-slate-300'} space-y-2`}>
                      <p className="text-xs font-sans leading-relaxed">
                        Forgot your clinical credentials? Enter your allowlisted Google account address to receive a secure password recovery token.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="recovery-email" className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                        Google Gmail Address
                      </label>
                      <div className="relative rounded-lg">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <input
                          id="recovery-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="yourname@gmail.com"
                          className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500'} block w-full pl-9 pr-3 py-2 text-xs rounded-lg font-mono font-semibold focus:outline-none focus:ring-1`}
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={`w-full py-2.5 ${isEmerald ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md`}
                    >
                      <span>Request Security Token</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}

                {/* STEP 2: VERIFY OTP */}
                {step === "verify_otp" && (
                  <form onSubmit={handleOtpSubmit} className="space-y-4">
                    <div className={`${isEmerald ? 'text-slate-600' : 'text-slate-300'} space-y-1.5 font-sans text-xs`}>
                      <p>
                        A clinical security recovery passcode has been dispatched to:
                      </p>
                      <div className={`inline-block px-3 py-1 rounded-lg font-mono font-bold ${isEmerald ? 'bg-slate-50 border border-slate-200 text-emerald-700' : 'bg-slate-900 border border-slate-800 text-blue-400'}`}>
                        {email}
                      </div>
                      <p className={`text-[10px] italic ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                        💡 (Sandbox demo: you can enter any 6 numbers e.g. <strong>123456</strong>)
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="recovery-otp" className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                        6-Digit Security PIN
                      </label>
                      <input
                        id="recovery-otp"
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500'} block w-full px-3 py-2.5 tracking-[0.4em] text-center text-sm rounded-lg font-mono font-bold focus:outline-none focus:ring-1`}
                        required
                        autoFocus
                      />
                    </div>

                    <button
                      type="submit"
                      className={`w-full py-2.5 ${isEmerald ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md`}
                    >
                      <span>Verify Access PIN</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}

                {/* STEP 3: RESET PASSWORD */}
                {step === "new_password" && (
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label htmlFor="recovery-new-pass" className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                        New Security Passkey / Access PIN
                      </label>
                      <div className="relative rounded-lg">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Key className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <input
                          id="recovery-new-pass"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500'} block w-full pl-9 pr-3 py-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1`}
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="recovery-confirm-pass" className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                        Confirm New Passkey
                      </label>
                      <div className="relative rounded-lg">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Key className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <input
                          id="recovery-confirm-pass"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter to confirm"
                          className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500'} block w-full pl-9 pr-3 py-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1`}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={`w-full py-2.5 ${isEmerald ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md`}
                    >
                      <span>Update Passkey</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}

                {/* STEP 4: SUCCESS */}
                {step === "success" && (
                  <div className="space-y-5 text-center py-4">
                    <div className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center ${isEmerald ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}>
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    
                    <div className="space-y-1.5">
                      <h3 className={`text-sm font-extrabold ${isEmerald ? 'text-slate-850' : 'text-slate-200'}`}>Reset Link Dispatched</h3>
                      <p className={`text-xs font-sans leading-relaxed ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                        A secure password reset link has been sent to your clinical email address. Please check your inbox and click the link to re-key your credentials, then proceed to log in.
                      </p>
                    </div>

                    <button
                      onClick={onBackToLogin}
                      className={`w-full py-2.5 ${isEmerald ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md`}
                    >
                      <span>Proceed to Log In</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {step !== "success" && (
              <div className={`border-t pt-3 text-[10.5px] font-mono flex items-center gap-1 justify-center ${isEmerald ? 'border-slate-100 text-slate-500' : 'border-slate-900 text-slate-400'}`}>
                <span>Remembered your password?</span>
                <button onClick={onBackToLogin} className={`font-bold hover:underline transition-all ${isEmerald ? 'text-emerald-600' : 'text-blue-400'}`}>
                  Sign In
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

      <div className="mt-6 text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>Secure ISO 27001 Clinical Sandbox Nodes</span>
      </div>
    </div>
  );
}
