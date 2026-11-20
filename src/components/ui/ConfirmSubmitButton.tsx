'use client';

/** Submit button that asks for confirmation first (used for destructive actions). */
export function ConfirmSubmitButton({
  confirmText,
  children,
  ...props
}: { confirmText: string } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'>) {
  return (
    <button
      {...props}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
