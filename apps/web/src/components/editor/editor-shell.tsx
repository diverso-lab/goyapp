"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/error-boundary";
import { Logo } from "@/components/logo";

const Editor = dynamic(() => import("./editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-48px)] items-center justify-center text-slate-400">
      Loading editor…
    </div>
  ),
});

type Props = {
  project: {
    id: string;
    name: string;
    width: number;
    height: number;
    scene: unknown;
  };
};

export function EditorShell({ project }: Props) {
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
        </div>
        <span className="text-xs text-slate-500 tabular-nums">
          {project.width} × {project.height}
        </span>
      </header>
      <div className="flex-1 min-h-0">
        <ErrorBoundary>
          <Editor project={project} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
