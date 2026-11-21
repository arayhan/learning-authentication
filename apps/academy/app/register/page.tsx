import type { Metadata } from "next";
import { safeNext } from "@/lib/auth/next-url";
import { AuthCard } from "@/components/shell/AuthCard";
import { AuthForm } from "@/components/shell/AuthForm";

export const metadata: Metadata = { title: "Create account · Auth Academy" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const next = safeNext((await searchParams).next);
  return (
    <AuthCard title="Create your account" subtitle="Learn authentication by building and breaking it.">
      <AuthForm mode="register" next={next} />
    </AuthCard>
  );
}
