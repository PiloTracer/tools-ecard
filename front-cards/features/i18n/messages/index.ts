import { enMessages } from './en';
import { esMessages } from './es';
import type { Locale } from '../types';

export const messagesByLocale: Record<Locale, typeof enMessages> = {
  en: enMessages,
  es: esMessages,
};

export { enMessages, esMessages };
