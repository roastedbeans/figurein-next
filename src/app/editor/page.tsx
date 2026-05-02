import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EditorLayout } from "@/components/editor/EditorLayout";

// Server-side guard: the editor is only meaningful when bound to a figure.
// Hitting /editor with no ?id= falls back to the dashboard rather than
// booting an orphaned in-memory session. EditorLayout still reads the id
// via useSearchParams, which is why the Suspense boundary stays.
export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) redirect("/dashboard");

  return (
    <Suspense fallback={null}>
      <EditorLayout />
    </Suspense>
  );
}
