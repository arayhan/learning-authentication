"use client";

import { Toaster as Sonner } from "@/components/ui/sonner";

/** Subtle, bottom-right, short-lived. Motion respects prefers-reduced-motion via the global rule in globals.css. */
export function Toaster() {
  return <Sonner position="bottom-right" duration={2500} visibleToasts={3} />;
}
