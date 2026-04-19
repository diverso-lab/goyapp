import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const source = await prisma.template.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clone = await prisma.template.create({
    data: {
      name: `${source.name} (copy)`,
      description: source.description,
      category: source.category,
      width: source.width,
      height: source.height,
      scene: source.scene as object,
      createdById: session.user.id,
    },
    select: { id: true },
  });
  return NextResponse.json({ template: clone }, { status: 201 });
}
