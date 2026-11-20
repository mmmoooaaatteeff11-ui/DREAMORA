import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ name, label, error, hint, className, ...props }: InputProps) {
  const id = props.id ?? name;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        {...props}
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-12 w-full rounded-xl border bg-glass px-4 text-ink outline-none transition-colors',
          'placeholder:text-muted/70 focus:ring-2 focus:ring-primary-light/40',
          error ? 'border-red-400/70' : 'border-glass-border hover:border-white/20 focus:border-primary-light',
          className,
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
