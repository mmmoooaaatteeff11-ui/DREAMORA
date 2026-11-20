import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  // Gradient stays in the violet-700 → primary range so white text keeps ≥4.5:1 contrast.
  primary:
    'bg-gradient-to-r from-[#6D28D9] to-primary text-white shadow-glow hover:brightness-110 active:brightness-95',
  ghost: 'border border-glass-border bg-glass text-ink hover:bg-white/10',
};

export function Button({ variant = 'primary', loading = false, className, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2 rounded-pill px-6 text-base font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      {children}
    </button>
  );
}
