import React, { useState } from "react";
import { Play, RotateCcw, AlertCircle, CheckCircle, ChevronRight, BookOpen, Star, Sparkles } from "lucide-react";
import { SIMULATION_CASES, SimulationCase, SimulationStep } from "../data/simulations";

export default function SimulationsView() {
  const [selectedCase, setSelectedCase] = useState<SimulationCase | null>(null);
  const [currentStepId, setCurrentStepId] = useState<string>("start");
  const [score, setScore] = useState<number>(100); // start with base 100
  const [history, setHistory] = useState<{ stepId: string; choiceText: string; feedback: string; scoreChange: number }[]>([]);
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; positive: boolean } | null>(null);

  const startCase = (c: SimulationCase) => {
    setSelectedCase(c);
    setCurrentStepId("start");
    setScore(100);
    setHistory([]);
    setSelectedChoiceIndex(null);
    setIsCompleted(false);
    setFeedbackMessage(null);
  };

  const handleChoiceSelect = (index: number) => {
    if (selectedChoiceIndex !== null || !selectedCase) return;
    
    setSelectedChoiceIndex(index);
    const step = selectedCase.steps[currentStepId];
    const choice = step.options[index];

    // Update score and message
    setScore(prev => prev + choice.scoreChange);
    setFeedbackMessage({
      text: choice.feedback,
      positive: choice.scoreChange >= 0
    });

    // Record history
    setHistory(prev => [
      ...prev,
      {
        stepId: currentStepId,
        choiceText: choice.text,
        feedback: choice.feedback,
        scoreChange: choice.scoreChange
      }
    ]);
  };

  const proceedToNextStep = () => {
    if (!selectedCase || selectedChoiceIndex === null) return;

    const step = selectedCase.steps[currentStepId];
    const choice = step.options[selectedChoiceIndex];
    const nextId = choice.nextStepId;

    setSelectedChoiceIndex(null);
    setFeedbackMessage(null);

    if (nextId.startsWith("simulation_end")) {
      setCurrentStepId(nextId);
      setIsCompleted(true);
    } else {
      setCurrentStepId(nextId);
    }
  };

  const resetCase = () => {
    if (selectedCase) {
      startCase(selectedCase);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="simulations-container">
      {/* List / Selector */}
      {!selectedCase ? (
        <div className="space-y-4">
          <div className="border-b pb-3">
            <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white">
              Interactive Clinical Simulator
            </h1>
            <p className="text-xs text-slate-400">
              Test your standard-of-care ATLS and PALS emergency response speed, patient triage, and critical care algorithms.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SIMULATION_CASES.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      c.difficulty === "Beginner"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                        : c.difficulty === "Intermediate"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                    }`}>
                      {c.difficulty}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">100 Base Score</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-800 dark:text-white font-display">
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {c.description}
                  </p>

                  {/* Base Vitals preview */}
                  <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850 grid grid-cols-5 gap-1.5 text-center text-[10px] font-mono text-slate-500">
                    <div>
                      <span className="block font-bold text-slate-400">BP</span>
                      <span className="font-semibold">{c.vitals.bp}</span>
                    </div>
                    <div>
                      <span className="block font-bold text-slate-400">HR</span>
                      <span className="font-semibold">{c.vitals.hr}</span>
                    </div>
                    <div>
                      <span className="block font-bold text-slate-400">SpO2</span>
                      <span className="font-semibold">{c.vitals.spo2}%</span>
                    </div>
                    <div>
                      <span className="block font-bold text-slate-400">RR</span>
                      <span className="font-semibold">{c.vitals.rr}</span>
                    </div>
                    <div>
                      <span className="block font-bold text-slate-400">Temp</span>
                      <span className="font-semibold">{c.vitals.temp}°F</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => startCase(c)}
                  className="mt-5 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Initiate Scenario
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Active Simulation Play Space
        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between border-b pb-3">
            <button
              onClick={() => setSelectedCase(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all uppercase"
            >
              ← Scenarios List
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full font-bold">
                Clinical Score: <span className="text-blue-600 dark:text-blue-400 font-extrabold">{score}</span>
              </span>
              <button
                onClick={resetCase}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
                title="Restart Scenario"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Decision Board */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Scenario Context */}
              <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-5 rounded-xl shadow-sm space-y-2">
                <span className="text-[10px] font-bold tracking-wider uppercase bg-white/10 px-2 py-0.5 rounded">Active Case Briefing</span>
                <h2 className="text-lg font-bold font-display leading-tight">{selectedCase.title}</h2>
                <p className="text-xs text-blue-100 leading-relaxed font-mono pt-1">{selectedCase.initialState}</p>
              </div>

              {/* Active Step */}
              {!isCompleted ? (
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 md:p-6 rounded-xl shadow-sm space-y-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Clinical Decision Point</span>
                  <p className="text-sm font-bold text-slate-850 dark:text-slate-100">
                    {selectedCase.steps[currentStepId]?.text}
                  </p>

                  <div className="space-y-2.5 pt-2">
                    {selectedCase.steps[currentStepId]?.options.map((option, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={selectedChoiceIndex !== null}
                        onClick={() => handleChoiceSelect(idx)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs font-medium leading-relaxed transition-all flex justify-between items-center ${
                          selectedChoiceIndex === idx
                            ? option.scoreChange >= 0
                              ? "bg-emerald-50/50 border-emerald-400 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : "bg-rose-50/50 border-rose-400 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400"
                            : selectedChoiceIndex !== null
                            ? "bg-slate-50 border-slate-200 opacity-60 text-slate-400 dark:bg-slate-900/40"
                            : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/5 dark:hover:bg-blue-950/10 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span>{option.text}</span>
                        {selectedChoiceIndex === idx && (
                          <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded ${
                            option.scoreChange >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {option.scoreChange >= 0 ? "+" : ""}{option.scoreChange}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Instant Feedback / Proceed */}
                  {feedbackMessage && (
                    <div className={`p-4 rounded-xl border space-y-3 animate-fade-in ${
                      feedbackMessage.positive
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400"
                        : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400"
                    }`}>
                      <p className="text-xs leading-relaxed font-mono">
                        {feedbackMessage.text}
                      </p>
                      <div className="flex justify-end">
                        <button
                          onClick={proceedToNextStep}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
                        >
                          Proceed
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Debrief / Completion Screen
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm space-y-5">
                  <div className="text-center space-y-2">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-full w-fit mx-auto">
                      <Sparkles className="w-10 h-10 text-blue-600 animate-pulse-slow" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white font-display">
                      {selectedCase.steps[currentStepId]?.text}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">Scenario concluded with a final clinical score of {score}</p>
                  </div>

                  {/* Debrief Content */}
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border space-y-2 text-xs leading-relaxed">
                    <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-blue-500" /> Clinical Debrief & Guideline Key Points
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400 font-mono">
                      {selectedCase.debrief}
                    </p>
                  </div>

                  <div className="flex justify-center gap-2 pt-2">
                    <button
                      onClick={resetCase}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => setSelectedCase(null)}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
                    >
                      Browse Other Cases
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Vitals & History tracking Sidebar */}
            <div className="space-y-4">
              
              {/* Current Patient Vitals monitor panel */}
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm space-y-3 text-xs">
                <h4 className="font-bold text-slate-400 uppercase tracking-wider">Patient Vitals</h4>
                <div className="grid grid-cols-2 gap-2 font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                  <div>BP: <strong className="text-slate-700 dark:text-slate-300">{selectedCase.vitals.bp}</strong></div>
                  <div>HR: <strong className="text-slate-700 dark:text-slate-300">{selectedCase.vitals.hr} bpm</strong></div>
                  <div>SpO2: <strong className="text-slate-700 dark:text-slate-300">{selectedCase.vitals.spo2}%</strong></div>
                  <div>RR: <strong className="text-slate-700 dark:text-slate-300">{selectedCase.vitals.rr} /min</strong></div>
                  <div className="col-span-2 border-t pt-1.5 mt-1.5">Temp: <strong className="text-slate-700 dark:text-slate-300">{selectedCase.vitals.temp} °F</strong></div>
                </div>
              </div>

              {/* Progress Steps history log */}
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm space-y-3 text-xs">
                <h4 className="font-bold text-slate-400 uppercase tracking-wider">Action Logs</h4>
                {history.length === 0 ? (
                  <p className="text-slate-400 font-medium">No actions taken yet.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
                    {history.map((hist, idx) => (
                      <div key={idx} className="border-l-2 border-blue-500 pl-2 py-0.5 space-y-0.5 font-mono text-[11px]">
                        <p className="text-slate-750 dark:text-slate-300 truncate">{hist.choiceText}</p>
                        <span className={`text-[10px] font-bold ${hist.scoreChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {hist.scoreChange >= 0 ? "+" : ""}{hist.scoreChange} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
