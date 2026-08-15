import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** interactive cards gain hover affordance + accent border */
  variant?: 'default' | 'interactive';
  /** elevation tier: 1 = shadow-elevation-1, 2 = default, 3 = prominent */
  elevation?: 1 | 2 | 3;
}

/**
 * Card — elevated surface container (tokens: --surface-elevated + --elevation-shadow-*).
 * Primitive per UI foundation doc 03 / CATALOG row.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', elevation = 2, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-testid="ui-card"
      className={cn(
        'rounded-lg bg-surface-elevated border border-border-subtle',
        elevation === 1 && 'shadow-elevation-1',
        elevation === 2 && 'shadow-elevation-2',
        elevation === 3 && 'shadow-elevation-3',
        variant === 'interactive' &&
          'cursor-pointer transition-colors hover:border-accent hover:shadow-elevation-3',
        className,
      )}
      {...props}
    />
  );
});
