import { Outlet, Link } from 'react-router-dom';
import { Sparkles, Stars } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_hsl(221_83%_53%_/_0.12),_transparent_30%),radial-gradient(circle_at_top_right,_hsl(262_83%_58%_/_0.12),_transparent_26%)]" />
      <div className="absolute -left-20 top-12 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />

      <div className="relative z-10 flex w-full max-w-md flex-col gap-6">
        <Link to="/" className="group flex items-center justify-center gap-3 self-center rounded-full border bg-card/90 px-4 py-2.5 shadow-[0_20px_40px_rgba(15,23,42,0.08)] backdrop-blur transition-transform hover:-translate-y-0.5">
          <div className="rounded-full bg-primary/10 p-2 text-primary shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Odd Note</span>
            <span className="text-lg font-bold tracking-tight text-foreground">Capture ideas beautifully</span>
          </div>
          <Stars className="h-4 w-4 text-primary opacity-70 transition-transform group-hover:rotate-12" />
        </Link>
        <Outlet />
      </div>
    </div>
  );
}
