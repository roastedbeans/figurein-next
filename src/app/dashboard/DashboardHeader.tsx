import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "../login/actions";

export function DashboardHeader({
  email,
  breadcrumbs,
}: {
  email: string | null | undefined;
  breadcrumbs?: React.ReactNode;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-3 text-sm">
        <Link
          href="/dashboard"
          className="font-semibold tracking-tight hover:text-primary"
        >
          FigurIn
        </Link>
        {breadcrumbs && (
          <>
            <span className="text-muted-foreground">/</span>
            {breadcrumbs}
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {email && (
          <span className="text-sm text-muted-foreground">{email}</span>
        )}
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
