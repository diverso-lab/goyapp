import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tpl = await prisma.template.findUnique({ where: { id }, select: { createdById: true } });
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (tpl.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden — you can only delete templates you created" }, { status: 403 });
  }
  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
