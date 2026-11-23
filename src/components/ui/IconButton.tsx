import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type IconButtonName = 'close' | 'panel';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconButtonName;
  'aria-label': string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[var(--w-border)] bg-transparent text-[var(--w-ink)] transition',
        'hover:bg-[var(--w-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--w-accent)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-5 w-5 rtl:-scale-x-100"
      >
        {icon === 'close' ? (
          <path d="m6 6 12 12M18 6 6 18" />
        ) : (
          <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M14 4v16" />
          </>
        )}
      </svg>
    </button>
  );
});
