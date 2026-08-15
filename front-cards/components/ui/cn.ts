/**
 * cn — minimal class-name joiner (zero deps).
 * Filters falsy values and joins with a space. No clsx/tailwind-merge.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
