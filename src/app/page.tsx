import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
      <h1 className="text-4xl font-bold tracking-tight">WOWWAI</h1>
      <p className="text-muted-foreground">
        Ways of Working With AI
      </p>
      <ThemeToggle />
    </div>
  );
}
