import { ThemeToggle } from "@/components/shell/theme-toggle";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">Auth Academy</h1>
      <ThemeToggle />
    </main>
  );
}
