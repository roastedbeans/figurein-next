import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">FigureIn</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Create publication-ready scientific figures with AI
        </p>
      </div>
      <Link href="/editor">
        <Button size="lg" className="gap-2">
          Open Editor
          <ArrowRight className="size-4" />
        </Button>
      </Link>
    </div>
  );
}
