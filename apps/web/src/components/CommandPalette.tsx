import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectSummary } from "@sonofcotester/sdk";
import { CheckCircle, Crown, Flask, Folder, Globe, GraduationCap, Lightning, MagnifyingGlass, Plus, Robot, Rocket, ShieldCheck, Sparkle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Navigation" | "Execution" | "Health & Security" | "Academy" | "Projects" | "Local AI (Ollama)";
  icon: Icon;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: "testing" | "health" | "admin" | "academy" | "maestro") => void;
  onRunSmoke: () => void;
  onCrawlTarget: () => void;
  onGenerateTests: () => void;
  onNewProject: () => void;
  projects: ProjectSummary[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onOpenStorefront: () => void;
  installedAiModels?: Array<{ name: string; parameterSize?: string }>;
  activeAiModel?: string | null;
  onSelectAiModel?: (model: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onRunSmoke,
  onCrawlTarget,
  onGenerateTests,
  onNewProject,
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenStorefront,
  installedAiModels,
  activeAiModel,
  onSelectAiModel
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Navigation
      {
        id: "nav-testing",
        title: "Test Console",
        subtitle: "Interactive test editor, execution runner, and live stream",
        category: "Navigation",
        icon: Flask,
        shortcut: "1",
        action: () => {
          onNavigate("testing");
          onClose();
        }
      },
      {
        id: "nav-health",
        title: "Health Monitor & 5-D APM",
        subtitle: "Security, UI/UX, DB latency, performance, and test health",
        category: "Navigation",
        icon: ShieldCheck,
        shortcut: "2",
        action: () => {
          onNavigate("health");
          onClose();
        }
      },
      {
        id: "nav-maestro",
        title: "Maestro Studio",
        subtitle: "Declarative mobile flows, YAML generation, and cloud device farm",
        category: "Navigation",
        icon: Lightning,
        shortcut: "3",
        action: () => {
          onNavigate("maestro");
          onClose();
        }
      },
      {
        id: "nav-academy",
        title: "Student Testing Academy",
        subtitle: "Interactive modules, AI test tutor, and verified certificates",
        category: "Navigation",
        icon: GraduationCap,
        shortcut: "4",
        action: () => {
          onNavigate("academy");
          onClose();
        }
      },
      {
        id: "nav-admin",
        title: "Admin & Subscriptions",
        subtitle: "API keys, audit logs stream, BullMQ telemetry, and plan metering",
        category: "Navigation",
        icon: Crown,
        shortcut: "5",
        action: () => {
          onNavigate("admin");
          onClose();
        }
      },
      {
        id: "nav-storefront",
        title: "Public Storefront / Landing Page",
        subtitle: "View high-converting public landing page and pricing tiers",
        category: "Navigation",
        icon: Globe,
        action: () => {
          onOpenStorefront();
          onClose();
        }
      },

      // Execution
      {
        id: "exec-smoke",
        title: "Run Instant Smoke Test",
        subtitle: "Execute Playwright smoke test against configured target URL",
        category: "Execution",
        icon: Rocket,
        shortcut: "⌘↵",
        action: () => {
          onRunSmoke();
          onClose();
        }
      },
      {
        id: "exec-crawl",
        title: "Inspect & Crawl Target App",
        subtitle: "Discover interactive buttons, inputs, links, and accessibility tree",
        category: "Execution",
        icon: MagnifyingGlass,
        action: () => {
          onNavigate("testing");
          onCrawlTarget();
          onClose();
        }
      },
      {
        id: "exec-generate",
        title: "Synthesize Tests from Crawled DOM",
        subtitle: "AI auto-generates resilient Playwright and Maestro test cases",
        category: "Execution",
        icon: Sparkle,
        action: () => {
          onNavigate("testing");
          onGenerateTests();
          onClose();
        }
      },

      // Academy
      {
        id: "acad-tutor",
        title: "Ask AI Testing Tutor",
        subtitle: "Get instant advice on locators, flakiness, or test strategy",
        category: "Academy",
        icon: Robot,
        action: () => {
          onNavigate("academy");
          onClose();
        }
      },

      // Projects
      {
        id: "proj-new",
        title: "Create New Project",
        subtitle: "Configure a new repository or application under test",
        category: "Projects",
        icon: Plus,
        action: () => {
          onNewProject();
          onClose();
        }
      }
    ];

    // Add Local AI models if available
    if (installedAiModels && installedAiModels.length > 0 && onSelectAiModel) {
      for (const m of installedAiModels) {
        list.push({
          id: `ai-model-${m.name}`,
          title: `Switch AI Model: ${m.name}`,
          subtitle: `Ollama local model ${m.parameterSize ? `(${m.parameterSize})` : ""} ${m.name === activeAiModel ? "● Currently Active" : ""}`,
          category: "Local AI (Ollama)",
          icon: Robot,
          action: () => {
            onSelectAiModel(m.name);
            onClose();
          }
        });
      }
    }

    // Add each project as selectable
    for (const proj of projects) {
      list.push({
        id: `proj-${proj.id}`,
        title: `Switch to: ${proj.name}`,
        subtitle: `${proj.description} ${proj.id === selectedProjectId ? "(Active)" : ""}`,
        category: "Projects",
        icon: proj.id === selectedProjectId ? CheckCircle : Folder,
        action: () => {
          onSelectProject(proj.id);
          onClose();
        }
      });
    }

    return list;
  }, [onNavigate, onClose, onRunSmoke, onCrawlTarget, onGenerateTests, onOpenStorefront, onNewProject, projects, selectedProjectId, onSelectProject, installedAiModels, activeAiModel, onSelectAiModel]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(lower)) ||
        item.category.toLowerCase().includes(lower)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="relative flex items-center border-b border-slate-100 px-5 py-4">
          <span className="text-lg text-slate-400 mr-3">⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search projects, or navigate... (↑↓ to select, ↵ to execute)"
            className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400"
          />
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-500 font-semibold">
            ESC to close
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No matching commands found for &ldquo;<span className="font-semibold text-slate-600">{query}</span>&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 cursor-pointer transition ${
                    isSelected ? "bg-slate-900 text-white shadow-sm" : "hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={20} weight="bold" className="flex-shrink-0" aria-hidden="true" />
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold truncate ${isSelected ? "text-white" : "text-slate-900"}`}>
                          {item.title}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                            isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className={`text-xs truncate mt-0.5 ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  {item.shortcut && (
                    <span
                      className={`rounded-lg px-2 py-1 text-xs font-mono font-semibold flex-shrink-0 ml-3 ${
                        isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {item.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-2.5 text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">↵</kbd> Select</span>
            <span><kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">ESC</kbd> Dismiss</span>
          </div>
          <span className="font-mono text-slate-500">SonOfCoTester God Mode</span>
        </div>
      </div>
    </div>
  );
}
