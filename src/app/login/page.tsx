import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only accept same-origin paths to avoid open-redirect on the "next"
  // parameter that the middleware round-trips through this page.
  const safeNext = next && next.startsWith("/") ? next : "/dashboard";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back to FigurIn.
          </p>
        </div>
        <LoginForm next={safeNext} />
      </div>
    </div>
  );
}
