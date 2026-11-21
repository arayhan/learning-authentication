// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flows } from "@/content/flows";
import { SequenceFlow } from "./SequenceFlow";

// motion caches the media query at module level, so stubbing matchMedia per test is vacuous. Mock the hook instead.
const motionPref = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (orig) => ({ ...(await orig<typeof import("motion/react")>()), useReducedMotion: () => motionPref.reduced }));

afterEach(() => {
  motionPref.reduced = false;
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const flow = flows.demo;
const current = (c: HTMLElement) => c.querySelector('[aria-current="step"]')?.getAttribute("data-step");

describe("SequenceFlow", () => {
  it("Next advances the aria-current step", async () => {
    const { container } = render(<SequenceFlow flow={flow} />);
    expect(current(container)).toBe("0");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(current(container)).toBe("1");
    expect(screen.getByText(/step 2 of 5/i)).toBeInTheDocument();
  });

  it("ArrowRight / ArrowLeft move the step when the region is focused", () => {
    const { container } = render(<SequenceFlow flow={flow} />);
    const region = screen.getByRole("group", { name: flow.title });
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(current(container)).toBe("1");
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(current(container)).toBe("0");
  });

  it("Back is disabled at step 0", () => {
    render(<SequenceFlow flow={flow} />);
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  it("future steps are hidden and the note shows below", async () => {
    const { container } = render(<SequenceFlow flow={flow} />);
    expect(container.querySelectorAll("[data-step]")).toHaveLength(1);
    expect(screen.getByText(flow.steps[0].note!)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(container.querySelectorAll("[data-step]")).toHaveLength(2);
  });

  it("clicking an arrow with http opens the drawer with the raw text; arrows without http are not clickable", async () => {
    render(<SequenceFlow flow={flow} />);
    await userEvent.click(screen.getByRole("button", { name: /POST \/login/ }));
    const dialog = await screen.findByRole("dialog");
    const pre = dialog.querySelector("pre")!;
    expect(pre.textContent).toBe(flow.steps[0].http);
    cleanup();

    const r = render(<SequenceFlow flow={flow} />);
    await userEvent.click(within(r.container).getByRole("button", { name: /next/i }));
    expect(within(r.container).queryByRole("button", { name: /SELECT user/ })).toBeNull();
  });

  it("Enter on a focused http arrow opens the drawer", async () => {
    render(<SequenceFlow flow={flow} />);
    const arrow = screen.getByRole("button", { name: /POST \/login/ });
    arrow.focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  // motion renders its `initial` pathLength/opacity as these attributes on the arrow paths.
  const hidden = (c: Element) => [...c.querySelectorAll('[data-step] path')].some((p) => /stroke-dasharray|opacity/.test(p.outerHTML) || p.getAttribute("pathLength"));

  it("animates the newly drawn arrow when motion is allowed", async () => {
    const { container } = render(<SequenceFlow flow={flow} />);
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(hidden(container.querySelector('[data-step="1"]')!.parentElement!)).toBe(true);
  });

  it("with reduced motion: no draw/fade props on arrows, and Play still advances to the end", () => {
    vi.useFakeTimers();
    motionPref.reduced = true;
    const { container } = render(<SequenceFlow flow={flow} />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(hidden(container)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    act(() => void vi.advanceTimersByTime(1600));
    expect(current(container)).toBe("1");
    for (let i = 0; i < 6; i++) act(() => void vi.advanceTimersByTime(1600)); // each tick re-arms after render
    expect(current(container)).toBe("4");
    expect(hidden(container)).toBe(false);
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("server render (and so the hydration render) has no hidden initial state", () => {
    const html = renderToString(<SequenceFlow flow={flow} />);
    expect(html).toContain('data-step="0"');
    expect(html).not.toMatch(/stroke-dasharray|opacity:\s*0|opacity="0"/);
  });

  it("a single-step flow: Play cannot run past the end", () => {
    vi.useFakeTimers();
    const one = { ...flow, steps: flow.steps.slice(0, 1) };
    render(<SequenceFlow flow={one} />);
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.getByText(/step 1 of 1/i)).toBeInTheDocument();
  });

  it("an empty flow renders a fallback without throwing", () => {
    render(<SequenceFlow flow={{ ...flow, steps: [] }} />);
    expect(screen.getByText(/no steps/i)).toBeInTheDocument();
  });

  it("modified arrow keys are ignored", () => {
    const { container } = render(<SequenceFlow flow={flow} />);
    fireEvent.keyDown(screen.getByRole("group", { name: flow.title }), { key: "ArrowRight", altKey: true });
    expect(current(container)).toBe("0");
  });

  it("pressing Next pauses Play; Reset returns to step 0", () => {
    vi.useFakeTimers();
    const { container } = render(<SequenceFlow flow={flow} />);
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    act(() => void vi.advanceTimersByTime(5000));
    expect(current(container)).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(current(container)).toBe("0");
  });
});
