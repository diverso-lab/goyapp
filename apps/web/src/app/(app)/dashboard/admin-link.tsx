"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AdminLinkIfAdmin({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  if (!isAdmin) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => router.push("/admin/users")}>
      Users
    </Button>
  );
}
