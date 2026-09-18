"use client";

import { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  ArrowRight,
  RotateCcw,
  Lightbulb,
  ShieldCheck,
  Award,
} from "lucide-react";

interface BlunderStep {
  stepNumber: number;
  label: string;
  mathOrContent: string;
}

interface BlunderChallenge {
  id: string;
  conceptName: string;
  problemTitle: string;
  problemPrompt: string;
  steps: BlunderStep[];
  blunderStepIndex: number;
  blunderExplanation: string;
  correctStepContent: string;
  pedagogicalTakeaway: string;
}

interface BlunderChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export default function BlunderChallengeModal({
  isOpen,
  onClose,
  projectId,
}: BlunderChallengeModalProps) {
  const [challenge, setChallenge] = useState<BlunderChallenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen && projectId) {
      loadNewChallenge();
    } else {
      setChallenge(null);
      setSelectedIndex(null);
      setResult(null);
    }
  }, [isOpen, projectId]);

  async function loadNewChallenge() {
    setLoading(true);
    setSelectedIndex(null);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/blunder`);
      const data = await res.json();
      if (data.challenge) {
        setChallenge(data.challenge);
      }
    } catch (err) {
      console.error("Failed to load blunder challenge:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyBlunder(indexToVerify: number) {
    if (!challenge || evaluating || result) return;
    setSelectedIndex(indexToVerify);
    setEvaluating(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/blunder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge,
          selectedStepIndex: indexToVerify,
        }),
      });

      const data = await res.json();
      if (data.result) {
        setResult(data.result);
        if (data.result.pointsAwarded > 0 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("points-updated"));
        }
      }
    } catch (err) {
      console.error("Failed to evaluate blunder:", err);
    } finally {
      setEvaluating(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Spot the Blunder Challenge
                </h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                  Socratic Mode
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Identify which step contains the deliberate flaw or misconception.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
              <p className="text-xs font-semibold">
                Crafting realistic problem with subtle conceptual trap...
              </p>
            </div>
          ) : challenge ? (
            <>
              {/* Problem Prompt Box */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400">
                  <span>{challenge.problemTitle}</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Topic: {challenge.conceptName}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {challenge.problemPrompt}
                </p>
              </div>

              {/* Instructions */}
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Click on the step where the student committed an error:
              </p>

              {/* Step Selection Cards */}
              <div className="space-y-3">
                {challenge.steps.map((step, idx) => {
                  const isSelected = selectedIndex === idx;
                  const isThisTheActualBlunder =
                    result && result.correctStepIndex === idx;
                  const isThisWrongSelection =
                    result && !result.isCorrect && isSelected;

                  let borderClass =
                    "border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500";
                  let bgClass = "bg-white dark:bg-slate-800/40";

                  if (result) {
                    if (isThisTheActualBlunder) {
                      borderClass = "border-emerald-500 ring-2 ring-emerald-500/20";
                      bgClass = "bg-emerald-50/50 dark:bg-emerald-950/30";
                    } else if (isThisWrongSelection) {
                      borderClass = "border-rose-500 ring-2 ring-rose-500/20";
                      bgClass = "bg-rose-50/50 dark:bg-rose-950/30";
                    } else {
                      bgClass = "opacity-60 bg-slate-50 dark:bg-slate-900/30";
                    }
                  } else if (isSelected) {
                    borderClass = "border-rose-500 ring-2 ring-rose-500/20";
                    bgClass = "bg-rose-50/40 dark:bg-rose-950/20";
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => !result && handleVerifyBlunder(idx)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${borderClass} ${bgClass} shadow-xs space-y-1.5`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {step.label}
                        </span>
                        {result && isThisTheActualBlunder && (
                          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            The Flawed Step!
                          </span>
                        )}
                        {result && isThisWrongSelection && (
                          <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            This step was actually valid
                          </span>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-900/80 font-mono text-xs text-slate-900 dark:text-slate-100 overflow-x-auto">
                        {step.mathOrContent}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Result & Pedagogical Feedback Card */}
              {result && (
                <div
                  className={`p-5 rounded-2xl border animate-in zoom-in-95 duration-150 space-y-3 ${
                    result.isCorrect
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100"
                      : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {result.isCorrect ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Brilliant! You spotted the trap!</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <span>Close, but the blunder was in Step {result.correctStepIndex + 1}!</span>
                        </>
                      )}
                    </div>
                    {result.pointsAwarded > 0 && (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        +{result.pointsAwarded} XP Earned
                      </span>
                    )}
                  </div>

                  <div className="text-xs leading-relaxed space-y-2">
                    <div>
                      <b>Why it is a blunder:</b> {result.blunderExplanation}
                    </div>
                    <div>
                      <b>Correct Working:</b>{" "}
                      <span className="font-mono bg-white/60 dark:bg-slate-900/60 px-2 py-0.5 rounded text-xs">
                        {result.correctStepContent}
                      </span>
                    </div>
                    <div className="pt-1 flex items-start gap-1.5 text-slate-700 dark:text-slate-300">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>
                        <b>Key Takeaway:</b> {result.pedagogicalTakeaway}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              Unable to load blunder challenge.
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>

          {result && (
            <button
              type="button"
              onClick={loadNewChallenge}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <span>Try Another Challenge</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
