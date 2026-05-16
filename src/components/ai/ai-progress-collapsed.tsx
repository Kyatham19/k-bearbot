'use client';

interface CollapsedProps {
  text: string;
}

export function AIProgressCollapsed({ text }: CollapsedProps) {
  return (
    <div className="flex h-12 items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
          <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
        </div>

        <span className="truncate text-sm font-medium tracking-tight text-white/82 transition-opacity duration-300 ease-out">
          {text}
        </span>
      </div>

      <div className="hidden flex-shrink-0 text-xs text-white/38 transition-colors duration-200 sm:block">expand</div>
    </div>
  );
}
