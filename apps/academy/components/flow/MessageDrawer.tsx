"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Side drawer with the raw HTTP text of one flow step. */
export function MessageDrawer({ open, onOpenChange, title, http }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; http: string }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Raw message</SheetDescription>
        </SheetHeader>
        <pre className="mx-4 mb-4 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[13px] leading-6 break-all whitespace-pre-wrap">{http}</pre>
      </SheetContent>
    </Sheet>
  );
}
