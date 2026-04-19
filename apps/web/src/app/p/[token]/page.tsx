import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PublicShareClient } from "./public-share-client";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";

export const metadata = { robots: { index: false, follow: false } };

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    select: { id: true, name: true, width: true, height: true, scene: true },
  });
  if (!project) notFound();

  return (
    <main className="min-h-screen flex flex-col bg-slate-100">
      <header className="h-14 shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <Logo className="h-6 w-auto" />
          <span className="text-sm font-semibold text-slate-900 truncate">{project.name}</span>
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{project.width}×{project.height}</span>
      </header>
      <PublicShareClient project={project} />
      <Footer />
    </main>
  );
}
