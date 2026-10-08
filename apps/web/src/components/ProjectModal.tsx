import { useState, type FormEvent } from "react";
import type { ProjectSummary } from "@sonofcotester/sdk";
import { X } from "@phosphor-icons/react";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: { id?: string; name: string; description: string }) => Promise<void>;
  onDelete?: (projectId: string) => Promise<void>;
  initialProject?: ProjectSummary | null;
}

export function ProjectModal({ isOpen, onClose, onSave, onDelete, initialProject }: ProjectModalProps) {
  const [name, setName] = useState(initialProject?.name ?? "");
  const [description, setDescription] = useState(initialProject?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: initialProject?.id, name, description });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initialProject?.id || !onDelete) return;
    setSaving(true);
    try {
      await onDelete(initialProject.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-slate-900">
            {initialProject ? "Edit Project" : "Create New Project"}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Project Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mobile Checkout App"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-ocean focus:outline-none focus:ring-2 focus:ring-ocean/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Primary regression & smoke testing pack..."
              rows={3}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-ocean focus:outline-none focus:ring-2 focus:ring-ocean/20"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {initialProject && onDelete ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete Project
                </button>
              )
            ) : <div />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : initialProject ? "Update Project" : "Create Project"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
