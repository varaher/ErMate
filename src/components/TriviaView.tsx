import React, { useMemo, useState } from "react";
import { TRIVIA_QUESTIONS } from "../data/trivia";
import { PROTOCOL_CHAPTERS, allProtocolTopics } from "../data/protocols";
import { generateQuestions, QUIZ_KIND_LABEL, QuizKind } from "../lib/protocolQuiz";
import { AlertCircle, CheckCircle2, RefreshCcw, HelpCircle, Trophy, BookOpen, Sparkles, Library } from "lucide-react";

/** One question as the screen shows it, whether it is a fixed board question or made from the ER Guide. */
interface Card {
  id: string;
  prompt: string;
  label: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  teachingPoint?: string;
  /** Guide questions only */
  source?: string;
  draft?: boolean;
}

const boardCards = (): Card[] =>
  TRIVIA_QUESTIONS.map((q) => ({
    id: q.id, prompt: q.vignette, label: "Clinical Vignette", options: q.options, correctIndex: q.correctIndex,
    explanation: q.explanation, teachingPoint: q.teachingPoint,
  }));

type Scope = "all" | "adult" | "paediatric" | string; // or a topic id

export default function TriviaView() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [mode, setMode] = useState<"board" | "guide">("board");
  const [scope, setScope] = useState<Scope>("all");
  const [count, setCount] = useState(10);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<Card[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  const topics = useMemo(() => allProtocolTopics(), []);
  const activeQuestion = cards ? cards[currentIndex] : null;

  const reset = () => {
    setCurrentIndex(0); setSelectedOptionIndex(null); setIsAnswered(false); setScore(0); setMissed([]); setShowSummary(false);
  };

  const startBoard = () => { reset(); setMode("board"); setCards(boardCards()); };
  const startGuide = () => {
    const opts: { count: number; seed: number; population?: "adult" | "paediatric"; topicId?: string; kinds?: QuizKind[] } = {
      count, seed: Math.floor(Math.random() * 2147483000) + 1,
    };
    if (scope === "adult" || scope === "paediatric") opts.population = scope;
    else if (scope !== "all") opts.topicId = scope;
    const qs = generateQuestions(topics, opts).map<Card>((q) => ({
      id: q.id, prompt: q.prompt, label: QUIZ_KIND_LABEL[q.kind], options: q.options, correctIndex: q.correctIndex,
      explanation: q.explanation, source: q.source, draft: q.status === "draft",
    }));
    reset(); setMode("guide"); setCards(qs);
  };

  const handleOptionSelect = (index: number) => {
    if (isAnswered || !activeQuestion) return;
    setSelectedOptionIndex(index);
    setIsAnswered(true);
    if (index === activeQuestion.correctIndex) setScore((p) => p + 1);
    else setMissed((m) => [...m, activeQuestion]);
  };

  const handleNext = () => {
    setSelectedOptionIndex(null);
    setIsAnswered(false);
    if (cards && currentIndex + 1 < cards.length) setCurrentIndex((p) => p + 1);
    else setShowSummary(true);
  };

  const getRankBadge = (s: number, total: number) => {
    const ratio = total ? s / total : 0;
    if (ratio >= 0.9) return { rank: "EM Chief Resident / Attending", desc: "Expert algorithm precision. Outstanding clinical triage speeds." };
    if (ratio >= 0.7) return { rank: "Senior Emergency Physician", desc: "Solid differential reasoning. Great grasp of standard-of-care protocols." };
    if (ratio >= 0.5) return { rank: "Junior EM Resident", desc: "Promising. Review the topics you missed in the ER Guide." };
    return { rank: "Clinical Trainee", desc: "Keep practicing. Read the ER Guide topics listed below, then try again." };
  };

  // ---- Start screen ----
  if (!cards) {
    return (
      <div className="max-w-3xl mx-auto space-y-5" id="trivia-container">
        <div className="border-b pb-3">
          <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-500" /> Trivia Time
          </h1>
          <p className="text-xs text-slate-400">Choose how you want to be quizzed.</p>
        </div>

        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3" data-testid="trivia-guide-start">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
            <Library className="w-4 h-4 text-purple-600" /> Quiz from the ER Guide
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            New questions every time, made from the Handbook text: first 10 minutes, critical steps, pitfalls, differentials, investigations, disposition. The right answer is always the Handbook's own wording. Free and instant.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              data-testid="trivia-scope"
              aria-label="Quiz scope"
              className="flex-1 min-w-0 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
            >
              <option value="all">All topics</option>
              <option value="adult">Adult topics only</option>
              <option value="paediatric">Paediatric topics only</option>
              {PROTOCOL_CHAPTERS.map((ch) => (
                <optgroup key={ch.id} label={ch.title}>
                  {ch.topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </optgroup>
              ))}
            </select>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              data-testid="trivia-count"
              aria-label="Number of questions"
              className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
            >
              {[5, 10, 20].map((n) => <option key={n} value={n}>{n} questions</option>)}
            </select>
            <button
              type="button"
              onClick={startGuide}
              data-testid="trivia-guide-go"
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Start quiz
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3" data-testid="trivia-board-start">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
            <HelpCircle className="w-4 h-4 text-blue-500" /> ER Clinical Board Trivia
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {TRIVIA_QUESTIONS.length} fixed clinical vignettes with teaching points.
          </p>
          <button
            type="button"
            onClick={startBoard}
            data-testid="trivia-board-go"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg"
          >
            Start board questions
          </button>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 text-center" id="trivia-container">
        <p className="text-sm text-slate-600 dark:text-slate-300">The ER Guide does not have enough written material on that topic to make a quiz yet. Choose another scope.</p>
        <button type="button" onClick={() => setCards(null)} className="px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg">Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6" id="trivia-container">
      {!showSummary && activeQuestion ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-500" />
                {mode === "guide" ? "ER Guide Quiz" : "ER Clinical Board Trivia"}
              </h1>
              <p className="text-xs text-slate-400">
                {mode === "guide" ? "Questions made from the Handbook text." : "Sharpen your diagnosis speeds under simulated board clinical vignettes."}
              </p>
            </div>
            <div className="text-right text-xs font-mono font-bold text-slate-500 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-full border">
              Card {currentIndex + 1} of {cards.length}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 md:p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span data-testid="trivia-kind" className="text-[10px] bg-slate-50 dark:bg-slate-900 border text-slate-400 font-bold px-2 py-0.5 rounded-full tracking-wider font-mono uppercase">
                {activeQuestion.label}
              </span>
              {activeQuestion.draft && (
                <span data-testid="trivia-draft" className="text-[10px] bg-amber-50 border border-amber-300 text-amber-800 font-bold px-2 py-0.5 rounded-full tracking-wider uppercase">
                  Draft topic, not yet signed off
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed font-mono" data-testid="trivia-prompt">
              {activeQuestion.prompt}
            </p>
          </div>

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
                  data-testid="trivia-option"
                  className={`w-full text-left p-4 rounded-xl border text-xs font-medium leading-relaxed transition-all flex justify-between items-center gap-3 ${
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

          {isAnswered && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700 dark:text-slate-300">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  {activeQuestion.teachingPoint ? <>Teaching Point: <span className="font-semibold">{activeQuestion.teachingPoint}</span></> : <>From the ER Guide{activeQuestion.source ? `: ${activeQuestion.source}` : ""}</>}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono" data-testid="trivia-explanation">
                  {activeQuestion.explanation}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  data-testid="trivia-next"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  {currentIndex + 1 < cards.length ? "Next Question" : "See result"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
          <div className="text-center space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-full w-fit mx-auto">
              <Trophy className="w-12 h-12 text-blue-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl md:text-2xl font-extrabold font-display text-slate-900 dark:text-white">Trivia Session Complete!</h2>
              <p className="text-xs text-slate-400 font-mono" data-testid="trivia-score">
                You answered {score} out of {cards.length} clinical questions correctly.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border p-5 rounded-xl max-w-md mx-auto space-y-2">
              <span className="text-[9px] font-bold tracking-wider uppercase bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2.5 py-0.5 rounded-full">Assigned Clinical Rank</span>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white font-display">{getRankBadge(score, cards.length).rank}</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-mono">{getRankBadge(score, cards.length).desc}</p>
            </div>
          </div>

          {missed.length > 0 && (
            <div className="space-y-2" data-testid="trivia-missed">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">To review ({missed.length})</h4>
              {missed.map((m) => (
                <div key={m.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">{m.prompt}</p>
                  <p className="text-emerald-700 dark:text-emerald-400">Answer: {m.options[m.correctIndex]}</p>
                  {m.source && <p className="text-slate-400">ER Guide › {m.source}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              onClick={mode === "guide" ? startGuide : startBoard}
              data-testid="trivia-again"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> {mode === "guide" ? "New questions" : "Restart Trivia"}
            </button>
            <button
              onClick={() => { reset(); setCards(null); }}
              data-testid="trivia-menu"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg"
            >
              Change quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}