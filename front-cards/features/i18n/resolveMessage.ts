import type { MessageParams, MessageTree } from './types';

export function resolveMessage(
  messages: MessageTree,
  key: string,
  params?: MessageParams
): string {
  const parts = key.split('.');
  let current: string | MessageTree = messages;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      return key;
    }
    current = current[part];
  }

  if (typeof current !== 'string') {
    return key;
  }

  if (!params) {
    return current;
  }

  return current.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token];
    return value === undefined ? `{${token}}` : String(value);
  });
}
