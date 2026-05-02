"use client";

import { useState, useTransition } from "react";
import { renameProject } from "./actions";

// Inline-edit heading bound to the renameProject server action. Saves on
// blur and on Enter; empty values round-trip to "Untitled Project" (the
// server action normalizes too, so the client mirror is just UX).
export function ProjectTitleEditor({
  projectId,
  initialTitle,
}: {
  projectId: string;
  initialTitle: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [saved, setSaved] = useState(initialTitle);
  const [, start] = useTransition();

  const save = () => {
    const next = title.trim() || "Untitled Project";
    if (next === saved) {
      if (title !== next) setTitle(next);
      return;
    }
    setTitle(next);
    setSaved(next);
    const fd = new FormData();
    fd.append("projectId", projectId);
    fd.append("title", next);
    start(async () => {
      await renameProject(fd);
    });
  };

  return (
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setTitle(saved);
          e.currentTarget.blur();
        }
      }}
      aria-label="Project title"
      className="-mx-2 w-full rounded-md bg-transparent px-2 py-0.5 text-base font-medium tracking-tight outline-none transition-colors hover:bg-muted/60 focus:bg-muted/80"
    />
  );
}
