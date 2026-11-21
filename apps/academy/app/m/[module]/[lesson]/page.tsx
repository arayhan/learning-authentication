import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LessonHeader } from "@/components/lesson/LessonHeader";
import { LessonProvider } from "@/components/lesson/LessonProvider";
import { AppShell } from "@/components/shell/AppShell";
import { ModuleNav } from "@/components/shell/ModuleNav";
import { XpGuide } from "@/components/shell/XpGuide";
import { currentUser } from "@/lib/auth/session";
import { course, getLessonBySlug } from "@/lib/course/registry";
import { lessonContent } from "@/content/mdx";

export const generateStaticParams = () =>
  course.flatMap((m) => m.lessons.map((l) => ({ module: m.slug, lesson: l.slug })));

export async function generateMetadata({ params }: PageProps<"/m/[module]/[lesson]">): Promise<Metadata> {
  const { module: m, lesson: l } = await params;
  const lesson = getLessonBySlug(m, l);
  return { title: lesson ? `${lesson.title} · Auth Academy` : "Auth Academy" };
}

export default async function LessonPage({ params }: PageProps<"/m/[module]/[lesson]">) {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  const lesson = getLessonBySlug(moduleSlug, lessonSlug);
  if (!lesson) notFound();
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/m/${moduleSlug}/${lessonSlug}`)}`);
  const { default: Content } = await lessonContent[lesson.id]();

  return (
    <AppShell userName={user.displayName} left={<ModuleNav />} right={<XpGuide />} rightTitle="XP guide">
      <LessonProvider lessonId={lesson.id}>
        <LessonHeader />
        <Content />
      </LessonProvider>
    </AppShell>
  );
}
