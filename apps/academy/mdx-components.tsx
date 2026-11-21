import type { MDXComponents } from "mdx/types";
import { Analogy } from "@/components/lesson/Analogy";
import { BossQuiz } from "@/components/lesson/BossQuiz";
import { Callout } from "@/components/lesson/Callout";
import { CodeTabs } from "@/components/lesson/CodeTabs";
import { ExplainBack } from "@/components/lesson/ExplainBack";
import { LessonSteps } from "@/components/lesson/LessonSteps";
import { Quiz } from "@/components/lesson/Quiz";
import { RecapCard } from "@/components/lesson/RecapCard";
import { Shot } from "@/components/lesson/Shot";
import { Step } from "@/components/lesson/Step";

// Prose is capped at ~68ch; wide blocks (code, shots) opt out in their own components.
const components: MDXComponents = {
  // The lesson page owns the h1; headings written in MDX start at h3 under a step's h2.
  h2: (p) => <h3 className="max-w-[68ch] pt-2 text-lg font-semibold tracking-tight" {...p} />,
  h3: (p) => <h4 className="max-w-[68ch] pt-1 text-base font-semibold" {...p} />,
  p: (p) => <p className="max-w-[68ch] leading-7" {...p} />,
  ul: (p) => <ul className="max-w-[68ch] list-disc space-y-1.5 pl-6 leading-7" {...p} />,
  ol: (p) => <ol className="max-w-[68ch] list-decimal space-y-1.5 pl-6 leading-7" {...p} />,
  a: (p) => <a className="font-medium text-brand underline underline-offset-4" {...p} />,
  strong: (p) => <strong className="font-semibold" {...p} />,
  blockquote: (p) => <blockquote className="max-w-[68ch] border-l-2 pl-4 text-muted-foreground" {...p} />,
  code: (p) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]" {...p} />,
  pre: (p) => <pre className="max-w-3xl overflow-x-auto rounded-lg border bg-muted/30 p-4 font-mono text-[13px] leading-6 [&_code]:bg-transparent [&_code]:p-0" {...p} />,
  table: (p) => (
    <div className="max-w-3xl overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm [&_td]:border-t [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium" {...p} />
    </div>
  ),
  LessonSteps,
  Step,
  Quiz,
  BossQuiz,
  Callout,
  Analogy,
  CodeTabs,
  RecapCard,
  ExplainBack,
  Shot,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
