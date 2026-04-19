"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TemplatePreview } from "@/components/template-preview";
import { useDialog } from "@/components/ui/dialogs";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";
import { ArrowLeft, RotateCcw } from "lucide-react";

type Rev = { id: string; scene: unknown; createdAt: string };

export function HistoryClient({
  project,
  revisions,
}: {
  project: { id: string; name: string; width: number; height: number };
  revisions: Rev[];
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [busy, setBusy] = useState<string | null>(null);

  async function restore(revId: string) {
    const ok = await dialog.confirm({
      title: "Restore this version?",
      message: "Your current poster will be replaced with this snapshot. A new version of the current state is kept, so you can undo later.",
      confirmLabel: "Restore",
    });
    if (!ok) return;
    setBusy(revId);
    const res = await fetch(`/api/projects/${project.id}/revisions/${revId}`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      await dialog.alert({ title: "Restore failed", tone: "error" });
      return;
    }
    router.push(`/editor/${project.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/editor/${project.id}`)}>
            <ArrowLeft className="h-4 w-4" /> Back to editor
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <Logo className="h-6 w-auto" />
          <span className="text-sm font-semibold text-slate-900 truncate">Version history — {project.name}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {revisions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No snapshots yet. The first one is taken 60 seconds after you start editing, then once per minute while you work.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {revisions.map((r, i) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <TemplatePreview scene={r.scene} width={project.width} height={project.height} />
                <div className="p-3 space-y-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {i === 0 ? "Latest snapshot" : `Version ${revisions.length - i}`}
                    </div>
                    <div className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</div>
                  </div>
                  <Button
                    variant="secondary" size="sm" className="w-full"
                    onClick={() => restore(r.id)} disabled={busy === r.id}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> {busy === r.id ? "Restoring…" : "Restore"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
