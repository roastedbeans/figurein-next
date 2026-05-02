import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { figures, projects } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "./DashboardHeader";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectTitleEditor } from "./ProjectTitleEditor";
import { Button } from "@/components/ui/button";
import { deleteProject } from "./actions";

function formatRelative(iso: string | Date) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const secs = Math.max(1, Math.round((now - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects unauthenticated visitors — this fallback
  // only triggers if the session expires between middleware and render.
  if (!user) return null;

  // Drizzle runs as service role; owner_id filter enforces ownership since
  // RLS doesn't apply on this connection. The figures join + count gives
  // each card a "N figures" badge without a second round trip.
  const rows = await db
    .select({
      id: projects.id,
      title: projects.title,
      description: projects.description,
      updatedAt: projects.updatedAt,
      figureCount: sql<number>`count(${figures.id})::int`.as("figure_count"),
    })
    .from(projects)
    .leftJoin(figures, eq(figures.projectId, projects.id))
    .where(eq(projects.ownerId, user.id))
    .groupBy(projects.id)
    .orderBy(desc(projects.updatedAt));

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader email={user.email} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground">
              Each project opens in the editor with its own set of canvases.
            </p>
          </div>
          <CreateProjectForm />
        </div>

        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No projects yet. Create your first one above.
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((p) => (
              <li
                key={p.id}
                className="group relative rounded-lg border bg-background p-4 transition-colors hover:border-primary/40"
              >
                <div className="mb-2">
                  <ProjectTitleEditor
                    projectId={p.id}
                    initialTitle={p.title}
                  />
                </div>
                <Link
                  href={`/editor?id=${p.id}`}
                  className="block outline-none"
                >
                  {p.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {p.figureCount} canvas{p.figureCount === 1 ? "" : "es"}
                    </span>
                    <span>Updated {formatRelative(p.updatedAt)}</span>
                  </div>
                </Link>
                <form
                  action={deleteProject}
                  className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <input type="hidden" name="projectId" value={p.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Delete
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
