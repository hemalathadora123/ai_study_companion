"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  BookOpen,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Shuffle,
  RotateCcw,
  Check,
  X,
  CreditCard,
  LayoutGrid,
  Layers,
  Lightbulb,
  Award,
  Trash2,
  Zap,
} from "lucide-react";
import ProgressBar from "./ProgressBar";
import PointsToast from "./rewards/PointsToast";

export interface Flashcard {
  id: string;
  projectId: string;
  conceptName?: string | null;
  frontQuestion: string;
  backAnswer: string;
  hint?: string | null;
  sourceCitation?: string | null;
  difficulty: string;
  reviewCount: number;
  masteryLevel: number;
  lastReviewedAt?: string | null;
  nextReviewDate?: string | null;
}

interface FlashcardsManagerProps {
  projectId: string;
}

export default function FlashcardsManager({ projectId }: FlashcardsManagerProps) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(6);

  // Deck study state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [viewMode, setViewMode] = useState<"DECK" | "GRID">("DECK");
  const [filterMode, setFilterMode] = useState<"ALL" | "NEED_REVIEW" | "MASTERED">("ALL");

  // Grid flip tracking
  const [gridFlippedIds, setGridFlippedIds] = useState<Record<string, boolean>>({});

  // Points toast
  const [rewardToast, setRewardToast] = useState<{ points: number; reason: string } | null>(null);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/flashcards`);
      const data = await res.json();
      if (data.cards) {
        setCards(data.cards);
      }
    } catch (err) {
      console.error("Failed to load flashcards:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Filtered card list
  const filteredCards = cards.filter((c) => {
    if (filterMode === "NEED_REVIEW") return c.masteryLevel < 3;
    if (filterMode === "MASTERED") return c.masteryLevel >= 3;
    return true;
  });

  const currentCard = filteredCards[currentIndex] || null;

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (isFlipped && currentCard) {
        if (e.key === "1") handleRate(currentCard.id, "AGAIN");
        else if (e.key === "2") handleRate(currentCard.id, "GOOD");
        else if (e.key === "3") handleRate(currentCard.id, "EASY");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlipped, currentCard, filteredCards.length]);

  function handleNext() {
    setIsFlipped(false);
    setShowHint(false);
    setCurrentIndex((prev) => (prev + 1 < filteredCards.length ? prev + 1 : 0));
  }

  function handlePrev() {
    setIsFlipped(false);
    setShowHint(false);
    setCurrentIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredCards.length - 1));
  }

  function handleShuffle() {
    setIsFlipped(false);
    setShowHint(false);
    setCards((prev) => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
  }

  async function handleGenerateFlashcards() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: generateCount }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate flashcards");
      }

      await loadCards();
      setIsFlipped(false);
      setShowHint(false);
      setCurrentIndex(0);

      setRewardToast({
        points: 20,
        reason: `Generated ${data.count} Flashcards from Materials! 🃏`,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("points-updated"));
      }
    } catch (err: any) {
      console.error("Failed to generate flashcards:", err);
      alert(err.message || "Failed to generate flashcards.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRate(cardId: string, rating: "AGAIN" | "GOOD" | "EASY") {
    try {
      const res = await fetch(`/api/projects/${projectId}/flashcards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });

      const data = await res.json();
      if (data.result) {
        // Update local card
        setCards((prev) =>
          prev.map((c) =>
            c.id === cardId ? { ...c, ...data.result.card } : c
          )
        );

        if (data.result.pointsAwarded && data.result.pointsAwarded > 0) {
          setRewardToast({
            points: data.result.pointsAwarded,
            reason: rating === "EASY" ? "Flashcard Mastered! 🌟" : "Flashcard Reviewed! 🎯",
          });
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("points-updated"));
          }
        }

        // Advance to next card smoothly
        setTimeout(() => {
          handleNext();
        }, 250);
      }
    } catch (err) {
      console.error("Failed to rate flashcard:", err);
    }
  }

  async function handleDeleteCard(cardId: string) {
    if (!confirm("Delete this flashcard?")) return;
    try {
      await fetch(`/api/projects/${projectId}/flashcards/${cardId}`, {
        method: "DELETE",
      });
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      if (currentIndex >= filteredCards.length - 1) {
        setCurrentIndex(Math.max(0, filteredCards.length - 2));
      }
    } catch (err) {
      console.error("Failed to delete card:", err);
    }
  }

  const masteredCount = cards.filter((c) => c.masteryLevel >= 3).length;
  const learningCount = cards.filter((c) => c.masteryLevel >= 1 && c.masteryLevel < 3).length;
  const newCount = cards.filter((c) => c.masteryLevel === 0).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {rewardToast && (
        <PointsToast
          points={rewardToast.points}
          reason={rewardToast.reason}
          onDismiss={() => setRewardToast(null)}
        />
      )}

      {/* Top Deck Controls & Generation Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Smart Active-Recall Flashcards
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Grounded in Materials
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-lg">
            AI-generated questions and answers derived directly from your uploaded notes and lecture documents, with exact page citations and spaced repetition tracking.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap">
          <select
            value={generateCount}
            onChange={(e) => setGenerateCount(Number(e.target.value))}
            className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value={5}>5 Cards</option>
            <option value={8}>8 Cards</option>
            <option value={12}>12 Cards (Full Chapter)</option>
          </select>

          <button
            type="button"
            onClick={handleGenerateFlashcards}
            disabled={generating}
            className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-sm transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating from Notes...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate from Materials</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metrics & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
        {/* Metric Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-semibold border border-slate-200">
            Total: <b>{cards.length}</b>
          </span>
          <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
            Mastered: <b>{masteredCount}</b>
          </span>
          <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-700 font-semibold border border-amber-200">
            Learning: <b>{learningCount}</b>
          </span>
          <span className="px-3 py-1 rounded-xl bg-purple-50 text-purple-700 font-semibold border border-purple-200">
            New: <b>{newCount}</b>
          </span>
        </div>

        {/* View Mode & Filter Controls */}
        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => {
                setFilterMode("ALL");
                setCurrentIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                filterMode === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setFilterMode("NEED_REVIEW");
                setCurrentIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                filterMode === "NEED_REVIEW" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              Need Review
            </button>
            <button
              onClick={() => {
                setFilterMode("MASTERED");
                setCurrentIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                filterMode === "MASTERED" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              Mastered
            </button>
          </div>

          {/* View Mode: Deck vs Grid */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode("DECK")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "DECK" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600"
              }`}
              title="Single Card Deck Mode"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("GRID")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "GRID" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600"
              }`}
              title="All Cards Grid Overview"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-semibold">Loading your flashcard deck...</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <CreditCard className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-base">
              {cards.length === 0
                ? "No Flashcards Generated Yet"
                : "No Cards Match the Selected Filter"}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {cards.length === 0
                ? "Click 'Generate from Materials' above to automatically turn your uploaded notes and textbooks into active-recall flashcards."
                : "Switch the filter to 'All' or generate more flashcards from your study materials."}
            </p>
          </div>
          {cards.length === 0 && (
            <button
              onClick={handleGenerateFlashcards}
              disabled={generating}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-900/20 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate 6 Flashcards Now</span>
            </button>
          )}
        </div>
      ) : viewMode === "DECK" && currentCard ? (
        /* 1. DECK STUDY MODE (One card at a time with 3D Flip) */
        <div className="flex flex-col items-center space-y-6 max-w-2xl mx-auto">
          {/* Deck Progress Bar */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold">
                Card {currentIndex + 1} of {filteredCards.length}
              </span>
              <span className="font-mono">
                {Math.round(((currentIndex + 1) / filteredCards.length) * 100)}% through deck
              </span>
            </div>
            <ProgressBar
              value={((currentIndex + 1) / filteredCards.length) * 100}
              size="sm"
            />
          </div>

          {/* Interactive 3D Flip Card Container */}
          <div
            className="w-full h-[360px] select-none cursor-pointer"
            style={{ perspective: "1200px" }}
            onClick={() => setIsFlipped((f) => !f)}
          >
            <div
              className="relative w-full h-full transition-transform duration-500 rounded-3xl"
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* FRONT SIDE OF CARD */}
              <div
                className="absolute inset-0 w-full h-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 text-white rounded-3xl p-7 shadow-2xl flex flex-col justify-between"
                style={{ backfaceVisibility: "hidden" }}
              >
                {/* Top Badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentCard.sourceCitation && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                        <BookOpen className="w-3 h-3" />
                        {currentCard.sourceCitation}
                      </span>
                    )}
                    {currentCard.conceptName && (
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                        {currentCard.conceptName}
                      </span>
                    )}
                  </div>

                  {/* Mastery Indicator */}
                  <span className="text-[11px] font-mono text-slate-400">
                    Box {currentCard.masteryLevel}/5
                  </span>
                </div>

                {/* Question Center */}
                <div className="my-auto text-center space-y-4 px-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                    Question (Front)
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed">
                    {currentCard.frontQuestion}
                  </h3>

                  {/* Hint Reveal */}
                  {currentCard.hint && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHint(!showHint);
                      }}
                      className="inline-block cursor-pointer pt-1"
                    >
                      {showHint ? (
                        <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2 text-left animate-in fade-in">
                          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{currentCard.hint}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>Show Intuition Hint</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Flip Prompt */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-3">
                  <span>Press Space or tap anywhere to flip</span>
                  <span className="flex items-center gap-1 text-indigo-400 font-semibold">
                    <RotateCw className="w-3 h-3" /> Flip to Answer
                  </span>
                </div>
              </div>

              {/* BACK SIDE OF CARD */}
              <div
                className="absolute inset-0 w-full h-full bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 border border-indigo-800/80 text-white rounded-3xl p-7 shadow-2xl flex flex-col justify-between"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                {/* Top Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Grounded Answer (Back)
                  </span>
                  {currentCard.sourceCitation && (
                    <span className="text-[11px] text-slate-400">
                      Ref: {currentCard.sourceCitation}
                    </span>
                  )}
                </div>

                {/* Answer Center */}
                <div className="my-auto px-4 text-center space-y-3">
                  <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed max-h-[160px] overflow-y-auto pr-1">
                    {currentCard.backAnswer}
                  </p>
                </div>

                {/* Self Assessment Rating Buttons */}
                <div
                  className="space-y-2 pt-3 border-t border-slate-800/80"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-[11px] font-semibold text-center text-slate-400">
                    How well did you know this?
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRate(currentCard.id, "AGAIN")}
                      className="p-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-rose-300 text-xs font-bold flex flex-col items-center gap-0.5 transition-colors cursor-pointer"
                      title="Key 1: Review again soon"
                    >
                      <span>🔴 Again</span>
                      <span className="text-[10px] font-normal text-rose-400">Reset</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRate(currentCard.id, "GOOD")}
                      className="p-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800 text-amber-300 text-xs font-bold flex flex-col items-center gap-0.5 transition-colors cursor-pointer"
                      title="Key 2: Recalled with effort"
                    >
                      <span>🟡 Good</span>
                      <span className="text-[10px] font-normal text-amber-400">+1 Box</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRate(currentCard.id, "EASY")}
                      className="p-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-300 text-xs font-bold flex flex-col items-center gap-0.5 transition-colors cursor-pointer shadow-sm"
                      title="Key 3: Mastered (+20 XP)"
                    >
                      <span>🟢 Easy</span>
                      <span className="text-[10px] font-normal text-emerald-400">+20 XP</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Controls Bar */}
          <div className="flex items-center justify-between w-full px-2">
            <button
              type="button"
              onClick={handlePrev}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShuffle}
                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs shadow-xs transition-colors cursor-pointer"
                title="Shuffle Cards"
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCard(currentCard.id)}
                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 text-xs shadow-xs transition-colors cursor-pointer"
                title="Delete this card"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Next Card</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* 2. GRID OVERVIEW MODE (All cards visible) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card, idx) => {
            const flipped = gridFlippedIds[card.id] || false;
            return (
              <div
                key={card.id}
                onClick={() =>
                  setGridFlippedIds((prev) => ({ ...prev, [card.id]: !flipped }))
                }
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 transition-all shadow-xs space-y-3 cursor-pointer flex flex-col justify-between min-h-[220px]"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-slate-400">Card #{idx + 1}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        card.masteryLevel >= 3
                          ? "bg-emerald-100 text-emerald-800"
                          : card.masteryLevel >= 1
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      Box {card.masteryLevel}/5
                    </span>
                  </div>

                  {flipped ? (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase text-emerald-600">
                        Answer:
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed">
                        {card.backAnswer}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase text-indigo-600">
                        Question:
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 leading-relaxed">
                        {card.frontQuestion}
                      </h5>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate max-w-[150px]">
                    {card.sourceCitation || card.conceptName || "Notes"}
                  </span>
                  <span className="text-indigo-600 font-semibold flex items-center gap-1">
                    <RotateCw className="w-3 h-3" />
                    {flipped ? "Show Question" : "Show Answer"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
