/**
 * Structured Logging Utility
 * Uses Pino for high-performance, structured JSON logging
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = (process.env.LOG_LEVEL || 'info') as pino.Level;

/**
 * Main logger instance
 * Configured based on environment
 */
export const logger = pino({
  level: logLevel,
  // Use pino-pretty in development for readable output
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
          messageFormat: '{module} | {msg}',
          singleLine: false,
        },
      }
    : undefined,
  // Base configuration
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

/**
 * Create a logger for a specific module/feature
 * @param module Module or feature name (e.g., 'TemplateStorage', 'Auth')
 * @returns Child logger with module context
 */
export const createLogger = (module: string) => {
  return logger.child({ module });
};

/**
 * Log levels guide:
 * - trace (5): Very detailed debugging (e.g., function entry/exit)
 * - debug (4): Detailed debugging info (e.g., variable values, state)
 * - info (3): General informational messages (e.g., "User logged in")
 * - warn (2): Warning conditions (e.g., "Deprecated API used")
 * - error (1): Error conditions (e.g., "Failed to save template")
 * - fatal (0): Critical errors that cause shutdown
 */

/**
 * Usage examples:
 *
 * Basic logging:
 * ```typescript
 * const log = createLogger('TemplateStorage');
 * log.info('Template saved successfully');
 * log.error('Failed to save template');
 * ```
 *
 * With context:
 * ```typescript
 * log.info({ templateId, userId }, 'Template saved');
 * log.error({ error, templateId }, 'Save failed');
 * ```
 *
 * Different levels:
 * ```typescript
 * log.trace({ detail }, 'Very detailed trace');
 * log.debug({ state }, 'Debug info');
 * log.info({ count }, 'Info message');
 * log.warn({ deprecated }, 'Warning');
 * log.error({ error }, 'Error occurred');
 * log.fatal({ error }, 'Fatal error');
 * ```
 */
