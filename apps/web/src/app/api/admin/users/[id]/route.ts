import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deletePrefix } from "@/lib/s3";

const updateSchema = z.object({
  name: z.string().max(80).nullable().optional(),
  email: z.string().email().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Don't let admins demote themselves out of ADMIN — safety.
  if (id === session.user.id && parsed.data.role === "USER") {
    return NextResponse.json({ error: "You can't demote yourself" }, { status: 400 });
  }

  if (parsed.data.email) {
    const clash = await prisma.user.findFirst({
      where: { email: parsed.data.email, id: { not: id } },
      select: { id: true },
    });
    if (clash) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data as never,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "You can't delete yourself" }, { status: 400 });
  }
  // Purge uploads from S3 (best-effort) before cascading user delete.
  await deletePrefix(`uploads/${id}/`);
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
