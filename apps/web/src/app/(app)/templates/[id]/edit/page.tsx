import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { TemplateEditShell } from "./edit-shell";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) notFound();

  const isOwner = template.createdById === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) redirect("/dashboard");

  return (
    <TemplateEditShell
      template={{
        id: template.id,
        name: template.name,
        width: template.width,
        height: template.height,
        scene: template.scene,
      }}
    />
  );
}
