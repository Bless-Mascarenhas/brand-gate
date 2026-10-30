'use client';
// Three-step guided tour through the primary product journey.
import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

export interface TourStep { path: string; target: string; title: string; body: string }

export const TOUR_STEPS: TourStep[] = [
  { path: '/company', target: 'pack-hash', title: '1 of 3 · Company Documents', body: 'Review the approved policies and facts that ground generated and evaluated posts.' },
  { path: '/build', target: 'create-brief', title: '2 of 3 · Create a post', body: 'Enter a brief or choose an example to generate and govern a draft.' },
  { path: '/verify', target: 'verify-run', title: '3 of 3 · Evaluate a post', body: 'Review a candidate post against deterministic rules, independent reviewers, and verified policy citations.' },
];

const KEY = 'bg_tour_step';
const EVENT = 'bg-tour';

export function startTour() {
  try { localStorage.setItem(KEY, '0'); } catch { /* storage blocked: tour still starts for this page */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: 0 }));
}

export function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved !== null) setStep(Number(saved));
    } catch { /* ignore */ }
    const onStart = (e: Event) => setStep((e as CustomEvent<number>).detail);
    window.addEventListener(EVENT, onStart);
    return () => window.removeEventListener(EVENT, onStart);
  }, []);

  const current = step === null ? null : TOUR_STEPS[step];

  // Navigate to the step's page, then highlight its target once rendered.
  useEffect(() => {
    if (!current) return;
    if (pathname !== current.path) {
      router.push(current.path);
      return;
    }
    let el: Element | null = null;
    const t = setTimeout(() => {
      el = document.querySelector(`[data-tour="${current.target}"]`);
      el?.classList.add('tour-highlight');
      el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      cardRef.current?.focus();
    }, 400);
    return () => {
      clearTimeout(t);
      document.querySelectorAll('.tour-highlight').forEach((n) => n.classList.remove('tour-highlight'));
    };
  }, [current, pathname, router]);

  const go = (n: number | null) => {
    try {
      if (n === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(n));
    } catch { /* ignore */ }
    setStep(n);
  };

  if (!current || step === null) return null;
  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      onKeyDown={(e) => { if (e.key === 'Escape') go(null); }}
      className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:w-96 p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-500 shadow-2xl space-y-2 focus:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="tour-title" className="font-bold text-slate-900 dark:text-white text-sm">{current.title}</h2>
        <button type="button" onClick={() => go(null)} aria-label="Close guided tour" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" aria-hidden /></button>
      </div>
      <p className="text-xs text-slate-700 dark:text-slate-300">{current.body}</p>
      <div className="flex items-center justify-between pt-1">
        <button type="button" disabled={step === 0} onClick={() => go(step - 1)} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40">
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Back
        </button>
        <span className="text-[11px] text-slate-600 dark:text-slate-400">Esc closes</span>
        {step < TOUR_STEPS.length - 1 ? (
          <button type="button" onClick={() => go(step + 1)} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold">
            Next <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        ) : (
          <button type="button" onClick={() => go(null)} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold">Finish tour</button>
        )}
      </div>
    </div>
  );
}
