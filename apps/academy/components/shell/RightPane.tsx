"use client";

import { useSyncExternalStore } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const KEY = "academy:right-pane-collapsed";
const listeners = new Set<() => void>();

const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const write = (collapsed: boolean) => {
  try {
    localStorage.setItem(KEY, collapsed ? "1" : "0");
  } catch {}
  listeners.forEach((f) => f());
};

/** Collapsible right pane. Open on the server render, then follows localStorage once hydrated. */
export function RightPane({ title, children }: { title: string; children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const label = collapsed ? `Tampilkan ${title}` : `Sembunyikan ${title}`;
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;

  return (
    <aside
      aria-label={title}
      className={`border-t lg:border-t-0 lg:border-l ${collapsed ? "lg:w-12" : "lg:w-80"}`}
    >
      <div className={`flex items-center p-2 ${collapsed ? "lg:justify-center" : "justify-between"}`}>
        <h2 className={`px-2 text-sm font-medium ${collapsed ? "lg:hidden" : ""}`}>{title}</h2>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" onClick={() => write(!collapsed)} aria-label={label} aria-expanded={!collapsed}>
                <Icon />
              </Button>
            }
          />
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </div>
      {!collapsed && <div className="p-4 pt-2">{children}</div>}
    </aside>
  );
}
