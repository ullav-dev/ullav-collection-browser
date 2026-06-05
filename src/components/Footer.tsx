"use client";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 py-3 shrink-0">
      <div className="max-w-full px-4 sm:px-6 flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>© {new Date().getFullYear()} Ullav. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px]">
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"} ({process.env.NEXT_PUBLIC_GIT_SHA ?? "dev"})
          </span>
        </div>
      </div>
    </footer>
  );
}
