import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  templateId: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, width: true, height: true, updatedAt: true },
  });
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!user) {
    return NextResponse.json(
      { error: "Session is stale — please sign out and sign in again." },
      { status: 401 },
    );
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { name, templateId } = parsed.data;

  let width = 1080;
  let height = 1920;
  let scene: unknown = { version: "6.0.0", objects: [], background: "#ffffff" };

  if (templateId) {
    const tpl = await prisma.template.findUnique({ where: { id: templateId } });
    if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    width = tpl.width;
    height = tpl.height;
    scene = tpl.scene;
  }

  const project = await prisma.project.create({
    data: {
      name,
      userId: session.user.id,
      templateId: templateId ?? null,
      width,
      height,
      scene: scene as object,
    },
    select: { id: true },
  });

  return NextResponse.json({ project }, { status: 201 });
}
