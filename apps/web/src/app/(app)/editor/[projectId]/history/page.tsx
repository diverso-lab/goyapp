import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { HistoryClient } from "./history-client";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, width: true, height: true, userId: true },
  });
  if (!project) notFound();
  if (project.userId !== session.user.id) redirect("/dashboard");

  const revisions = await prisma.projectRevision.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, scene: true, createdAt: true },
  });

  return (
    <HistoryClient
      project={{ id: project.id, name: project.name, width: project.width, height: project.height }}
      revisions={revisions.map((r) => ({ id: r.id, scene: r.scene, createdAt: r.createdAt.toISOString() }))}
    />
  );
}
