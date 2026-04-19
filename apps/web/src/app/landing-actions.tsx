"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LandingActions() {
  const router = useRouter();
  return (
    <div className="flex justify-center gap-3 pt-2">
      <Button variant="primary" size="lg" onClick={() => router.push("/login")}>
        Log in
      </Button>
    </div>
  );
}
