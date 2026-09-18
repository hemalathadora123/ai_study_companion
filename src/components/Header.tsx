"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  GraduationCap, 
  Plus, 
  FolderPlus, 
  Layers, 
  ShieldCheck, 
  User, 
  Sparkles,
  ChevronDown,
  LogOut,
  Mic,
  Flame,
  Star,
  Trophy
} from "lucide-react";
import CreateSpaceModal from "./CreateSpaceModal";
import CreateProjectModal from "./CreateProjectModal";
import VoiceAgentModal from "./voice/VoiceAgentModal";
import RewardsModal from "./rewards/RewardsModal";

interface HeaderProps {
  onRefresh?: () => void;
  activeSpaceName?: string;
  activeProjectName?: string;
  activeSpaceId?: string;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  points?: number;
  level?: number;
  currentStreak?: number;
}

export default function Header({
  onRefresh,
  activeSpaceName,
  activeProjectName,
  activeSpaceId,
}: HeaderProps) {
  const router = useRouter();
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fetchUser() {
      fetch("/api/auth/me")
        .then((res) => (res.ok ? res.json().catch(() => null) : null))
        .then((data) => {
          if (data?.user) setCurrentUser(data.user);
        })
        .catch(() => {});
    }

    fetchUser();
    window.addEventListener("points-updated", fetchUser);
    return () => window.removeEventListener("points-updated", fetchUser);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      window.location.href = "/login";
    } catch (err) {
      console.error("Sign out failed:", err);
      window.location.href = "/login";
    }
  }

  // Generate initials
  const initials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AD";

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Brand and Breadcrumbs */}
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <Link href="/" className="flex items-center space-x-2 group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
                <span className="hidden sm:inline">AI Study Companion</span>
                <span className="sm:hidden font-extrabold">Study AI</span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  <Sparkles className="w-3 h-3 mr-1 text-indigo-500" />
                  Workspace
                </span>
              </span>
            </div>
          </Link>

          {/* Breadcrumb Navigation */}
          {(activeSpaceName || activeProjectName) && (
            <div className="hidden md:flex items-center space-x-2 text-sm text-slate-500 pl-4 border-l border-slate-200 min-w-0">
              <Link href="/" className="hover:text-indigo-600 transition-colors shrink-0">
                Home
              </Link>
              {activeSpaceName && (
                <>
                  <span className="text-slate-400 shrink-0">/</span>
                  <span className="font-medium text-slate-700 max-w-[140px] truncate" title={activeSpaceName}>
                    {activeSpaceName}
                  </span>
                </>
              )}
              {activeProjectName && (
                <>
                  <span className="text-slate-400 shrink-0">/</span>
                  <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded max-w-[160px] truncate" title={activeProjectName}>
                    {activeProjectName}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* Quick Action Buttons */}
          <button
            type="button"
            onClick={() => setIsSpaceModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            title="Create a new Learning Space"
          >
            <FolderPlus className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="hidden sm:inline">New Space</span>
            <span className="sm:hidden text-xs">Space</span>
          </button>

          <button
            type="button"
            onClick={() => setIsProjectModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium shadow-sm transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            title="Create a new Learning Project"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden text-xs">Project</span>
          </button>

          {/* Voice Tutor Quick Action */}
          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50/70 text-purple-700 hover:bg-purple-100/80 text-sm font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            title="Open Interactive AI Voice Companion"
          >
            <Mic className="w-4 h-4 text-purple-600 animate-pulse shrink-0" />
            <span className="hidden sm:inline">Voice Tutor</span>
            <span className="sm:hidden text-xs">Voice</span>
          </button>

          {/* Student Points & Streak Badge */}
          <button
            type="button"
            onClick={() => setIsRewardsModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50/80 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
            title="View Points, Streaks & Achievements"
          >
            <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            <span>{currentUser?.currentStreak || 0}d</span>
            <span className="text-slate-300">•</span>
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>{currentUser?.points || 0} pts</span>
          </button>

          {/* Admin Dashboard link */}
          <Link
            href="/admin"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100/70 text-sm font-medium transition-colors"
            title="Platform Telemetry, Evaluation & Background Workflows"
          >
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">Admin</span>
          </Link>

          {/* User Profile Tag with Dropdown */}
          <div className="relative pl-2 border-l border-slate-200" ref={dropdownRef}>
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center space-x-2 text-left p-1 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer focus:outline-hidden"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                {initials}
              </div>
              <div className="hidden lg:block text-left text-xs">
                <div className="font-semibold text-slate-800 flex items-center gap-1">
                  <span>{currentUser?.name || "Alex Dev"}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>
                <div className="text-slate-400">
                  {currentUser?.role === "ADMIN" ? "Administrator" : "Learner Mode"}
                </div>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in-50 slide-in-from-top-1">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900">{currentUser?.name || "Learner"}</div>
                  <div className="text-[11px] text-slate-500 truncate">{currentUser?.email || "alex@example.com"}</div>
                  <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {currentUser?.role || "USER"}
                  </div>
                </div>

                <div className="p-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateSpaceModal
        isOpen={isSpaceModalOpen}
        onClose={() => setIsSpaceModalOpen(false)}
        onCreated={(space) => {
          setIsSpaceModalOpen(false);
          if (space?.id) {
            router.push(`/spaces/${space.id}`);
            router.refresh();
          }
          if (onRefresh) {
            onRefresh();
          }
        }}
      />

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        defaultSpaceId={activeSpaceId}
        onClose={() => setIsProjectModalOpen(false)}
        onCreated={(project) => {
          setIsProjectModalOpen(false);
          if (project?.id) {
            router.push(`/projects/${project.id}`);
            router.refresh();
          }
          if (onRefresh) {
            onRefresh();
          }
        }}
        onOpenCreateSpace={() => {
          setIsProjectModalOpen(false);
          setIsSpaceModalOpen(true);
        }}
      />

      <VoiceAgentModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />

      <RewardsModal
        isOpen={isRewardsModalOpen}
        onClose={() => setIsRewardsModalOpen(false)}
        onRewardClaimed={() => {
          fetch("/api/auth/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.user) setCurrentUser(data.user);
            });
          if (onRefresh) onRefresh();
        }}
      />
    </header>
  );
}
