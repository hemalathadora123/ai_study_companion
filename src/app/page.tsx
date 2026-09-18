"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  BookOpen, 
  Target, 
  ArrowRight, 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Sparkles, 
  Folder, 
  Layers, 
  Compass, 
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Flame,
  Star,
  Trophy
} from "lucide-react";
import Header from "@/components/Header";
import ProgressBar from "@/components/ProgressBar";
import CreateProjectModal from "@/components/CreateProjectModal";
import CreateSpaceModal from "@/components/CreateSpaceModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import FloatingVoiceOrb from "@/components/voice/FloatingVoiceOrb";
import RewardsModal from "@/components/rewards/RewardsModal";

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | undefined>(undefined);
  const [spaceToDelete, setSpaceToDelete] = useState<any>(null);
  const [deletingSpace, setDeletingSpace] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  function loadHomeData() {
    setLoading(true);
    fetch("/api/home")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Error loading home:", err))
      .finally(() => setLoading(false));
  }

  async function handleDeleteSpace() {
    if (!spaceToDelete) return;
    setDeletingSpace(true);
    try {
      const res = await fetch(`/api/spaces/${spaceToDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete space");
      }
      setSpaceToDelete(null);
      loadHomeData();
    } catch (err) {
      console.error("Failed to delete space:", err);
      alert("Failed to delete space. Please try again.");
    } finally {
      setDeletingSpace(false);
    }
  }

  async function handleDeleteProject() {
    if (!projectToDelete) return;
    setDeletingProject(true);
    try {
      const res = await fetch(`/api/projects/${projectToDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project");
      }
      setProjectToDelete(null);
      loadHomeData();
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project. Please try again.");
    } finally {
      setDeletingProject(false);
    }
  }

  const [claimingDaily, setClaimingDaily] = useState(false);

  async function handleClaimDaily() {
    setClaimingDaily(true);
    try {
      const res = await fetch("/api/rewards", { method: "POST" });
      const data = await res.json();
      if (data.profile) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("points-updated"));
        }
        loadHomeData();
      }
    } catch (err) {
      console.error("Failed to claim daily reward:", err);
    } finally {
      setClaimingDaily(false);
    }
  }

  useEffect(() => {
    loadHomeData();
    window.addEventListener("points-updated", loadHomeData);
    return () => window.removeEventListener("points-updated", loadHomeData);
  }, []);

  const continueProject = data?.continueLearningProject;
  const recommendations = data?.recommendations || [];
  const weakConcepts = data?.weakConcepts || [];
  const spaces = data?.spaces || [];
  const projects = data?.projects || [];
  const stats = data?.stats || { totalSpaces: 0, totalProjects: 0, averageMastery: 0, weakConceptsCount: 0 };
  const gamification = data?.gamification;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header onRefresh={loadHomeData} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Welcome & Overview Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                Personalized Learning Space
              </span>
              <span className="text-xs text-slate-400">• Persistent & Contextual</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Welcome back, {data?.user?.name || "Learner"}! 👋
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Here is your learning summary answering: <span className="font-medium text-slate-800">Where you were, how you are doing, and what to do next.</span>
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="text-xs text-slate-500 font-medium">Spaces</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{stats.totalSpaces}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="text-xs text-slate-500 font-medium">Active Projects</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{stats.totalProjects}</div>
            </div>
            <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
              <div className="text-xs text-indigo-700 font-medium">Avg. Mastery</div>
              <div className="text-xl font-bold text-indigo-900 mt-0.5">{stats.averageMastery}%</div>
            </div>
            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80">
              <div className="text-xs text-amber-700 font-medium">Focus Concepts</div>
              <div className="text-xl font-bold text-amber-900 mt-0.5">{stats.weakConceptsCount}</div>
            </div>
          </div>
        </div>

        {/* Gamification & Daily Study Streak Banner */}
        <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 rounded-2xl border border-amber-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Flame className="w-7 h-7 fill-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Level {gamification?.level || 1} • {gamification?.levelTitle || "Apprentice Scholar"}
                </span>
                <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 fill-rose-500" /> {gamification?.currentStreak || 0} Day Streak
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                Keep your momentum going, {data?.user?.name || "Scholar"}!
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
                Earn points and unlock badges by asking questions to your grounded tutor, taking adaptive quizzes, or exploring with the voice agent.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Level progress meter */}
            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-slate-200 min-w-[190px]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> {gamification?.points || 0} pts
                </span>
                <span className="text-[11px] text-slate-500">
                  {gamification?.pointsToNext ? `${gamification.pointsToNext} to Lvl ${(gamification?.level || 1) + 1}` : "Top Level"}
                </span>
              </div>
              <ProgressBar value={gamification?.progressPct || 0} size="sm" color="amber" />
            </div>

            {gamification?.canClaimDaily && (
              <button
                type="button"
                onClick={handleClaimDaily}
                disabled={claimingDaily}
                className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer shrink-0"
              >
                <Flame className="w-3.5 h-3.5 fill-white" />
                <span>{claimingDaily ? "Claiming..." : "Claim Daily Streak (+30 XP)"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsRewardsModalOpen(true)}
              className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Rewards & Badges</span>
            </button>
          </div>
        </div>

        {/* Section 1: "Continue Learning" & "Recommended Next Action" */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Continue Learning Card */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full blur-3xl -z-0 pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                    <Clock className="w-4 h-4" />
                  </span>
                  <h2 className="text-base font-semibold text-slate-900">
                    Continue Learning
                  </h2>
                </div>
                {continueProject && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {continueProject.space?.name}
                  </span>
                )}
              </div>

              {continueProject ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                      <Link href={`/projects/${continueProject.id}`}>
                        {continueProject.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                      {continueProject.learningGoal}
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70">
                    <div className="flex justify-between items-center text-xs text-slate-600 mb-1.5">
                      <span className="font-medium">Project Mastery Progress</span>
                      <span className="font-bold text-slate-900">{continueProject.progress}%</span>
                    </div>
                    <ProgressBar value={continueProject.progress} showLabel={false} />
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      {continueProject._count?.materials || 0} Materials
                    </span>
                    <span className="flex items-center gap-1">
                      <Brain className="w-3.5 h-3.5 text-slate-400" />
                      {continueProject._count?.concepts || 0} Concepts
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500">
                  <p className="text-sm">No active project yet.</p>
                  <button
                    onClick={() => {
                      setSelectedSpaceId(undefined);
                      setIsProjectModalOpen(true);
                    }}
                    className="mt-3 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer transition-colors"
                  >
                    Start Your First Project
                  </button>
                </div>
              )}
            </div>

            {continueProject && (
              <div className="pt-6 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">Jump right back into your session</span>
                <Link
                  href={`/projects/${continueProject.id}`}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm group"
                >
                  <span>Resume Workspace</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            )}
          </div>

          {/* Actionable Recommendations (What should I do next?) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 rounded-lg bg-amber-500 text-white shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h2 className="text-base font-semibold text-slate-900">
                    What Should I Do Next?
                  </h2>
                </div>
                <span className="text-xs text-slate-400">Dynamic Guidance</span>
              </div>

              <div className="space-y-3">
                {recommendations.length > 0 ? (
                  recommendations.map((rec: any) => (
                    <div
                      key={rec.id}
                      className="p-3.5 rounded-xl border border-slate-100 hover:border-indigo-200 bg-slate-50/50 hover:bg-indigo-50/30 transition-all text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          rec.priority === "HIGH"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {rec.priority} Priority
                        </span>
                        <span className="text-xs text-slate-400">{rec.project?.name}</span>
                      </div>
                      <h4 className="font-semibold text-sm text-slate-900 mt-1.5 group-hover:text-indigo-600 transition-colors">
                        {rec.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {rec.reason}
                      </p>
                      {rec.targetUrl && (
                        <div className="mt-2 text-right">
                          <Link
                            href={rec.targetUrl}
                            className="inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-700"
                          >
                            Take Action <ArrowRight className="w-3 h-3 ml-1" />
                          </Link>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-slate-400 text-sm">
                    No active recommendations. Great job keeping up!
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
              <span>Personalized based on quizzes & tutor context</span>
            </div>
          </div>
        </div>

        {/* Section 2: Areas Requiring Attention (<60% Mastery) */}
        {weakConcepts.length > 0 && (
          <div className="bg-white rounded-2xl border border-rose-100 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Areas Requiring Attention
                  </h2>
                  <p className="text-xs text-slate-500">
                    Concepts where your mastery is below 60% or recent mistakes were made.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {weakConcepts.map((item: any) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>{item.project?.name}</span>
                      <span className="font-semibold text-rose-600">{item.masteryScore}%</span>
                    </div>
                    <div className="font-medium text-sm text-slate-900">
                      {item.concept?.name}
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={item.masteryScore} size="sm" showLabel={false} />
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Attempts: {item.totalAttempts} ({item.correctAttempts} correct)
                    </span>
                    <Link
                      href={`/projects/${item.projectId}?tab=tutor&concept=${encodeURIComponent(item.concept?.name)}`}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Ask Tutor →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Spaces & Projects Explorer */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Your Learning Spaces
              </h2>
              <p className="text-xs text-slate-500">
                Broad learning areas containing focused project journeys.
              </p>
            </div>
            <button
              onClick={() => setIsSpaceModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Space</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {spaces.map((space: any) => {
              const spaceProjects = projects.filter((p: any) => p.spaceId === space.id);
              return (
                <div
                  key={space.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">
                            <Link href={`/spaces/${space.id}`} className="hover:text-indigo-600">
                              {space.name}
                            </Link>
                          </h3>
                          <span className="text-xs text-slate-400">
                            {space._count?.projects || 0} Focused Projects
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setSpaceToDelete(space);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Space"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/spaces/${space.id}`}
                          className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-0.5"
                        >
                          View Space <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>

                    {space.description && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                        {space.description}
                      </p>
                    )}

                    {/* Projects in this space */}
                    <div className="mt-4 space-y-2">
                      {spaceProjects.map((proj: any) => (
                        <Link
                          key={proj.id}
                          href={`/projects/${proj.id}`}
                          className="p-2.5 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50/70 flex items-center justify-between group transition-colors block"
                        >
                          <div className="truncate pr-3">
                            <div className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 truncate">
                              {proj.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {proj.learningGoal}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setProjectToDelete(proj);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                              title="Delete Project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="w-16 text-right shrink-0">
                              <span className="text-[11px] font-bold text-slate-700">
                                {proj.progress}%
                              </span>
                              <div className="w-full bg-slate-200 h-1 rounded-full mt-1">
                                <div
                                  className="bg-indigo-600 h-1 rounded-full"
                                  style={{ width: `${proj.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}

                      {spaceProjects.length === 0 && (
                        <div className="text-xs text-slate-400 py-2 italic text-center">
                          No projects created in this space yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => {
                        setSelectedSpaceId(space.id);
                        setIsProjectModalOpen(true);
                      }}
                      className="text-xs text-slate-600 hover:text-indigo-600 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Project to Space
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* Modals */}
      <CreateSpaceModal
        isOpen={isSpaceModalOpen}
        onClose={() => setIsSpaceModalOpen(false)}
        onCreated={(space) => {
          setIsSpaceModalOpen(false);
          if (space?.id) {
            router.push(`/spaces/${space.id}`);
          } else {
            loadHomeData();
          }
        }}
      />

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        defaultSpaceId={selectedSpaceId}
        onClose={() => {
          setIsProjectModalOpen(false);
          setSelectedSpaceId(undefined);
        }}
        onCreated={(project) => {
          setIsProjectModalOpen(false);
          setSelectedSpaceId(undefined);
          if (project?.id) {
            router.push(`/projects/${project.id}`);
          } else {
            loadHomeData();
          }
        }}
        onOpenCreateSpace={() => {
          setIsProjectModalOpen(false);
          setIsSpaceModalOpen(true);
        }}
      />
      <ConfirmDeleteModal
        isOpen={Boolean(spaceToDelete)}
        title="Delete Learning Space?"
        description="Are you sure you want to delete this space? All associated projects, documents, knowledge concepts, and study notes within this space will also be permanently deleted."
        itemName={spaceToDelete?.name}
        itemType="Space"
        loading={deletingSpace}
        onConfirm={handleDeleteSpace}
        onClose={() => setSpaceToDelete(null)}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(projectToDelete)}
        title="Delete Learning Project?"
        description="Are you sure you want to delete this project? All associated study materials, generated quizzes, chat sessions, and progress data will be permanently removed."
        itemName={projectToDelete?.name}
        itemType="Project"
        loading={deletingProject}
        onConfirm={handleDeleteProject}
        onClose={() => setProjectToDelete(null)}
      />

      {/* Floating Voice Companion */}
      <FloatingVoiceOrb />

      {/* Rewards & Achievements Modal */}
      <RewardsModal
        isOpen={isRewardsModalOpen}
        onClose={() => setIsRewardsModalOpen(false)}
        onRewardClaimed={loadHomeData}
      />
    </div>
  );
}
