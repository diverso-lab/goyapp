import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { EditorShell } from "@/components/editor/editor-shell";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();
  if (project.userId !== session.user.id) notFound();

  return (
    <EditorShell
      project={{
        id: project.id,
        name: project.name,
        width: project.width,
        height: project.height,
        scene: project.scene,
      }}
    />
  );
}
