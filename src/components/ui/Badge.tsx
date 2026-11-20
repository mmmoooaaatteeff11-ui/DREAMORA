import { cn } from '@/lib/utils';

type Tone = 'muted' | 'primary' | 'gold';

const tones: Record<Tone, string> = {
  muted: 'border-glass-border bg-glass text-muted',
  primary: 'border-primary/40 bg-primary/15 text-primary-light',
  // Gold is reserved for highlights, badges and streaks.
  gold: 'border-gold/40 bg-gold/10 text-gold',
};

export function Badge({
  tone = 'muted',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}
      {...props}
    />
  );
}
