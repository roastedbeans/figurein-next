"use client";

import { useState } from "react";
import { Shapes, Sticker } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShapesPanel } from "./ShapesPanel";
import { IconsPanel } from "./IconsPanel";

type TabKey = "shapes" | "icons";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "shapes", label: "Shapes", icon: <Shapes className="size-5" /> },
  { key: "icons", label: "Icons", icon: <Sticker className="size-5" /> },
];

export function Sidebar() {
  const [active, setActive] = useState<TabKey>("shapes");

  return (
    <aside className="flex border-r bg-background">
      <nav className="flex w-14 flex-col gap-1 border-r bg-muted/30 p-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            aria-pressed={active === t.key}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-md py-2 text-[10px] font-medium transition-colors",
              active === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            )}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="flex w-[260px] flex-col overflow-hidden">
        {active === "shapes" && <ShapesPanel />}
        {active === "icons" && <IconsPanel />}
      </div>
    </aside>
  );
}
