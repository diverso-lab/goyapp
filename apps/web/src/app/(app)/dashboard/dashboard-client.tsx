"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TemplatePreview } from "@/components/template-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NewTemplateDialog } from "./new-template-dialog";
import { useDialog } from "@/components/ui/dialogs";

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  width: number;
  height: number;
  scene: unknown;
  createdById: string | null;
};

type Project = {
  id: string;
  name: string;
  width: number;
  height: number;
  scene: unknown;
  updatedAt: string;
};

function collectSlots(scene: unknown): string[] {
  const objects = (scene as { objects?: Array<{ slot?: string }> } | null)?.objects ?? [];
  const found = new Set<string>();
  for (const o of objects) if (typeof o.slot === "string" && o.slot) found.add(o.slot);
  return [...found];
}

export function DashboardClient({
  currentUserId,
  isAdmin,
  templates,
  projects,
}: {
  currentUserId: string;
  isAdmin: boolean;
  templates: Template[];
  projects: Project[];
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [posterQuery, setPosterQuery] = useState("");
  const [posterSort, setPosterSort] = useState<"updated" | "name">("updated");
  const [selectedPosters, setSelectedPosters] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const t of templates) if (t.category) seen.add(t.category);
    return [...seen].sort();
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (category && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    });
  }, [query, templates, category]);

  async function createFromTemplate(t: Template) {
    setCreating(t.id);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: t.name, templateId: t.id }),
    });
    setCreating(null);
    if (res.status === 401) {
      await fetch("/api/auth/signout", { method: "POST" });
      await dialog.alert({
        title: "Session expired",
        message: "Please sign in again to continue.",
        tone: "error",
      });
      router.push("/login");
      return;
    }
    if (!res.ok) {
      await dialog.alert({ title: "Could not create poster", tone: "error" });
      return;
    }
    const { project } = await res.json();
    router.push(`/editor/${project.id}`);
  }

  const filteredProjects = useMemo(() => {
    const q = posterQuery.trim().toLowerCase();
    const rows = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects.slice();
    rows.sort((a, b) =>
      posterSort === "name"
        ? a.name.localeCompare(b.name)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return rows;
  }, [projects, posterQuery, posterSort]);

  const toggleSelected = (id: string) => {
    setSelectedPosters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  async function duplicateProject(id: string) {
    const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
    if (!res.ok) { await dialog.alert({ title: "Could not duplicate", tone: "error" }); return; }
    router.refresh();
  }

  async function deleteManyProjects() {
    if (selectedPosters.size === 0) return;
    const ok = await dialog.confirm({
      title: `Delete ${selectedPosters.size} poster${selectedPosters.size === 1 ? "" : "s"}?`,
      message: "This cannot be undone.",
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    await Promise.all([...selectedPosters].map((id) =>
      fetch(`/api/projects/${id}`, { method: "DELETE" }),
    ));
    setSelectedPosters(new Set());
    router.refresh();
  }

  async function deleteProject(id: string) {
    const ok = await dialog.confirm({
      title: "Delete this poster?",
      message: "This cannot be undone.",
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function cloneTemplate(id: string) {
    const res = await fetch(`/api/templates/${id}/clone`, { method: "POST" });
    if (!res.ok) {
      await dialog.alert({ title: "Could not clone template", tone: "error" });
      return;
    }
    const { template } = await res.json();
    router.push(`/templates/${template.id}/edit`);
  }

  async function deleteTemplate(id: string) {
    const ok = await dialog.confirm({
      title: "Delete this template?",
      message: "Existing posters won't be affected, but you won't be able to start new ones from it.",
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-10 space-y-14">
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Templates</h2>
            <p className="text-sm text-slate-500 mt-1">Pick one, fill the blanks, export.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-xs"
            />
            <Button variant="primary" size="md" onClick={() => setNewOpen(true)}>
              + New template
            </Button>
          </div>
        </div>

        {newOpen && <NewTemplateDialog onClose={() => setNewOpen(false)} />}

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategory(null)}
              className={`h-7 px-3 rounded-full text-xs font-medium transition ${
                category === null
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c === category ? null : c)}
                className={`h-7 px-3 rounded-full text-xs font-medium transition ${
                  category === c
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map((t) => {
            const slotCount = collectSlots(t.scene).length;
            const owned = t.createdById === currentUserId;
            return (
              <div key={t.id} data-testid="template-card" data-template-name={t.name} className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition overflow-hidden flex flex-col">
                <TemplatePreview
                  scene={t.scene}
                  width={t.width}
                  height={t.height}
                  className="border-b border-slate-100"
                />
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 truncate">{t.name}</h3>
                      {slotCount > 0 && (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-orange-50 text-orange-700 text-[10px] font-medium px-2 py-0.5 ring-1 ring-orange-200">
                          {slotCount} slot{slotCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.category ? `${t.category} · ` : ""}{t.width}×{t.height}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 mt-auto">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      disabled={creating === t.id}
                      onClick={() => {
                        if (slotCount > 0) router.push(`/templates/${t.id}/fill`);
                        else createFromTemplate(t);
                      }}
                    >
                      {creating === t.id ? "Opening…" : slotCount > 0 ? "Fill in" : "Edit"}
                    </Button>
                    <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                      {slotCount > 0 && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            disabled={creating === t.id}
                            onClick={() => createFromTemplate(t)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            onClick={() => router.push(`/templates/${t.id}/batch`)}
                          >
                            Batch
                          </Button>
                        </>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => cloneTemplate(t.id)}>
                        Clone
                      </Button>
                      {(owned || isAdmin) && (
                        <Button variant="destructive" size="sm" onClick={() => deleteTemplate(t.id)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-slate-500 col-span-full">No templates match.</p>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Your posters</h2>
            <p className="text-sm text-slate-500 mt-1">Everything you&apos;ve saved.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedPosters.size > 0 && (
              <>
                <span className="text-xs text-slate-500">{selectedPosters.size} selected</span>
                <Button variant="destructive" size="sm" onClick={deleteManyProjects}>
                  Delete selected
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPosters(new Set())}>
                  Clear
                </Button>
                <div className="h-5 w-px bg-slate-200" />
              </>
            )}
            <select
              value={posterSort}
              onChange={(e) => setPosterSort(e.target.value as "updated" | "name")}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm"
            >
              <option value="updated">Most recent</option>
              <option value="name">Name (A→Z)</option>
            </select>
            <Input
              placeholder="Search posters…"
              value={posterQuery}
              onChange={(e) => setPosterQuery(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <p className="text-sm text-slate-500">No posters yet — pick a template above.</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <p className="text-sm text-slate-500">No posters match your search.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredProjects.map((p) => {
              const checked = selectedPosters.has(p.id);
              return (
                <div key={p.id} className={`group relative rounded-2xl border bg-white shadow-sm hover:shadow-md transition overflow-hidden flex flex-col ${checked ? "border-slate-900 ring-2 ring-slate-900/20" : "border-slate-200 hover:border-slate-300"}`}>
                  <label className="absolute top-2 left-2 z-10 flex items-center justify-center h-6 w-6 rounded-md border border-slate-200 bg-white/95 shadow-sm cursor-pointer opacity-0 group-hover:opacity-100 has-[:checked]:opacity-100 transition">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(p.id)}
                      className="h-3.5 w-3.5"
                    />
                  </label>
                  <TemplatePreview scene={p.scene} width={p.width} height={p.height} className="border-b border-slate-100" />
                  <div className="p-4 flex flex-col gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{p.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Updated {new Date(p.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="primary" size="sm" className="flex-1" onClick={() => router.push(`/editor/${p.id}`)}>
                        Open
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => duplicateProject(p.id)}>
                        Duplicate
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteProject(p.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
