"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Target, 
  ArrowLeft, 
  BookOpen, 
  Brain, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  MessageSquare, 
  HelpCircle, 
  BarChart3, 
  TrendingUp, 
  Loader2,
  FileText,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Trash2,
  CreditCard,
} from "lucide-react";
import Header from "@/components/Header";
import ProgressBar from "@/components/ProgressBar";
import MaterialsManager from "@/components/MaterialsManager";
import FlashcardsManager from "@/components/FlashcardsManager";
import TutorChat from "@/components/TutorChat";
import QuizManager from "@/components/QuizManager";
import GrowthDashboard from "@/components/GrowthDashboard";
import ObservabilityDashboard from "@/components/ObservabilityDashboard";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import FloatingVoiceOrb from "@/components/voice/FloatingVoiceOrb";

type TabType = "overview" | "materials" | "flashcards" | "tutor" | "quiz" | "growth" | "analytics";

export default function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteProject() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project");
      }
      if (projectData?.project?.spaceId) {
        router.push(`/spaces/${projectData.project.spaceId}`);
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project. Please try again.");
    } finally {
      setDeleting(false);
      setIsDeleteModalOpen(false);
    }
  }

  function loadProject() {
    setLoading(true);
    fetch(`/api/projects/${projectId}`)
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = `/login?returnUrl=/projects/${projectId}`;
          return null;
        }
        if (!res.ok) {
          try {
            const errData = await res.json();
            console.warn("Project fetch failed:", errData.error || res.statusText);
          } catch {
            console.warn("Project fetch returned status:", res.status);
          }
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setProjectData(data);
        } else {
          setProjectData(null);
        }
      })
      .catch((err) => {
        console.error("Failed to load project:", err);
        setProjectData(null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProject();
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (!projectData?.project) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <h2 className="text-xl font-bold text-slate-800">Project Not Found</h2>
          <Link href="/" className="mt-4 text-sm text-indigo-600 hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const { project, averageMastery, masteries } = projectData;
  const materials = project.materials || [];
  const concepts = project.concepts || [];
  const recommendations = project.recommendations || [];
  const conversations = project.conversations || [];
  const quizzes = project.quizzes || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header
        activeSpaceName={project.space?.name}
        activeProjectName={project.name}
        activeSpaceId={project.spaceId}
        onRefresh={loadProject}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Top Breadcrumb & Actions */}
        <div className="flex items-center justify-between">
          <Link
            href={`/spaces/${project.spaceId}`}
            className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Space: {project.space?.name}
          </Link>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            title="Delete this project"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Project</span>
          </button>
        </div>

        {/* Project Header Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Project Workspace
                </span>
                <span className="text-xs text-slate-400">• Data Isolated</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {project.name}
              </h1>
              
              {/* Learning Goal Banner */}
              <div className="bg-gradient-to-r from-indigo-50/90 to-purple-50/70 border border-indigo-100/80 rounded-xl p-3.5 text-sm flex items-start gap-3">
                <Target className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                    Target Learning Goal
                  </div>
                  <div className="text-indigo-950 font-medium mt-0.5">
                    {project.learningGoal}
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Mastery Meter */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 min-w-[220px] shrink-0 text-center">
              <div className="text-xs text-slate-500 font-medium">Estimated Mastery</div>
              <div className="text-3xl font-extrabold text-slate-900 my-1">
                {averageMastery}%
              </div>
              <ProgressBar value={averageMastery} showLabel={false} size="sm" />
              <div className="text-[11px] text-slate-400 mt-2">
                Across {concepts.length} key concepts
              </div>
            </div>
          </div>

          {/* PRD Primary Learning Loop Navigation Bar */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
            {[
              { id: "overview", label: "Overview", icon: Layers },
              { id: "materials", label: `Materials (${materials.length})`, icon: BookOpen },
              { id: "flashcards", label: "Flashcards", icon: CreditCard },
              { id: "tutor", label: "AI Tutor", icon: MessageSquare },
              { id: "quiz", label: "Adaptive Quiz", icon: HelpCircle },
              { id: "growth", label: "Mastery & Growth", icon: TrendingUp },
              { id: "analytics", label: "Analytics", icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Concept Mastery Snapshot (PRD Section 10 Page 10) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Brain className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-slate-900 text-base">
                      Core Concepts Mastery
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab("growth")}
                    className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1"
                  >
                    View Growth Matrix <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-4">
                  {concepts.map((concept: any) => {
                    const mastery = masteries.find((m: any) => m.conceptId === concept.id);
                    const score = mastery?.masteryScore || 0;
                    const status = mastery?.status || "NEEDS_ATTENTION";

                    let badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
                    if (status === "IMPROVING") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    if (status === "STABLE") badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-200";

                    return (
                      <div key={concept.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="font-semibold text-slate-800 flex items-center gap-2">
                            <span>{concept.name}</span>
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded border ${badgeColor}`}>
                              {status.replace("_", " ")}
                            </span>
                          </div>
                          <span className="font-bold text-slate-700">{score}%</span>
                        </div>
                        <ProgressBar value={score} showLabel={false} size="sm" />
                      </div>
                    );
                  })}

                  {concepts.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No concepts indexed yet. Upload learning materials to extract key concepts automatically.
                    </div>
                  )}
                </div>
              </div>

              {/* Recommended Next Actions */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-slate-900 text-base">
                      Next Step Guidance
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {recommendations.length > 0 ? (
                      recommendations.map((rec: any) => (
                        <div
                          key={rec.id}
                          className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              rec.priority === "HIGH" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                            }`}>
                              {rec.priority} Priority
                            </span>
                            <span className="text-[11px] text-slate-400">{rec.type}</span>
                          </div>
                          <h4 className="font-semibold text-xs text-slate-900 mt-2">
                            {rec.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            {rec.reason}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        No pending recommendations!
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Ready to test?</span>
                  <button
                    onClick={() => setActiveTab("quiz")}
                    className="font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    Start Adaptive Assessment →
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Nav to Loop */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div>
                <h4 className="font-bold text-base">
                  Follow the Primary Learning Loop
                </h4>
                <p className="text-xs text-indigo-100 mt-0.5">
                  Materials → Grounded AI Tutor → Adaptive Quiz → Mastery Growth → Action
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("materials")}
                  className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-xs"
                >
                  Upload PDFs
                </button>
                <button
                  onClick={() => setActiveTab("tutor")}
                  className="px-4 py-1.5 rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-bold shadow-xs"
                >
                  Open AI Tutor
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: MATERIALS */}
        {activeTab === "materials" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <MaterialsManager
              projectId={project.id}
              onMaterialsChanged={loadProject}
            />
          </div>
        )}

        {/* Tab: SMART FLASHCARDS */}
        {activeTab === "flashcards" && (
          <FlashcardsManager projectId={project.id} />
        )}

        {/* Tab 3: GROUNDED AI TUTOR */}
        {activeTab === "tutor" && (
          <TutorChat
            projectId={project.id}
            projectName={project.name}
            learningGoal={project.learningGoal}
          />
        )}

        {/* Tab 4: ADAPTIVE QUIZ */}
        {activeTab === "quiz" && (
          <QuizManager
            projectId={project.id}
            onQuizCompleted={loadProject}
          />
        )}

        {/* Tab 5: MASTERY & GROWTH */}
        {activeTab === "growth" && (
          <GrowthDashboard
            projectId={project.id}
            onNavigateTab={(tab) => setActiveTab(tab as TabType)}
          />
        )}

        {/* Tab 6: ANALYTICS & OBSERVABILITY */}
        {activeTab === "analytics" && (
          <ObservabilityDashboard projectId={project.id} />
        )}

        <ConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          title="Delete Learning Project?"
          description="Are you sure you want to permanently delete this project? All associated study materials, extracted concepts, chat histories, quizzes, and mastery tracking will be permanently lost."
          itemName={project.name}
          itemType="Project"
          loading={deleting}
          onConfirm={handleDeleteProject}
          onClose={() => setIsDeleteModalOpen(false)}
        />

        {/* Floating Voice Companion */}
        <FloatingVoiceOrb
          projectId={project.id}
          projectName={project.name}
          learningGoal={project.learningGoal}
        />

      </main>
    </div>
  );
}
