"use client";

import { useState, useEffect } from "react";
import {
  HelpCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Loader2,
  Brain,
  AlertTriangle,
  Award,
  ChevronRight,
  BookOpen,
  Star,
  Target,
} from "lucide-react";
import ProgressBar from "./ProgressBar";
import PointsToast from "./rewards/PointsToast";
import BlunderChallengeModal from "./BlunderChallengeModal";
import { MetacognitiveMatrix } from "@/lib/ai/quizEvaluator";

interface Question {
  id: string;
  questionType: "MCQ" | "OPEN_ENDED";
  prompt: string;
  optionsJson?: string | null;
  correctOptionIndex?: number | null;
  rubricJson?: string | null;
  explanation?: string | null;
  concept?: { id: string; name: string } | null;
}

interface Attempt {
  id: string;
  questionId: string;
  selectedOptionIndex?: number | null;
  textResponse?: string | null;
  isCorrect?: boolean | null;
  score?: number | null;
  feedback?: string | null;
  missingConceptsJson?: string | null;
}

interface Quiz {
  id: string;
  title: string;
  status: string;
  score?: number | null;
  totalQuestions: number;
  difficultyLevel: string;
  createdAt: string;
  completedAt?: string | null;
  _count?: { questions: number; attempts: number };
}

interface GradedResult {
  questionId: string;
  questionType: string;
  prompt: string;
  isCorrect: boolean;
  score: number;
  feedback: string;
  missingConcepts: string[];
  explanation?: string | null;
}

export interface QuizPerformanceReward {
  basePoints: number;
  correctAnswersPoints: number;
  scoreBonusPoints: number;
  perfectBonusPoints: number;
  totalPointsAwarded: number;
  performanceTier: string;
}

interface QuizEvaluation {
  quizId: string;
  overallScore: number;
  totalQuestions: number;
  correctCount: number;
  gradedQuestions: GradedResult[];
  pointsAwarded?: number;
  performanceReward?: QuizPerformanceReward | null;
  metacognitiveMatrix?: MetacognitiveMatrix | null;
}

interface QuizManagerProps {
  projectId: string;
  onQuizCompleted?: () => void;
}

export default function QuizManager({ projectId, onQuizCompleted }: QuizManagerProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [questionCount, setQuestionCount] = useState(3);

  // Active quiz state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<
    Record<
      string,
      {
        selectedOptionIndex?: number;
        textResponse?: string;
        confidenceLevel?: "HIGH" | "MEDIUM" | "LOW";
      }
    >
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<QuizEvaluation | null>(null);
  const [rewardToast, setRewardToast] = useState<{ points: number; reason: string } | null>(null);
  const [isBlunderModalOpen, setIsBlunderModalOpen] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, [projectId]);

  async function loadQuizzes() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/quizzes`);
      const data = await res.json();
      setQuizzes(data.quizzes || []);
    } catch (err) {
      console.error("Failed to load quizzes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateQuiz() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/quizzes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionCount }),
      });
      const data = await res.json();
      if (data.quiz) {
        await loadQuizzes();
        await startQuiz(data.quiz.quizId);
      }
    } catch (err) {
      console.error("Failed to generate quiz:", err);
    } finally {
      setGenerating(false);
    }
  }

  async function startQuiz(quizId: string) {
    try {
      const res = await fetch(`/api/quizzes/${quizId}`);
      const data = await res.json();
      if (data.quiz) {
        setActiveQuiz(data.quiz);
        setQuestions(data.quiz.questions || []);
        setCurrentQIndex(0);
        setUserAnswers({});
        setEvaluationResult(null);
      }
    } catch (err) {
      console.error("Failed to fetch quiz questions:", err);
    }
  }

  function handleSelectOption(questionId: string, optionIndex: number) {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        selectedOptionIndex: optionIndex,
      },
    }));
  }

  function handleTextResponseChange(questionId: string, text: string) {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        textResponse: text,
      },
    }));
  }

  function handleSetConfidence(questionId: string, confidence: "HIGH" | "MEDIUM" | "LOW") {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        confidenceLevel: confidence,
      },
    }));
  }

  async function handleSubmitQuiz() {
    if (!activeQuiz) return;
    setSubmitting(true);

    const answersPayload = questions.map((q) => {
      const ans = userAnswers[q.id] || {};
      return {
        questionId: q.id,
        selectedOptionIndex: ans.selectedOptionIndex ?? null,
        textResponse: ans.textResponse ?? null,
        confidenceLevel: ans.confidenceLevel ?? null,
      };
    });

    try {
      const res = await fetch(`/api/quizzes/${activeQuiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersPayload }),
      });
      const data = await res.json();
      if (data.evaluation) {
        setEvaluationResult(data.evaluation);
        if (data.evaluation.pointsAwarded && data.evaluation.pointsAwarded > 0) {
          setRewardToast({
            points: data.evaluation.pointsAwarded,
            reason: `Adaptive Quiz Completed (${data.evaluation.overallScore}%)! 🎯`,
          });
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("points-updated"));
          }
        }
        loadQuizzes();
        if (onQuizCompleted) onQuizCompleted();
      }
    } catch (err) {
      console.error("Failed to submit quiz:", err);
    } finally {
      setSubmitting(false);
    }
  }

  // 1. RESULTS VIEW
  if (evaluationResult) {
    const isPassing = evaluationResult.overallScore >= 60;
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Gamification Points Toast */}
        {rewardToast && (
          <PointsToast
            points={rewardToast.points}
            reason={rewardToast.reason}
            onDismiss={() => setRewardToast(null)}
          />
        )}

        {/* Score Banner */}
        <div
          className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6 ${
            isPassing
              ? "bg-emerald-50/80 border-emerald-200"
              : "bg-amber-50/80 border-amber-200"
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm ${
                isPassing
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-500 text-white"
              }`}
            >
              {evaluationResult.overallScore}%
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {isPassing ? "Adaptive Assessment Passed!" : "Needs Review"}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Answered {evaluationResult.correctCount} of{" "}
                {evaluationResult.totalQuestions} questions correctly. Concept
                masteries have been updated.
              </p>
              {evaluationResult.pointsAwarded ? (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/90 text-amber-800 text-xs font-bold border border-amber-300">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  +{evaluationResult.pointsAwarded} Points Earned!
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveQuiz(null);
                setEvaluationResult(null);
              }}
              className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors shadow-xs"
            >
              Back to Quizzes
            </button>
            <button
              onClick={() => handleGenerateQuiz()}
              disabled={generating}
              className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm inline-flex items-center gap-1.5"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Take New Quiz
            </button>
          </div>
        </div>

        {/* Quiz Performance Rewards Breakdown */}
        {evaluationResult.performanceReward && (
          <div className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                  <Award className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Performance Points Breakdown
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Earned for participation and score in this assessment
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-amber-600 flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  +{evaluationResult.pointsAwarded} XP
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-500">Participation</div>
                <div className="text-sm font-black text-slate-800 mt-0.5">
                  +{evaluationResult.performanceReward.basePoints} pts
                </div>
                <div className="text-[10px] text-slate-400">Quiz Completed</div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-center">
                <div className="text-[10px] uppercase font-bold text-emerald-700">Correct Answers</div>
                <div className="text-sm font-black text-emerald-800 mt-0.5">
                  +{evaluationResult.performanceReward.correctAnswersPoints} pts
                </div>
                <div className="text-[10px] text-emerald-600 font-medium">
                  {evaluationResult.correctCount} of {evaluationResult.totalQuestions} correct
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200/70 text-center">
                <div className="text-[10px] uppercase font-bold text-indigo-700">Score Tier</div>
                <div className="text-sm font-black text-indigo-800 mt-0.5">
                  +{evaluationResult.performanceReward.scoreBonusPoints} pts
                </div>
                <div className="text-[10px] text-indigo-600 font-medium truncate">
                  {evaluationResult.performanceReward.performanceTier}
                </div>
              </div>

              {evaluationResult.performanceReward.perfectBonusPoints > 0 ? (
                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-300 text-center">
                  <div className="text-[10px] uppercase font-bold text-amber-700">Perfect 100% Bonus</div>
                  <div className="text-sm font-black text-amber-800 mt-0.5">
                    +{evaluationResult.performanceReward.perfectBonusPoints} pts
                  </div>
                  <div className="text-[10px] text-amber-600 font-medium">Flawless Score!</div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Total Points</div>
                  <div className="text-sm font-black text-amber-600 mt-0.5">
                    +{evaluationResult.pointsAwarded} pts
                  </div>
                  <div className="text-[10px] text-slate-400">Added to Balance</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metacognitive Calibration Matrix */}
        {evaluationResult.metacognitiveMatrix && (
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Metacognitive Calibration Matrix
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-indigo-300">
                  Calibration: <b>{evaluationResult.metacognitiveMatrix.calibrationScore}%</b>
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    evaluationResult.metacognitiveMatrix.calibrationVerdict === "WELL_CALIBRATED"
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      : evaluationResult.metacognitiveMatrix.calibrationVerdict === "OVERCONFIDENT"
                      ? "bg-rose-950 text-rose-300 border border-rose-800"
                      : "bg-amber-950 text-amber-300 border border-amber-800"
                  }`}
                >
                  {evaluationResult.metacognitiveMatrix.calibrationVerdict.replace("_", " ")}
                </span>
              </div>
            </div>

            {/* 2x2 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mastery Zone */}
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mastery Zone
                  </span>
                  <span className="text-sm font-mono">
                    {evaluationResult.metacognitiveMatrix.masteryZoneCount}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                  High confidence + Correct. Genuine, solid mastery with reliable retention.
                </p>
              </div>

              {/* Danger Zone / Blind Spot */}
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Blind Spot Traps
                  </span>
                  <span className="text-sm font-mono">
                    {evaluationResult.metacognitiveMatrix.blindSpotCount}
                  </span>
                </div>
                <p className="text-[11px] text-rose-300/80 leading-relaxed">
                  High confidence + Incorrect. Dangerous false assumptions or tricky traps.
                </p>
              </div>

              {/* Lucky Guess Zone */}
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" /> Unstable Intuition
                  </span>
                  <span className="text-sm font-mono">
                    {evaluationResult.metacognitiveMatrix.luckyGuessCount}
                  </span>
                </div>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Low confidence + Correct. You got it right, but strengthen the foundational &ldquo;why&rdquo;.
                </p>
              </div>

              {/* Conscious Gap Zone */}
              <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/60 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-purple-400">
                  <span className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Conscious Growth Need
                  </span>
                  <span className="text-sm font-mono">
                    {evaluationResult.metacognitiveMatrix.growthZoneCount}
                  </span>
                </div>
                <p className="text-[11px] text-purple-300/80 leading-relaxed">
                  Low confidence + Incorrect. High self-awareness! Great candidate for tutor review.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Question Review Cards */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Detailed Performance Breakdown
          </h4>
          {evaluationResult.gradedQuestions.map((gq, idx) => {
            const originalQ = questions.find((q) => q.id === gq.questionId);
            const rawOptions = originalQ?.optionsJson
              ? JSON.parse(originalQ.optionsJson)
              : [];
            const studentAns = userAnswers[gq.questionId];

            return (
              <div
                key={gq.questionId}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">
                      Q{idx + 1}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        gq.questionType === "MCQ"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-purple-50 text-purple-700"
                      }`}
                    >
                      {gq.questionType === "MCQ" ? "Multiple Choice" : "Open-Ended"}
                    </span>
                    {originalQ?.concept && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                        {originalQ.concept.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {gq.isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {gq.score}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                        <XCircle className="w-3.5 h-3.5" />
                        {gq.score}%
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                  {gq.prompt}
                </p>

                {/* MCQ Options Display */}
                {gq.questionType === "MCQ" && (
                  <div className="space-y-1.5 pt-1">
                    {rawOptions.map((opt: string, oi: number) => {
                      const isChosen = studentAns?.selectedOptionIndex === oi;
                      const isRight = originalQ?.correctOptionIndex === oi;
                      return (
                        <div
                          key={oi}
                          className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                            isRight
                              ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 font-semibold"
                              : isChosen
                              ? "bg-rose-50/80 border-rose-300 text-rose-900"
                              : "bg-slate-50/50 border-slate-100 text-slate-600"
                          }`}
                        >
                          <span>{opt}</span>
                          {isRight && (
                            <span className="text-[10px] font-bold text-emerald-700 uppercase">
                              Correct Answer
                            </span>
                          )}
                          {isChosen && !isRight && (
                            <span className="text-[10px] font-bold text-rose-700 uppercase">
                              Your Choice
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Open Ended Display */}
                {gq.questionType === "OPEN_ENDED" && (
                  <div className="space-y-2 pt-1">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Your Written Response:
                      </div>
                      <p className="italic">
                        "{studentAns?.textResponse || "No answer submitted"}"
                      </p>
                    </div>
                  </div>
                )}

                {/* AI Explanatory Feedback */}
                <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-950 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-indigo-900 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    AI Pedagogical Feedback
                  </div>
                  <p className="leading-relaxed">{gq.feedback}</p>

                  {gq.missingConcepts.length > 0 && (
                    <div className="pt-2 border-t border-indigo-100/60 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Gaps to Review:
                      </span>
                      {gq.missingConcepts.map((mc, mci) => (
                        <span
                          key={mci}
                          className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold"
                        >
                          {mc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. ACTIVE RUNNER VIEW
  if (activeQuiz && questions.length > 0) {
    const currentQ = questions[currentQIndex];
    const isLastQuestion = currentQIndex === questions.length - 1;
    const studentAns = userAnswers[currentQ.id] || {};
    const options: string[] = currentQ.optionsJson
      ? JSON.parse(currentQ.optionsJson)
      : [];

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        {/* Progress & Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider">
              {activeQuiz.title}
            </span>
            <span className="font-bold text-indigo-600">
              Question {currentQIndex + 1} of {questions.length}
            </span>
          </div>
          <ProgressBar
            value={((currentQIndex + 1) / questions.length) * 100}
          />
        </div>

        {/* Current Question Body */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                currentQ.questionType === "MCQ"
                  ? "bg-slate-100 text-slate-700"
                  : "bg-purple-100 text-purple-800"
              }`}
            >
              {currentQ.questionType === "MCQ"
                ? "Multiple Choice"
                : "Open-Ended Conceptual"}
            </span>
            {currentQ.concept && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                Target: {currentQ.concept.name}
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-slate-900 leading-snug">
            {currentQ.prompt}
          </h3>

          {/* Question Form */}
          {currentQ.questionType === "MCQ" ? (
            <div className="space-y-2.5 pt-2">
              {options.map((opt, i) => {
                const isSelected = studentAns.selectedOptionIndex === i;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelectOption(currentQ.id, i)}
                    className={`w-full text-left p-4 rounded-xl text-xs font-medium border transition-all flex items-center justify-between ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span>{opt}</span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-3 ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300"
                      }`}
                    >
                      {isSelected && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <textarea
                value={studentAns.textResponse || ""}
                onChange={(e) =>
                  handleTextResponseChange(currentQ.id, e.target.value)
                }
                rows={5}
                placeholder="Write your detailed explanation here... Ground your reasoning in the project materials."
                className="w-full p-3.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder-slate-400"
              />
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span>
                  Evaluated on conceptual precision, core mechanisms, and clarity.
                </span>
              </div>
            </div>
          )}

          {/* Confidence Rating (Metacognitive Calibration) */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-indigo-500" />
                Confidence Level:
              </span>
              <span className="text-[11px] text-slate-400">
                Calibrates your self-awareness & exam readiness
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSetConfidence(currentQ.id, "HIGH")}
                className={`p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  studentAns.confidenceLevel === "HIGH"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Certain (100%)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetConfidence(currentQ.id, "MEDIUM")}
                className={`p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  studentAns.confidenceLevel === "MEDIUM"
                    ? "bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Educated Guess (50%)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetConfidence(currentQ.id, "LOW")}
                className={`p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  studentAns.confidenceLevel === "LOW"
                    ? "bg-purple-50 border-purple-500 text-purple-800 ring-2 ring-purple-500/20 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Wild Guess (0%)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQIndex === 0}
            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Previous
          </button>

          {isLastQuestion ? (
            <button
              onClick={handleSubmitQuiz}
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Grading Assessment...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Submit & Evaluate
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() =>
                setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))
              }
              className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all shadow-xs inline-flex items-center gap-1"
            >
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. QUIZ LIST & GENERATOR VIEW
  return (
    <div className="space-y-6">
      {/* Top Banner with Generation Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            Adaptive Quiz & Assessment
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            Automatically targets weak concepts with MCQs and conceptual
            open-ended prompts evaluated via rubric grading.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setIsBlunderModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-sm transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Spot the Blunder</span>
          </button>

          <select
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value={3}>3 Questions (Quick Check)</option>
            <option value={5}>5 Questions (Standard)</option>
            <option value={8}>8 Questions (Deep Assessment)</option>
          </select>

          <button
            onClick={handleGenerateQuiz}
            disabled={generating}
            className="flex-1 md:flex-none px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Adaptive Quiz...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Quiz
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quizzes List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Quiz History & Assessments ({quizzes.length})
        </h4>

        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Brain className="w-6 h-6" />
            </div>
            <h5 className="font-bold text-slate-800 text-sm">
              No Quizzes Generated Yet
            </h5>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Generate an adaptive quiz to practice concepts and receive
              rubric-graded explanatory feedback.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {quizzes.map((quiz) => {
              const isDone = quiz.status === "COMPLETED";
              const score = quiz.score;

              return (
                <div
                  key={quiz.id}
                  onClick={() => startQuiz(quiz.id)}
                  className="bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-bold text-slate-900 text-xs group-hover:text-indigo-600 transition-colors">
                        {quiz.title}
                      </h5>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDone
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {isDone ? "Completed" : "In Progress"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>{quiz.totalQuestions} Questions</span>
                      <span>·</span>
                      <span>
                        Created {new Date(quiz.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {isDone && typeof score === "number" && (
                      <div
                        className={`font-black text-sm px-3 py-1 rounded-xl ${
                          score >= 60
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {Math.round(score)}%
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gamification Points Toast */}
      {rewardToast && (
        <PointsToast
          points={rewardToast.points}
          reason={rewardToast.reason}
          onDismiss={() => setRewardToast(null)}
        />
      )}

      {/* Spot the Blunder Interactive Socratic Modal */}
      <BlunderChallengeModal
        isOpen={isBlunderModalOpen}
        onClose={() => setIsBlunderModalOpen(false)}
        projectId={projectId}
      />
    </div>
  );
}
