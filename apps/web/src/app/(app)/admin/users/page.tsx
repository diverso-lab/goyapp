import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AdminUsersClient } from "./admin-users-client";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return (
    <AdminUsersClient
      currentUserId={session.user.id}
      users={users.map((u) => ({
        id: u.id, email: u.email, name: u.name, role: u.role,
        createdAt: u.createdAt.toISOString(),
      }))}
    />
  );
}
