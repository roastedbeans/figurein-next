"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { figures, projects } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import type { EditorElement } from "@/types/editor";

// Server actions that back the editor's client-side project persistence.
// Drizzle bypasses RLS, so each action re-checks ownership with the
// Supabase-issued user id before touching any row.

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export type CanvasPayload = {
  id: string;
  title: string;
  elements: EditorElement[];
};

/** Delta save shape. The client sends only what changed:
 *  - `projectTitle` is populated only when the title actually moved
 *    (gated on the client side by a ref); `undefined` means "don't touch".
 *  - `pages` is the subset of canvases that got mutated since the last
 *    successful save (or since load, on the first save).
 *  - `deletedIds` is the set of figure ids the editor dropped.
 *  - `currentPageId` reflects the user's active canvas — currently unused
 *    server-side but forwarded so a future reload-open-to-last-page
 *    feature can rely on it without a second round trip. */
export type ProjectDelta = {
  projectTitle?: string;
  pages: CanvasPayload[];
  deletedIds: string[];
  currentPageId: string;
};

export type LoadedProject = {
  projectTitle: string;
  pages: CanvasPayload[];
  currentPageId: string;
};

export async function loadProject(
  projectId: string
): Promise<{ error: string } | LoadedProject> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  try {
    return await db.transaction(async (tx) => {
      const [project] = await tx
        .select({ id: projects.id, title: projects.title })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
        .limit(1);
      if (!project) return { error: "Project not found" } as const;

      const rows = await tx
        .select({
          id: figures.id,
          title: figures.title,
          content: figures.content,
        })
        .from(figures)
        .where(
          and(eq(figures.projectId, projectId), eq(figures.ownerId, userId))
        )
        .orderBy(asc(figures.createdAt));

      // Forward-compatible read: figures used to store `{ pages: [...] }`.
      // The new shape is `{ elements: [...] }`. If we see the old shape,
      // flatten the first page's elements so the row stays readable until
      // it's next saved (at which point it'll be rewritten in the new shape).
      const pages: CanvasPayload[] = rows.map((r) => {
        const content = (r.content ?? {}) as {
          elements?: EditorElement[];
          pages?: Array<{ elements?: EditorElement[] }>;
        };
        const elements =
          content.elements ?? content.pages?.[0]?.elements ?? [];
        return { id: r.id, title: r.title, elements };
      });

      // Bump lastOpenedAt in-transaction so dashboard "recent" ordering
      // reflects actual access. One statement for the whole set.
      if (rows.length > 0) {
        await tx
          .update(figures)
          .set({ lastOpenedAt: new Date() })
          .where(
            and(
              inArray(
                figures.id,
                rows.map((r) => r.id)
              ),
              eq(figures.ownerId, userId)
            )
          );
      }

      return {
        projectTitle: project.title,
        pages,
        currentPageId: pages[0]?.id ?? "",
      };
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to load project",
    };
  }
}

/** Delta save: applies only what the client marked dirty.
 *  - Updates `projects.title` only when `delta.projectTitle` is provided.
 *  - Upserts exactly the pages in `delta.pages` (partitioned into insert
 *    vs update by whether the figure row already exists).
 *  - Deletes exactly the ids in `delta.deletedIds`.
 *
 *  The whole delta runs in one transaction so a mid-save failure can't
 *  leave the project with some pages deleted and others un-updated.
 *  Pages not mentioned in the delta are left completely untouched — that's
 *  the whole point of the switch from whole-project snapshots. */
export async function saveProject(
  projectId: string,
  delta: ProjectDelta
): Promise<{ error: string } | { ok: true }> {
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in." };

  // Sanity: a completely empty delta shouldn't reach here (the hook
  // short-circuits first), but tolerate it rather than opening a
  // transaction for nothing.
  if (
    delta.pages.length === 0 &&
    delta.deletedIds.length === 0 &&
    delta.projectTitle === undefined
  ) {
    return { ok: true } as const;
  }

  try {
    return await db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
        .limit(1);
      if (!owned) return { error: "Project not found" } as const;

      if (delta.projectTitle !== undefined) {
        await tx
          .update(projects)
          .set({ title: delta.projectTitle, updatedAt: new Date() })
          .where(
            and(eq(projects.id, projectId), eq(projects.ownerId, userId))
          );
      }

      if (delta.deletedIds.length > 0) {
        await tx
          .delete(figures)
          .where(
            and(
              inArray(figures.id, delta.deletedIds),
              eq(figures.projectId, projectId),
              eq(figures.ownerId, userId)
            )
          );
      }

      if (delta.pages.length > 0) {
        // Partition incoming pages into insert vs update. The delta is
        // small (just the dirty pages), so a single SELECT of their ids
        // is much cheaper than the old "fetch every row in the project"
        // approach.
        const incomingIds = delta.pages.map((p) => p.id);
        const existing = await tx
          .select({ id: figures.id })
          .from(figures)
          .where(
            and(
              inArray(figures.id, incomingIds),
              eq(figures.projectId, projectId),
              eq(figures.ownerId, userId)
            )
          );
        const existingIds = new Set(existing.map((r) => r.id));

        const toInsert = delta.pages.filter((p) => !existingIds.has(p.id));
        if (toInsert.length > 0) {
          await tx.insert(figures).values(
            toInsert.map((p) => ({
              id: p.id,
              ownerId: userId,
              projectId,
              title: p.title,
              content: { elements: p.elements } as never,
            }))
          );
        }

        // Updates stay per-row because each page has its own title/content
        // and postgres has no native "update many rows with different
        // values" without a VALUES CTE. N here is just the dirty page
        // count — usually 1.
        const toUpdate = delta.pages.filter((p) => existingIds.has(p.id));
        for (const page of toUpdate) {
          await tx
            .update(figures)
            .set({
              title: page.title,
              content: { elements: page.elements } as never,
              updatedAt: new Date(),
            })
            .where(
              and(eq(figures.id, page.id), eq(figures.ownerId, userId))
            );
        }
      }

      return { ok: true } as const;
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to save project",
    };
  }
}
