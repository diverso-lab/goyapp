import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { FillClient } from "./fill-client";

export default async function FillPage({
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
    <FillClient
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
