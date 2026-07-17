import React, { useState } from "react";
import { TRIVIA_QUESTIONS, TriviaQuestion } from "../data/trivia";
import { AlertCircle, CheckCircle2, RefreshCcw, Sparkles, HelpCircle, Trophy, BookOpen } from "lucide-react";

export default function TriviaView() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  const activeQuestion = TRIVIA_QUESTIONS[currentIndex];

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOptionIndex(index);
    setIsAnswered(true);

    if (index === activeQuestion.correctIndex) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    setSelectedOptionIndex(null);
    setIsAnswered(false);

    if (currentIndex + 1 < TRIVIA_QUESTIONS.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowSummary(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOptionIndex(null);
    setIsAnswered(false);
    setScore(0);
    setShowSummary(false);
  };

  // Get professional rank badge based on score
  const getRankBadge = (s: number) => {
    const total = TRIVIA_QUESTIONS.length;
    const ratio = s / total;
    if (ratio >= 0.9) return { rank: "EM Chief Resident / Attending", desc: "Expert algorithm precision. Outstanding clinical triage speeds." };
    if (ratio >= 0.7) return { rank: "Senior Emergency Physician", desc: "Solid differential reasoning. Great grasp of standard-of-care protocols." };
    if (ratio >= 0.5) return { rank: "Junior EM Resident", desc: "Promising. Review PALS dosage metrics and chest trauma clinical indicators." };
    return { rank: "Clinical Trainee", desc: "Keep practicing. Read the detailed ErMate User Guide modules for comprehensive training." };
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" id="trivia-container">
      {/* Active Game Layout */}
      {!showSummary ? (
        <div className="space-y-6">
          
          {/* Top progress metrics */}
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-500" />
                ER Clinical Board Trivia
              </h1>
              <p className="text-xs text-slate-400">
                Sharpen your diagnosis speeds under simulated board clinical vignettes.
              </p>
            </div>

            <div className="text-right text-xs font-mono font-bold text-slate-500 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-full border">
              Card {currentIndex + 1} of {TRIVIA_QUESTIONS.length}
            </div>
          </div>

          {/* Vignette Card */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 md:p-6 rounded-2xl shadow-sm space-y-4">
            <span className="text-[10px] bg-slate-50 dark:bg-slate-900 border text-slate-400 font-bold px-2 py-0.5 rounded-full tracking-wider font-mono uppercase">
              Clinical Vignette
            </span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed font-mono">
              {activeQuestion.vignette}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {activeQuestion.options.map((opt, idx) => {
              const isSelected = selectedOptionIndex === idx;
              const isCorrect = idx === activeQuestion.correctIndex;
              const revealCorrect = isAnswered && isCorrect;
              const revealWrong = isAnswered && isSelected && !isCorrect;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleOptionSelect(idx)}
                  className={`w-full text-left p-4 rounded-xl border text-xs font-medium leading-relaxed transition-all flex justify-between items-center ${
                    revealCorrect
                      ? "bg-emerald-50 border-emerald-400 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                      : revealWrong
                      ? "bg-rose-50 border-rose-400 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400"
                      : isSelected
                      ? "border-blue-500 bg-blue-50/20 text-slate-800 dark:text-white"
                      : isAnswered
                      ? "bg-slate-50/50 border-slate-200 opacity-60 text-slate-400 dark:bg-slate-900/40"
                      : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/5 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span>{opt}</span>
                  {revealCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {revealWrong && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Explanation Banner */}
          {isAnswered && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700 dark:text-slate-300">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  Teaching Point: <span className="font-semibold">{activeQuestion.teachingPoint}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
                  {activeQuestion.explanation}
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                >
                  Next Question
                </button>
              </div>
            </div>
          )}

        </div>
      ) : (
        // Score Summary Screen
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm text-center space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-full w-fit mx-auto">
            <Trophy className="w-12 h-12 text-blue-600 animate-pulse-slow" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-extrabold font-display text-slate-900 dark:text-white">
              Trivia Session Complete!
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              You answered {score} out of {TRIVIA_QUESTIONS.length} clinical questions correctly.
            </p>
          </div>

          {/* Badge Display */}
          <div className="bg-slate-50 dark:bg-slate-900 border p-5 rounded-xl max-w-md mx-auto space-y-2">
            <span className="text-[9px] font-bold tracking-wider uppercase bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2.5 py-0.5 rounded-full">
              Assigned Clinical Rank
            </span>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-white font-display">
              {getRankBadge(score).rank}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-mono">
              {getRankBadge(score).desc}
            </p>
          </div>

          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={handleRestart}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> Restart Trivia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
