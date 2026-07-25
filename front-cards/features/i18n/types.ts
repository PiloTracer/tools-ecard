import type { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './constants';

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type DefaultLocale = typeof DEFAULT_LOCALE;

export type MessageParams = Record<string, string | number>;

export type MessageTree = {
  readonly [key: string]: string | MessageTree;
};
