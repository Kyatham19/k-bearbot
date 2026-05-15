'use client';

interface CollapsedProps {
  taskName: string;
  ellipsis: number;
}

export function AIProgressCollapsed({ taskName, ellipsis }: CollapsedProps) {
  // Show 1, 2, or 3 dots based on ellipsis value
  const dots = '.'.repeat((ellipsis % 3) + 1);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 h-12">
      {/* Animated pulse indicator */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="w-1.5 h-1.5 bg-teal-400 rounded-full" />
          <div className="absolute inset-0 w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
        </div>

        {/* Task name with ellipsis */}
        <span className="text-sm font-medium text-white/85 tracking-tight truncate">
          {taskName}
          <span className="inline-block w-6">{dots}</span>
        </span>
      </div>

      {/* Small hint that it's clickable */}
      <div className="text-xs text-white/40 flex-shrink-0 hidden sm:block">expand</div>
    </div>
  );
}
