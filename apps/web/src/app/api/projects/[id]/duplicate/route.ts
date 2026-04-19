import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const source = await prisma.project.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (source.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const dup = await prisma.project.create({
    data: {
      name: `${source.name} (copy)`,
      userId: session.user.id,
      templateId: source.templateId,
      width: source.width,
      height: source.height,
      scene: source.scene as object,
    },
    select: { id: true },
  });
  return NextResponse.json({ project: dup }, { status: 201 });
}
