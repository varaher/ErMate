import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CoachStep, TourId, tourForTab, unseenSteps, markTourSeen, markAllToursSeen, COACH_REQUEST_EVENT } from "../lib/coachTours";

/**
 * CoachMarks - one-time pointer walkthrough per page (spotlight + Next / Back / Skip).
 * Presentation only: reads the DOM to find the target, stores one flag per page per doctor on this device.
 * Mounted once in App.tsx. Never opens while a case, form, or dialog is open (`blocked`).
 */

interface Props {
  activeTab: string;
  email?: string | null;
  /** True while any case, form, modal or full-screen flow is open. */
  blocked: boolean;
}

const PAD = 6;
const DELAY_MS = 900;

function isVisible(el: Element): boolean {
  const r = (el as HTMLElement).getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const cs = window.getComputedStyle(el as HTMLElement);
  return cs.visibility !== "hidden" && cs.display !== "none";
}

export function findTarget(step: CoachStep): HTMLElement | null {
  if (!step.target) return null;
  let list: Element[] = [];
  try { list = Array.from(document.querySelectorAll(step.target.sel)); } catch { return null; }
  const text = step.target.text?.toLowerCase();
  for (const el of list) {
    if (text && !(el.textContent || "").toLowerCase().includes(text)) continue;
    if (isVisible(el)) return el as HTMLElement;
  }
  return null;
}

export default function CoachMarks({ activeTab, email, blocked }: Props) {
  const [tour, setTour] = useState<TourId | null>(null);
  const [steps, setSteps] = useState<CoachStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [tipTop, setTipTop] = useState(0);
  const [placement, setPlacement] = useState<"below" | "above" | "center">("center");
  const [arrowX, setArrowX] = useState(40);
  const tipRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    if (tour) markTourSeen(email, tour);
    setTour(null);
    setSteps([]);
  }, [tour, email]);

  // Open a tour if this doctor has unseen steps for it. Returning doctors only get the newer steps.
  const tryOpen = useCallback((id: TourId) => {
    const usable = unseenSteps(email, id).filter((s) => !s.target || findTarget(s));
    if (usable.length === 0) return false; // nothing new, or page not rendered yet: try again on the next visit
    setSteps(usable);
    setIndex(0);
    setTour(id);
    return true;
  }, [email]);

  // Decide whether to open a tour for this page.
  useEffect(() => {
    if (blocked) { setTour(null); setSteps([]); return; }
    const id = tourForTab(activeTab);
    if (!id || unseenSteps(email, id).length === 0) { setTour(null); setSteps([]); return; }
    const timer = window.setTimeout(() => { tryOpen(id); }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeTab, email, blocked, tryOpen]);

  // Pages that are not tabs (the Protocols reader) can request their own tour.
  useEffect(() => {
    if (blocked) return;
    let timer = 0;
    const onRequest = (e: Event) => {
      const id = (e as CustomEvent).detail as TourId;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (!tour) tryOpen(id); }, DELAY_MS);
    };
    window.addEventListener(COACH_REQUEST_EVENT, onRequest);
    return () => { window.removeEventListener(COACH_REQUEST_EVENT, onRequest); window.clearTimeout(timer); };
  }, [blocked, tour, tryOpen]);

  const step = tour ? steps[index] : undefined;

  const measure = useCallback(() => {
    if (!step) return;
    const el = findTarget(step);
    const vw = window.innerWidth, vh = window.innerHeight;
    const tipH = tipRef.current?.offsetHeight ?? 190;
    if (!el) {
      setRect(null);
      setPlacement("center");
      setTipTop(Math.max(12, (vh - tipH) / 2));
      return;
    }
    const r = el.getBoundingClientRect();
    const box = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
    setRect(box);
    const below = box.y + box.h + tipH + 20 <= vh - 8;
    const above = box.y - tipH - 20 >= 8;
    if (below || !above) {
      setPlacement("below");
      setTipTop(Math.min(box.y + box.h + 14, Math.max(8, vh - tipH - 8)));
    } else {
      setPlacement("above");
      setTipTop(Math.max(8, box.y - tipH - 14));
    }
    const tipW = Math.min(340, vw - 24);
    const tipLeft = (vw - tipW) / 2;
    setArrowX(Math.max(24, Math.min(box.x + box.w / 2 - tipLeft, tipW - 24)));
  }, [step]);

  // Scroll the target into view, then measure.
  useLayoutEffect(() => {
    if (!step) return;
    const el = findTarget(step);
    if (el) { try { el.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" }); } catch { /* ignore */ } }
    measure();
    const t1 = window.setTimeout(measure, 120);
    const t2 = window.setTimeout(measure, 400);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [step, measure]);

  useEffect(() => {
    if (!tour) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); };
  }, [tour, measure]);

  useEffect(() => {
    if (!tour) return;
    nextRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, index, steps.length]);

  function goNext() {
    if (index >= steps.length - 1) close();
    else setIndex(index + 1);
  }

  if (!tour || !step) return null;
  const last = index === steps.length - 1;
  const tipW = Math.min(340, (typeof window !== "undefined" ? window.innerWidth : 360) - 24);

  return (
    <div className="fixed inset-0 z-[300] no-print" role="dialog" aria-modal="true" aria-label="ErMate page tips" data-testid="coach-marks">
      {/* blocks taps on the page behind while a tip is open */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <div
          className="absolute pointer-events-none rounded-2xl motion-reduce:transition-none transition-all duration-300"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, boxShadow: "0 0 0 9999px rgba(15,10,35,0.72)" }}
        >
          <span className="absolute -inset-1 rounded-[20px] border-2 border-white/90 motion-safe:animate-pulse" />
        </div>
      ) : (
        <div className="absolute inset-0 pointer-events-none bg-slate-950/70" />
      )}
      <div
        ref={tipRef}
        className="absolute bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 motion-reduce:transition-none transition-[top] duration-300"
        style={{ top: tipTop, left: "50%", width: tipW, transform: "translateX(-50%)" }}
      >
        {placement !== "center" && (
          <span
            className="absolute w-4 h-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rotate-45"
            style={{
              left: arrowX - 8,
              ...(placement === "below"
                ? { top: -8, borderLeftWidth: 1, borderTopWidth: 1 }
                : { bottom: -8, borderRightWidth: 1, borderBottomWidth: 1 }),
            }}
          />
        )}
        <h2 className="text-base font-extrabold">{step.title}</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300">{step.body}</p>
        <div className="mt-3.5 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {steps.map((s, k) => (
              <span key={s.id} className={`h-1.5 rounded-full transition-all ${k === index ? "w-5 bg-emerald-600" : "w-1.5 bg-slate-300 dark:bg-slate-700"}`} />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {index > 0 && (
              <button type="button" onClick={() => setIndex(index - 1)} className="px-3 py-2 rounded-xl text-[13px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                Back
              </button>
            )}
            {!last && (
              <button type="button" onClick={close} className="px-3 py-2 rounded-xl text-[13px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                Skip
              </button>
            )}
            <button ref={nextRef} type="button" onClick={goNext} className="px-4 py-2 rounded-xl text-[13px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer min-h-[40px]">
              {last ? "Got it" : "Next"}
            </button>
          </div>
        </div>
        {index === 0 && (
          <button
            type="button"
            onClick={() => { markAllToursSeen(email); setTour(null); setSteps([]); }}
            className="mt-2 text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
          >
            Turn off all tips
          </button>
        )}
      </div>
    </div>
  );
}