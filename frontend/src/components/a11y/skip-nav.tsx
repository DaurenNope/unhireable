import { cn } from '@/lib/utils';

type SkipNavLinkProps = {
  targetId?: string;
  label?: string;
  className?: string;
};

export function SkipNavLink({
  targetId = 'main-content',
  label = 'Skip to main content',
  className,
}: SkipNavLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:text-primary-foreground shadow-lg transition',
        className,
      )}
    >
      {label}
    </a>
  );
}



