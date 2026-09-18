"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Trophy,
  Flame,
  Star,
  Sparkles,
  Award,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  Target,
  Mic,
  Brain,
  Zap,
  Loader2,
} from "lucide-react";
import ProgressBar from "@/components/ProgressBar";

interface RewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRewardClaimed?: () => void;
}

export default function RewardsModal({
  isOpen,
  onClose,
  onRewardClaimed,
}: RewardsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "badges" | "history">("overview");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      loadProfile();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch("/api/rewards");
      const data = await res.json();
      if (data.profile) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.error("Failed to load rewards profile:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimDaily() {
    setClaiming(true);
    try {
      const res = await fetch("/api/rewards", { method: "POST" });
      const data = await res.json();
      if (data.profile) {
        setProfile(data.profile);
        onRewardClaimed?.();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("points-updated"));
        }
      }
    } catch (err) {
      console.error("Failed to claim daily reward:", err);
    } finally {
      setClaiming(false);
    }
  }

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-xl bg-white border border-slate-200 text-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient banner */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 text-white overflow-hidden">
          {/* Subtle decorative shapes */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
                <Trophy className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
                  Student Rewards & Streaks
                </span>
                <h2 className="text-xl font-bold tracking-tight">
                  {profile?.levelTitle || "Apprentice Scholar"}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Stats Banner inside header */}
          <div className="mt-5 grid grid-cols-3 gap-2.5 bg-black/20 backdrop-blur-md p-3 rounded-2xl border border-white/15 text-center">
            <div>
              <div className="text-[11px] font-medium text-slate-200">Total Points</div>
              <div className="text-lg font-black text-amber-300 flex items-center justify-center gap-1">
                <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                {profile?.points ?? 0}
              </div>
            </div>
            <div className="border-x border-white/15">
              <div className="text-[11px] font-medium text-slate-200">Study Streak</div>
              <div className="text-lg font-black text-rose-300 flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 fill-rose-300 text-rose-300" />
                {profile?.currentStreak ?? 0} {profile?.currentStreak === 1 ? "Day" : "Days"}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-200">Scholar Level</div>
              <div className="text-lg font-black text-indigo-200">
                Lvl {profile?.level ?? 1}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "overview"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Level & Milestones
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("badges")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "badges"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Badges ({profile?.badges?.filter((b: any) => b.unlocked).length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "history"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Points History
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === "overview" && (
            <>
              {/* Level Progress Section */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    Level {profile?.level} Progress
                  </span>
                  <span className="text-slate-500 font-semibold">
                    {profile?.points} / {profile?.nextLevelPoints ? `${profile.nextLevelPoints} pts` : "MAX"}
                  </span>
                </div>

                <ProgressBar value={profile?.progressPct || 0} size="md" color="indigo" />

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{profile?.levelTitle}</span>
                  {profile?.pointsToNext > 0 ? (
                    <span className="text-indigo-600 font-semibold">
                      {profile.pointsToNext} pts to Level {(profile?.level || 1) + 1}
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">Top Level Achieved!</span>
                  )}
                </div>
              </div>

              {/* Daily Streak Claim Action */}
              <div className="p-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 to-rose-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold shrink-0">
                    <Flame className="w-6 h-6 text-rose-500 fill-rose-500" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Individual Daily Streak
                    </div>
                    <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      {profile?.currentStreak ?? 0} Day Streak • +30 XP Daily
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {profile?.canClaimDaily 
                        ? "Claim your streak bonus for today to keep your streak alive!" 
                        : "Today's streak reward claimed! Come back tomorrow to continue."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClaimDaily}
                  disabled={claiming || !profile?.canClaimDaily}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer ${
                    profile?.canClaimDaily
                      ? "bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white shadow-amber-500/20"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {claiming ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Claiming...
                    </span>
                  ) : profile?.canClaimDaily ? (
                    "🔥 Claim Today (+30 XP)"
                  ) : (
                    "✓ Claimed for Today"
                  )}
                </button>
              </div>

              {/* How to Earn Points Guide */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  How To Earn Points
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl border border-slate-200/70 bg-white flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        <Brain className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Ask AI Tutor</div>
                        <div className="text-[10px] text-slate-400">Step-by-step clarity</div>
                      </div>
                    </div>
                    <span className="text-xs font-black text-indigo-600">+10 pts</span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200/70 bg-white flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
                        <Mic className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Voice Companion</div>
                        <div className="text-[10px] text-slate-400">Spoken interactions</div>
                      </div>
                    </div>
                    <span className="text-xs font-black text-cyan-600">+15 pts</span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200/70 bg-white flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Trophy className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Complete Quiz</div>
                        <div className="text-[10px] text-slate-400">+20 bonus for 80%+</div>
                      </div>
                    </div>
                    <span className="text-xs font-black text-amber-600">+30 pts</span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200/70 bg-white flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                        <Flame className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Daily Study Streak</div>
                        <div className="text-[10px] text-slate-400">Consistency bonus</div>
                      </div>
                    </div>
                    <span className="text-xs font-black text-rose-600">+30 pts</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "badges" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(profile?.badges || []).map((badge: any) => (
                <div
                  key={badge.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    badge.unlocked
                      ? "bg-indigo-50/40 border-indigo-200 shadow-2xs"
                      : "bg-slate-50 border-slate-200 opacity-60"
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        badge.unlocked
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                          : "bg-slate-200 text-slate-400"
                      }`}
                    >
                      {badge.unlocked ? <Award className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900">{badge.name}</h4>
                        {badge.unlocked && (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Unlocked
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {badge.description}
                      </p>
                      <div className="text-[10px] font-medium text-slate-400 mt-2">
                        Progress: {badge.progress}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-2">
              {(profile?.recentTransactions || []).length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No points recorded yet. Ask a question or complete a quiz to earn points!
                </div>
              ) : (
                (profile?.recentTransactions || []).map((tx: any) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {tx.description}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-indigo-600">
                      +{tx.points} pts
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Keep studying daily to maintain your <span className="font-bold text-rose-600">🔥 {profile?.currentStreak || 0}-day streak</span>!
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Keep Learning
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
