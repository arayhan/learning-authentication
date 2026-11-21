import type { Metadata } from "next";
import { safeNext } from "@/lib/auth/next-url";
import { AuthCard } from "@/components/shell/AuthCard";
import { AuthForm } from "@/components/shell/AuthForm";

export const metadata: Metadata = { title: "Sign in · Auth Academy" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  return (
    <AuthCard title="Sign in" subtitle="Pick up where you left off.">
      <AuthForm mode="login" next={next} />
    </AuthCard>
  );
}
