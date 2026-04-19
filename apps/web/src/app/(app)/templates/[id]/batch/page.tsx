import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { BatchClient } from "./batch-client";

export default async function BatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) notFound();

  return (
    <BatchClient
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
