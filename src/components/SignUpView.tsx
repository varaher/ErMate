import React, { useState } from "react";
import { Activity, User, Building, ShieldCheck, ArrowRight, ArrowLeft, Mail, Key, Sparkles } from "lucide-react";
import { UserProfile } from "../types";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";

interface SignUpViewProps {
  onSignUp: (profile: UserProfile) => void;
  onBackToLogin: () => void;
  theme?: "emerald" | "dark";
}

export default function SignUpView({ onSignUp, onBackToLogin, theme = "emerald" }: SignUpViewProps) {
  const [name, setName] = useState("");
  const [age, setAge] = useState<string>("");
  const [hospital, setHospital] = useState("");
  const [role, setRole] = useState<"Resident" | "Consultant" | "HOD">("Resident");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subscription, setSubscription] = useState<"Free Trial" | "Pro Doctor" | "Team Department">("Free Trial");
  
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("Registering new clinical node...");

  const isEmerald = theme === "emerald";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your full professional name.");
      return;
    }
    
    const parsedAge = parseInt(age);
    if (!age || isNaN(parsedAge) || parsedAge <= 18 || parsedAge > 100) {
      setError("Please enter a valid age (19-100).");
      return;
    }

    if (!hospital.trim()) {
      setError("Please specify your current active hospital name.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }

    if (email.toLowerCase().includes("@") && !email.toLowerCase().endsWith("@gmail.com")) {
      setError("For hospital auto-linking, we recommend a verified Google account (@gmail.com).");
      return;
    }

    if (!password.trim() || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    // High fidelity registration animation
    setIsRegistering(true);
    
    const messages = [
      { delay: 400, msg: "Allocating private local database shard..." },
      { delay: 800, msg: "Registering Google whitelists for department sharing..." },
      { delay: 1200, msg: "Preparing custom subscription plan..." },
      { delay: 1600, msg: "Signing certificates and securing clinical node..." }
    ];

    messages.forEach((step) => {
      setTimeout(() => {
        setRegisterMessage(step.msg);
      }, step.delay);
    });

    // Run Firebase Authentication user registration
    const registerUser = async () => {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
        const user = userCredential.user;

        // Determine the precise display subscription tier based on user selection
        let subTier = "Free Standard";
        let credits = 100;
        if (subscription === "Pro Doctor") {
          subTier = "Pro Doctor Plan (Active)";
          credits = 250;
        } else if (subscription === "Team Department") {
          subTier = "Team Department (Activated)";
          credits = 500;
        }

        const formattedName = name.trim().startsWith("Dr.") ? name.trim() : `Dr. ${name.trim()}`;
        const newProfile: UserProfile = {
          name: formattedName,
          email: email.trim().toLowerCase(),
          role: role === "HOD" ? "HOD / Shift Lead" : role === "Consultant" ? "Senior Consultant" : "EM Resident",
          hospital: hospital.trim(),
          aiCredits: credits,
          streak: 1, // new user streak starts at 1
          subscriptionTier: subTier,
          age: parsedAge
        };

        // Write user profile to firestore
        await setDoc(doc(db, "users", user.uid), newProfile);

        // Success callback
        onSignUp(newProfile);
      } catch (err: any) {
        setIsRegistering(false);
        let errorMsg = err.message || String(err);
        if (err.code === "auth/email-already-in-use") {
          errorMsg = "This clinical email address is already registered in ErMate.";
        } else if (err.code === "auth/invalid-email") {
          errorMsg = "Please enter a valid email address.";
        } else if (err.code === "auth/weak-password") {
          errorMsg = "The password is too weak. Please choose at least 6 characters.";
        }
        setError(errorMsg);
      }
    };

    setTimeout(() => {
      registerUser();
    }, 2200);
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

      {/* Register/Sign Up Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className={`${isEmerald ? 'bg-white border border-emerald-100/80 shadow-xl' : 'bg-slate-950 border border-slate-800/80 shadow-2xl'} rounded-2xl overflow-hidden`}>
          
          <div className={`border-b px-6 py-4 flex items-center justify-between ${isEmerald ? 'border-slate-100 bg-slate-50/50' : 'border-slate-900 bg-slate-950'}`}>
            <h2 className={`text-sm font-extrabold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-700' : 'text-slate-300'}`}>
              Create Doctor Account
            </h2>
            <button
              onClick={onBackToLogin}
              className={`text-xs font-bold font-mono flex items-center gap-1 transition-all cursor-pointer ${isEmerald ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-400 hover:text-white'}`}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Log In
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            {isRegistering ? (
              <div className="flex flex-col items-center justify-center space-y-6 py-12">
                <div className="relative w-16 h-16">
                  <div className={`absolute inset-0 rounded-full border-4 ${isEmerald ? 'border-slate-100' : 'border-slate-800'}`} />
                  <div className={`absolute inset-0 rounded-full border-4 ${isEmerald ? 'border-emerald-600' : 'border-blue-500'} border-t-transparent animate-spin`} />
                </div>
                <div className="text-center space-y-2">
                  <h3 className={`text-sm font-extrabold ${isEmerald ? 'text-slate-850' : 'text-slate-200'}`}>Creating Secure Node</h3>
                  <p className={`text-xs font-mono animate-pulse ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                    {registerMessage}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Error Banner */}
                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-mono leading-relaxed">
                    ⚠️ {error}
                  </div>
                )}

                {/* Name */}
                <div className="space-y-1">
                  <label htmlFor="signup-name" className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                    Full Name (e.g. Vipin Kumar)
                  </label>
                  <div className="relative rounded-lg">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Dr. Rajesh Patel"
                      className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500'} block w-full pl-9 pr-3 py-2 text-xs rounded-lg font-sans font-semibold focus:outline-none focus:ring-1`}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Age */}
                  <div className="space-y-1">
                    <label htmlFor="signup-age" className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                      Age (Years)
                    </label>
                    <input
                      id="signup-age"
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="e.g. 34"
                      min="19"
                      max="100"
                      className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500'} block w-full px-3 py-2 text-xs rounded-lg font-mono font-semibold focus:outline-none focus:ring-1`}
                      required
                    />
                  </div>

                  {/* Hospital Designation Role */}
                  <div className="space-y-1">
                    <label htmlFor="signup-role" className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                      Designation Role
                    </label>
                    <select
                      id="signup-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500'} block w-full px-2 py-2 text-xs rounded-lg font-bold focus:outline-none focus:ring-1`}
                    >
                      <option value="Resident">EM Resident</option>
                      <option value="Consultant">Senior Consultant</option>
                      <option value="HOD">HOD / Shift Lead</option>
                    </select>
                  </div>
                </div>

                {/* Hospital Name */}
                <div className="space-y-1">
                  <label htmlFor="signup-hospital" className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                    Hospital Name
                  </label>
                  <div className="relative rounded-lg">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <input
                      id="signup-hospital"
                      type="text"
                      value={hospital}
                      onChange={(e) => setHospital(e.target.value)}
                      placeholder="Varah Group Emergency Care"
                      className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500'} block w-full pl-9 pr-3 py-2 text-xs rounded-lg font-sans font-semibold focus:outline-none focus:ring-1`}
                      required
                    />
                  </div>
                </div>

                {/* Gmail Address */}
                <div className="space-y-1">
                  <label htmlFor="signup-email" className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                    Verified Google Account Gmail
                  </label>
                  <div className="relative rounded-lg">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="yourname@gmail.com"
                      className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500'} block w-full pl-9 pr-3 py-2 text-xs rounded-lg font-mono font-semibold focus:outline-none focus:ring-1`}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label htmlFor="signup-password" className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                    Security Passkey / Password
                  </label>
                  <div className="relative rounded-lg">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${isEmerald ? 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500'} block w-full pl-9 pr-3 py-2 text-xs rounded-lg font-mono focus:outline-none focus:ring-1`}
                      required
                    />
                  </div>
                </div>

                {/* Subscription Tier Picker */}
                <div className="space-y-1.5 pt-1">
                  <label className={`block text-[9px] font-bold uppercase tracking-wider font-mono ${isEmerald ? 'text-slate-500' : 'text-slate-400'}`}>
                    Choose Subscription Tier
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSubscription("Free Trial")}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        subscription === "Free Trial"
                          ? isEmerald
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                            : "bg-blue-950/40 border-blue-500 text-blue-400"
                          : isEmerald
                            ? "bg-slate-50/50 border-slate-200 text-slate-500 hover:text-slate-700"
                            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      <p className="text-[10px] font-bold">Free Trial</p>
                      <span className="text-[8px] font-mono block mt-0.5">100 Scribes</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubscription("Pro Doctor")}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        subscription === "Pro Doctor"
                          ? isEmerald
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                            : "bg-blue-950/40 border-blue-500 text-blue-400"
                          : isEmerald
                            ? "bg-slate-50/50 border-slate-200 text-slate-500 hover:text-slate-700"
                            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      <p className="text-[10px] font-bold flex items-center justify-center gap-0.5">
                        Pro Doctor <Sparkles className="w-2.5 h-2.5 text-emerald-500" />
                      </p>
                      <span className="text-[8px] font-mono block mt-0.5">₹999 / mo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubscription("Team Department")}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        subscription === "Team Department"
                          ? isEmerald
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                            : "bg-blue-950/40 border-blue-500 text-blue-400"
                          : isEmerald
                            ? "bg-slate-50/50 border-slate-200 text-slate-500 hover:text-slate-700"
                            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      <p className="text-[10px] font-bold">Team License</p>
                      <span className="text-[8px] font-mono block mt-0.5">Custom / Roster</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full py-2.5 ${isEmerald ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md`}
                >
                  <span>Register & Authenticate Node</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

              </form>
            )}

            <div className={`border-t pt-3 text-[10.5px] font-mono flex items-center gap-2 justify-center ${isEmerald ? 'border-slate-100 text-slate-500' : 'border-slate-900 text-slate-400'}`}>
              <span>Already have an ErMate credential?</span>
              <button onClick={onBackToLogin} className={`font-bold hover:underline transition-all ${isEmerald ? 'text-emerald-600' : 'text-blue-400'}`}>
                Sign In
              </button>
            </div>

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
