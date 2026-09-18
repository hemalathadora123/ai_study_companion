"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Layers, 
  Plus, 
  Target, 
  ArrowLeft, 
  ArrowRight, 
  BookOpen, 
  Brain, 
  Loader2, 
  Calendar, 
  Sparkles,
  Trash2
} from "lucide-react";
import Header from "@/components/Header";
import ProgressBar from "@/components/ProgressBar";
import CreateProjectModal from "@/components/CreateProjectModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import FloatingVoiceOrb from "@/components/voice/FloatingVoiceOrb";

export default function SpaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const spaceId = resolvedParams.id;

  const [space, setSpace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isDeleteSpaceModalOpen, setIsDeleteSpaceModalOpen] = useState(false);
  const [deletingSpace, setDeletingSpace] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  function loadSpace() {
    setLoading(true);
    fetch(`/api/spaces/${spaceId}`)
      .then((res) => res.json())
      .then((data) => setSpace(data.space))
      .catch((err) => console.error("Failed to load space:", err))
      .finally(() => setLoading(false));
  }

  async function handleDeleteSpace() {
    setDeletingSpace(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete space");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Failed to delete space:", err);
      alert("Failed to delete space. Please try again.");
    } finally {
      setDeletingSpace(false);
      setIsDeleteSpaceModalOpen(false);
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
      loadSpace();
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project. Please try again.");
    } finally {
      setDeletingProject(false);
    }
  }

  useEffect(() => {
    loadSpace();
  }, [spaceId]);

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

  if (!space) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <h2 className="text-xl font-bold text-slate-800">Space Not Found</h2>
          <Link href="/" className="mt-4 text-sm text-indigo-600 hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const projects = space.projects || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header activeSpaceName={space.name} activeSpaceId={space.id} onRefresh={loadSpace} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Home
          </Link>
        </div>

        {/* Space Header Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                  Learning Space
                </span>
                <span className="text-xs text-slate-400">
                  {projects.length} {projects.length === 1 ? "Project" : "Projects"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                {space.name}
              </h1>
              {space.description && (
                <p className="text-slate-600 text-sm mt-1.5 max-w-2xl">
                  {space.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            <button
              type="button"
              onClick={() => setIsDeleteSpaceModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 rounded-xl text-sm font-medium transition-all cursor-pointer shadow-2xs"
              title="Delete this Space"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete Space</span>
            </button>

            <button
              type="button"
              onClick={() => setIsProjectModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Learning Project</span>
            </button>
          </div>
        </div>

        {/* Projects List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Focused Learning Projects
            </h2>
            <span className="text-xs text-slate-500">
              Each project maintains its own isolated materials, knowledge & AI Tutor
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj: any) => (
              <div
                key={proj.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {proj.status}
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-indigo-500" />
                      Goal Set
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors">
                    <Link href={`/projects/${proj.id}`}>
                      {proj.name}
                    </Link>
                  </h3>

                  <div className="mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-500" /> Learning Goal:
                    </div>
                    <p className="text-xs text-slate-700 mt-0.5 line-clamp-2">
                      {proj.learningGoal}
                    </p>
                  </div>

                  {proj.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                      {proj.description}
                    </p>
                  )}

                  <div className="mt-4">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-slate-500">Mastery Progress</span>
                      <span className="font-bold text-slate-800">{proj.progress}%</span>
                    </div>
                    <ProgressBar value={proj.progress} showLabel={false} size="sm" />
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      {proj._count?.materials || 0} Materials
                    </span>
                    <span className="flex items-center gap-1">
                      <Brain className="w-3.5 h-3.5 text-slate-400" />
                      {proj._count?.concepts || 0} Concepts
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setProjectToDelete(proj);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Link
                    href={`/projects/${proj.id}`}
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}

            {projects.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
                <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-800">No Projects in this Space yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Start your journey in {space.name} by setting a concrete learning goal and uploading documents.
                </p>
                <button
                  onClick={() => setIsProjectModalOpen(true)}
                  className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Project</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </main>

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onCreated={(project) => {
          setIsProjectModalOpen(false);
          if (project?.id) {
            router.push(`/projects/${project.id}`);
          } else {
            loadSpace();
          }
        }}
        defaultSpaceId={space.id}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteSpaceModalOpen}
        title="Delete Learning Space?"
        description="Are you sure you want to permanently delete this space? All associated projects, uploaded materials, knowledge concepts, and study notes within this space will also be deleted."
        itemName={space.name}
        itemType="Space"
        loading={deletingSpace}
        onConfirm={handleDeleteSpace}
        onClose={() => setIsDeleteSpaceModalOpen(false)}
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
    </div>
  );
}
