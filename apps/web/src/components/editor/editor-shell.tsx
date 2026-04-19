"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const Editor = dynamic(() => import("./editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-40px)] items-center justify-center text-muted-foreground">
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
  return (
    <div className="flex flex-col h-screen">
      <header className="h-10 shrink-0 flex items-center justify-between border-b px-4 bg-card/50">
        <Link href="/dashboard" className="text-xs font-medium hover:underline">
          ← Back to dashboard
        </Link>
        <span className="text-xs text-muted-foreground">
          {project.width} × {project.height}
        </span>
      </header>
      <div className="flex-1 min-h-0">
        <Editor project={project} />
      </div>
    </div>
  );
}
