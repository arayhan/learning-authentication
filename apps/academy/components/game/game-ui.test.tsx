// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { course } from "@/lib/course/registry";
import { BadgeShelf } from "./BadgeShelf";
import { ProgressProvider, useProgress } from "./ProgressProvider";
import { SkillMap } from "./SkillMap";
import { XpBar } from "./XpBar";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const refs = (lessonId: string, only?: "steps") => {
  const l = course.flatMap((m) => m.lessons).find((x) => x.id === lessonId)!;
  return [...l.steps.map((s) => `${l.id}/${s.id}`), ...(only ? [] : l.quizzes.map((q) => `${l.id}/${q.id}`))];
};
const stateOf = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-lesson="${id}"]`)?.getAttribute("data-state");

describe("SkillMap", () => {
  it("locks m1-l2 until every step of m1-l1 is done", () => {
    const { container, rerender } = render(<SkillMap completed={[]} />);
    expect(stateOf(container, "m1-l1")).toBe("available");
    expect(stateOf(container, "m1-l2")).toBe("locked");
    rerender(<SkillMap completed={refs("m1-l1", "steps").slice(0, 1)} />);
    expect(stateOf(container, "m1-l2")).toBe("locked");
    rerender(<SkillMap completed={refs("m1-l1")} />);
    expect(stateOf(container, "m1-l1")).toBe("done");
    expect(stateOf(container, "m1-l2")).toBe("available");
  });

  it("links available lessons to /m/<module>/<lesson> and not locked ones", () => {
    const { container } = render(<SkillMap completed={[]} />);
    expect(container.querySelector('[data-lesson="m1-l1"]')).toHaveAttribute("href", "/m/passwords-sessions/identity");
    expect(container.querySelector('[data-lesson="m1-l2"]')).not.toHaveAttribute("href");
  });
});

describe("XpBar", () => {
  it("reports xp relative to the level floor", () => {
    render(<XpBar xp={450} level={{ name: "Junior", min: 300, next: 900 }} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "150");
    expect(bar).toHaveAttribute("aria-valuemax", "600");
  });
});

describe("BadgeShelf", () => {
  it("shows all 6 badges with the earned count", () => {
    render(<BadgeShelf earned={["cookie-monster", "flawless"]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("2 / 6 earned")).toBeInTheDocument();
    expect(screen.getByText("Finish Module 2")).toBeInTheDocument();
  });
});

describe("useProgress", () => {
  const initial = { completed: [], xp: 0, level: { name: "Intern", min: 0, next: 300 }, badges: [], streak: 0 };
  function Probe() {
    const { send, state } = useProgress();
    return (
      <>
        <span data-testid="xp">{state.xp}</span>
        <button onClick={async () => void screen.getByTestId("out").setAttribute("data-r", String(await send({ kind: "step", ref: "m1-l1/hook" })))}>go</button>
        <span data-testid="out" />
      </>
    );
  }
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it("applies the server result and sends the browser tz", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? json(200, { ...initial, xp: 10, completed: ["m1-l1/hook"], gained: 10, newBadges: [] })
        : json(200, initial),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ProgressProvider initial={initial}><Probe /></ProgressProvider>);
    await userEvent.click(screen.getByText("go"));
    await waitFor(() => expect(screen.getByTestId("xp")).toHaveTextContent("10"));
    const post = fetchMock.mock.calls.find(([, i]) => i?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string)).toMatchObject({ event: { kind: "step", ref: "m1-l1/hook" }, tz: expect.any(String) });
  });

  it("returns 'unauthorized' on 401 and opens the re-login dialog", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => (init?.method === "POST" ? json(401, { error: "Unauthorized" }) : json(200, initial))));
    render(<ProgressProvider initial={initial}><Probe /></ProgressProvider>);
    await userEvent.click(screen.getByText("go"));
    await waitFor(() => expect(screen.getByTestId("out")).toHaveAttribute("data-r", "unauthorized"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });
});
