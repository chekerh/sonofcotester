import React, { useState } from "react";
import type { SupportedLanguage } from "../lib/i18n.js";
import { Check, User, X } from "@phosphor-icons/react";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "ENGINEER" | "STUDENT" | "VIEWER";
  workspaceId: string;
}

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSwitchUser: (email: string) => void;
  currentLanguage: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
}

const DEMO_PERSONAS: { name: string; email: string; role: UserProfile["role"]; desc: string }[] = [
  {
    name: "DevOps Lead",
    email: "admin@sonofcotester.dev",
    role: "ADMIN",
    desc: "Full administrative, billing, API keys, and audit access"
  },
  {
    name: "Senior QA Engineer",
    email: "engineer@sonofcotester.dev",
    role: "ENGINEER",
    desc: "Suite authoring, crawling, live execution, and self-healing patches"
  },
  {
    name: "Testing Student",
    email: "student@sonofcotester.dev",
    role: "STUDENT",
    desc: "Academy learner, AI tutor guidance, and certificate candidate"
  }
];

export function UserAuthModal({
  isOpen,
  onClose,
  currentUser,
  onSwitchUser,
  currentLanguage,
  onSelectLanguage
}: UserAuthModalProps) {
  const [customEmail, setCustomEmail] = useState("");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center rounded-xl bg-slate-900 p-2.5 text-white"><User size={18} weight="fill" aria-hidden="true" /></span>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">User Identity & Global Settings</h2>
              <p className="text-xs text-slate-500">Multi-tenant role switching & localization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-slate-100 hover:bg-slate-200 p-1.5 text-xs font-bold text-slate-600"
          >
            <X size={14} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Active User Card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500">Active Profile</span>
                <h3 className="font-bold text-slate-900 text-base mt-0.5">{currentUser.name}</h3>
                <p className="text-xs text-slate-600 font-mono">{currentUser.email}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                currentUser.role === "ADMIN" ? "bg-purple-100 text-purple-800" :
                currentUser.role === "ENGINEER" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"
              }`}>
                {currentUser.role}
              </span>
            </div>
          </div>

          {/* Quick Persona Switcher */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2.5">
              Quick Role / Persona Switcher
            </span>
            <div className="space-y-2">
              {DEMO_PERSONAS.map((persona) => {
                const isActive = persona.email === currentUser.email;
                return (
                  <button
                    key={persona.email}
                    onClick={() => onSwitchUser(persona.email)}
                    className={`w-full flex items-center justify-between rounded-xl p-3 text-left transition border ${
                      isActive
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{persona.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                        }`}>
                          {persona.role}
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                        {persona.desc}
                      </p>
                    </div>
                    {isActive && (
                      <span className="ml-2 inline-flex items-center gap-1 text-emerald-400 font-bold">
                        <Check size={13} weight="bold" aria-hidden="true" />
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language / Region */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2.5">
              Interface Language (Global i18n)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { code: "en", label: "English" },
                { code: "ja", label: "日本語" },
                { code: "de", label: "Deutsch" },
                { code: "fr", label: "Français" },
                { code: "es", label: "Español" }
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  aria-pressed={currentLanguage === lang.code}
                  onClick={() => onSelectLanguage(lang.code as SupportedLanguage)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold border text-center transition ${
                    currentLanguage === lang.code
                      ? "bg-ocean text-white border-ocean shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full bg-slate-900 hover:bg-black px-5 py-2 text-xs font-bold text-white shadow-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
