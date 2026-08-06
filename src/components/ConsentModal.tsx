import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, Lock, Globe, Mic, CheckCircle, ArrowRight, ChevronLeft, Shield, X, AlertCircle } from "lucide-react";
import { UserProfile } from "../types";

interface ConsentModalProps {
  isOpen: boolean;
  profile: UserProfile;
  onConsent: (consent: boolean) => void;
  onClose: () => void;
  isFirstCaseTrigger?: boolean;
}

export default function ConsentModal({ isOpen, profile, onConsent, onClose, isFirstCaseTrigger = false }: ConsentModalProps) {
  const [screen, setScreen] = useState<"consent" | "learn-more" | "post-consent">("consent");

  if (!isOpen) return null;

  const handleConsentChoice = (agreed: boolean) => {
    if (agreed) {
      setScreen("post-consent");
    } else {
      onConsent(false);
      onClose();
    }
  };

  const handlePostConsentConfirm = () => {
    onConsent(true);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-lg bg-white dark:bg-[#111c2a] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col my-8"
        >
          {/* Top Banner Accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

          {/* Screen Content */}
          <div className="p-6 md:p-8 flex-1 overflow-y-auto max-h-[85vh]">
            {screen === "consent" && (
              <div className="space-y-6 text-center animate-fade-in">
                {/* Positive State Impact Banner */}
                {isFirstCaseTrigger && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-350 p-4 rounded-2xl text-xs font-medium text-left leading-relaxed flex gap-3 items-start shadow-xs">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-extrabold text-[12px] block text-emerald-700 dark:text-emerald-400 uppercase tracking-wide font-mono mb-0.5">
                        First Completed Case Saved!
                      </strong>
                      "You just saved 15 minutes on that case. Help ErMate get even better for the next doctor."
                    </div>
                  </div>
                )}

                {/* Visual Header / Brand Icon */}
                <div className="mx-auto w-14 h-14 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border border-emerald-500/30 dark:border-emerald-500/40 rounded-2xl flex items-center justify-center shadow-inner">
                  <span className="text-2xl">🇮🇳</span>
                </div>

                {/* Typography */}
                <div className="space-y-2">
                  <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white leading-tight font-sans tracking-tight">
                    Help build Indian emergency medicine's clinical brain
                  </h2>
                  <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-sans font-medium px-2">
                    Every case you document makes ErMate smarter for every Indian ER doctor after you
                  </p>
                </div>

                {/* Three Points */}
                <div className="space-y-3.5 text-left pt-2">
                  {/* Point 1 */}
                  <div className="flex items-start gap-3.5 p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-2xl">
                    <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-lg">🎙️</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide font-mono">
                        Local Speech Context
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 font-sans">
                        Your voice helps ErMate learn Indian medical speech — Malayalam, Hindi, Tamil, and how doctors actually talk
                      </p>
                    </div>
                  </div>

                  {/* Point 2 */}
                  <div className="flex items-start gap-3.5 p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-2xl">
                    <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-lg">🔒</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide font-mono">
                        Identity Anonymisation
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 font-sans">
                        Patient identity is never stored. Only clinical content — symptoms, vitals, diagnoses. Fully anonymised.
                      </p>
                    </div>
                  </div>

                  {/* Point 3 */}
                  <div className="flex items-start gap-3.5 p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-2xl">
                    <div className="w-9 h-9 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-lg">🇮🇳</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide font-mono">
                        Sovereign Indian Data
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 font-sans">
                        Your data stays in India. Google Cloud, Mumbai. Never shared externally.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Learn More link */}
                <div>
                  <button
                    type="button"
                    onClick={() => setScreen("learn-more")}
                    className="text-[11px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400 hover:underline cursor-pointer bg-transparent border-none font-mono inline-flex items-center gap-1"
                  >
                    <span>Learn how this works</span> <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleConsentChoice(true)}
                    className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs md:text-sm rounded-2xl transition-all cursor-pointer shadow-lg shadow-emerald-500/15"
                  >
                    Yes — I'll help build ErMate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConsentChoice(false)}
                    className="w-full py-2.5 px-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold text-xs md:text-sm rounded-2xl transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                  >
                    Not right now
                  </button>
                </div>

                {/* Footer */}
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-4">
                  You can change this anytime in Profile → Settings
                </p>
              </div>
            )}

            {screen === "learn-more" && (
              <div className="space-y-6 animate-fade-in text-left">
                {/* Back Button */}
                <button
                  type="button"
                  onClick={() => setScreen("consent")}
                  className="py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>

                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight font-sans">
                    Data Learning Details
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                    Transparent overview of how de-identified training metadata powers local models safely.
                  </p>
                </div>

                {/* Learn More Grid */}
                <div className="space-y-4 pt-2">
                  {/* Collects vs Never Collects */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="p-4 bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/10 dark:border-emerald-500/20 rounded-2xl">
                      <h4 className="text-[10.5px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-mono mb-2">
                        ✔️ What ErMate Collects
                      </h4>
                      <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-4 font-sans">
                        <li>Your voice recordings</li>
                        <li>The text transcript</li>
                        <li>What fields were extracted</li>
                        <li>Your corrections (if any)</li>
                        <li>The clinical diagnosis</li>
                      </ul>
                    </div>

                    <div className="p-4 bg-rose-500/5 dark:bg-rose-950/10 border border-rose-500/10 dark:border-rose-500/20 rounded-2xl">
                      <h4 className="text-[10.5px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider font-mono mb-2">
                        ❌ What ErMate Never Collects
                      </h4>
                      <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-4 font-sans">
                        <li>Patient name</li>
                        <li>Patient age (removed)</li>
                        <li>Patient address or contact</li>
                        <li>Your personal cases (only anonymised patterns)</li>
                        <li>Any billing information</li>
                      </ul>
                    </div>
                  </div>

                  {/* How it's used */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-2xl space-y-2">
                    <h4 className="text-[10.5px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                      How It's Used
                    </h4>
                    <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-4 font-sans">
                      <li>To train ErMate's voice model to better understand Indian medical speech</li>
                      <li>To build clinical pathways from real Indian ER cases</li>
                      <li>To make differential diagnosis suggestions more accurate for Indian patient populations</li>
                    </ul>
                  </div>

                  {/* Who sees it */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-2xl space-y-1">
                    <h4 className="text-[10.5px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                      Who Sees It
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                      Nobody. It's used only to train AI models inside ErMate. Never sold. Never shared. Never given to any third party.
                    </p>
                  </div>

                  {/* Where it's stored */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-2xl space-y-1">
                    <h4 className="text-[10.5px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                      Where It's Stored
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                      Google Cloud Storage, Mumbai, India (asia-south1). Encrypted at rest and in transit. Only authorized healthcare facility personnel have access.
                    </p>
                  </div>

                  {/* Your rights */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 rounded-2xl space-y-1">
                    <h4 className="text-[10.5px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                      Your Rights
                    </h4>
                    <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-4 font-sans">
                      <li>Turn off anytime in Settings</li>
                      <li>Request deletion by emailing <span className="font-mono underline">support@ermate.app</span></li>
                      <li>Your existing cases are unaffected</li>
                    </ul>
                  </div>
                </div>

                {/* Back Link */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setScreen("consent")}
                    className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-2xl transition-all cursor-pointer"
                  >
                    Return to contribution choice
                  </button>
                </div>
              </div>
            )}

            {screen === "post-consent" && (
              <div className="space-y-6 text-center animate-fade-in py-4">
                {/* Double Ring Check Animation */}
                <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/5 animate-bounce">
                  <CheckCircle className="w-8 h-8" />
                </div>

                <div className="space-y-3.5 max-w-sm mx-auto">
                  <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-white leading-tight font-sans">
                    Thank you, Dr. {profile.name.replace("Dr.", "").trim()}
                  </h3>
                  <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-sans leading-relaxed px-1">
                    You're now part of building Indian emergency medicine's first clinical AI.
                  </p>
                  <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                    Every case you document makes ErMate smarter for every ER doctor in India.
                  </p>
                </div>

                <div className="pt-4 max-w-xs mx-auto">
                  <button
                    type="button"
                    onClick={handlePostConsentConfirm}
                    className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs md:text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10"
                  >
                    <span>Start your shift</span> <ArrowRight className="w-4 h-4 animate-pulse" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
