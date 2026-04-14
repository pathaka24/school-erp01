'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  color?: string;
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, color, ...props }, ref) => {
    const pct = Math.min((value / max) * 100, 100);
    const autoColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div ref={ref} className={cn('relative h-3 w-full overflow-hidden rounded-full bg-slate-100', className)} {...props}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', color || autoColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
