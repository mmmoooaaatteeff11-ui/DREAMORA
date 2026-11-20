import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass animate-fade-in p-6 sm:p-8', className)} {...props} />;
}
