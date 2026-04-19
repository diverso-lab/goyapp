"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ErrorBoundary } from "@/components/error-boundary";

const Editor = dynamic(
  () => import("@/components/editor/editor").then((m) => m.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-48px)] items-center justify-center text-slate-400">
        Loading editor…
      </div>
    ),
  },
);

type Props = {
  template: {
    id: string;
    name: string;
    width: number;
    height: number;
    scene: unknown;
  };
};

export function TemplateEditShell({ template }: Props) {
  const router = useRouter();
  return (
    <div className="flex flex-col h-screen">
      <header className="h-12 shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            ← Dashboard
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <Logo className="h-6 w-auto" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 rounded-full bg-orange-50 ring-1 ring-orange-200 px-2 py-0.5">
            Template
          </span>
        </div>
        <span className="text-xs text-slate-500 tabular-nums">
          {template.width} × {template.height}
        </span>
      </header>
      <div className="flex-1 min-h-0">
        <ErrorBoundary>
          <Editor project={template} mode="template" />
        </ErrorBoundary>
      </div>
    </div>
  );
}
