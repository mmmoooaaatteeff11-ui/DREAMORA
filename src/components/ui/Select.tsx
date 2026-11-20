import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  name: string;
  label: string;
  error?: string;
}

export function Select({ name, label, error, className, children, ...props }: SelectProps) {
  const id = props.id ?? name;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        {...props}
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          'h-12 w-full rounded-xl border bg-glass px-4 text-ink outline-none transition-colors',
          'focus:ring-2 focus:ring-primary-light/40',
          error ? 'border-red-400/70' : 'border-glass-border hover:border-white/20 focus:border-primary-light',
          className,
        )}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
