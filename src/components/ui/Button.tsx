
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: `
    bg-primary
    text-base
    border border-transparent
    hover:bg-primary-dark
    active:bg-[#C9C2B4]
  `,

  secondary: `
    bg-card-hover
    text-ink
    border border-border
    hover:bg-card-elevated
    active:bg-card
  `,

  outline: `
    bg-transparent
    text-primary
    border border-border-strong
    hover:bg-card
    hover:border-muted
  `,

  ghost: `
    bg-transparent
    text-muted
    border border-transparent
    hover:bg-card
    hover:text-ink
  `,

  danger: `
    bg-danger
    text-base
    border border-transparent
    hover:opacity-90
  `,
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4 text-sm',
  md: 'min-h-11 px-6 text-sm',
  lg: 'min-h-12 px-8 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`
        inline-flex
        items-center
        justify-center
        gap-2
        rounded-full
        font-semibold
        tracking-normal
        transition-colors
        duration-200
        ease-in-out
        focus-visible:outline
        focus-visible:outline-2
        focus-visible:outline-offset-2
        focus-visible:outline-[#A9B2A7]
        active:scale-[0.98]
        disabled:cursor-not-allowed
        disabled:opacity-45
        disabled:active:scale-100
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="
            h-4 w-4
            animate-spin
            rounded-full
            border-2
            border-current
            border-e-transparent
          "
        />
      )}

      {children}
    </button>
  );
}

export default Button;
