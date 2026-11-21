// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flows } from "@/content/flows";
import { SequenceFlow } from "./SequenceFlow";

afterEach(() => {
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

  it("Play still advances with reduced motion, then stops at the end", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("prefers-reduced-motion"),
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }));
    const { container } = render(<SequenceFlow flow={flow} />);
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    act(() => void vi.advanceTimersByTime(1600));
    expect(current(container)).toBe("1");
    for (let i = 0; i < 6; i++) act(() => void vi.advanceTimersByTime(1600)); // each tick re-arms after render
    expect(current(container)).toBe("4");
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
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
