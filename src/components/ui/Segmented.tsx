'use client';

import { useRef } from 'react';
import { useLocale } from 'next-intl';
import type { ReactNode, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export type SegmentOption = {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
};

export function Segmented({
  value,
  options,
  label,
  onChange,
  className,
}: {
  value: string;
  options: SegmentOption[];
  label: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const locale = useLocale();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const reverse = locale === 'ar';
    const forwardKey = reverse ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = reverse ? 'ArrowRight' : 'ArrowLeft';
    let nextIndex: number | undefined;

    if (event.key === forwardKey || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % options.length;
    } else if (event.key === backwardKey || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + options.length) % options.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = options.length - 1;
    }

    if (nextIndex === undefined) return;
    event.preventDefault();
    const option = options[nextIndex];
    if (!option) return;
    onChange(option.value);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex min-h-11 flex-wrap items-center gap-2 rounded-[10px] border border-[var(--w-border)] bg-[var(--w-surface)] p-1',
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = value === option.value;
        return (
          <button
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (!options.some((item) => item.value === value) && index === 0) ? 0 : -1}
            key={option.value}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[10px] px-3 text-sm font-medium text-[var(--w-ink)] transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--w-accent)]',
              selected
                ? 'border border-[var(--w-primary)] bg-[var(--w-surface-2)] ring-1 ring-[var(--w-accent)]'
                : 'border border-transparent hover:bg-[var(--w-surface-2)]',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
