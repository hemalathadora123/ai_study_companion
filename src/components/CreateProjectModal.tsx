"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Target, Loader2, Sparkles, FolderPlus } from "lucide-react";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project?: any) => void;
  defaultSpaceId?: string;
  onOpenCreateSpace?: () => void;
}

export default function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
  defaultSpaceId,
  onOpenCreateSpace,
}: CreateProjectModalProps) {
  const [mounted, setMounted] = useState(false);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [spaceId, setSpaceId] = useState(defaultSpaceId || "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingSpaces, setFetchingSpaces] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state and fetch spaces when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setName("");
    setDescription("");
    setLearningGoal("");
    setError(null);
    setLoading(false);
    setFetchingSpaces(true);
    document.body.style.overflow = "hidden";

    fetch("/api/spaces")
      .then((res) => res.json())
      .then((data) => {
        const list = data.spaces || [];
        setSpaces(list);

        if (defaultSpaceId && list.some((s: any) => s.id === defaultSpaceId)) {
          setSpaceId(defaultSpaceId);
        } else if (list.length > 0) {
          setSpaceId(list[0].id);
        } else {
          setSpaceId("");
        }
      })
      .catch((err) => {
        console.error("Failed to load spaces:", err);
        setError("Failed to load spaces list. Please try again.");
      })
      .finally(() => setFetchingSpaces(false));

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, defaultSpaceId]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!spaceId) {
      setError("Please select a Space for this Project");
      return;
    }
    if (!name.trim()) {
      setError("Please provide a project name");
      return;
    }
    if (!learningGoal.trim()) {
      setError("Please specify a concrete learning goal");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId,
          name: name.trim(),
          description: description.trim() || undefined,
          learningGoal: learningGoal.trim(),
        }),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      setName("");
      setDescription("");
      setLearningGoal("");
      onCreated(data.project);
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  const modalContent = (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Create Learning Project</h3>
              <p className="text-[11px] text-slate-400">Launch a focused study journey with AI tutor & evaluations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Parent Space <span className="text-rose-500">*</span>
              </label>
              {onOpenCreateSpace && (
                <button
                  type="button"
                  onClick={onOpenCreateSpace}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>+ New Space</span>
                </button>
              )}
            </div>

            {fetchingSpaces ? (
              <div className="text-xs text-slate-500 flex items-center gap-2 py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-200">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Loading your learning spaces...</span>
              </div>
            ) : spaces.length === 0 ? (
              <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2">
                <p>You do not have any Spaces yet. Projects must belong to a Space.</p>
                {onOpenCreateSpace && (
                  <button
                    type="button"
                    onClick={onOpenCreateSpace}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Create a Space First</span>
                  </button>
                )}
              </div>
            ) : (
              <select
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white cursor-pointer"
                required
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Attention Mechanisms & Transformers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder:text-slate-400"
              required
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Learning Goal <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-normal text-indigo-600 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Grounds AI Tutor & Assessments
              </span>
            </div>
            <input
              type="text"
              placeholder="e.g. Master self-attention query-key-value math and multi-head projections"
              value={learningGoal}
              onChange={(e) => setLearningGoal(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder:text-slate-400"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Your AI tutor uses this goal to focus discussions, quiz questions, and concept metrics.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              placeholder="Context, focus areas, or specific textbook chapters..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder:text-slate-400"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || spaces.length === 0 || !name.trim() || !learningGoal.trim()}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Create Project</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
