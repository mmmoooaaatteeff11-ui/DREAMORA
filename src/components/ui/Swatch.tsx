'use client';

import { forwardRef } from 'react';
import type { MouseEventHandler } from 'react';
import { cn } from '@/lib/utils';

type SwatchProps = {
  color: string;
  label: string;
  selected: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  className?: string;
};

export const Swatch = forwardRef<HTMLButtonElement, SwatchProps>(function Swatch(
  { color, label, selected, onClick, className },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-label={label}
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--w-border)] transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--w-accent)]',
        selected
          ? 'ring-2 ring-[var(--w-accent)] ring-offset-2 ring-offset-[var(--w-base)]'
          : 'hover:ring-1 hover:ring-[var(--w-accent)]',
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {selected && (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--w-base)] text-[var(--w-ink)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-5 w-5"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
        </span>
      )}
    </button>
  );
});
