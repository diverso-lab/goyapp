"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TemplatePreview } from "@/components/template-preview";

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

export function DashboardClient({
  currentUserId,
  templates,
  projects,
}: {
  currentUserId: string;
  templates: Template[];
  projects: Project[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q),
    );
  }, [query, templates]);

  async function createFromTemplate(t: Template) {
    setCreating(t.id);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: t.name, templateId: t.id }),
    });
    setCreating(null);
    if (!res.ok) return;
    const { project } = await res.json();
    router.push(`/editor/${project.id}`);
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this poster?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="px-6 py-8 space-y-12">
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Templates</h2>
            <p className="text-sm text-muted-foreground">Start from a ready-made poster.</p>
          </div>
          <input
            placeholder="Search templates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-72 rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((t) => (
            <div key={t.id} className="rounded-lg border bg-card overflow-hidden hover:shadow-md transition flex flex-col">
              <button
                onClick={() => createFromTemplate(t)}
                disabled={creating === t.id}
                className="block w-full text-left disabled:opacity-50"
              >
                <TemplatePreview scene={t.scene} width={t.width} height={t.height} />
                <div className="p-3">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.category ? `${t.category} · ` : ""}{t.width}×{t.height}
                  </div>
                </div>
              </button>
              <div className="border-t px-3 py-2 flex justify-between text-xs">
                <button
                  onClick={() => createFromTemplate(t)}
                  disabled={creating === t.id}
                  className="hover:underline disabled:opacity-50"
                >
                  {creating === t.id ? "Creating…" : "Use template"}
                </button>
                <div className="flex items-center gap-3">
                  <Link href={`/templates/${t.id}/batch`} className="hover:underline text-muted-foreground">
                    Batch…
                  </Link>
                  {t.createdById === currentUserId && (
                    <button onClick={() => deleteTemplate(t.id)} className="text-destructive hover:underline">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">No templates match.</p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Your posters</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posters yet — pick a template above.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {projects.map((p) => (
              <div key={p.id} className="rounded-lg border bg-card overflow-hidden">
                <button onClick={() => router.push(`/editor/${p.id}`)} className="block w-full text-left">
                  <TemplatePreview scene={p.scene} width={p.width} height={p.height} />
                </button>
                <div className="p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button onClick={() => deleteProject(p.id)} className="text-xs text-destructive underline shrink-0">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
