"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useDialog } from "@/components/ui/dialogs";
import { Footer } from "@/components/footer";

type U = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
};

export function AdminUsersClient({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: U[];
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name: name || undefined, password, role }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => null))?.error ?? "Failed");
      return;
    }
    setEmail(""); setName(""); setPassword(""); setRole("USER");
    router.refresh();
  }

  async function remove(id: string) {
    const ok = await dialog.confirm({
      title: "Delete this user?",
      message: "All their posters will be deleted as well. This cannot be undone.",
      variant: "destructive",
      confirmLabel: "Delete user",
    });
    if (!ok) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function editUser(u: U) {
    const newName = await dialog.prompt({
      title: `Edit name — ${u.email}`,
      message: "Change display name. Leave empty to clear.",
      defaultValue: u.name ?? "",
      placeholder: "Display name",
    });
    if (newName === null) return;
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName || null }),
    });
    if (!res.ok) {
      await dialog.alert({ title: "Could not update name", tone: "error" });
      return;
    }
    router.refresh();
  }

  async function editEmail(u: U) {
    const newEmail = await dialog.prompt({
      title: `Change email for ${u.name ?? u.email}`,
      message: "The user will need to sign in with this new email.",
      defaultValue: u.email,
      placeholder: "new@example.com",
      confirmLabel: "Change email",
    });
    if (!newEmail || newEmail === u.email) return;
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: newEmail }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null))?.error ?? "Update failed";
      await dialog.alert({ title: err, tone: "error" });
      return;
    }
    await dialog.alert({ title: "Email updated", tone: "success" });
    router.refresh();
  }

  async function toggleRole(u: U) {
    if (u.id === currentUserId) return;
    const nextRole = u.role === "ADMIN" ? "USER" : "ADMIN";
    const ok = await dialog.confirm({
      title: nextRole === "ADMIN" ? "Promote to admin?" : "Demote to regular user?",
      message: `${u.email} will ${nextRole === "ADMIN" ? "gain" : "lose"} admin privileges.`,
      confirmLabel: nextRole === "ADMIN" ? "Promote" : "Demote",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    if (!res.ok) {
      await dialog.alert({ title: "Could not change role", tone: "error" });
      return;
    }
    router.refresh();
  }

  async function resetPassword(id: string, email: string) {
    const newPassword = await dialog.prompt({
      title: `Reset password for ${email}`,
      message: "Enter a new temporary password. Share it with the user manually.",
      placeholder: "At least 8 characters",
      confirmLabel: "Reset",
    });
    if (!newPassword) return;
    if (newPassword.length < 8) {
      await dialog.alert({ title: "Password too short", message: "Minimum 8 characters.", tone: "error" });
      return;
    }
    const res = await fetch(`/api/admin/users/${id}/password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) {
      await dialog.alert({ title: "Failed to reset", tone: "error" });
      return;
    }
    await dialog.alert({ title: "Password reset", message: `${email} can now sign in with the new password.`, tone: "success" });
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-8 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>← Dashboard</Button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Users</h1>
            <p className="text-xs text-slate-500">Admin only. Add people, promote to admin, or remove.</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-8 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8 items-start">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">All users ({users.length})</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 truncate">{u.name ?? u.email}</p>
                    {u.role === "ADMIN" && (
                      <span className="inline-flex items-center rounded-full bg-slate-900 text-white text-[10px] font-medium px-2 py-0.5">
                        ADMIN
                      </span>
                    )}
                    {u.id === currentUserId && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-[10px] font-medium px-2 py-0.5">
                        you
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{u.email} · joined {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => editUser(u)} title="Edit display name">
                    Rename
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => editEmail(u)} title="Change email">
                    Email
                  </Button>
                  {u.id !== currentUserId && (
                    <Button variant="ghost" size="sm" onClick={() => toggleRole(u)}>
                      {u.role === "ADMIN" ? "Demote" : "Promote"}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => resetPassword(u.id, u.email)}>
                    Reset password
                  </Button>
                  {u.id !== currentUserId && (
                    <Button variant="destructive" size="sm" onClick={() => remove(u.id)}>Delete</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Invite a new user</h2>
          <form onSubmit={create} className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Temporary password</Label>
              <Input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-[10px] text-slate-400 mt-1">At least 8 characters. Share with the user manually.</p>
            </div>
            <div>
              <Label>Role</Label>
              <div className="flex gap-2">
                <Button type="button" variant={role === "USER" ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setRole("USER")}>
                  User
                </Button>
                <Button type="button" variant={role === "ADMIN" ? "primary" : "secondary"} size="sm" className="flex-1" onClick={() => setRole("ADMIN")}>
                  Admin
                </Button>
              </div>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <Button type="submit" variant="primary" size="md" className="w-full" disabled={busy}>
              {busy ? "Creating…" : "Create user"}
            </Button>
          </form>
        </aside>
      </div>
      <Footer />
    </main>
  );
}
