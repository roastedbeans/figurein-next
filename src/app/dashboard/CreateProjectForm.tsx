"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createProject, type ActionResult } from "./actions";

// One-click create: the server action drops in "Untitled Project" and
// redirects to the project page where the user renames inline.
export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    createProject,
    undefined
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Button type="submit" size="sm" disabled={pending}>
        <Plus className="size-3.5" />
        {pending ? "Creating…" : "New project"}
      </Button>
      {state?.error && (
        <span className="text-xs text-destructive">{state.error}</span>
      )}
    </form>
  );
}
