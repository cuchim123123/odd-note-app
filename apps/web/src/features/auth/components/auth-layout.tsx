import { Outlet, Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
      
      <div className="w-full max-w-md relative z-10 flex flex-col gap-6">
        <Link to="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
          <div className="bg-primary/10 p-2 rounded-xl text-primary">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="font-bold text-2xl tracking-tight">odd note</span>
        </Link>
        <Outlet />
      </div>
    </div>
  );
}
