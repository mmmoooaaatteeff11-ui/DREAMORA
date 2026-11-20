import { cn } from '@/lib/utils';

export function Alert({
  tone = 'error',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: 'error' | 'success' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        tone === 'error'
          ? 'border-red-400/30 bg-red-500/10 text-red-200'
          : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
        className,
      )}
      {...props}
    />
  );
}
