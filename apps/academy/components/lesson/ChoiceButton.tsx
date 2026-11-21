import { Check, X } from "lucide-react";

export type ChoiceState = "idle" | "selected" | "correct" | "wrong";

const STYLE: Record<ChoiceState, string> = {
  idle: "hover:bg-muted",
  selected: "border-brand bg-brand/5",
  correct: "border-brand bg-brand/5",
  wrong: "border-destructive bg-destructive/5",
};

export function ChoiceButton({
  state = "idle",
  disabled,
  onClick,
  children,
}: {
  state?: ChoiceState;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state !== "idle"}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default ${STYLE[state]}`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {state === "correct" && <Check aria-label="Jawaban benar" className="mt-0.5 size-4 shrink-0 text-brand" />}
      {state === "wrong" && <X aria-label="Jawaban salah" className="mt-0.5 size-4 shrink-0 text-destructive" />}
    </button>
  );
}
