"use client";

import { cn } from "cn";
import { useLabImpl } from "./LabImpl";

/** Go | TS segmented control for the shared lab implementation. */
export function LabSwitcher() {
  const [impl, setImpl] = useLabImpl();
  return (
    <div role="radiogroup" aria-label="Lab implementation" className="inline-flex rounded-md border p-0.5 text-xs">
      {(["go", "ts"] as const).map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={impl === i}
          onClick={() => setImpl(i)}
          className={cn(
            "rounded px-2.5 py-1 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
            impl === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {i === "go" ? "Go" : "TS"}
        </button>
      ))}
    </div>
  );
}
