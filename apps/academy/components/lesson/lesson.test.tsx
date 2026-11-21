// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgressProvider } from "@/components/game/ProgressProvider";
import { getLesson } from "@/lib/course/registry";
import type { LessonMeta, XpEvent } from "@/lib/course/types";
import { BossQuiz } from "./BossQuiz";
import { LessonProvider } from "./LessonProvider";
import { LessonSteps } from "./LessonSteps";
import { Quiz } from "./Quiz";
import { Step } from "./Step";

// The BossQuiz tests need a tiny, known exam (choices A/B, answer index 0). The real m1-l7 content is swapped out here
// so these engine tests do not depend on, or break with, what the course actually asks.
const bossFixture = vi.hoisted(() => ({
  id: "m1-l7",
  module: "m1",
  slug: "boss",
  title: "Boss",
  minutes: 1,
  steps: [{ id: "intro", title: "Intro" }],
  quizzes: [{ id: "boss", boss: { seconds: 600, passRatio: 0.8 }, questions: [{ prompt: "Placeholder question", choices: ["A", "B"], answer: 0, why: "Placeholder." }] }],
  labTasks: [],
  attacks: [],
}));
vi.mock("@/lib/course/registry", async (orig) => {
  const actual = await orig<typeof import("@/lib/course/registry")>();
  return { ...actual, getLesson: (id: string) => (id === "m1-l7" ? (bossFixture as LessonMeta) : actual.getLesson(id)) };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const q1 = getLesson("m1-l1")!.quizzes[0];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const progress = (completed: string[]) => ({ completed, xp: 0, level: { name: "Intern", min: 0, next: 300 }, badges: [], streak: 0 });

/** Fake progress API: records completed refs and grades quizzes like the server (all correct = pass). While `unauthorized`, POSTs get 401 until a login succeeds. */
function fakeServer(completed: string[], opts: { unauthorized?: boolean } = {}) {
  const done = [...completed];
  const posts: XpEvent[] = [];
  let unauthorized = !!opts.unauthorized;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/auth/login") {
      unauthorized = false;
      return json(200, { ok: true });
    }
    if (init?.method !== "POST") return json(200, progress(done));
    if (unauthorized) return json(401, { error: "Unauthorized" });
    const { event } = JSON.parse(init.body as string) as { event: XpEvent };
    posts.push(event);
    if (event.kind === "quiz" || event.kind === "boss") {
      const [lessonId, quizId] = event.ref.split("/");
      const quiz = getLesson(lessonId)!.quizzes.find((q) => q.id === quizId)!;
      const score = quiz.questions.filter((q, i) => event.answers[i] === q.answer).length;
      if (score !== quiz.questions.length) return json(422, { score, total: quiz.questions.length, passed: false });
    }
    done.push(event.ref);
    return json(200, { ...progress(done), gained: 10, newBadges: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { posts, fetchMock };
}

function renderLesson(completed: string[]) {
  return render(
    <ProgressProvider initial={progress(completed)}>
      <LessonProvider lessonId="m1-l1">
        <LessonSteps>
          <Step id="hook" title="Hook">Hook body</Step>
          <Step id="concept" title="Concept">Concept body</Step>
          <Step id="check" title="Check">
            Check body
            <Quiz id="q1" gate />
          </Step>
          <Step id="recap" title="Recap">Recap body</Step>
        </LessonSteps>
      </LessonProvider>
    </ProgressProvider>,
  );
}

const choose = (text: string) => userEvent.click(screen.getByRole("button", { name: text }));
async function answerAll(answers: number[]) {
  for (const [i, a] of answers.entries()) {
    await choose(q1.questions[i].choices[a]);
    await userEvent.click(screen.getByRole("button", { name: i === answers.length - 1 ? /finish/i : /next/i }));
  }
}

describe("lesson engine", () => {
  it("only first step visible until Continue", async () => {
    const server = fakeServer([]);
    renderLesson([]);
    expect(screen.getByText("Hook body")).toBeInTheDocument();
    expect(screen.queryByText("Concept body")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(await screen.findByText("Concept body")).toBeInTheDocument();
    expect(screen.getByText("Hook body")).toBeInTheDocument();
    expect(server.posts).toEqual([{ kind: "step", ref: "m1-l1/hook" }]);
    expect(screen.queryByText("Check body")).not.toBeInTheDocument();
  });

  it("gated quiz blocks Continue until passed", async () => {
    const server = fakeServer(["m1-l1/hook", "m1-l1/concept"]);
    renderLesson(["m1-l1/hook", "m1-l1/concept"]);
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    // a failing attempt keeps it blocked and offers a retry
    await answerAll(q1.questions.map((q) => (q.answer + 1) % q.choices.length));
    expect(await screen.findByText(new RegExp(`0 of ${q1.questions.length}`))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await answerAll(q1.questions.map((q) => q.answer));
    await waitFor(() => expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled());
    expect(server.posts.filter((p) => p.kind === "quiz")).toHaveLength(2);
  });

  it("an already passed gate does not block Continue", () => {
    fakeServer([]);
    renderLesson(["m1-l1/hook", "m1-l1/concept", "m1-l1/q1"]);
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("completed refs restore: steps 1-2 done → step 3 visible and focused", () => {
    fakeServer([]);
    renderLesson(["m1-l1/hook", "m1-l1/concept"]);
    expect(screen.getByText("Hook body")).toBeInTheDocument();
    expect(screen.getByText("Concept body")).toBeInTheDocument();
    expect(screen.getByText("Check body")).toBeInTheDocument();
    expect(screen.queryByText("Recap body")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Check" })).toHaveFocus();
  });

  it("send returns 'unauthorized' → ReauthDialog opens, revealed steps unchanged, re-sent after re-login", async () => {
    const server = fakeServer([], { unauthorized: true });
    renderLesson([]);
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Concept body")).not.toBeInTheDocument();
    expect(screen.getByText("Hook body")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Concept body")).toBeInTheDocument();
    expect(server.posts).toEqual([{ kind: "step", ref: "m1-l1/hook" }]);
  });
});

describe("reauth recovery", () => {
  const signIn = async () => {
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  };
  const dismiss = async () => {
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  };

  it("Quiz: dismissed dialog can be re-opened, answers are kept and re-sent after login", async () => {
    const server = fakeServer(["m1-l1/hook", "m1-l1/concept"], { unauthorized: true });
    renderLesson(["m1-l1/hook", "m1-l1/concept"]);
    await answerAll(q1.questions.map((q) => q.answer));
    await dismiss();
    await userEvent.click(await screen.findByRole("button", { name: /sign in again/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await signIn();
    await waitFor(() => expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled());
    expect(server.posts).toEqual([{ kind: "quiz", ref: "m1-l1/q1", answers: q1.questions.map((q) => q.answer) }]);
  });

  it("BossQuiz: dismissed dialog can be re-opened and the answers are re-sent after login", async () => {
    const server = fakeServer([], { unauthorized: true });
    renderBossStep();
    await userEvent.click(screen.getByRole("button", { name: /start/i }));
    await userEvent.click(screen.getByRole("button", { name: "A" }));
    await userEvent.click(screen.getByRole("button", { name: "Finish" }));
    await dismiss();
    await userEvent.click(await screen.findByRole("button", { name: /sign in again/i }));
    await signIn();
    expect(await screen.findByText("Boss defeated.")).toBeInTheDocument();
    expect(server.posts).toHaveLength(1);
    expect(server.posts[0]).toMatchObject({ kind: "boss", ref: "m1-l7/boss", answers: [0] });
  });
});

function renderBossStep() {
  return render(
    <ProgressProvider initial={progress([])}>
      <LessonProvider lessonId="m1-l7">
        <LessonSteps>
          <Step id="intro" title="Intro">
            <BossQuiz id="boss" />
          </Step>
        </LessonSteps>
      </LessonProvider>
    </ProgressProvider>,
  );
}

describe("BossQuiz", () => {
  it("gates its step: Continue stays disabled until the boss is passed", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // identity order
    const server = fakeServer([]);
    renderBossStep();
    expect(screen.getByRole("button", { name: /finish lesson/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /start/i }));
    await userEvent.click(screen.getByRole("button", { name: "A" })); // original index 0 = correct
    await userEvent.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /finish lesson/i })).toBeEnabled());
    expect(server.posts[0]).toMatchObject({ kind: "boss", answers: [0] });
  });

  const renderBoss = () =>
    render(
      <ProgressProvider initial={progress([])}>
        <LessonProvider lessonId="m1-l7">
          <BossQuiz id="boss" />
        </LessonProvider>
      </ProgressProvider>,
    );

  it("maps shuffled choice back to original index", async () => {
    // Math.random() = 0 makes the Fisher-Yates shuffle reverse a 2-item list: [A, B] -> [B, A].
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(getLesson("m1-l7")!.quizzes[0].questions[0].choices).toEqual(["A", "B"]);
    const server = fakeServer([]);
    renderBoss();
    await userEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(screen.getAllByRole("button", { name: /^[AB]$/ }).map((b) => b.textContent)).toEqual(["B", "A"]);
    await userEvent.click(screen.getByRole("button", { name: "B" })); // original index 1
    await userEvent.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(server.posts).toHaveLength(1));
    expect(server.posts[0]).toMatchObject({ kind: "boss", ref: "m1-l7/boss", answers: [1] });
    expect((server.posts[0] as { elapsedMs: number }).elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("auto-submits the current answers when the countdown ends", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    try {
      const server = fakeServer([]);
      renderBoss();
      fireEvent.click(screen.getByRole("button", { name: /start/i }));
      await vi.advanceTimersByTimeAsync(600_000 + 500);
      expect(server.posts).toHaveLength(1);
      expect(server.posts[0]).toMatchObject({ kind: "boss", answers: [-1] });
    } finally {
      vi.useRealTimers();
    }
  });
});
