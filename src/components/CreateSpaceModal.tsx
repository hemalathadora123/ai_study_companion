"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  FolderPlus, 
  Loader2, 
  Brain, 
  Folder, 
  Layers, 
  BookOpen, 
  Sparkles, 
  Code, 
  GraduationCap, 
  Cpu 
} from "lucide-react";

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (space?: any) => void;
}

const COLOR_OPTIONS = [
  { name: "indigo", label: "Indigo", bg: "bg-indigo-500", border: "border-indigo-600" },
  { name: "emerald", label: "Emerald", bg: "bg-emerald-500", border: "border-emerald-600" },
  { name: "purple", label: "Purple", bg: "bg-purple-500", border: "border-purple-600" },
  { name: "amber", label: "Amber", bg: "bg-amber-500", border: "border-amber-600" },
  { name: "rose", label: "Rose", bg: "bg-rose-500", border: "border-rose-600" },
  { name: "sky", label: "Sky", bg: "bg-sky-500", border: "border-sky-600" },
];

const ICON_OPTIONS = [
  { name: "Folder", label: "Folder", icon: Folder },
  { name: "Brain", label: "Brain", icon: Brain },
  { name: "Layers", label: "Layers", icon: Layers },
  { name: "BookOpen", label: "Book", icon: BookOpen },
  { name: "Sparkles", label: "AI", icon: Sparkles },
  { name: "Code", label: "Code", icon: Code },
  { name: "GraduationCap", label: "Academy", icon: GraduationCap },
  { name: "Cpu", label: "Systems", icon: Cpu },
];

export default function CreateSpaceModal({ isOpen, onClose, onCreated }: CreateSpaceModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("indigo");
  const [icon, setIcon] = useState("Folder");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setColor("indigo");
      setIcon("Folder");
      setError(null);
      setLoading(false);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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
    if (!name.trim()) {
      setError("Please provide a name for this Space");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          icon,
        }),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create space");
      }

      setName("");
      setDescription("");
      setColor("indigo");
      setIcon("Folder");
      onCreated(data.space);
    } catch (err: any) {
      setError(err.message || "Something went wrong while creating the space");
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
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Create Learning Space</h3>
              <p className="text-[11px] text-slate-400">Organize your projects under a common subject domain</p>
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
            <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Space Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Machine Learning, System Design, Bioengineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder:text-slate-400"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              placeholder="Broad learning area, exam certification, or professional domain goals..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Icon
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {ICON_OPTIONS.map((item) => {
                  const IconComp = item.icon;
                  const isSelected = icon === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setIcon(item.name)}
                      className={`p-2 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50 border-indigo-500 text-indigo-600 shadow-xs"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                      title={item.label}
                    >
                      <IconComp className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Color Accent
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setColor(c.name)}
                    className={`w-7 h-7 rounded-full ${c.bg} transition-all cursor-pointer ${
                      color === c.name ? "ring-3 ring-offset-2 ring-indigo-500 scale-110" : "opacity-75 hover:opacity-100"
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
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
              disabled={loading || !name.trim()}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Create Space</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
