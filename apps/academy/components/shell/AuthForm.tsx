"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // same rule as the register route

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const register = mode === "register";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    const displayName = String(f.get("displayName") ?? "").trim();
    if (register && !displayName) return setError("Display name is required");
    if (!EMAIL.test(email)) return setError("Enter a valid email address");
    if (password.length < 8) return setError("Password must be at least 8 characters");

    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(register ? { email, password, displayName } : { email, password }),
      });
      if (!res.ok) {
        setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Something went wrong");
        return;
      }
      router.push(next ?? "/");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {register && (
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" name="displayName" autoComplete="name" maxLength={80} required />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={register ? "new-password" : "current-password"}
          minLength={8}
          required
          aria-describedby={register ? "password-hint" : undefined}
        />
        {register && <p id="password-hint" className="text-xs text-muted-foreground">At least 8 characters.</p>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="h-9 w-full">
        {pending ? "Please wait…" : register ? "Create account" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {register ? "Already have an account? " : "New here? "}
        <Link href={`${register ? "/login" : "/register"}${q}`} className="text-brand underline-offset-4 hover:underline">
          {register ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
