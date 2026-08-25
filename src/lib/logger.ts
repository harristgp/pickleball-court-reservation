type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
  if (entry.context && Object.keys(entry.context).length > 0) {
    return `${base} ${JSON.stringify(entry.context)}`;
  }
  return base;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  };

  const line = formatEntry(entry);

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Sanitize an error for safe client-facing display.
 * Never leaks stack traces or internal details.
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('Unique constraint')) return 'A conflict occurred. Please try again.';
    if (error.message.includes('Foreign key')) return 'Referenced record not found.';
    if (error.message.includes('Record to update not found')) return 'Record not found.';
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Server-side logger. Writes structured JSON to stdout/stderr,
 * which Vercel collects automatically in function logs.
 */
export const logger = {
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
};
