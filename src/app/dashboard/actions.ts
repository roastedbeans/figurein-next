"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | undefined;

// Supabase is the auth source of truth; drizzle connects as service role and
// enforces ownership manually via `where owner_id = user.id` on every query.
async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** One-click create. Title defaults to "Untitled Project" and the user
 *  renames it inline on the dashboard — no name prompt upfront. */
export async function createProject(
  _prev?: ActionResult,
  _formData?: FormData
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  const [row] = await db
    .insert(projects)
    .values({ ownerId: userId, title: "Untitled Project" })
    .returning({ id: projects.id });
  if (!row) return { error: "Insert failed" };

  revalidatePath("/dashboard");
}

export async function renameProject(formData: FormData): Promise<ActionResult> {
  const projectId = String(formData.get("projectId") ?? "");
  const title =
    String(formData.get("title") ?? "").trim() || "Untitled Project";
  if (!projectId) return { error: "Missing projectId" };

  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  await db
    .update(projects)
    .set({ title })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));

  revalidatePath("/dashboard");
}

/** Void-return so the server action can be wired directly to a <form
 *  action={deleteProject}>. Unauthorized deletes silently no-op because the
 *  owner_id guard filters them out; the happy path revalidates and the row
 *  drops from the list. */
export async function deleteProject(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;

  const userId = await currentUserId();
  if (!userId) return;

  await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));
  revalidatePath("/dashboard");
}

// Figures (canvases) are created and deleted by the editor's persistence
// diff — no dashboard-level action needed. Deleting a project cascades to
// its figures via the FK, so a dedicated deleteFigure here is also gone.
